import type {
  TelegramBotInfo,
  TelegramChatValidation,
  TelegramTransport,
} from './telegram-transport.js';
import { TelegramTransportError } from './telegram-transport.js';

export class FakeTelegramTransport implements TelegramTransport {
  readonly tokens = new Map<string, string>();
  readonly chats = new Map<string, { id: number; title: string; username?: string; canPublish: boolean }>();
  sentMessages: Array<Record<string, unknown>> = [];
  private messageCounter = 1;

  constructor(
    private readonly options?: {
      validToken?: string;
      invalidToken?: boolean;
      rateLimitAfter?: number;
    },
  ) {}

  async connectBot(connectionId: string, botToken: string): Promise<TelegramBotInfo> {
    if (this.options?.invalidToken || botToken === 'invalid') {
      throw new TelegramTransportError(
        'Не удалось подключить бота. Проверьте token и попробуйте ещё раз.',
        'unauthorized',
        null,
        true,
      );
    }
    const secretRef = `connection/${connectionId}/bot_token`;
    this.tokens.set(secretRef, botToken);
    if (!this.tokens.has(secretRef)) {
      throw new TelegramTransportError('SECRET_STORE_VERIFY_FAILED', 'unauthorized', null, true);
    }
    const alternateBot = botToken.startsWith('456:');
    return {
      id: alternateBot ? 888002 : 999001,
      isBot: true,
      firstName: alternateBot ? 'Other Bot' : 'Reizoko Test Bot',
      username: alternateBot ? 'other_test_bot' : 'reizoko_test_bot',
    };
  }

  registerChat(chatRef: string, chat: { id: number; title: string; username?: string; canPublish: boolean }) {
    this.chats.set(chatRef, chat);
  }

  async validateChat(
    secretRef: string,
    chatRef: string,
    _botUserId: number,
  ): Promise<TelegramChatValidation> {
    if (!this.tokens.has(secretRef)) {
      throw new TelegramTransportError('SECRET_MISSING', 'unauthorized', null, true);
    }
    const chat = this.chats.get(chatRef);
    if (!chat) {
      return {
        chat: { id: -100123, type: 'channel', title: chatRef, username: chatRef.replace('@', '') },
        canPublish: false,
        reason: 'Бот не является администратором канала или не может публиковать сообщения.',
      };
    }
    return {
      chat: {
        id: chat.id,
        type: 'channel',
        title: chat.title,
        username: chat.username ?? null,
      },
      canPublish: chat.canPublish,
      reason: chat.canPublish ? null : 'Недостаточно прав',
    };
  }

  async sendMessage(secretRef: string, chatId: string, text: string): Promise<{ messageId: number }> {
    this.ensureSecret(secretRef);
    const messageId = this.nextMessageId();
    this.sentMessages.push({ type: 'message', chatId, text, messageId });
    return { messageId };
  }

  async sendPhoto(
    secretRef: string,
    chatId: string,
    photoPath: string,
    caption?: string | null,
  ): Promise<{ messageId: number }> {
    this.ensureSecret(secretRef);
    const messageId = this.nextMessageId();
    this.sentMessages.push({ type: 'photo', chatId, photoPath, caption, messageId });
    return { messageId };
  }

  async sendMediaGroup(
    secretRef: string,
    chatId: string,
    photoPaths: string[],
    caption?: string | null,
  ): Promise<{ messageIds: number[] }> {
    this.ensureSecret(secretRef);
    const messageIds = photoPaths.map(() => this.nextMessageId());
    this.sentMessages.push({ type: 'media_group', chatId, photoPaths, caption, messageIds });
    return { messageIds };
  }

  async deleteSecret(secretRef: string): Promise<void> {
    this.tokens.delete(secretRef);
  }

  async hasSecret(secretRef: string): Promise<boolean> {
    return this.tokens.has(secretRef);
  }

  private ensureSecret(secretRef: string) {
    if (!this.tokens.has(secretRef)) {
      throw new TelegramTransportError('SECRET_MISSING', 'unauthorized', null, true);
    }
    if (this.options?.rateLimitAfter && this.sentMessages.length >= this.options.rateLimitAfter) {
      throw new TelegramTransportError('Too many requests', 'rate_limit', 30, false);
    }
  }

  private nextMessageId() {
    const id = this.messageCounter;
    this.messageCounter += 1;
    return id;
  }
}
