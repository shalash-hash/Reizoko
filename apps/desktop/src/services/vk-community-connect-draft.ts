export interface VkCommunityConnectDraft {
  communityInput: string;
  accessToken: string;
}

const STORAGE_KEY = 'reizoko.vk-community-connect-draft';

export function loadVkCommunityConnectDraft(): VkCommunityConnectDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { communityInput: '', accessToken: '' };
    const parsed = JSON.parse(raw) as Partial<VkCommunityConnectDraft>;
    return {
      communityInput: parsed.communityInput ?? '',
      accessToken: parsed.accessToken ?? '',
    };
  } catch {
    return { communityInput: '', accessToken: '' };
  }
}

export function saveVkCommunityConnectDraft(draft: VkCommunityConnectDraft): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearVkCommunityConnectDraft(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
