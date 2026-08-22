export const CONNECTION_SECRET_MISSING_CODE = 'CONNECTION_SECRET_MISSING';

export class ConnectionSecretMissingError extends Error {
  readonly code = CONNECTION_SECRET_MISSING_CODE;

  constructor(
    message = 'Подключение Telegram требует повторного входа. Сохранённый ключ бота не найден в защищённом хранилище Windows. Подключите бота заново.',
  ) {
    super(message);
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
    return error.message;
  }
  if (error instanceof Error) {
    if (isConnectionSecretMissingError(error)) {
      return 'Подключение Telegram требует повторного входа. Сохранённый ключ бота не найден в защищённом хранилище Windows. Подключите бота заново.';
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
