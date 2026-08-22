import { platformRegistry } from '@reizoko/platform-sdk';
import { toPreviewAccountContext } from '@reizoko/core';
import { PlannedFeature } from '@reizoko/ui';
import { useAppStore } from '../stores/app-store';
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
          description="Preview пока недоступен для этой площадки."
          stage={3}
        />
      </div>
    );
  }

  const { adapter, Preview } = platform;
  const transformed = adapter.transform(blocks);
  const issues = adapter.validate(blocks);

  return (
    <div className="platform-preview-panel" data-testid="platform-preview-panel">
      <div className="platform-preview-panel__stage">
        <Preview
          blocks={blocks}
          transformed={transformed}
          issues={issues}
          socialAccount={previewAccount}
          getMediaUrl={(mediaId) => getMediaUrl(mediaId, mediaPaths[mediaId])}
        />
      </div>
    </div>
  );
}
