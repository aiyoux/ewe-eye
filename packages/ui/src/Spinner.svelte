<script lang="ts" module>
  /**
   * Dual-arc conic spinner, ported from the legacy wisewords app and
   * modernised for Svelte 5 runes + the shared UI design tokens.
   *
   * Two counterpoint arcs (the second offset half a turn) read as a single
   * spinning ring. A configurable grace delay keeps the spinner visible
   * briefly after `spinning` flips false so that fast ops don't visibly
   * flicker on/off — the same feel the legacy app had.
   *
   * All visual dimensions are CSS custom properties so callers can size/tint
   * it (e.g. fetch vs sync color) without forking the component.
   */
</script>

<script lang="ts">
  import { cn } from './utils.js';

  let {
    spinning = false,
    size = 16,
    width = 2.5,
    speed = '0.8s',
    color = 'var(--color-primary)',
    graceMs = 1000,
    class: className = ''
  }: {
    spinning?: boolean;
    /** Ring outer diameter in px. */
    size?: number;
    /** Ring stroke thickness in px. */
    width?: number;
    /** Rotation period, e.g. '0.8s'. */
    speed?: string;
    /** Any CSS color (token var, hex, etc.). */
    color?: string;
    /** Keep spinning this long after `spinning` goes false, to avoid flicker. */
    graceMs?: number;
    class?: string;
  } = $props();

  // Grace: stay visible for `graceMs` after spinning stops. Tracked with a
  // timeout that we clear/re-arm whenever `spinning` changes.
  let visible = $state(false);
  let graceTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const on = spinning;
    if (on) {
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = undefined;
      }
      visible = true;
    } else if (visible) {
      if (graceTimer) clearTimeout(graceTimer);
      graceTimer = setTimeout(() => {
        visible = false;
        graceTimer = undefined;
      }, graceMs);
    }
  });

  $effect(() => {
    return () => {
      if (graceTimer) clearTimeout(graceTimer);
    };
  });

  const inner = $derived(size - width * 2);
  const ringVars = $derived(`--spinner-size:${size}px;--spinner-width:${width}px;--spinner-inner:${inner}px;--spinner-color:${color};--spinner-speed:${speed};`);
</script>

<span
  class={cn('spinner-root inline-flex items-center justify-center align-middle', className)}
  class:on={visible}
  style={ringVars}
  role="status"
  aria-live="off"
  aria-hidden={!visible}
>
  <span class="spinner-arc spinner-arc--a"></span>
  <span class="spinner-arc spinner-arc--b"></span>
</span>

<style>
  .spinner-root {
    width: var(--spinner-size);
    height: var(--spinner-size);
    position: relative;
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
    pointer-events: none;
  }
  .spinner-root.on {
    opacity: 1;
    transform: scale(1);
  }

  .spinner-arc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    /* Dual-arc ring: a conic gradient masked to a ring, plus a small dot cap
       at the leading edge. The second arc is rotated half a turn so the two
       arcs chase each other around the ring. */
    background:
      radial-gradient(farthest-side, var(--spinner-color) 96%, #0000) top / var(--spinner-width) var(--spinner-width) no-repeat,
      conic-gradient(#0000 60%, var(--spinner-color));
    -webkit-mask: radial-gradient(farthest-side, #0000 calc(100% - var(--spinner-width)), #000 0);
    mask: radial-gradient(farthest-side, #0000 calc(100% - var(--spinner-width)), #000 0);
    animation: spinner-rotate var(--spinner-speed) linear infinite;
    animation-play-state: paused;
  }
  .spinner-arc--b {
    animation-delay: calc(var(--spinner-speed) * -0.5);
  }
  .spinner-root.on .spinner-arc {
    animation-play-state: running;
  }

  @keyframes spinner-rotate {
    to {
      transform: rotate(1turn);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner-arc {
      animation: none;
    }
    .spinner-root.on {
      opacity: 0.7;
    }
  }
</style>