// Shared overlay / modal host state. A single active overlay at a time.
// Any component can open an overlay and `<OverlayHost>` renders whichever
// one is currently active.

export type OverlayDescriptor = {
  id: string;
  component: any;
  props?: Record<string, unknown>;
  shellClass?: string;
  shellStyle?: string;
  panelClass?: string;
  panelStyle?: string;
  backdropClass?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onClose?: () => void;
};

let activeOverlay = $state<OverlayDescriptor | null>(null);

export function getActiveOverlay(): OverlayDescriptor | null {
  return activeOverlay;
}

export function openOverlay(descriptor: OverlayDescriptor): void {
  activeOverlay = descriptor;
}

export function updateOverlay(id: string, patch: Partial<OverlayDescriptor>): void {
  const current = activeOverlay;
  if (!current || current.id !== id) return;
  activeOverlay = {
    ...current,
    ...patch,
    props: patch.props ? { ...(current.props ?? {}), ...patch.props } : current.props
  };
}

export function closeOverlay(id?: string): void {
  const current = activeOverlay;
  if (!current) return;
  if (id && current.id !== id) return;
  activeOverlay = null;
  current.onClose?.();
}
