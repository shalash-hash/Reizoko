interface PlatformBrandIconProps {
  size?: number;
  className?: string;
}

export function InstagramBrandIcon({ size = 20, className }: PlatformBrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm11.5 1.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  );
}

export function TelegramBrandIcon({ size = 20, className }: PlatformBrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M21.94 4.66 2.8 12.04c-1.55.64-1.53 1.48-.28 1.87l4.88 1.52 1.87 5.7c.24.65.44.9.9.9.58 0 .83-.27 1.15-.59l2.76-2.67 5.74 4.24c1.06.58 1.82.28 2.08-1l3.35-15.76c.39-1.56-.6-2.27-1.74-1.85zM8.68 14.02l9.69-6.1c.47-.3.9-.14.55.19l-8.33 7.58-.31 3.18-1.6-4.85z" />
    </svg>
  );
}

export function VkBrandIcon({ size = 20, className }: PlatformBrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12.82 16.5c-5.17 0-8.12-3.55-8.25-9.47h2.58c.09 4.35 2 6.07 3.5 6.43V7.03h2.43v3.67c1.49-.16 3.05-1.86 3.58-3.67h2.43c-.41 2.27-1.77 3.97-3.49 4.67 1.72.8 4.48 2.57 5.53 4.4h-2.68c-.79-1.23-2.76-2.42-4.83-2.53v2.53h-.3z" />
    </svg>
  );
}
