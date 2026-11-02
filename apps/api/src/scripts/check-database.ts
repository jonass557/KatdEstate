/**
 * Diagnostic de connexion MongoDB.
 *
 * Usage : `npm run db:check` (depuis la racine ou `apps/api`).
 *
 * Ce script existe parce qu'une erreur de connexion Mongo est souvent noyée dans
 * un log applicatif. Ici, le résultat est sans ambiguïté et le code de sortie est
 * exploitable dans un pipeline : 0 si la base répond, 1 sinon.
 */

import { connectDatabase, disconnectDatabase, pingDatabase } from '../db/connection.js';
import { ConfigError, loadConfig } from '../config/index.js';
import { loadDotEnvFiles } from '../config/dotenv.js';

function print(lines: readonly string[]): void {
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main(): Promise<number> {
  loadDotEnvFiles();

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`\n${error.message}\n\n`);
      process.stderr.write('Copiez .env.example vers .env avant de relancer.\n');
      return 1;
    }
    throw error;
  }

  // L'URI peut contenir un mot de passe : on n'affiche que l'hôte et la base.
  const redactedUri = config.database.uri.replace(/\/\/([^@/]+)@/, '//***:***@');

  print(['', 'Diagnostic de connexion MongoDB', `  Cible : ${redactedUri}`, '']);

  try {
    await connectDatabase({
      uri: config.database.uri,
      serverSelectionTimeoutMs: config.database.serverSelectionTimeoutMs,
    });
  } catch (error) {
    print([
      '  Résultat : ÉCHEC',
      `  Motif    : ${error instanceof Error ? error.message : String(error)}`,
      '',
      '  Que faire ?',
      '    1. Vérifiez que MongoDB est démarré.',
      '    2. Avec Docker : npm run db:up',
      '    3. Sans Docker : démarrez un service MongoDB local sur le port 27017.',
      '    4. Vérifiez MONGODB_URI dans votre fichier .env.',
      '',
    ]);
    return 1;
  }

  const status = await pingDatabase();
  await disconnectDatabase();

  if (!status.connected) {
    print([
      '  Résultat : ÉCHEC',
      `  État     : ${status.state}`,
      `  Motif    : ${status.error ?? 'inconnu'}`,
      '',
    ]);
    return 1;
  }

  print([
    '  Résultat : SUCCÈS',
    `  État     : ${status.state}`,
    `  Latence  : ${status.latencyMs} ms`,
    '',
    '  La connexion MongoDB est opérationnelle.',
    '',
  ]);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`Erreur inattendue : ${String(error)}\n`);
    process.exitCode = 1;
  });
