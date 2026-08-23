import type { ReactNode } from 'react';
import { createBackdropDismissHandlers } from './backdrop-dismiss';

interface AccountDialogOverlayProps {
  children: ReactNode;
  onClose: () => void;
  disabled?: boolean;
  className?: string;
}

export function AccountDialogOverlay({
  children,
  onClose,
  disabled = false,
  className = 'account-dialog-overlay',
}: AccountDialogOverlayProps) {
  const backdropHandlers = createBackdropDismissHandlers(onClose, { disabled });

  return (
    <div className={className} role="presentation" {...backdropHandlers}>
      {children}
    </div>
  );
}
