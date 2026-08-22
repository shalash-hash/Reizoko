import { isConnectionSecretMissingError, toUserFacingConnectionError } from './connection-errors.js';
import { TelegramDestinationInputError } from './telegram-destination-input.js';
import { TelegramTransportError } from './telegram-transport.js';

export function toUserFacingTelegramDestinationError(
  error: unknown,
  botHandle = '@reizoko_publisher_bot',
): string {
  if (error instanceof TelegramDestinationInputError) {
    return error.message;
  }

  if (isConnectionSecretMissingError(error)) {
    return toUserFacingConnectionError(error);
  }

  if (error instanceof TelegramTransportError) {
    return mapTransportCode(error.message, error.code, botHandle);
  }

  if (error instanceof Error) {
    return mapTransportCode(error.message, undefined, botHandle);
  }

  return 'Не удалось добавить канал или чат.';
}

function mapTransportCode(message: string, code?: string, botHandle = '@reizoko_publisher_bot'): string {
  if (message === 'TELEGRAM_CHAT_NOT_FOUND' || message.startsWith('TELEGRAM_CHAT_NOT_FOUND:')) {
    return 'Канал или чат не найден. Проверьте ссылку или имя канала.';
  }

  if (message === 'TELEGRAM_FORBIDDEN' || message.startsWith('TELEGRAM_FORBIDDEN:')) {
    return 'Бот не имеет доступа к этому каналу.';
  }

  if (message.startsWith('TELEGRAM_NETWORK:') || code === 'network') {
    return 'Не удалось соединиться с Telegram. Проверьте подключение к интернету.';
  }

  if (message.startsWith('RATE_LIMIT:') || code === 'rate_limit') {
    return 'Telegram временно ограничил запросы. Попробуйте снова через несколько секунд.';
  }

  if (message === 'TELEGRAM_UNAUTHORIZED' || code === 'unauthorized') {
    return 'Подключение Telegram недействительно. Подключите бота снова.';
  }

  if (message === 'TELEGRAM_API:parse:invalid telegram json' || message.startsWith('TELEGRAM_API:parse:')) {
    return 'Telegram вернул неожиданный ответ. Попробуйте ещё раз.';
  }

  if (/Сетевая ошибка/i.test(message)) {
    return 'Не удалось соединиться с Telegram. Проверьте подключение к интернету.';
  }

  if (message === 'TELEGRAM_PERMISSION_DENIED' || /администратор|публиковать|permission|прав/i.test(message)) {
    if (message === 'TELEGRAM_PERMISSION_DENIED') {
      return 'Бот подключён, но у него нет права публиковать сообщения в этом канале.';
    }
    return `Добавьте ${botHandle} администратором канала и разрешите публикацию сообщений.`;
  }

  if (message.startsWith('TELEGRAM_API:')) {
    return 'Telegram не смог обработать запрос. Проверьте ссылку или имя канала.';
  }

  return message || 'Не удалось добавить канал или чат.';
}
