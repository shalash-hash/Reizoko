import type { PlatformPreviewProps } from '@reizoko/platform-sdk';
import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import './instagram-preview.css';

export function InstagramPreview({ transformed, getMediaUrl, socialAccount }: PlatformPreviewProps) {
  const images = transformed.images;
  const firstImage = images[0];
  const imageUrl = firstImage ? getMediaUrl(firstImage.mediaId) : null;
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
        {imageUrl ? (
          <img src={imageUrl} alt={firstImage?.alt ?? 'Post image'} />
        ) : (
          <div className="ig-preview__placeholder">
            <span>Добавьте изображение в редакторе</span>
          </div>
        )}
        {images.length > 1 && (
          <div className="ig-preview__carousel-dots">
            {images.map((_, i) => (
              <span key={i} className={i === 0 ? 'active' : ''} />
            ))}
          </div>
        )}
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
