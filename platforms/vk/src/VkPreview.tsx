import type { PlatformPreviewProps } from '@reizoko/platform-sdk';
import { ThumbsUp, MessageSquare, Share2, MoreHorizontal } from 'lucide-react';
import './vk-preview.css';

export function VkPreview({ transformed, getMediaUrl }: PlatformPreviewProps) {
  return (
    <div className="vk-preview">
      <div className="vk-preview__header">
        <div className="vk-preview__avatar">R</div>
        <div className="vk-preview__header-text">
          <div className="vk-preview__name">Reizoko</div>
          <div className="vk-preview__time">только что · 🌐</div>
        </div>
        <MoreHorizontal size={18} className="vk-preview__more" strokeWidth={1.75} />
      </div>

      <div className="vk-preview__text">
        {transformed.text || <span className="muted">Текст записи…</span>}
      </div>

      {transformed.images.length > 0 && (
        <div className={`vk-preview__photos vk-preview__photos--${Math.min(transformed.images.length, 3)}`}>
          {transformed.images.map((img) => {
            const url = getMediaUrl(img.mediaId);
            return url ? <img key={img.mediaId} src={url} alt={img.alt ?? ''} /> : null;
          })}
        </div>
      )}

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
