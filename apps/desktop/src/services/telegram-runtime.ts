import { invoke } from '@tauri-apps/api/core';
import {
  TelegramTransportError,
  type TelegramBotInfo,
  type TelegramChatValidation,
  type TelegramTransport,
} from '@reizoko/core';

function mapInvokeError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
    if (message.includes('SECRET_MISSING') || /secure storage|No matching entry/i.test(message)) {
    throw new TelegramTransportError('SECRET_MISSING', 'unauthorized', null, true);
  }
  if (/SECRET_STORE_VERIFY_FAILED|CREDENTIAL_STORE_ERROR/i.test(message)) {
    throw new TelegramTransportError(message, 'secret_store', null, false);
  }
  if (message === 'TELEGRAM_CHAT_NOT_FOUND' || message.startsWith('TELEGRAM_CHAT_NOT_FOUND:')) {
    throw new TelegramTransportError('TELEGRAM_CHAT_NOT_FOUND', 'chat_not_found', null, false);
  }
  if (message === 'TELEGRAM_FORBIDDEN' || message.startsWith('TELEGRAM_FORBIDDEN:')) {
    throw new TelegramTransportError('TELEGRAM_FORBIDDEN', 'forbidden', null, false);
  }
  if (message.startsWith('TELEGRAM_NETWORK:')) {
    throw new TelegramTransportError(message, 'network', null, false);
  }
  if (message.startsWith('TELEGRAM_API:')) {
    throw new TelegramTransportError(message, 'telegram_api', null, false);
  }
  if (message === 'TELEGRAM_UNAUTHORIZED' || message.startsWith('UNAUTHORIZED:')) {
    throw new TelegramTransportError(
      'TELEGRAM_UNAUTHORIZED',
      'unauthorized',
      null,
      true,
    );
  }
  if (message.startsWith('RATE_LIMIT:')) {
    const [, retryAfter, ...rest] = message.split(':');
    throw new TelegramTransportError(
      rest.join(':') || 'Telegram rate limit',
      'rate_limit',
      Number(retryAfter) || null,
      false,
    );
  }
  if (message.toLowerCase().includes('unauthorized')) {
    throw new TelegramTransportError(
      'Не удалось подключить бота. Проверьте token и попробуйте ещё раз.',
      'unauthorized',
      null,
      true,
    );
  }
  throw new TelegramTransportError(message);
}

export class TauriTelegramTransport implements TelegramTransport {
  async connectBot(connectionId: string, botToken: string): Promise<TelegramBotInfo> {
    try {
      return await invoke<TelegramBotInfo>('telegram_connect_bot', { connectionId, token: botToken });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async validateChat(
    secretRef: string,
    chatRef: string,
    botUserId: number,
  ): Promise<TelegramChatValidation> {
    try {
      return await invoke<TelegramChatValidation>('telegram_validate_chat', {
        secretRef,
        chatRef,
        botUserId,
      });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async sendMessage(
    secretRef: string,
    chatId: string,
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML',
  ): Promise<{ messageId: number }> {
    try {
      const messageId = await invoke<number>('telegram_send_message', {
        secretRef,
        chatId,
        text,
        parseMode,
      });
      return { messageId };
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async sendPhoto(
    secretRef: string,
    chatId: string,
    photoPath: string,
    caption?: string | null,
    parseMode: 'HTML' | 'Markdown' = 'HTML',
  ): Promise<{ messageId: number }> {
    try {
      const messageId = await invoke<number>('telegram_send_photo', {
        secretRef,
        chatId,
        photoPath,
        caption,
        parseMode,
      });
      return { messageId };
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async sendMediaGroup(
    secretRef: string,
    chatId: string,
    photoPaths: string[],
    caption?: string | null,
    parseMode: 'HTML' | 'Markdown' = 'HTML',
  ): Promise<{ messageIds: number[] }> {
    try {
      const messageIds = await invoke<number[]>('telegram_send_media_group', {
        secretRef,
        chatId,
        photoPaths,
        caption,
        parseMode,
      });
      return { messageIds };
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async deleteSecret(secretRef: string): Promise<void> {
    await invoke('telegram_delete_secret', { secretRef });
  }

  async hasSecret(secretRef: string): Promise<boolean> {
    return invoke<boolean>('has_secret_command', { key: secretRef });
  }
}

export function createTelegramTransport(): TelegramTransport {
  return new TauriTelegramTransport();
}
