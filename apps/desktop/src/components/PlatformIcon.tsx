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

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'IG',
  telegram: 'TG',
  vk: 'VK',
  facebook: 'f',
  threads: '@',
  x: 'X',
  tiktok: '♪',
  linkedin: 'in',
  bluesky: '🦋',
};

interface PlatformIconProps {
  platformId: string;
  size?: number;
  muted?: boolean;
}

export function PlatformIcon({ platformId, size = 20, muted = false }: PlatformIconProps) {
  const color = PLATFORM_COLORS[platformId] ?? 'var(--text-muted)';
  const label = PLATFORM_LABELS[platformId] ?? platformId.slice(0, 2).toUpperCase();

  return (
    <span
      className={`platform-icon ${muted ? 'platform-icon--muted' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: muted ? 'var(--bg-surface-muted)' : `${color}18`,
        color: muted ? 'var(--text-muted)' : color,
      }}
      aria-hidden
    >
      {label}
    </span>
  );
}
