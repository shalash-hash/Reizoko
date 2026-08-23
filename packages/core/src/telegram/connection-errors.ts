export const CONNECTION_SECRET_MISSING_CODE = 'CONNECTION_SECRET_MISSING';

export type ConnectionPlatform = 'telegram' | 'vk';

export const CONNECTION_SECRET_MISSING_MESSAGES: Record<ConnectionPlatform, string> = {
  telegram:
    'Подключение Telegram требует повторного входа. Сохранённый ключ бота не найден в защищённом хранилище Windows. Подключите бота заново.',
  vk:
    'Подключение ВКонтакте требует повторной авторизации. Сохранённый токен доступа не найден в защищённом хранилище Windows. Подключите аккаунт заново.',
};

export function getConnectionSecretMissingMessage(platform: ConnectionPlatform): string {
  return CONNECTION_SECRET_MISSING_MESSAGES[platform];
}

export class ConnectionSecretMissingError extends Error {
  readonly code = CONNECTION_SECRET_MISSING_CODE;
  readonly platform: ConnectionPlatform;

  constructor(platform: ConnectionPlatform = 'telegram', message?: string) {
    super(message ?? getConnectionSecretMissingMessage(platform));
    this.platform = platform;
    this.name = 'ConnectionSecretMissingError';
  }
}

export function isConnectionSecretMissingError(error: unknown): boolean {
  if (error instanceof ConnectionSecretMissingError) return true;
  if (error instanceof Error) {
    if (error.message === CONNECTION_SECRET_MISSING_CODE) return true;
    if (/SECRET_MISSING|SECRET_STORE_VERIFY_FAILED|secure storage|No matching entry/i.test(error.message)) {
      return true;
    }
  }
  return false;
}

export function toUserFacingConnectionError(error: unknown): string {
  if (error instanceof ConnectionSecretMissingError) {
    return getConnectionSecretMissingMessage(error.platform);
  }
  if (error instanceof Error) {
    if (isConnectionSecretMissingError(error)) {
      return getConnectionSecretMissingMessage('telegram');
    }
    if (/подключён другой бот/i.test(error.message)) {
      return error.message;
    }
    if (/permission|прав|администратор/i.test(error.message)) {
      return error.message;
    }
    if (/CREDENTIAL_STORE_ERROR|SECRET_STORE_VERIFY_FAILED/i.test(error.message)) {
      return 'Не удалось сохранить ключ Telegram в защищённом хранилище Windows. Попробуйте подключить бота ещё раз.';
    }
    if (
      error.message === 'TELEGRAM_UNAUTHORIZED' ||
      /TELEGRAM_UNAUTHORIZED|UNAUTHORIZED:/i.test(error.message)
    ) {
      return 'Telegram отклонил токен бота. Проверьте токен в BotFather и попробуйте снова.';
    }
    return error.message;
  }
  return 'Не удалось выполнить операцию подключения Telegram.';
}
