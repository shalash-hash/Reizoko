import type { PlatformPreviewProps } from '@reizoko/platform-sdk';
import type { MediaTransform } from '@reizoko/shared';
import { MediaTransformView } from '@reizoko/platform-sdk';
import { ThumbsUp, MessageSquare, Share2, MoreHorizontal } from 'lucide-react';
import './vk-preview.css';

export function VkPreview({
  transformed,
  getMediaUrl,
  socialAccount,
  getMediaTransform: getMediaTransformProp,
  activeMediaId,
  onSelectMedia,
  onTransformChange,
}: PlatformPreviewProps) {
  const images = transformed.images;
  const firstImage = images[0];
  const currentMediaId = activeMediaId ?? firstImage?.mediaId ?? null;
  const imageUrl = currentMediaId ? getMediaUrl(currentMediaId) : null;
  const transform: MediaTransform = currentMediaId
    ? getMediaTransformProp?.(currentMediaId) ?? { mediaId: currentMediaId }
    : { mediaId: '' };
  const avatarUrl = socialAccount?.avatarMediaId
    ? getMediaUrl(socialAccount.avatarMediaId)
    : null;
  const name = socialAccount?.displayName ?? 'Reizoko';
  const handle = socialAccount?.handle;

  return (
    <div className="vk-preview" data-testid="vk-preview">
      <div className="vk-preview__header">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="vk-preview__avatar vk-preview__avatar--image" />
        ) : (
          <div className="vk-preview__avatar">{name.slice(0, 1).toUpperCase()}</div>
        )}
        <div className="vk-preview__header-text">
          <div className="vk-preview__name" data-testid="preview-account-name">
            {name}
          </div>
          <div className="vk-preview__time" data-testid="preview-account-handle">
            {handle ?? 'только что · 🌐'}
          </div>
        </div>
        <MoreHorizontal size={18} className="vk-preview__more" strokeWidth={1.75} />
      </div>

      <div className="vk-preview__text">
        {transformed.text || <span className="muted">Текст записи…</span>}
      </div>

      {imageUrl && currentMediaId ? (
        <div className="vk-preview__media">
          <MediaTransformView
            imageUrl={imageUrl}
            transform={transform}
            interactive
            selected
            onSelect={() => onSelectMedia?.(currentMediaId)}
            onTransformChange={(next) => onTransformChange?.(next)}
          />
          {images.length > 1 ? (
            <div className="vk-preview__carousel-dots">
              {images.map((image, index) => (
                <button
                  key={image.mediaId}
                  type="button"
                  className={image.mediaId === currentMediaId ? 'active' : ''}
                  onClick={() => onSelectMedia?.(image.mediaId)}
                  aria-label={`Изображение ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : transformed.images.length > 0 ? (
        <div className="vk-preview__photos vk-preview__photos--placeholder">
          <span className="muted">Изображение недоступно</span>
        </div>
      ) : null}

      <div className="vk-preview__actions">
        <button type="button" className="vk-preview__action">
          <ThumbsUp size={18} strokeWidth={1.75} /> Нравится
        </button>
        <button type="button" className="vk-preview__action">
          <MessageSquare size={18} strokeWidth={1.75} /> Комментировать
        </button>
        <button type="button" className="vk-preview__action">
          <Share2 size={18} strokeWidth={1.75} /> Поделиться
        </button>
      </div>
    </div>
  );
}
