import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createConfig, loadEnv } from './config/index.js';

/**
 * Environnement de test explicite.
 *
 * Les secrets sont générés à la volée : aucun secret réel ne doit apparaître
 * dans le dépôt, y compris dans les tests.
 */
const testConfig = createConfig(
  loadEnv({
    NODE_ENV: 'test',
    PORT: '4000',
    SERVER_URL: 'http://localhost:4000',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/rentflow_test',
    CLIENT_URL: 'http://localhost:5173,http://localhost:4173',
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv),
);

describe('Fondation de l’API', () => {
  const app = createApp(testConfig);

  describe('enveloppe de succès', () => {
    it('expose /api/health avec success: true et un requestId', async () => {
      const response = await request(app).get('/api/health');

      // Sans base de données, la sonde répond 503 : les deux cas sont acceptables
      // ici, ce qui est vérifié est la forme de l'enveloppe.
      expect([200, 503]).toContain(response.status);
      expect(response.headers['x-request-id']).toBeTruthy();

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ok');
        expect(response.body.requestId).toBe(response.headers['x-request-id']);
      } else {
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('répond 200 sur /api/health/live sans dépendre de la base', async () => {
      const response = await request(app).get('/api/health/live');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('conserve l’alias versionné /api/v1/health/live', async () => {
      const response = await request(app).get('/api/v1/health/live');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('enveloppe d’erreur', () => {
    it('renvoie { success: false, error: { code, message, requestId } } sur route inconnue', async () => {
      const response = await request(app).get('/api/v1/route-inexistante');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(typeof response.body.error.message).toBe('string');
      expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
      expect(response.body.data).toBeUndefined();
    });

    it('n’expose ni stack ni détail interne', async () => {
      const response = await request(app).get('/api/v1/route-inexistante');

      expect(JSON.stringify(response.body)).not.toContain('at ');
      expect(response.body.error.stack).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('accepte une origine présente dans CLIENT_URL', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .set('Origin', 'http://localhost:4173');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4173');
    });

    it('refuse une origine absente de CLIENT_URL', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .set('Origin', 'https://origine-malveillante.example');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('en-têtes de sécurité', () => {
    it('ne divulgue pas la stack technique', async () => {
      const response = await request(app).get('/api/health/live');

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('propage un X-Request-Id fourni par le client', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .set('X-Request-Id', 'req_test_correlation_1');

      expect(response.headers['x-request-id']).toBe('req_test_correlation_1');
      expect(response.body.requestId).toBe('req_test_correlation_1');
    });

    it('remplace un X-Request-Id malformé', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .set('X-Request-Id', 'valeur avec espaces !');

      expect(response.headers['x-request-id']).not.toBe('valeur avec espaces !');
      expect(response.headers['x-request-id']).toMatch(/^req_/);
    });
  });
});
