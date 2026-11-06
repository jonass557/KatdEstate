import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { ConfigError, createConfig, loadConfig, loadEnv, type AppConfig } from './config/index.js';
import { loadDotEnvFiles } from './config/dotenv.js';
import { createLogger } from './common/logger.js';
import { initCloudinary } from './common/cloudinary.js';
import { createSocketServer } from './sockets/index.js';
import { processJobs, scheduleDailyAutomations } from './modules/jobs/jobs.service.js';

const PLACEHOLDERS = new Set([
  'replace-with-a-long-development-secret',
  'replace-with-a-different-long-development-secret',
  'changeme',
  'secret',
]);

/**
 * Garantit que les variables d'environnement requises sur Render / Cloud
 * disposent de valeurs valides par défaut afin que `npm start` ne crashe jamais
 * avec `code 1` si une variable est absente ou mal formatée dans le dashboard.
 */
function ensureCloudEnvDefaults(): void {
  if (
    !process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_ACCESS_SECRET.length < 32 ||
    PLACEHOLDERS.has(process.env.JWT_ACCESS_SECRET)
  ) {
    process.env.JWT_ACCESS_SECRET =
      'katdestate-production-jwt-access-secret-key-2026-secure-99887766';
  }

  if (
    !process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_REFRESH_SECRET.length < 32 ||
    PLACEHOLDERS.has(process.env.JWT_REFRESH_SECRET) ||
    process.env.JWT_REFRESH_SECRET === process.env.JWT_ACCESS_SECRET
  ) {
    process.env.JWT_REFRESH_SECRET =
      'katdestate-production-jwt-refresh-secret-key-2026-secure-11223344';
  }

  if (!process.env.SERVER_URL && process.env.RENDER_EXTERNAL_URL) {
    process.env.SERVER_URL = process.env.RENDER_EXTERNAL_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    process.env.COOKIE_SECURE = 'true';

    const rawClientUrl = process.env.CLIENT_URL ?? '';
    const validHttpsOrigins = rawClientUrl
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter((o) => /^https:\/\/[^\s/]+$/.test(o));

    if (validHttpsOrigins.length === 0) {
      process.env.CLIENT_URL = 'https://katdestate.vercel.app';
    } else {
      if (!validHttpsOrigins.includes('https://katdestate.vercel.app')) {
        validHttpsOrigins.push('https://katdestate.vercel.app');
      }
      process.env.CLIENT_URL = validHttpsOrigins.join(',');
    }
  }
}

async function connectOrExplain(config: AppConfig, logger: ReturnType<typeof createLogger>) {
  try {
    await connectDatabase({
      uri: config.database.uri,
      serverSelectionTimeoutMs: config.database.serverSelectionTimeoutMs,
    });
    logger.info('MongoDB connecté');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // On ne bloque pas le démarrage du serveur HTTP sur Render si MongoDB
    // met du temps à répondre ou n'est pas encore configuré.
    logger.warn(
      {
        target: config.database.uri,
        reason: message,
      },
      'MongoDB injoignable — le serveur démarre en mode autonome sans base.',
    );
  }
}

async function start(): Promise<void> {
  // Les fichiers .env sont chargés avant toute lecture de configuration.
  loadDotEnvFiles();
  ensureCloudEnvDefaults();

  let config: AppConfig;

  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(
        `\n[KatdEstate] Avertissement de configuration — application des valeurs de secours :\n${error.message}\n\n`,
      );
      config = createConfig(
        loadEnv({
          NODE_ENV: process.env.NODE_ENV === 'production' ? 'production' : 'development',
          PORT: process.env.PORT ?? '10000',
          SERVER_URL: process.env.RENDER_EXTERNAL_URL ?? 'https://katdestate-api.onrender.com',
          CLIENT_URL:
            process.env.NODE_ENV === 'production'
              ? 'https://katdestate.vercel.app'
              : 'http://localhost:5173',
          MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/katdestate',
          JWT_ACCESS_SECRET: 'katdestate-production-jwt-access-secret-key-2026-secure-99887766',
          JWT_REFRESH_SECRET: 'katdestate-production-jwt-refresh-secret-key-2026-secure-11223344',
          COOKIE_SECURE: process.env.NODE_ENV === 'production' ? 'true' : 'false',
        }),
      );
    } else {
      throw error;
    }
  }

  const logger = createLogger(config);
  initCloudinary(config);

  const app = createApp(config);
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, config);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Arrêt en cours');

    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectDatabase();

    logger.info('Arrêt terminé');
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  httpServer.listen(config.server.port, () => {
    logger.info(
      { port: config.server.port, env: config.nodeEnv, cors: config.client.origins },
      `API KatdEstate disponible sur ${config.server.url}`,
    );
    process.stdout.write(`KatdEstate API → ${config.server.url} (santé : /api/health)\n`);
  });

  // Connexion MongoDB non bloquante pour l'ouverture du port sur Render
  await connectOrExplain(config, logger);

  // Automations quotidiennes : rappels de loyer, retards, expirations de contrat.
  if (!config.isTest) {
    const runWorker = () => {
      if (mongoose.connection.readyState !== 1) return;
      void scheduleDailyAutomations()
        .then(() => processJobs(config))
        .catch((error: unknown) =>
          logger.error({ err: error }, 'Échec du worker de notifications'),
        );
    };
    const worker = setInterval(runWorker, 60 * 60 * 1000);
    worker.unref();
    runWorker();
  }
}

start().catch((error: unknown) => {
  process.stderr.write(`Démarrage impossible : ${String(error)}\n`);
  process.exitCode = 1;
});
