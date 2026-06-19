import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveBus } from './live.ts';

type MessageHandler = (event: { data: unknown }) => void;

class MockBroadcastChannel {
  static channels = new Map<string, Set<MockBroadcastChannel>>();

  readonly name: string;
  private listeners = new Set<MessageHandler>();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  addEventListener(type: string, handler: MessageHandler) {
    if (type === 'message') {
      this.listeners.add(handler);
    }
  }

  postMessage(data: unknown) {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;

    for (const peer of peers) {
      if (peer === this) continue;
      for (const listener of peer.listeners) {
        listener({ data });
      }
    }
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static reset() {
    MockBroadcastChannel.channels.clear();
  }
}

describe('createLiveBus', () => {
  let originalBroadcastChannel: typeof globalThis.BroadcastChannel | undefined;
  let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
  const originalDocument = globalThis.document;
  let scheduledFrame: FrameRequestCallback | null = null;

  beforeEach(() => {
    originalBroadcastChannel = globalThis.BroadcastChannel;
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    scheduledFrame = null;

    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      writable: true,
      value: MockBroadcastChannel
    });

    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback;
        return 1;
      })
    });
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
    vi.useRealTimers();

    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      writable: true,
      value: originalBroadcastChannel
    });

    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame
    });

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: originalDocument
    });
  });

  it('delivers SyncWake without waiting for animation-frame coalescing', () => {
    const leaderBus = createLiveBus('scope-A', 'leader');
    const followerBus = createLiveBus('scope-A', 'follower');
    const received: string[] = [];

    leaderBus.onMessage((msg) => {
      received.push(msg.type);
    });

    followerBus.broadcast({ type: 'SyncWake' });

    expect(received).toEqual(['SyncWake']);
    expect(scheduledFrame).toBeNull();

    leaderBus.destroy();
    followerBus.destroy();
  });

  it('continues to coalesce cache mutations behind requestAnimationFrame', () => {
    const leaderBus = createLiveBus('scope-B', 'leader');
    const followerBus = createLiveBus('scope-B', 'follower');
    const received: string[] = [];

    leaderBus.onMessage((msg) => {
      received.push(msg.type);
    });

    followerBus.broadcast({
      type: 'RecordDelete',
      id: 'records:1'
    });

    expect(received).toEqual([]);
    expect(scheduledFrame).not.toBeNull();

    scheduledFrame?.(0);

    expect(received).toEqual(['RecordDelete']);

    leaderBus.destroy();
    followerBus.destroy();
  });

  it('does not let immediate messages consume mutation sequence numbers', () => {
    const leaderBus = createLiveBus('scope-C', 'leader');
    const followerBus = createLiveBus('scope-C', 'follower');
    const received: string[] = [];

    leaderBus.onMessage((msg) => {
      received.push(msg.type);
    });

    followerBus.broadcast({ type: 'SyncWake' });
    followerBus.broadcast({
      type: 'RecordDelete',
      id: 'records:1'
    });

    expect(received).toEqual(['SyncWake']);
    expect(scheduledFrame).not.toBeNull();

    scheduledFrame?.(0);

    expect(received).toEqual(['SyncWake', 'RecordDelete']);

    leaderBus.destroy();
    followerBus.destroy();
  });

  it('flushes queued mutations with a timeout fallback when the tab is hidden', async () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: { visibilityState: 'hidden' }
    });

    const leaderBus = createLiveBus('scope-D', 'leader');
    const followerBus = createLiveBus('scope-D', 'follower');
    const received: string[] = [];

    leaderBus.onMessage((msg) => {
      received.push(msg.type);
    });

    followerBus.broadcast({
      type: 'RecordDelete',
      id: 'records:2'
    });

    expect(received).toEqual([]);
    expect(scheduledFrame).toBeNull();

    await vi.runAllTimersAsync();

    expect(received).toEqual(['RecordDelete']);

    leaderBus.destroy();
    followerBus.destroy();
  });
});
