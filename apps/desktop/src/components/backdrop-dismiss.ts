export function shouldDismissBackdropOnPointerUp(input: {
  pointerStartedOnBackdrop: boolean;
  pointerEndedOnBackdrop: boolean;
  disabled?: boolean;
}): boolean {
  if (input.disabled) return false;
  return input.pointerStartedOnBackdrop && input.pointerEndedOnBackdrop;
}

export function createBackdropDismissHandlers(
  onClose: () => void,
  options?: { disabled?: boolean },
) {
  let pointerStartedOnBackdrop = false;
  const disabled = options?.disabled ?? false;

  return {
    onPointerDown: (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
      if (disabled) return;
      pointerStartedOnBackdrop = event.target === event.currentTarget;
    },
    onPointerUp: (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
      if (
        shouldDismissBackdropOnPointerUp({
          pointerStartedOnBackdrop,
          pointerEndedOnBackdrop: event.target === event.currentTarget,
          disabled,
        })
      ) {
        onClose();
      }
      pointerStartedOnBackdrop = false;
    },
    onPointerCancel: () => {
      pointerStartedOnBackdrop = false;
    },
  };
}
