import { platformRegistry } from '@reizoko/platform-sdk';
import { useAppStore } from '../stores/app-store';
import { getMediaUrl } from '../services/media-service';
import './platform-preview-panel.css';

interface PlatformPreviewPanelProps {
  platformId: string;
}

export function PlatformPreviewPanel({ platformId }: PlatformPreviewPanelProps) {
  const blocks = useAppStore((s) => s.blocks);
  const mediaPaths = useAppStore((s) => s.mediaPaths);

  const platform = platformRegistry.get(platformId);
  if (!platform) {
    return <div className="platform-preview-panel">Платформа не найдена</div>;
  }

  const { adapter, Preview } = platform;
  const transformed = adapter.transform(blocks);
  const issues = adapter.validate(blocks);

  return (
    <div className="platform-preview-panel">
      <div className="platform-preview-panel__stage">
        <Preview
          blocks={blocks}
          transformed={transformed}
          issues={issues}
          getMediaUrl={(mediaId) => getMediaUrl(mediaId, mediaPaths[mediaId])}
        />
      </div>
    </div>
  );
}
