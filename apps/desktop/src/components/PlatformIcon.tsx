import { InstagramBrandIcon, TelegramBrandIcon, VkBrandIcon } from './platform-icons/brand-icons';
import './platform-icon.css';

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  telegram: '#0088CC',
  vk: '#0077FF',
  facebook: '#1877F2',
  threads: '#000000',
  x: '#000000',
  tiktok: '#010101',
  linkedin: '#0A66C2',
  bluesky: '#0085FF',
};

interface PlatformIconProps {
  platformId: string;
  size?: number;
  muted?: boolean;
}

export function PlatformIcon({ platformId, size = 20, muted = false }: PlatformIconProps) {
  const color = PLATFORM_COLORS[platformId] ?? 'var(--text-muted)';
  const iconColor = muted ? 'var(--text-muted)' : color;
  const background = muted ? 'var(--bg-surface-muted)' : `color-mix(in srgb, ${color} 14%, transparent)`;

  const icon = renderBrandIcon(platformId, size);

  return (
    <span
      className={`platform-icon ${muted ? 'platform-icon--muted' : ''}`}
      style={{
        width: size,
        height: size,
        background,
        color: iconColor,
      }}
      data-platform-icon={platformId}
      aria-hidden
    >
      {icon}
    </span>
  );
}

function renderBrandIcon(platformId: string, size: number) {
  const iconSize = Math.round(size * 0.62);
  const className = 'platform-icon__svg';

  switch (platformId) {
    case 'instagram':
      return <InstagramBrandIcon size={iconSize} className={className} />;
    case 'telegram':
      return <TelegramBrandIcon size={iconSize} className={className} />;
    case 'vk':
      return <VkBrandIcon size={iconSize} className={className} />;
    default:
      return (
        <span className="platform-icon__fallback" style={{ fontSize: iconSize * 0.7 }}>
          {platformId.slice(0, 1).toUpperCase()}
        </span>
      );
  }
}
