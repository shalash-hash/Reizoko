import type { ReactNode } from 'react';
import './badge.css';

interface BadgeProps {
  variant?: 'default' | 'planned' | 'success' | 'warning' | 'info' | 'danger';
  children: ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
