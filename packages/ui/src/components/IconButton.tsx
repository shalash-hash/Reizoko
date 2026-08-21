import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './icon-button.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function IconButton({
  label,
  size = 'md',
  children,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn--${size} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
