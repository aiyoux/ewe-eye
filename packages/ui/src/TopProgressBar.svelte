<script lang="ts" module>
  /**
   * Thin global loading strip pinned to the very top of the viewport.
   *
   * A short glowing segment sweeps left→right and cycles around while active,
   * then the whole strip fades out when idle. A soft gradient bleeds below the
   * 2px bar so the glow reads as light spilling down rather than a hard line.
   *
   * The caller picks the color so a single instance can be tinted differently
   * for fetch (reads) vs sync (writes) activity — pass whichever is active,
   * preferring sync when both are.
   */
</script>

<script lang="ts">
  import { cn } from './utils.js';

  let {
    active = false,
    color = 'var(--color-primary)',
    /** Bar height in px. */
    height = 2,
    /** Sweep period, e.g. '1.4s'. */
    speed = '1.4s',
    class: className = ''
  }: {
    active?: boolean;
    /** Any CSS color (token var, hex, etc.). */
    color?: string;
    height?: number;
    speed?: string;
    class?: string;
  } = $props();
</script>

<div
  class={cn('top-progress', className)}
  class:on={active}
  style={`--top-progress-color:${color};--top-progress-speed:${speed};--top-progress-height:${height}px;`}
  aria-hidden="true"
>
  <div class="top-progress__track"></div>
  <div class="top-progress__sweep"></div>
</div>

<style>
  .top-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--top-progress-height);
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  .top-progress.on {
    opacity: 1;
  }

  /* Faint full-width track so the strip is legible even ahead of the sweep. */
  .top-progress__track {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--top-progress-color) 16%, transparent);
  }

  /* The glowing segment that sweeps across and cycles around. */
  .top-progress__sweep {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 20%;
    transform: translateX(-150%);
    background: linear-gradient(
      90deg,
      transparent,
      var(--top-progress-color) 35%,
      #fff 50%,
      var(--top-progress-color) 65%,
      transparent
    );
    box-shadow: 0 0 4px 0 var(--top-progress-color);
    border-radius: 9999px;
    opacity: 0;
  }
  .top-progress.on .top-progress__sweep {
    opacity: 1;
    animation: top-progress-sweep var(--top-progress-speed) ease-in-out infinite;
  }

  /* Soft glow bleeding below the bar — gradient fade at the bottom edge. */
  .top-progress::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 5px;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--top-progress-color) 28%, transparent),
      transparent
    );
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  .top-progress.on::after {
    opacity: 1;
  }

  @keyframes top-progress-sweep {
    0% {
      transform: translateX(-150%);
    }
    100% {
      transform: translateX(550%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .top-progress.on .top-progress__sweep {
      animation: none;
      transform: translateX(0);
      width: 100%;
    }
  }
</style>