import type { PlatformPreviewProps } from '@reizoko/platform-sdk';
import { CheckCheck } from 'lucide-react';
import './telegram-preview.css';

export function TelegramPreview({ transformed, getMediaUrl }: PlatformPreviewProps) {
  return (
    <div className="tg-preview">
      <div className="tg-preview__channel">
        <span className="tg-preview__channel-icon">✈</span>
        Reizoko Channel
      </div>

      <div className="tg-preview__bubble">
        {transformed.images.map((img) => {
          const url = getMediaUrl(img.mediaId);
          return url ? (
            <img key={img.mediaId} src={url} alt={img.alt ?? ''} className="tg-preview__image" />
          ) : null;
        })}
        <div
          className="tg-preview__text"
          dangerouslySetInnerHTML={{
            __html:
              transformed.text.replace(/\n/g, '<br/>') ||
              '<span class="muted">Текст сообщения…</span>',
          }}
        />
        <div className="tg-preview__meta">
          12:00
          <CheckCheck size={14} strokeWidth={2} className="tg-preview__checks" />
        </div>
      </div>
    </div>
  );
}
