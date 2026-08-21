import { Check, ChevronDown, Info } from 'lucide-react';
import { platformRegistry } from '@reizoko/platform-sdk';
import { blocksToPlainText, extractImages } from '@reizoko/platform-sdk';
import { useAppStore } from '../stores/app-store';
import { getMediaUrl } from '../services/media-service';
import { PlatformIcon } from './PlatformIcon';
import './inspector-panel.css';

interface InspectorPanelProps {
  platformId: string;
}

export function InspectorPanel({ platformId }: InspectorPanelProps) {
  const blocks = useAppStore((s) => s.blocks);
  const mediaPaths = useAppStore((s) => s.mediaPaths);
  const setShowPlatformPicker = useAppStore((s) => s.setShowPlatformPicker);

  const platform = platformRegistry.get(platformId);
  if (!platform) return null;

  const { adapter, Preview } = platform;
  const transformed = adapter.transform(blocks);
  const text = blocksToPlainText(blocks);
  const images = extractImages(blocks);
  const caps = adapter.capabilities;

  const hashtagCount = (text.match(/#\w+/g) ?? []).length;
  const mentionCount = (text.match(/@\w+/g) ?? []).length;
  const maxText = caps.maxTextLength ?? 2200;
  const maxImages = caps.maxImages ?? 10;

  const checks = [
    {
      label: 'Длина текста',
      value: `${text.length} / ${maxText}`,
      ok: text.length <= maxText,
    },
    {
      label: 'Изображений',
      value: `${images.length} / ${maxImages}`,
      ok: images.length <= maxImages && images.length > 0,
    },
    {
      label: 'Хэштеги',
      value: `${hashtagCount} / 30`,
      ok: hashtagCount <= 30,
    },
    {
      label: 'Упоминания',
      value: String(mentionCount),
      ok: true,
    },
    {
      label: 'Карусель',
      value: images.length > 1 ? 'Вкл.' : 'Выкл.',
      ok: images.length <= 1,
      info: images.length <= 1,
    },
  ];

  return (
    <aside className="inspector-panel" aria-label="Инспектор публикации">
      <section className="inspector-panel__section">
        <h3 className="inspector-panel__heading">Платформа</h3>
        <button
          type="button"
          className="inspector-panel__platform"
          onClick={() => setShowPlatformPicker(true)}
        >
          <PlatformIcon platformId={adapter.id} size={20} />
          <span>{adapter.name}</span>
          <ChevronDown size={14} strokeWidth={2} aria-hidden />
        </button>
      </section>

      <section className="inspector-panel__section">
        <h3 className="inspector-panel__heading">Проверка</h3>
        <ul className="inspector-panel__checks">
          {checks.map((check) => (
            <li key={check.label} className="inspector-panel__check">
              <span className="inspector-panel__check-icon">
                {check.info ? (
                  <Info size={14} strokeWidth={2} />
                ) : check.ok ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : (
                  <Info size={14} strokeWidth={2} />
                )}
              </span>
              <span className="inspector-panel__check-label">{check.label}</span>
              <span className="inspector-panel__check-value">{check.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="inspector-panel__section inspector-panel__section--preview">
        <h3 className="inspector-panel__heading">Превью</h3>
        <div className="inspector-panel__preview">
          <Preview
            blocks={blocks}
            transformed={transformed}
            issues={adapter.validate(blocks)}
            getMediaUrl={(mediaId) => getMediaUrl(mediaId, mediaPaths[mediaId])}
          />
        </div>
      </section>
    </aside>
  );
}
