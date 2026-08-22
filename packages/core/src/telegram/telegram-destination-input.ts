export type TelegramDestinationInputKind = 'username' | 'numeric_id';

export interface NormalizedTelegramDestination {
  kind: TelegramDestinationInputKind;
  apiChatId: string;
  displayValue: string;
}

export type TelegramDestinationInputErrorCode =
  | 'empty'
  | 'invalid_url'
  | 'invite_link'
  | 'invalid_format';

export class TelegramDestinationInputError extends Error {
  readonly code: TelegramDestinationInputErrorCode;

  constructor(code: TelegramDestinationInputErrorCode, message: string) {
    super(message);
    this.name = 'TelegramDestinationInputError';
    this.code = code;
  }
}

const TELEGRAM_HOSTS = new Set(['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me']);
const NUMERIC_CHAT_ID_PATTERN = /^-?\d+$/;
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

const INVITE_LINK_MESSAGE =
  'Ссылка-приглашение не подходит для подключения канала. Для приватного канала укажите его числовой Telegram ID.';

const INVALID_URL_MESSAGE =
  'Укажите ссылку Telegram (t.me/...), имя канала (@channel) или числовой ID.';

const INVALID_FORMAT_MESSAGE =
  'Не удалось распознать канал или чат. Укажите ссылку Telegram, имя @channel или числовой ID.';

function assertNotInviteLink(segment: string): void {
  const normalized = segment.trim();
  if (normalized.startsWith('+') || /^joinchat(?:\/|$)/i.test(normalized)) {
    throw new TelegramDestinationInputError('invite_link', INVITE_LINK_MESSAGE);
  }
}

function parseAbsoluteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TelegramDestinationInputError('invalid_url', INVALID_URL_MESSAGE);
  }

  const host = url.hostname.toLowerCase();
  if (!TELEGRAM_HOSTS.has(host)) {
    throw new TelegramDestinationInputError('invalid_url', INVALID_URL_MESSAGE);
  }

  const path = url.pathname.replace(/^\/+/, '').trim();
  if (!path) {
    throw new TelegramDestinationInputError('invalid_format', INVALID_FORMAT_MESSAGE);
  }

  const firstSegment = path.split('/')[0] ?? '';
  assertNotInviteLink(firstSegment);
  return firstSegment;
}

function parseTelegramPath(value: string): string | null {
  const match = value.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(.+)$/i);
  if (!match?.[1]) return null;

  const path = match[1].trim();
  const firstSegment = path.split('/')[0] ?? '';
  assertNotInviteLink(firstSegment);
  return firstSegment;
}

function rejectNonTelegramAbsoluteUrl(value: string): void {
  if (!/^https?:\/\//i.test(value)) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TelegramDestinationInputError('invalid_url', INVALID_URL_MESSAGE);
  }

  const host = url.hostname.toLowerCase();
  if (!TELEGRAM_HOSTS.has(host)) {
    throw new TelegramDestinationInputError('invalid_url', INVALID_URL_MESSAGE);
  }
}

function normalizeUsernameSegment(segment: string): NormalizedTelegramDestination {
  const username = segment.replace(/^@+/, '').trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new TelegramDestinationInputError('invalid_format', INVALID_FORMAT_MESSAGE);
  }

  return {
    kind: 'username',
    apiChatId: `@${username}`,
    displayValue: `t.me/${username}`,
  };
}

export function normalizeTelegramDestinationInput(raw: string): NormalizedTelegramDestination {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new TelegramDestinationInputError('empty', INVALID_FORMAT_MESSAGE);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeUsernameSegment(parseAbsoluteUrl(trimmed));
  }

  const telegramPath = parseTelegramPath(trimmed);
  if (telegramPath) {
    return normalizeUsernameSegment(telegramPath);
  }

  rejectNonTelegramAbsoluteUrl(trimmed);

  if (trimmed.includes('t.me/+') || /joinchat/i.test(trimmed)) {
    throw new TelegramDestinationInputError('invite_link', INVITE_LINK_MESSAGE);
  }

  if (NUMERIC_CHAT_ID_PATTERN.test(trimmed)) {
    return {
      kind: 'numeric_id',
      apiChatId: trimmed,
      displayValue: trimmed,
    };
  }

  return normalizeUsernameSegment(trimmed);
}
