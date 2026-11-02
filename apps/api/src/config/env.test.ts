import { describe, expect, it } from 'vitest';
import { ConfigError, createConfig, loadEnv } from './index.js';

/**
 * La configuration est une frontière de sécurité : un secret faible ou une
 * origine non chiffrée doivent empêcher le démarrage. Ces tests verrouillent ce
 * comportement pour qu'il ne puisse pas régresser silencieusement.
 */

const VALID_SECRET_A = 'a'.repeat(48);
const VALID_SECRET_B = 'b'.repeat(48);

const baseEnv = {
  NODE_ENV: 'development',
  JWT_ACCESS_SECRET: VALID_SECRET_A,
  JWT_REFRESH_SECRET: VALID_SECRET_B,
} as NodeJS.ProcessEnv;

describe('loadEnv — validation', () => {
  it('accepte une configuration de développement complète', () => {
    const env = loadEnv(baseEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.CLIENT_URL).toEqual(['http://localhost:5173']);
  });

  it('refuse un access secret absent', () => {
    const env = { ...baseEnv } as NodeJS.ProcessEnv;
    delete env.JWT_ACCESS_SECRET;

    expect(() => loadEnv(env)).toThrow(ConfigError);
  });

  it('refuse un secret de moins de 32 caractères', () => {
    expect(() => loadEnv({ ...baseEnv, JWT_ACCESS_SECRET: 'trop-court' })).toThrow(ConfigError);
  });

  it('refuse deux secrets identiques', () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        JWT_ACCESS_SECRET: VALID_SECRET_A,
        JWT_REFRESH_SECRET: VALID_SECRET_A,
      }),
    ).toThrow(/différent/);
  });

  it('refuse une durée mal formée', () => {
    expect(() => loadEnv({ ...baseEnv, ACCESS_TOKEN_TTL: 'quinze minutes' })).toThrow(ConfigError);
  });

  it('refuse une origine CORS sans schéma', () => {
    expect(() => loadEnv({ ...baseEnv, CLIENT_URL: 'localhost:5173' })).toThrow(ConfigError);
  });

  it('découpe CLIENT_URL en liste d’origines nettoyées', () => {
    const env = loadEnv({
      ...baseEnv,
      CLIENT_URL: ' http://localhost:5173 , https://app.rentflow.africa/ ',
    });

    expect(env.CLIENT_URL).toEqual(['http://localhost:5173', 'https://app.rentflow.africa']);
  });

  it('accepte une variable optionnelle laissée vide dans .env', () => {
    // Cas réel : `COOKIE_DOMAIN=` dans un .env. Une chaîne vide n'est pas
    // `undefined`, elle doit donc être normalisée plutôt que rejetée.
    const env = loadEnv({ ...baseEnv, COOKIE_DOMAIN: '' });

    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });

  it('traite une valeur d’espaces seuls comme non définie', () => {
    const env = loadEnv({ ...baseEnv, COOKIE_DOMAIN: '   ' });

    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });

  it('nettoie les espaces autour d’une valeur optionnelle renseignée', () => {
    const env = loadEnv({ ...baseEnv, COOKIE_DOMAIN: '  .rentflow.africa  ' });

    expect(env.COOKIE_DOMAIN).toBe('.rentflow.africa');
  });

  it('énumère chaque problème dans le message d’erreur', () => {
    try {
      loadEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
      expect.unreachable('la validation aurait dû échouer');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const issues = (error as ConfigError).issues;
      expect(issues.some((issue) => issue.startsWith('JWT_ACCESS_SECRET'))).toBe(true);
      expect(issues.some((issue) => issue.startsWith('JWT_REFRESH_SECRET'))).toBe(true);
    }
  });
});

describe('loadEnv — garde-fous de production', () => {
  const productionEnv = {
    ...baseEnv,
    NODE_ENV: 'production',
    COOKIE_SECURE: 'true',
    CLIENT_URL: 'https://app.rentflow.africa',
  } as NodeJS.ProcessEnv;

  it('accepte une configuration de production correcte', () => {
    expect(() => loadEnv(productionEnv)).not.toThrow();
  });

  it('refuse un secret resté à sa valeur d’exemple', () => {
    expect(() =>
      loadEnv({
        ...productionEnv,
        JWT_ACCESS_SECRET: 'replace-with-a-long-development-secret',
      }),
    ).toThrow(/valeur d’exemple/);
  });

  it('exige COOKIE_SECURE=true', () => {
    expect(() => loadEnv({ ...productionEnv, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
  });

  it('exige des origines HTTPS', () => {
    expect(() => loadEnv({ ...productionEnv, CLIENT_URL: 'http://app.rentflow.africa' })).toThrow(
      /HTTPS/,
    );
  });
});

describe('createConfig', () => {
  it('dérive une configuration gelée et cohérente', () => {
    const config = createConfig(
      loadEnv({
        ...baseEnv,
        CLIENT_URL: 'http://localhost:5173,http://localhost:4173',
        REFRESH_TOKEN_TTL: '7d',
        COOKIE_DOMAIN: '.rentflow.africa',
      }),
    );

    expect(config.client.origins).toHaveLength(2);
    expect(config.client.primaryOrigin).toBe('http://localhost:5173');
    // 7 jours en millisecondes : le cookie et le refresh token expirent ensemble.
    expect(config.cookie.maxAgeMs).toBe(7 * 24 * 60 * 60 * 1_000);
    expect(config.cookie.domain).toBe('.rentflow.africa');
    expect(config.isProduction).toBe(false);
    expect(config.isDevelopment).toBe(true);
  });

  it('normalise SERVER_URL sans slash final', () => {
    const config = createConfig(
      loadEnv({ ...baseEnv, SERVER_URL: 'https://api.rentflow.africa/' }),
    );

    expect(config.server.url).toBe('https://api.rentflow.africa');
  });

  it('gèle la configuration pour empêcher toute mutation à l’exécution', () => {
    const config = createConfig(loadEnv(baseEnv));

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.tokens)).toBe(true);
    expect(() => {
      (config as { nodeEnv: string }).nodeEnv = 'production';
    }).toThrow();
  });
});
