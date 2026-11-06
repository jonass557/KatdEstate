import { randomUUID } from 'node:crypto';
import type { Role } from '@rentflow/shared';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll } from 'vitest';
import type { AppConfig } from '../config/index.js';
import { createConfig, loadEnv } from '../config/index.js';
import { hashPassword } from '../common/password.js';
import { signAccessToken } from '../common/tokens.js';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { Membership, Organization, Session, User } from '../models/identity.js';
import { createApp } from '../app.js';

export const testConfig: AppConfig = createConfig(
  loadEnv({
    NODE_ENV: 'test',
    PORT: '4000',
    SERVER_URL: 'http://localhost:4000',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/unused',
    CLIENT_URL: 'http://localhost:5173',
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv),
);

let memory: MongoMemoryServer | undefined;

export async function startTestDatabase(): Promise<void> {
  memory = await MongoMemoryServer.create();
  await connectDatabase({ uri: memory.getUri(), serverSelectionTimeoutMs: 10_000 });
}

export async function stopTestDatabase(): Promise<void> {
  await disconnectDatabase();
  await memory?.stop();
}

export function useTestDatabase(): void {
  beforeAll(startTestDatabase, 300_000);
  afterAll(stopTestDatabase, 60_000);
}

export interface TestActor {
  userId: string;
  organizationId: string;
  token: string;
}

/** Crée une organisation, un utilisateur et sa membership, puis signe un jeton. */
export async function createActor(role: Role, organizationId?: string): Promise<TestActor> {
  const unique = randomUUID().slice(0, 8);
  const organization =
    organizationId ??
    String(
      (
        await Organization.create({
          name: `Org ${unique}`,
          slug: `org-${unique}`,
          country: 'SN',
          currency: 'XOF',
          timezone: 'Africa/Dakar',
          locale: 'fr',
        })
      )._id,
    );

  const user = await User.create({
    emailNormalized: `${role.toLowerCase()}-${unique}@example.com`,
    displayName: role,
    passwordHash: await hashPassword('motdepasse-tres-long'),
  });
  await Membership.create({
    organizationId: organization,
    userId: user._id,
    role,
    status: 'ACTIVE',
  });

  const session = await Session.create({
    userId: user._id,
    jti: randomUUID(),
    tokenHash: 'test',
    familyId: randomUUID(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const { token } = signAccessToken(
    { userId: String(user._id), sessionId: String(session._id), jti: session.jti },
    testConfig.tokens,
  );
  return { userId: String(user._id), organizationId: organization, token };
}

export function api() {
  return request(createApp(testConfig));
}

export function authed(actor: TestActor) {
  return { Authorization: `Bearer ${actor.token}` };
}
