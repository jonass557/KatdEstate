import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { ConfigError, loadConfig, type AppConfig } from './config/index.js';
import { loadDotEnvFiles } from './config/dotenv.js';
import { createLogger } from './common/logger.js';
import { initCloudinary } from './common/cloudinary.js';
import { createSocketServer } from './sockets/index.js';
import { processJobs, scheduleDailyAutomations } from './modules/jobs/jobs.service.js';

/**
 * Amorçage du serveur.
 *
 * Séquence : configuration → journalisation → base → application → sockets.
 * Toute erreur de configuration est fatale : démarrer avec une sécurité
 * incomplète serait pire qu'un arrêt immédiat.
 */

async function connectOrExplain(config: AppConfig, logger: ReturnType<typeof createLogger>) {
  try {
    await connectDatabase({
      uri: config.database.uri,
      serverSelectionTimeoutMs: config.database.serverSelectionTimeoutMs,
    });
    logger.info('MongoDB connecté');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // En production, une base injoignable rend le service inutile : on échoue
    // immédiatement pour que l'orchestrateur redémarre l'instance.
    if (config.isProduction) {
      logger.fatal({ err: error }, 'MongoDB injoignable — arrêt du serveur');
      throw error;
    }

    // En développement, on continue : la sonde `/api/health` expliquera
    // précisément ce qui manque, ce qui est plus utile qu'un crash au démarrage.
    // On journalise un objet concis : sérialiser l'erreur Mongoose complète
    // déverse plusieurs kilo-octets de topologie dans les journaux.
    logger.warn(
      {
        target: config.database.uri,
        reason: message,
      },
      'MongoDB injoignable — le serveur démarre sans base. ' +
        'Lancez « npm run db:up » ou démarrez un serveur MongoDB, puis consultez GET /api/health.',
    );
  }
}

async function start(): Promise<void> {
  // Les fichiers .env sont chargés avant toute lecture de configuration.
  loadDotEnvFiles();

  let config: AppConfig;

  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      // Sortie directe sur stderr : le logger n'existe pas encore.
      process.stderr.write(`\n${error.message}\n\n`);
      process.stderr.write(
        'Copiez .env.example vers .env à la racine du dépôt, puis renseignez les valeurs manquantes.\n\n',
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const logger = createLogger(config);
  initCloudinary(config);
  await connectOrExplain(config, logger);

  const app = createApp(config);
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, config);

  // Automations quotidiennes : rappels de loyer, retards, expirations de contrat.
  // Le worker reprend les travaux interrompus grâce au verrou périssable.
  if (!config.isTest) {
    const runWorker = () => {
      if (mongoose.connection.readyState !== 1) return;
      void scheduleDailyAutomations()
        .then(() => processJobs(config))
        .catch((error: unknown) => logger.error({ err: error }, 'Échec du worker de notifications'));
    };
    const worker = setInterval(runWorker, 60 * 60 * 1000);
    worker.unref();
    runWorker();
  }

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
      `API RentFlow disponible sur ${config.server.url}`,
    );
    process.stdout.write(`RentFlow API → ${config.server.url} (santé : /api/health)\n`);
  });
}

start().catch((error: unknown) => {
  process.stderr.write(`Démarrage impossible : ${String(error)}\n`);
  process.exitCode = 1;
});
