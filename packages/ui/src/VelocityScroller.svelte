<script lang="ts">
  let {
    scrollContainer = $bindable(null),
    scrollBounds = null
  }: {
    scrollContainer: HTMLElement | null;
    scrollBounds?: (() => { min: number; max: number } | null) | null;
  } = $props();

  let trackEl: HTMLElement | null = $state(null);
  let isDragging = $state(false);
  let thumbOffsetY = $state(0); // pixels from center, negative = up
  let maxDeflection = $state(100);
  let rafId: number | null = null;
  let lastFrameTime: number | null = null;

  const MAX_SPEED = 2000;

  let normalizedOffset = $derived(
    maxDeflection > 0 ? Math.max(-1, Math.min(1, thumbOffsetY / maxDeflection)) : 0
  );

  let targetVelocity = $derived(normalizedOffset * Math.abs(normalizedOffset) * MAX_SPEED);

  let upAlpha = $derived(Math.max(0, -normalizedOffset) ** 2 * 0.18);
  let downAlpha = $derived(Math.max(0, normalizedOffset) ** 2 * 0.18);

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    trackEl?.setPointerCapture(e.pointerId);
    isDragging = true;
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(scrollLoop);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging || !trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const rawOffset = e.clientY - centerY;
    thumbOffsetY = Math.max(-maxDeflection, Math.min(maxDeflection, rawOffset));
  }

  function handlePointerUp(_e: PointerEvent) {
    isDragging = false;
    thumbOffsetY = 0;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastFrameTime = null;
  }

  function scrollLoop(now: number) {
    if (!isDragging || !scrollContainer) {
      rafId = null;
      lastFrameTime = null;
      return;
    }

    if (lastFrameTime !== null) {
      const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
      const delta = targetVelocity * dt;
      const nativeMax = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0);
      const bounds = scrollBounds?.();
      const minScroll = bounds?.min ?? 0;
      const maxScroll = bounds?.max ?? nativeMax;
      const nextScroll = Math.max(minScroll, Math.min(scrollContainer.scrollTop + delta, maxScroll));
      scrollContainer.scrollTop = nextScroll;
    }

    lastFrameTime = now;
    rafId = requestAnimationFrame(scrollLoop);
  }

  $effect(() => {
    if (!trackEl) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        maxDeflection = entry.contentRect.height / 2 - 18;
        if (maxDeflection < 20) maxDeflection = 20;
      }
    });
    observer.observe(trackEl);
    return () => observer.disconnect();
  });

  $effect(() => {
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  });
</script>

<!--
  VelocityScroller: a velocity-based scroll handle.
  Place alongside the scroll container inside a position:relative wrapper.
  It fills the full height of that wrapper via position:absolute.
-->
<div
  class="velocity-scroller"
  bind:this={trackEl}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  role="slider"
  aria-label="Scroll velocity"
  aria-orientation="vertical"
  aria-valuemin="-100"
  aria-valuemax="100"
  aria-valuenow={Math.round(normalizedOffset * 100)}
  tabindex="0"
>
  <div class="track">
    <div class="tint tint-up" style:opacity={upAlpha}></div>
    <div class="tint tint-down" style:opacity={downAlpha}></div>
    <div class="center-line"></div>
  </div>
  <div
    class="thumb"
    class:dragging={isDragging}
    style:top="calc(50% + {thumbOffsetY}px)"
  ></div>
</div>

<style>
  .velocity-scroller {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 28px;
    z-index: 2;
    touch-action: none;
    user-select: none;
    cursor: ns-resize;
  }

  .track {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: stretch;
    justify-content: center;
    border-radius: 0 6px 6px 0;
    overflow: hidden;
  }

  .tint {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
  }

  .tint-up {
    top: 0;
    bottom: 50%;
    background: linear-gradient(to bottom, rgba(100, 160, 255, 1), transparent);
  }

  .tint-down {
    top: 50%;
    bottom: 0;
    background: linear-gradient(to top, rgba(255, 140, 80, 1), transparent);
  }

  .center-line {
    position: absolute;
    left: 6px;
    right: 6px;
    top: 50%;
    height: 1px;
    background: var(--color-border, rgba(0, 0, 0, 0.12));
    pointer-events: none;
  }

  .thumb {
    position: absolute;
    left: 2px;
    right: 2px;
    height: 36px;
    margin-top: -18px;
    background: var(--color-foreground, #333);
    opacity: 0.4;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    transition: top 0.2s cubic-bezier(0.22, 0.68, 0, 1.1), opacity 0.15s ease;
    pointer-events: none;
  }

  .thumb.dragging {
    opacity: 0.85;
    transition: opacity 0.1s ease;
  }
</style>
