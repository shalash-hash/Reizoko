import {
  ConnectionSecretMissingError,
  getConnectionSecretMissingMessage,
  isConnectionSecretMissingError,
} from '../telegram/connection-errors.js';

export interface VkApiErrorDetails {

  errorCode: number;

  errorMessage: string;

  userMessage: string;

  unauthorized?: boolean;

  permissionDenied?: boolean;

}



export interface VkErrorContext {

  stage?: 'oauth' | 'publication_target_discovery' | 'external_wall' | 'publish';

  method?: string;

  credentialKind?: 'user_oauth' | 'community_token';

}



const VK_TOKEN_INVALID_MESSAGE = 'Авторизация ВКонтакте устарела. Подключите аккаунт заново.';



const VK_ERROR_MESSAGES: Record<number, string> = {

  5: 'Не удалось выполнить запрос к ВКонтакте. Проверьте права доступа приложения.',

  6: 'Слишком много запросов к ВКонтакте. Подождите и попробуйте снова.',

  7: 'Нет прав для выполнения этого действия во ВКонтакте.',

  15: 'Недостаточно прав для публикации на эту стену.',

  17: 'Доступ к ВКонтакте запрещён. Проверьте настройки приложения.',

  100: 'Некорректные параметры запроса к ВКонтакте.',

  1051: 'Токен VK ID не поддерживает публикацию через API. Используйте приложение VK с правами wall, photos, groups.',

  214: 'ВКонтакте отклонил публикацию: запись на этой стене запрещена.',

  220: 'Слишком много публикаций. Подождите и попробуйте снова.',

};



export function parseVkApiErrorFromMessage(message: string): VkApiErrorDetails | null {

  if (!message.startsWith('VK_API:')) return null;

  const [, code, ...rest] = message.split(':');

  const errorCode = Number(code);

  if (!Number.isFinite(errorCode)) return null;

  return mapVkApiError(errorCode, rest.join(':'));

}



export function mapVkApiError(errorCode: number, rawMessage?: string | null): VkApiErrorDetails {

  const normalizedMessage = rawMessage?.toLowerCase() ?? '';

  const tokenInvalid =

    errorCode === 1110 ||

    (errorCode === 5 &&

      (normalizedMessage.includes('access_token has expired') ||

        normalizedMessage.includes('user authorization failed: invalid access_token') ||

        normalizedMessage.includes('access_token was revoked')));



  const userMessage = tokenInvalid

    ? VK_TOKEN_INVALID_MESSAGE

    : VK_ERROR_MESSAGES[errorCode] ??

      (rawMessage

        ? `ВКонтакте отклонил запрос: ${rawMessage}`

        : `Ошибка ВКонтакте (${errorCode})`);



  return {

    errorCode,

    errorMessage: rawMessage ?? `VK API error ${errorCode}`,

    userMessage,

    unauthorized: tokenInvalid,

    permissionDenied: errorCode === 7 || errorCode === 15 || errorCode === 214,

  };

}



const VK_COMMUNITY_TOKEN_MESSAGES: Record<string, string> = {
  too_short: 'Ключ доступа слишком короткий. Скопируйте ключ полностью из настроек сообщества VK.',
  empty_community: 'Укажите ссылку, короткое имя или ID сообщества.',
  invalid_id: 'Не удалось распознать ID сообщества. Проверьте ссылку или введите club123456.',
  not_a_community:
    'Указанный адрес не является сообществом. Введите ссылку на группу или публичную страницу, а не личный профиль.',
  invalid_resolve: 'Сообщество не найдено. Проверьте ссылку или короткое имя.',
};

export function mapCommunityTokenError(message: string): string | null {
  if (!message.startsWith('VK_COMMUNITY_TOKEN:')) return null;
  const code = message.split(':')[1] ?? '';
  return VK_COMMUNITY_TOKEN_MESSAGES[code] ?? 'Не удалось проверить ключ доступа сообщества.';
}

export function toUserFacingVkError(error: unknown, context?: VkErrorContext): string {

  if (error instanceof VkTransportError) {

    if (context?.credentialKind === 'community_token') {
      if (error.code === 'community_token') {
        return error.userMessage;
      }
      if (error.code === 'network') {
        return error.userMessage;
      }
    if (
      error.unauthorized ||
      error.message.startsWith('VK_API:5:') ||
      error.message === 'VK_UNAUTHORIZED'
    ) {
      return 'Ключ доступа недействителен, отозван или не подходит для этого сообщества. Создайте новый ключ в VK: Сообщество → Управление → Работа с API → Ключи доступа.';
    }
      if (error.permissionDenied || error.message.startsWith('VK_API:7:')) {
        return 'У ключа нет нужных прав для этого сообщества. Проверьте права ключа в VK.';
      }
    }

    if (error.code === 'secret_missing' || (error.unauthorized && context?.stage !== 'publication_target_discovery')) {

      return VK_TOKEN_INVALID_MESSAGE;

    }

    if (context?.stage === 'external_wall') {
      if (error.permissionDenied || error.message.startsWith('VK_API:5:') || error.message.startsWith('VK_API:7:')) {
        return 'Недостаточно прав для проверки этой стены. Разрешите Reizoko доступ к сообществам и стене.';
      }
      if (error.message.startsWith('VK_API:1051:')) {
        return 'Для приложения Reizoko ещё не включён нужный доступ в кабинете VK ID (Сообщества, Стена, Фотографии).';
      }
    }

    if (context?.stage === 'publication_target_discovery' && context.method === 'groups.get') {

      if (error.permissionDenied || error.message.startsWith('VK_API:5:')) {

        return 'Подключение ВКонтакте выполнено, но Reizoko не получил разрешение на просмотр доступных сообществ.';

      }

      return 'Не удалось автоматически получить сообщества. Их можно добавить вручную.';

    }

    return error.userMessage;

  }

  if (error instanceof Error) {

    if (error instanceof ConnectionSecretMissingError || isConnectionSecretMissingError(error)) {
      return getConnectionSecretMissingMessage('vk');
    }

    const communityMessage = mapCommunityTokenError(error.message);
    if (communityMessage) return communityMessage;

    const parsed = parseVkApiErrorFromMessage(error.message);

    if (parsed) {

      if (context?.stage === 'external_wall') {
        if (parsed.errorCode === 1051) {
          return 'Для приложения Reizoko ещё не включён нужный доступ в кабинете VK ID (Сообщества, Стена, Фотографии).';
        }
        if (parsed.permissionDenied || parsed.errorCode === 5 || parsed.errorCode === 7) {
          return 'Недостаточно прав для проверки этой стены. Разрешите Reizoko доступ к сообществам и стене.';
        }
      }

      if (context?.stage === 'publication_target_discovery' && context.method === 'groups.get') {

        if (parsed.permissionDenied || parsed.errorCode === 5) {

          return 'Подключение ВКонтакте выполнено, но Reizoko не получил разрешение на просмотр доступных сообществ.';

        }

      }

      return parsed.userMessage;

    }

    if (error.message.includes('SECRET_MISSING')) {

      return VK_TOKEN_INVALID_MESSAGE;

    }

    return error.message;

  }

  return 'Не удалось выполнить операцию ВКонтакте.';

}



export class VkTransportError extends Error {

  constructor(

    message: string,

    readonly code: string,

    readonly userMessage: string,

    readonly unauthorized = false,

    readonly permissionDenied = false,

    readonly retryable = false,

  ) {

    super(message);

    this.name = 'VkTransportError';

  }

}


