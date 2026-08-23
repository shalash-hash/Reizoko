import { generateId, nowIso, type PlatformConnection, type SocialAccount } from '@reizoko/shared';

import { buildSecretRef } from '@reizoko/shared';

import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';

import {

  ConnectionSecretMissingError,

  isConnectionSecretMissingError,

} from './connection-errors.js';
import { normalizeTelegramDestinationInput } from './telegram-destination-input.js';

import type {

  TelegramBotInfo,

  TelegramChatValidation,

  TelegramTransport,

} from './telegram-transport.js';



export interface TelegramConnectionResult {

  connection: PlatformConnection;

  bot: TelegramBotInfo;

}



export class TelegramConnectionService {

  constructor(

    private readonly connections: PlatformConnectionRepository,

    private readonly transport: TelegramTransport,

  ) {}



  async connectBot(botToken: string, existingConnectionId?: string | null): Promise<TelegramConnectionResult> {

    const connectionId = existingConnectionId ?? generateId();

    const secretRef = buildSecretRef(connectionId, 'bot_token');

    const bot = await this.transport.connectBot(connectionId, botToken);



    const secretExists = await this.transport.hasSecret(secretRef);

    if (!secretExists) {

      await this.transport.deleteSecret(secretRef).catch(() => undefined);

      throw new Error('SECRET_STORE_VERIFY_FAILED');

    }



    const now = nowIso();

    const handle = bot.username ? `@${bot.username}` : null;

    const displayName = bot.firstName ? `Telegram Bot ${bot.firstName}` : 'Telegram Bot';



    const existing = await this.connections.getById(connectionId);

    if (existing?.externalIdentityId && existing.externalIdentityId !== String(bot.id)) {

      await this.transport.deleteSecret(secretRef).catch(() => undefined);

      throw new Error('Подключён другой бот. Создайте новое подключение для другого token.');

    }



    const payload: PlatformConnection = {

      id: connectionId,

      platformId: 'telegram',

      method: 'bot_token',

      state: 'connected',

      externalIdentityId: String(bot.id),

      displayName,

      handle,

      connectedAt: now,

      lastValidatedAt: now,

      secretRef,

      errorCode: null,

      errorMessage: null,

      createdAt: existing?.createdAt ?? now,

      updatedAt: now,

    };



    const connection = existing

      ? await this.connections.update(connectionId, payload)

      : await this.connections.create(payload);

    return { connection, bot };

  }



  async verifyConnectionHealth(connection: PlatformConnection): Promise<PlatformConnection> {

    if (connection.state !== 'connected' || !connection.secretRef) {

      return connection;

    }

    const secretExists = await this.transport.hasSecret(connection.secretRef);

    if (secretExists) {

      return connection;

    }

    return this.connections.update(connection.id, {
      state: 'needs_reconnect',
      errorCode: 'secret_missing',
      errorMessage: null,
      lastValidatedAt: null,
    });

  }



  async verifyAllConnectionsHealth(connections: PlatformConnection[]): Promise<PlatformConnection[]> {

    return Promise.all(connections.map((connection) => this.verifyConnectionHealth(connection)));

  }



  async validateDestination(

    connection: PlatformConnection,

    chatRef: string,

  ): Promise<TelegramChatValidation> {

    const healthy = await this.verifyConnectionHealth(connection);

    if (healthy.state !== 'connected' || !healthy.secretRef || !healthy.externalIdentityId) {

      throw new ConnectionSecretMissingError('telegram');

    }

    const normalized = normalizeTelegramDestinationInput(chatRef);

    try {

      return await this.transport.validateChat(

        healthy.secretRef,

        normalized.apiChatId,

        Number(healthy.externalIdentityId),

      );

    } catch (error) {

      if (isConnectionSecretMissingError(error)) {

        await this.verifyConnectionHealth({

          ...healthy,

          state: 'connected',

          secretRef: healthy.secretRef,

        });

        throw new ConnectionSecretMissingError('telegram');

      }

      throw error;

    }

  }



  async markCredentialInvalid(
    connectionId: string,
    errorCode: string,
  ): Promise<PlatformConnection> {
    const existing = await this.connections.getById(connectionId);
    if (!existing) throw new Error(`Connection ${connectionId} not found`);
    return this.connections.update(connectionId, {
      state: 'needs_reconnect',
      errorCode,
      errorMessage: null,
      lastValidatedAt: null,
    });
  }

  async disconnect(connectionId: string): Promise<PlatformConnection> {

    const existing = await this.connections.getById(connectionId);

    if (!existing) throw new Error(`Connection ${connectionId} not found`);

    if (existing.secretRef) {

      await this.transport.deleteSecret(existing.secretRef);

    }

    return this.connections.update(connectionId, {

      state: 'needs_reconnect',

      secretRef: null,

      connectedAt: null,

      lastValidatedAt: null,

      errorCode: null,

      errorMessage: null,

    });

  }



  resolveAccountConnectionState(

    account: Pick<SocialAccount, 'connectionId'>,

    connection: PlatformConnection | null,

  ): SocialAccount['connectionState'] {

    if (!account.connectionId) return 'local';

    if (!connection || connection.state !== 'connected') {

      return 'needs_reconnect';

    }

    return 'connected';

  }

}


