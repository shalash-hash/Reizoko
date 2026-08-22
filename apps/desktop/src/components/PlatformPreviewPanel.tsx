import { platformRegistry } from '@reizoko/platform-sdk';
import { getMediaTransform, resolveCarouselOrder, resolvePlatformText } from '@reizoko/core';
import { toPreviewAccountContext } from '@reizoko/core';
import { PlannedFeature } from '@reizoko/ui';
import { useAppStore } from '../stores/app-store';
import { usePresentationOverrides } from '../stores/use-presentation-overrides';
import { getMediaUrl } from '../services/media-service';
import './platform-preview-panel.css';

interface PlatformPreviewPanelProps {
  platformId: string;
  socialAccountId?: string | null;
}

export function PlatformPreviewPanel({ platformId, socialAccountId }: PlatformPreviewPanelProps) {
  const blocks = useAppStore((s) => s.blocks);
  const mediaPaths = useAppStore((s) => s.mediaPaths);
  const getAccountById = useAppStore((s) => s.getAccountById);
  const overrides = usePresentationOverrides(platformId, socialAccountId);
  const setMediaTransform = useAppStore((s) => s.setMediaTransform);
  const activeComposerMediaId = useAppStore((s) => s.activeComposerMediaId);
  const selectComposerMedia = useAppStore((s) => s.selectComposerMedia);

  const platform = platformRegistry.get(platformId);
  const account = getAccountById(socialAccountId);
  const previewAccount = toPreviewAccountContext(account);

  if (!platform) {
    return <div className="platform-preview-panel">Платформа не найдена</div>;
  }

  if (!platform.adapter.available) {
    return (
      <div className="platform-preview-panel" data-testid="platform-preview-panel">
        <PlannedFeature
          title={platform.adapter.name}
          description="Предпросмотр пока недоступен для этой площадки."
          stage={3}
        />
      </div>
    );
  }

  const { adapter, Preview } = platform;
  const transformed = adapter.transform(blocks);
  const issues = adapter.validate(blocks);
  const carouselOrder = resolveCarouselOrder(blocks, overrides);
  const activeMediaId = activeComposerMediaId ?? carouselOrder[0] ?? null;
  const resolvedText = resolvePlatformText(blocks, overrides);

  return (
    <div className="platform-preview-panel" data-testid="platform-preview-panel">
      <div className="platform-preview-panel__stage">
        <Preview
          blocks={blocks}
          transformed={{ ...transformed, text: resolvedText }}
          issues={issues}
          socialAccount={previewAccount}
          getMediaUrl={(mediaId) => getMediaUrl(mediaId, mediaPaths[mediaId])}
          getMediaTransform={(mediaId) => getMediaTransform(overrides, mediaId)}
          activeMediaId={activeMediaId}
          onSelectMedia={(mediaId) => selectComposerMedia(mediaId)}
          onTransformChange={(next) => void setMediaTransform(platformId, socialAccountId, next)}
        />
      </div>
    </div>
  );
}
