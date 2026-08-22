import type { PlatformPreviewProps } from '@reizoko/platform-sdk';
import { CheckCheck } from 'lucide-react';
import './telegram-preview.css';

export function TelegramPreview({ transformed, getMediaUrl, socialAccount }: PlatformPreviewProps) {
  const channelName = socialAccount?.displayName ?? 'Reizoko Channel';
  const channelHandle = socialAccount?.handle ?? '@reizoko';

  return (
    <div className="tg-preview" data-testid="telegram-preview">
      <div className="tg-preview__channel">
        <span className="tg-preview__channel-icon">✈</span>
        <span data-testid="preview-account-name">{channelName}</span>
        <span className="tg-preview__channel-handle" data-testid="preview-account-handle">
          {channelHandle}
        </span>
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
