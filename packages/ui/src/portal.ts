export const DEFAULT_PORTAL_ROOT_ID = 'modular-ui-overlay-root';

function resolvePortalTarget(targetId: string): HTMLElement {
  return document.getElementById(targetId) ?? document.body;
}

export function portal(node: HTMLElement, targetId = DEFAULT_PORTAL_ROOT_ID) {
  if (typeof document === 'undefined') {
    return;
  }

  let currentTarget = resolvePortalTarget(targetId);
  currentTarget.appendChild(node);

  return {
    update(nextTargetId: string) {
      if (!nextTargetId || nextTargetId === targetId) return;
      targetId = nextTargetId;
      const nextTarget = resolvePortalTarget(targetId);
      if (nextTarget === currentTarget) return;
      nextTarget.appendChild(node);
      currentTarget = nextTarget;
    },
    destroy() {
      if (node.parentNode === currentTarget) {
        currentTarget.removeChild(node);
      }
    }
  };
}
