import { useAppStore } from './app-store';
import { getOverridesForTarget } from './presentation-overrides';

export function usePresentationOverrides(platformId: string, socialAccountId?: string | null) {
  return useAppStore((state) =>
    getOverridesForTarget(
      state.presentationOverrides,
      state.content?.id,
      platformId,
      socialAccountId,
    ),
  );
}
