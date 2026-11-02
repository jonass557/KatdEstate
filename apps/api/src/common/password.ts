import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

/**
 * Hachage de mots de passe — Argon2id.
 *
 * `@node-rs/argon2` applique Argon2id par défaut (algorithme recommandé) ; on ne
 * passe donc pas `algorithm` explicitement, ce qui évite au passage d'importer un
 * `const enum` incompatible avec `isolatedModules`.
 *
 * Paramètres alignés sur la recommandation OWASP « Argon2id » :
 * 19 MiB de mémoire, 2 passes, 1 thread.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify(passwordHash, password);
  } catch {
    // Un hash illisible ou corrompu ne doit pas produire une 500 : on refuse
    // simplement l'authentification.
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Hash factice utilisé lorsqu'aucun compte ne correspond à l'email fourni.
 * Vérifier un mot de passe contre ce hash coûte le même temps qu'une vérification
 * réelle, ce qui évite de révéler l'existence d'un compte par le temps de réponse.
 */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword('rentflow-dummy-password-never-matches');
  return dummyHash;
}
