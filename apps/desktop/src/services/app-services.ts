import {
  FakeTelegramTransport,
  FakeVkTransport,
  InMemorySecretStore,
  PlatformConnectionService,
  PublicationService,
  TelegramConnectionService,
  VkConnectionService,
  type TelegramTransport,
  type VkTransport,
} from '@reizoko/core';
import type { DatabaseContext } from '@reizoko/database';
import { platformRegistry } from '@reizoko/platform-sdk';
import { isSmokeTestMode } from '../config/smoke-test';
import { createSecretStore } from './secret-store';
import { createTelegramTransport } from './telegram-runtime';
import { createVkTransport } from './vk-runtime';

let smokeTelegramTransport: FakeTelegramTransport | null = null;
let smokeVkTransport: FakeVkTransport | null = null;

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

export function getSmokeVkTransport(): FakeVkTransport {
  if (!smokeVkTransport) {
    smokeVkTransport = new FakeVkTransport();
  }
  return smokeVkTransport;
}

export interface AppServices {
  publicationService: PublicationService;
  telegramConnectionService: TelegramConnectionService;
  vkConnectionService: VkConnectionService;
  platformConnectionService: PlatformConnectionService;
  telegramTransport: TelegramTransport;
  vkTransport: VkTransport;
}

export function createAppServices(db: DatabaseContext): AppServices {
  const telegramTransport = isSmokeTestMode()
    ? getSmokeTelegramTransport()
    : createTelegramTransport();
  const vkTransport = isSmokeTestMode() ? getSmokeVkTransport() : createVkTransport();
  const secretStore = isSmokeTestMode() ? new InMemorySecretStore() : createSecretStore();

  const platformConnectionService = new PlatformConnectionService(db.platformConnections, secretStore);
  const telegramConnectionService = new TelegramConnectionService(
    db.platformConnections,
    telegramTransport,
  );
  const vkConnectionService = new VkConnectionService(
    db.platformConnections,
    db.socialAccounts,
    vkTransport,
  );
  const publicationService = new PublicationService(
    db.content,
    db.publicationBatches,
    db.publications,
    platformRegistry,
    db.socialAccounts,
    db.platformConnections,
    telegramTransport,
    vkTransport,
  );

  return {
    publicationService,
    telegramConnectionService,
    vkConnectionService,
    platformConnectionService,
    telegramTransport,
    vkTransport,
  };
}
