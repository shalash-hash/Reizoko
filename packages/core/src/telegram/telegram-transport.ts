import type { PreparedPublicationSnapshot } from '@reizoko/shared';

export function splitTelegramCaption(text: string): { caption: string; overflow: string | null } {
  if (text.length <= TELEGRAM_CAPTION_MAX_LENGTH) {
    return { caption: text, overflow: null };
  }
  return {
    caption: text.slice(0, TELEGRAM_CAPTION_MAX_LENGTH),
    overflow: text.slice(TELEGRAM_CAPTION_MAX_LENGTH),
  };
}

export interface TelegramBotInfo {
  id: number;
  isBot: boolean;
  firstName: string;
  username?: string | null;
}

export interface TelegramChatInfo {
  id: number;
  type: string;
  title?: string | null;
  username?: string | null;
}

export interface TelegramChatValidation {
  chat: TelegramChatInfo;
  canPublish: boolean;
  reason?: string | null;
}

export interface TelegramPublishMediaItem {
  mediaId: string;
  localPath: string;
  mimeType?: string | null;
}

export interface TelegramPublishRequest {
  secretRef: string;
  chatId: string;
  snapshot: PreparedPublicationSnapshot;
  media: TelegramPublishMediaItem[];
  channelUsername?: string | null;
}

export interface TelegramPublishResponse {
  success: boolean;
  messageIds: number[];
  remoteUrl?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  retryAfterSeconds?: number | null;
  unauthorized?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TelegramTransport {
  connectBot(connectionId: string, botToken: string): Promise<TelegramBotInfo>;
  validateChat(secretRef: string, chatRef: string, botUserId: number): Promise<TelegramChatValidation>;
  sendMessage(
    secretRef: string,
    chatId: string,
    text: string,
    parseMode?: 'HTML' | 'Markdown',
  ): Promise<{ messageId: number }>;
  sendPhoto(
    secretRef: string,
    chatId: string,
    photoPath: string,
    caption?: string | null,
    parseMode?: 'HTML' | 'Markdown',
  ): Promise<{ messageId: number }>;
  sendMediaGroup(
    secretRef: string,
    chatId: string,
    photoPaths: string[],
    caption?: string | null,
    parseMode?: 'HTML' | 'Markdown',
  ): Promise<{ messageIds: number[] }>;
  deleteSecret(secretRef: string): Promise<void>;
  hasSecret(secretRef: string): Promise<boolean>;
}

export const TELEGRAM_CAPTION_MAX_LENGTH = 1024;
export const TELEGRAM_MEDIA_GROUP_MAX = 10;

export function buildTelegramPublicUrl(
  channelUsername: string | null | undefined,
  messageId: number,
): string | null {
  if (!channelUsername) return null;
  const normalized = channelUsername.replace(/^@/, '');
  if (!normalized) return null;
  return `https://t.me/${normalized}/${messageId}`;
}

export async function executeTelegramPublish(
  transport: TelegramTransport,
  request: TelegramPublishRequest,
): Promise<TelegramPublishResponse> {
  const { secretRef, chatId, snapshot, media } = request;
  const text = snapshot.transformedContent.text;
  const parseMode = 'HTML' as const;

  try {
    if (media.length === 0) {
      if (!text.trim()) {
        return { success: false, messageIds: [], errorMessage: 'Нет текста для публикации.' };
      }
      const result = await transport.sendMessage(secretRef, chatId, text, parseMode);
      return {
        success: true,
        messageIds: [result.messageId],
        remoteUrl: buildTelegramPublicUrl(request.channelUsername, result.messageId),
      };
    }

    if (media.length === 1) {
      const { caption, overflow } = splitTelegramCaption(text);
      const photo = await transport.sendPhoto(
        secretRef,
        chatId,
        media[0]!.localPath,
        caption || null,
        parseMode,
      );
      const messageIds = [photo.messageId];
      if (overflow) {
        const followUp = await transport.sendMessage(secretRef, chatId, overflow, parseMode);
        messageIds.push(followUp.messageId);
      }
      return {
        success: true,
        messageIds,
        remoteUrl: buildTelegramPublicUrl(request.channelUsername, photo.messageId),
      };
    }

    const { caption, overflow } = splitTelegramCaption(text);
    const group = await transport.sendMediaGroup(
      secretRef,
      chatId,
      media.map((item) => item.localPath),
      caption || null,
      parseMode,
    );
    const messageIds = [...group.messageIds];
    if (overflow) {
      const followUp = await transport.sendMessage(secretRef, chatId, overflow, parseMode);
      messageIds.push(followUp.messageId);
    }
    return {
      success: true,
      messageIds,
      remoteUrl: buildTelegramPublicUrl(request.channelUsername, group.messageIds[0] ?? 0),
    };
  } catch (error) {
    const message = error instanceof TelegramTransportError ? error.message : 'Не удалось опубликовать в Telegram.';
    return {
      success: false,
      messageIds: [],
      errorMessage: message,
      errorCode: error instanceof TelegramTransportError ? error.code : undefined,
      retryAfterSeconds: error instanceof TelegramTransportError ? error.retryAfterSeconds : undefined,
      unauthorized: error instanceof TelegramTransportError ? error.unauthorized : undefined,
    };
  }
}

export class TelegramTransportError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly retryAfterSeconds?: number | null,
    readonly unauthorized?: boolean,
  ) {
    super(message);
    this.name = 'TelegramTransportError';
  }
}
