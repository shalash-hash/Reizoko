import type { PlatformPreviewProps } from '@reizoko/platform-sdk';
import type { MediaTransform } from '@reizoko/shared';
import { MediaTransformView } from '@reizoko/platform-sdk';
import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import './instagram-preview.css';

export function InstagramPreview({
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
  const username =
    socialAccount?.handle?.replace(/^@/, '') ?? socialAccount?.displayName ?? 'reizoko_user';
  const headerName = socialAccount?.displayName ?? 'reizoko_user';
  const headerHandle = socialAccount?.handle ?? `@${username}`;

  return (
    <div className="ig-preview" data-testid="instagram-preview">
      <div className="ig-preview__header">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="ig-preview__avatar ig-preview__avatar--image" />
        ) : (
          <div className="ig-preview__avatar" />
        )}
        <div>
          <div className="ig-preview__username" data-testid="preview-account-name">
            {headerName}
          </div>
          <div className="ig-preview__location" data-testid="preview-account-handle">
            {headerHandle}
          </div>
        </div>
      </div>

      <div className="ig-preview__media">
        {imageUrl && currentMediaId ? (
          <MediaTransformView
            imageUrl={imageUrl}
            transform={transform}
            interactive
            selected
            onSelect={() => onSelectMedia?.(currentMediaId)}
            onTransformChange={(next) => onTransformChange?.(next)}
          />
        ) : (
          <div className="ig-preview__placeholder">
            <span>Добавьте изображение в редакторе</span>
          </div>
        )}
        {images.length > 1 ? (
          <div className="ig-preview__carousel-dots">
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

      <div className="ig-preview__actions">
        <Heart size={22} strokeWidth={1.75} />
        <MessageCircle size={22} strokeWidth={1.75} />
        <Send size={22} strokeWidth={1.75} />
        <Bookmark size={22} strokeWidth={1.75} className="ig-preview__bookmark" />
      </div>

      <div className="ig-preview__likes">Нравится: reizoko и другие</div>

      <div className="ig-preview__caption">
        <strong>{username}</strong>{' '}
        {transformed.text || <span className="muted">Подпись к публикации…</span>}
      </div>
    </div>
  );
}
