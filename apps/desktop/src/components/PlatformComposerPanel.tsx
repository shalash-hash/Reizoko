import { useMemo } from 'react';
import { platformRegistry } from '@reizoko/platform-sdk';
import { blocksToPlainText, extractImages } from '@reizoko/platform-sdk';
import {
  defaultMediaTransform,
  getMediaTransform,
  getPlatformDisplayName,
  resolveCarouselOrder,
  resolvePlatformText,
} from '@reizoko/core';
import type { MediaTransform } from '@reizoko/shared';
import { Button } from '@reizoko/ui';
import { useAppStore } from '../stores/app-store';
import { usePresentationOverrides } from '../stores/use-presentation-overrides';
import { PlatformIcon } from './PlatformIcon';
import './platform-composer-panel.css';

interface PlatformComposerPanelProps {
  platformId: string;
  socialAccountId?: string | null;
}

export function PlatformComposerPanel({ platformId, socialAccountId }: PlatformComposerPanelProps) {
  const blocks = useAppStore((s) => s.blocks);
  const activeComposerMediaId = useAppStore((s) => s.activeComposerMediaId);
  const overrides = usePresentationOverrides(platformId, socialAccountId);
  const setMediaTransform = useAppStore((s) => s.setMediaTransform);
  const setAspectRatio = useAppStore((s) => s.setAspectRatio);
  const setTextOverrideMode = useAppStore((s) => s.setTextOverrideMode);
  const setPlatformTextOverride = useAppStore((s) => s.setPlatformTextOverride);
  const resetPlatformPresentation = useAppStore((s) => s.resetPlatformPresentation);
  const selectComposerMedia = useAppStore((s) => s.selectComposerMedia);

  const platform = platformRegistry.get(platformId);
  const composer = platform?.adapter.composerCapabilities;
  const images = extractImages(blocks);
  const carouselOrder = resolveCarouselOrder(blocks, overrides);
  const activeMediaId = activeComposerMediaId ?? carouselOrder[0] ?? null;
  const activeTransform = activeMediaId
    ? getMediaTransform(overrides, activeMediaId)
    : defaultMediaTransform('');

  const text = useMemo(
    () => resolvePlatformText(blocks, overrides),
    [blocks, overrides],
  );
  const masterText = blocksToPlainText(blocks);
  const caps = platform?.adapter.capabilities;
  const maxText = caps?.maxTextLength ?? 2200;

  if (!platform || !composer) {
    return null;
  }

  const supportsImageEditing =
    composer.allowCrop ||
    composer.allowZoom ||
    composer.allowPan ||
    composer.allowRotation ||
    composer.supportedAspectRatios.some((ratio) => ratio.id !== 'original');

  return (
    <aside className="platform-composer-panel" data-testid="platform-composer-panel" aria-label="Композитор площадки">
      <section className="platform-composer-panel__section">
        <h3 className="platform-composer-panel__heading">Платформа</h3>
        <div className="platform-composer-panel__platform">
          <PlatformIcon platformId={platformId} size={20} />
          <span>{getPlatformDisplayName(platformId, platform.adapter.name)}</span>
        </div>
      </section>

      {composer.allowTextOverride ? (
        <section className="platform-composer-panel__section">
          <h3 className="platform-composer-panel__heading">Текст</h3>
          <label className="platform-composer-panel__toggle">
            <input
              type="checkbox"
              checked={overrides?.text?.useMasterText ?? true}
              onChange={(event) =>
                void setTextOverrideMode(platformId, socialAccountId, event.target.checked)
              }
            />
            <span>Использовать текст Master Post</span>
          </label>
          {!overrides?.text?.useMasterText ? (
            <textarea
              className="platform-composer-panel__textarea"
              value={overrides?.text?.text ?? masterText}
              onChange={(event) =>
                void setPlatformTextOverride(platformId, socialAccountId, event.target.value)
              }
            />
          ) : null}
          <p className="platform-composer-panel__meta">
            {text.length} / {maxText}
          </p>
        </section>
      ) : null}

      {images.length > 0 && !supportsImageEditing ? (
        <section className="platform-composer-panel__section">
          <h3 className="platform-composer-panel__heading">Изображение</h3>
          <p className="platform-composer-panel__note" data-testid="composer-media-original-note">
            Изображение будет отправлено в исходном виде.
          </p>
        </section>
      ) : null}

      {images.length > 0 && supportsImageEditing ? (
        <section className="platform-composer-panel__section">
          <h3 className="platform-composer-panel__heading">Изображение</h3>
          {carouselOrder.length > 1 ? (
            <div className="platform-composer-panel__thumbs">
              {carouselOrder.map((mediaId) => (
                <button
                  key={mediaId}
                  type="button"
                  className={
                    mediaId === activeMediaId
                      ? 'platform-composer-panel__thumb platform-composer-panel__thumb--active'
                      : 'platform-composer-panel__thumb'
                  }
                  onClick={() => selectComposerMedia(mediaId)}
                >
                  #{carouselOrder.indexOf(mediaId) + 1}
                </button>
              ))}
            </div>
          ) : null}

          <div className="platform-composer-panel__ratio-group">
            {composer.supportedAspectRatios.map((ratio) => (
              <button
                key={ratio.id}
                type="button"
                className={
                  activeTransform.aspectRatio === ratio.id
                    ? 'platform-composer-panel__ratio platform-composer-panel__ratio--active'
                    : 'platform-composer-panel__ratio'
                }
                onClick={() => {
                  if (!activeMediaId) return;
                  void setAspectRatio(platformId, socialAccountId, activeMediaId, ratio.id);
                }}
              >
                {ratio.label}
              </button>
            ))}
          </div>

          {composer.allowZoom ? (
            <label className="platform-composer-panel__slider">
              <span>Масштаб</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={activeTransform.zoom ?? 1}
                onChange={(event) => {
                  if (!activeMediaId) return;
                  const next: MediaTransform = {
                    ...activeTransform,
                    zoom: Number(event.target.value),
                  };
                  void setMediaTransform(platformId, socialAccountId, next);
                }}
              />
            </label>
          ) : null}

          {composer.allowRotation ? (
            <div className="platform-composer-panel__actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!activeMediaId) return;
                  const rotation = (((activeTransform.rotation ?? 0) + 270) % 360) as 0 | 90 | 180 | 270;
                  void setMediaTransform(platformId, socialAccountId, {
                    ...activeTransform,
                    rotation,
                  });
                }}
              >
                ↶
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!activeMediaId) return;
                  const rotation = (((activeTransform.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270;
                  void setMediaTransform(platformId, socialAccountId, {
                    ...activeTransform,
                    rotation,
                  });
                }}
              >
                ↷
              </Button>
            </div>
          ) : null}
          <p className="platform-composer-panel__note platform-composer-panel__note--muted">
            Настройка изображения Reizoko перед загрузкой на площадку.
          </p>
        </section>
      ) : null}

      <section className="platform-composer-panel__section">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void resetPlatformPresentation(platformId, socialAccountId)}
        >
          Сбросить настройки площадки
        </Button>
      </section>
    </aside>
  );
}
