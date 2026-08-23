import { invoke } from '@tauri-apps/api/core';
import {
  VkTransportError,
  buildVkOAuthConnectionMeta,
  createVkRemoteOAuthSession,
  generateVkPkcePair,
  logVkOAuthGrantedScopes,
  logVkOAuthRequestedScopes,
  parseVkApiErrorFromMessage,
  mapCommunityTokenError,
  registerVkRemoteOAuthSession,
  waitForVkRemoteOAuthResult,
  type VkCommunityInfo,
  type VkCommunityTokenVerification,
  type VkOAuthConnectionMeta,
  type VkOAuthResult,
  type VkOAuthStartRequest,
  type VkPublicationCapability,
  type VkPublishRequest,
  type VkResolvedObject,
  type VkTransport,
  type VkUserInfo,
  type VkWallPostResult,
} from '@reizoko/core';
import { buildSecretRef, generateId } from '@reizoko/shared';
import type { VkPublicationTargetType } from '@reizoko/shared';
import { pollVkOAuthStatusFromNative } from './vk-server-probe-runtime';

function mapInvokeError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('SECRET_MISSING') || /secure storage|No matching entry/i.test(message)) {
    throw new VkTransportError('SECRET_MISSING', 'secret_missing', 'Требуется повторное подключение ВКонтакте.', true);
  }
  if (message === 'VK_UNAUTHORIZED' || message.startsWith('VK_UNAUTHORIZED')) {
    throw new VkTransportError('VK_UNAUTHORIZED', 'unauthorized', 'Авторизация ВКонтакте устарела. Подключите аккаунт заново.', true);
  }
  if (message.startsWith('VK_COMMUNITY_TOKEN:')) {
    throw new VkTransportError(message, 'community_token', mapCommunityTokenError(message) ?? message);
  }
  if (message.startsWith('VK_NETWORK')) {
    const detail = message.slice('VK_NETWORK:'.length);
    const userMessage = detail.startsWith('invalid_json:') || detail.startsWith('invalid_response_shape:')
      ? 'ВКонтакте вернул неожиданный ответ. Проверьте ключ сообщества, VPN или попробуйте позже.'
      : 'Не удалось связаться с API ВКонтакте. Проверьте подключение к интернету, VPN или firewall и попробуйте снова.';
    throw new VkTransportError(message, 'network', userMessage, false, false, true);
  }
  if (message.startsWith('VK_OAUTH')) {
    throw new VkTransportError(message, 'oauth', 'Не удалось авторизоваться во ВКонтакте.', false);
  }
  if (message.startsWith('VK_API:')) {
    const parsed = parseVkApiErrorFromMessage(message);
    if (parsed) {
      throw new VkTransportError(
        message,
        'vk_api',
        parsed.userMessage,
        parsed.unauthorized ?? false,
        parsed.permissionDenied ?? false,
      );
    }
  }
  throw new VkTransportError(message, 'unknown', message);
}

interface RustResolvedObject {
  objectType: string;
  objectId: number;
  screenName?: string | null;
}

function mapResolvedObject(value: RustResolvedObject): VkResolvedObject {
  const type =
    value.objectType === 'group' || value.objectType === 'page'
      ? (value.objectType as 'group' | 'page')
      : 'user';
  return {
    type,
    objectId: value.objectId,
    screenName: value.screenName,
  };
}

export class TauriVkTransport implements VkTransport {
  async startOAuth(request: VkOAuthStartRequest): Promise<VkOAuthResult> {
    logVkOAuthRequestedScopes(request.scopes);
    const sessionId = generateId();
    const pkce = await generateVkPkcePair();
    const oauthSession = createVkRemoteOAuthSession({
      sessionId,
      codeVerifier: pkce.codeVerifier,
      codeChallenge: pkce.codeChallenge,
      appId: request.appId,
      redirectUri: request.redirectUri,
      scope: request.scopes.join(' '),
      prompt: request.forceConsent ? 'consent' : undefined,
    });

    try {
      await registerVkRemoteOAuthSession({
        serverBaseUrl: request.serverBaseUrl,
        sessionId: oauthSession.sessionId,
        state: oauthSession.state,
        codeVerifier: oauthSession.codeVerifier,
        appId: request.appId,
        redirectUri: request.redirectUri,
      });
      await invoke('vk_open_url', { url: oauthSession.authorizeUrl });
      const result = await waitForVkRemoteOAuthResult({
        serverBaseUrl: request.serverBaseUrl,
        sessionId: oauthSession.sessionId,
        pollStatus: pollVkOAuthStatusFromNative,
      });

      if (result.status !== 'success' || !result.accessToken) {
        throw new VkTransportError(
          'VK_OAUTH_FAILED',
          'oauth',
          result.error ?? 'Авторизация ВКонтакте не завершена.',
        );
      }

      const secretRef = buildSecretRef(request.connectionId, 'access_token');
      await invoke('set_secret', { key: secretRef, value: result.accessToken });

      let profile: VkUserInfo | null = null;
      try {
        profile = await invoke<VkUserInfo>('vk_fetch_vkid_profile', {
          secretRef,
          appId: request.appId,
        });
      } catch {
        profile = null;
      }

      const oauthMeta: VkOAuthConnectionMeta = buildVkOAuthConnectionMeta({
        requestedScopes: request.scopes,
        grantedScopeString: result.scope,
        expiresIn: result.expiresIn ?? null,
      });
      logVkOAuthGrantedScopes(oauthMeta);

      return {
        accessToken: result.accessToken,
        userId: profile?.id ?? result.userId ?? 0,
        expiresIn: result.expiresIn ?? null,
        profile,
        oauthMeta,
      };
    } catch (error) {
      if (error instanceof VkTransportError) throw error;
      mapInvokeError(error);
    }
  }

