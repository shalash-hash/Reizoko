import { describe, expect, it } from 'vitest';
import {
  normalizeTelegramDestinationInput,
  TelegramDestinationInputError,
} from './telegram-destination-input.js';
import { toUserFacingTelegramDestinationError } from './telegram-destination-errors.js';
import { TelegramTransportError } from './telegram-transport.js';

describe('normalizeTelegramDestinationInput', () => {
  it('normalizes bare username to @username', () => {
    expect(normalizeTelegramDestinationInput('reizoko_test')).toEqual({
      kind: 'username',
      apiChatId: '@reizoko_test',
      displayValue: 't.me/reizoko_test',
    });
  });

  it('keeps @username unchanged', () => {
    expect(normalizeTelegramDestinationInput('@reizoko_test')).toEqual({
      kind: 'username',
      apiChatId: '@reizoko_test',
      displayValue: 't.me/reizoko_test',
    });
  });

  it('normalizes t.me/username to @username', () => {
    expect(normalizeTelegramDestinationInput('t.me/reizoko_test')).toEqual({
      kind: 'username',
      apiChatId: '@reizoko_test',
      displayValue: 't.me/reizoko_test',
    });
  });

  it('normalizes https://t.me/username to @username', () => {
    expect(normalizeTelegramDestinationInput('https://t.me/reizoko_test')).toEqual({
      kind: 'username',
      apiChatId: '@reizoko_test',
      displayValue: 't.me/reizoko_test',
    });
  });

  it('normalizes http://t.me/username to @username', () => {
    expect(normalizeTelegramDestinationInput('http://t.me/reizoko_test')).toEqual({
      kind: 'username',
      apiChatId: '@reizoko_test',
      displayValue: 't.me/reizoko_test',
    });
  });

  it('trims whitespace around values', () => {
    expect(normalizeTelegramDestinationInput('  @reizoko_test  ')).toEqual({
      kind: 'username',
      apiChatId: '@reizoko_test',
      displayValue: 't.me/reizoko_test',
    });
  });

  it('accepts negative numeric chat id', () => {
    expect(normalizeTelegramDestinationInput('-1001234567890')).toEqual({
      kind: 'numeric_id',
      apiChatId: '-1001234567890',
      displayValue: '-1001234567890',
    });
  });

  it('rejects unrelated absolute URLs', () => {
    expect(() => normalizeTelegramDestinationInput('https://google.com/test')).toThrow(
      TelegramDestinationInputError,
    );
  });

  it('classifies invite links separately', () => {
    expect(() => normalizeTelegramDestinationInput('https://t.me/+AbCdEf')).toThrow(
      /приглашение/i,
    );
    expect(() => normalizeTelegramDestinationInput('t.me/joinchat/AAAA')).toThrow(/приглашение/i);
  });
});

describe('toUserFacingTelegramDestinationError', () => {
  it('maps Telegram chat not found separately from network errors', () => {
    const message = toUserFacingTelegramDestinationError(new Error('TELEGRAM_CHAT_NOT_FOUND'));
    expect(message).toContain('не найден');
    expect(message).not.toMatch(/интернет|Сетевая/i);
  });

  it('maps Telegram forbidden correctly', () => {
    const message = toUserFacingTelegramDestinationError(new Error('TELEGRAM_FORBIDDEN'));
    expect(message).toContain('не имеет доступа');
  });

  it('maps actual transport failure to network error', () => {
    const message = toUserFacingTelegramDestinationError(
      new TelegramTransportError('TELEGRAM_NETWORK:connect', 'network', null, false),
    );
    expect(message).toContain('интернет');
    expect(message).not.toContain('TELEGRAM_NETWORK');
  });

  it('maps permission denial to bot admin guidance', () => {
    const message = toUserFacingTelegramDestinationError(new Error('TELEGRAM_PERMISSION_DENIED'));
    expect(message).toContain('нет права публиковать');
    expect(message).not.toContain('@reizoko_publisher_bot');
  });

  it('maps telegram parse errors separately from network errors', () => {
    const message = toUserFacingTelegramDestinationError(
      new Error('TELEGRAM_API:parse:invalid telegram json'),
    );
    expect(message).toContain('неожиданный ответ');
    expect(message).not.toMatch(/интернет|Сетевая/i);
  });

  it('maps telegram unauthorized to reconnect guidance', () => {
    const message = toUserFacingTelegramDestinationError(new Error('TELEGRAM_UNAUTHORIZED'));
    expect(message).toContain('недействительно');
    expect(message).not.toContain('TELEGRAM_UNAUTHORIZED');
  });
});
