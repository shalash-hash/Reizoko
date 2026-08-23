import { describe, expect, it } from 'vitest';

import { shouldDismissBackdropOnPointerUp } from './backdrop-dismiss';

describe('backdrop dismiss', () => {
  it('closes on backdrop click', () => {
    expect(
      shouldDismissBackdropOnPointerUp({
        pointerStartedOnBackdrop: true,
        pointerEndedOnBackdrop: true,
      }),
    ).toBe(true);
  });

  it('does not close when pointer started inside modal', () => {
    expect(
      shouldDismissBackdropOnPointerUp({
        pointerStartedOnBackdrop: false,
        pointerEndedOnBackdrop: true,
      }),
    ).toBe(false);
  });

  it('does not close after text selection drag ending inside input', () => {
    expect(
      shouldDismissBackdropOnPointerUp({
        pointerStartedOnBackdrop: false,
        pointerEndedOnBackdrop: false,
      }),
    ).toBe(false);
  });

  it('does not close when disabled', () => {
    expect(
      shouldDismissBackdropOnPointerUp({
        pointerStartedOnBackdrop: true,
        pointerEndedOnBackdrop: true,
        disabled: true,
      }),
    ).toBe(false);
  });
});