  async getCurrentUser(secretRef: string): Promise<VkUserInfo> {
    try {
      return await invoke<VkUserInfo>('vk_get_current_user', { secretRef });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async listManageableCommunities(secretRef: string): Promise<VkCommunityInfo[]> {
    try {
      return await invoke<VkCommunityInfo[]>('vk_list_manageable_communities', { secretRef });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async resolveScreenName(secretRef: string, screenName: string): Promise<VkResolvedObject> {
    try {
      const result = await invoke<RustResolvedObject>('vk_resolve_screen_name', {
        secretRef,
        screenName,
      });
      return mapResolvedObject(result);
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async getUserInfo(secretRef: string, userId: number): Promise<VkUserInfo> {
    try {
      return await invoke<VkUserInfo>('vk_get_user_info', { secretRef, userId });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async getCommunityInfo(secretRef: string, communityId: number): Promise<VkCommunityInfo> {
    try {
      return await invoke<VkCommunityInfo>('vk_get_community_info', { secretRef, communityId });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async checkPublicationTarget(
    secretRef: string,
    targetType: VkPublicationTargetType,
    ownerId: number,
    options?: { communityId?: number | null; postAsGroup?: boolean },
  ): Promise<VkPublicationCapability> {
    try {
      return await invoke<VkPublicationCapability>('vk_check_publication_target', {
        secretRef,
        targetType,
        ownerId,
        communityId: options?.communityId ?? null,
        postAsGroup: options?.postAsGroup ?? null,
      });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async publishWallPost(secretRef: string, request: VkPublishRequest): Promise<VkWallPostResult> {
    try {
      return await invoke<VkWallPostResult>('vk_publish_wall_post', {
        secretRef,
        ownerId: request.ownerId,
        message: request.message,
        fromGroup: request.fromGroup ?? null,
        groupId: request.groupId ?? null,
        photos: request.photos?.map((photo) => ({
          mediaId: photo.mediaId,
          localPath: photo.localPath,
        })),
        photoUploadSecretRef: request.photoUploadSecretRef ?? null,
      });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async verifyCommunityToken(input: {
    communityInput: string;
    accessToken: string;
  }): Promise<VkCommunityTokenVerification> {
    try {
      return await invoke<VkCommunityTokenVerification>('vk_verify_community_token', {
        communityInput: input.communityInput,
        accessToken: input.accessToken,
      });
    } catch (error) {
      mapInvokeError(error);
    }
  }

  async probeCommunityPhotoUpload(input: {
    accessToken: string;
    communityId: number;
  }): Promise<{ available: boolean; errorCode?: number; errorMessage?: string }> {
    try {
      const result = await invoke<VkPublicationCapability>('vk_probe_community_photo_upload', {
        accessToken: input.accessToken,
        communityId: input.communityId,
      });
      return {
        available: result.canUploadPhotos ?? false,
        errorCode: undefined,
        errorMessage: result.reason ?? undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        const parsed = parseVkApiErrorFromMessage(error.message);
        return {
          available: false,
          errorCode: parsed?.errorCode,
          errorMessage: parsed?.errorMessage ?? error.message,
        };
      }
      return { available: false, errorMessage: 'Не удалось проверить загрузку фотографий.' };
    }
  }

  async probeCommunityPhotoUploadBySecretRef(input: {
    secretRef: string;
    communityId: number;
  }): Promise<{ available: boolean; errorCode?: number; errorMessage?: string }> {
    try {
      const result = await invoke<VkPublicationCapability>(
        'vk_probe_community_photo_upload_by_secret_ref',
        {
          secretRef: input.secretRef,
          communityId: input.communityId,
        },
      );
      return {
        available: result.canUploadPhotos ?? false,
        errorMessage: result.reason ?? undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        const parsed = parseVkApiErrorFromMessage(error.message);
        return {
          available: false,
          errorCode: parsed?.errorCode,
          errorMessage: parsed?.errorMessage ?? error.message,
        };
      }
      return { available: false, errorMessage: 'Не удалось проверить загрузку фотографий.' };
    }
  }

  async storeSecret(secretRef: string, value: string): Promise<void> {
    await invoke('set_secret', { key: secretRef, value });
  }

  async deleteSecret(secretRef: string): Promise<void> {
    await invoke('vk_delete_secret', { secretRef });
  }

  async hasSecret(secretRef: string): Promise<boolean> {
    return invoke<boolean>('has_secret_command', { key: secretRef });
  }

  async getSecret(secretRef: string): Promise<string | null> {
    return invoke<string | null>('get_secret', { key: secretRef });
  }
}

export function createVkTransport(): VkTransport {
  return new TauriVkTransport();
}
