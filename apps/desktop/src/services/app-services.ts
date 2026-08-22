import {
  FakeTelegramTransport,
  InMemorySecretStore,
  PlatformConnectionService,
  PublicationService,
  TelegramConnectionService,
  type TelegramTransport,
} from '@reizoko/core';
import type { DatabaseContext } from '@reizoko/database';
import { platformRegistry } from '@reizoko/platform-sdk';
import { isSmokeTestMode } from '../config/smoke-test';
import { createSecretStore } from './secret-store';
import { createTelegramTransport } from './telegram-runtime';

let smokeTelegramTransport: FakeTelegramTransport | null = null;

export function getSmokeTelegramTransport(): FakeTelegramTransport {
  if (!smokeTelegramTransport) {
    smokeTelegramTransport = new FakeTelegramTransport();
    smokeTelegramTransport.registerChat('@reizoko_smoke', {
      id: -100999001,
      title: 'Reizoko Smoke Channel',
      username: 'reizoko_smoke',
      canPublish: true,
    });
  }
  return smokeTelegramTransport;
}

export interface AppServices {
  publicationService: PublicationService;
  telegramConnectionService: TelegramConnectionService;
  platformConnectionService: PlatformConnectionService;
  telegramTransport: TelegramTransport;
}

export function createAppServices(db: DatabaseContext): AppServices {
  const telegramTransport = isSmokeTestMode()
    ? getSmokeTelegramTransport()
    : createTelegramTransport();
  const secretStore = isSmokeTestMode() ? new InMemorySecretStore() : createSecretStore();

  const platformConnectionService = new PlatformConnectionService(db.platformConnections, secretStore);
  const telegramConnectionService = new TelegramConnectionService(
    db.platformConnections,
    telegramTransport,
  );
  const publicationService = new PublicationService(
    db.content,
    db.publicationBatches,
    db.publications,
    platformRegistry,
    db.socialAccounts,
    db.platformConnections,
    telegramTransport,
  );

  return {
    publicationService,
    telegramConnectionService,
    platformConnectionService,
    telegramTransport,
  };
}
