const browser = typeof window !== 'undefined';
let browserTabId: string | null = null;

function getMyTabId(): string {
  if (!browser) return 'server';
  // Keep one stable ID per live browsing context, but avoid sessionStorage:
  // duplicated tabs can clone sessionStorage and end up suppressing each
  // other's messages as if they were self-sent.
  if (!browserTabId) {
    browserTabId = crypto.randomUUID();
  }
  return browserTabId;
}

export function createLeaderElection(isolationKey: string) {
  const LEADER_KEY = `db_global_leader_${isolationKey}`;

  if (!browser) {
    return {
      isLeader: false,
      tabId: 'server',
      leaderSessionId: 0,
      release: () => {},
      destroy: () => {},
      onChange: () => () => {}
    };
  }

  const myTabId = getMyTabId();
  let isLeader = $state(false);
  let leaderSessionId = $state(0);
  let handlers: Array<() => void> = [];
  let destroyed = false;
  let abortController = new AbortController();

  function notifyHandlers() {
    for (const h of handlers) {
      h();
    }
  }

  function acquireLock() {
    if (destroyed) return;
    
    if (navigator.locks) {
      navigator.locks.request(LEADER_KEY, { signal: abortController.signal }, (lock) => {
        if (destroyed || abortController.signal.aborted) return Promise.resolve();
        
        isLeader = true;
        leaderSessionId++;
        notifyHandlers();
        
        return new Promise<void>((resolve) => {
          // Hold the lock until aborted
          abortController.signal.addEventListener('abort', () => {
            isLeader = false;
            notifyHandlers();
            resolve();
          });
        });
      }).catch(err => {
        if (err.name === 'AbortError') {
          // Expected when aborted while waiting in queue
        } else {
          console.error("Lock acquisition failed:", err);
        }
      });
    } else {
      console.warn("navigator.locks API not supported. Leader election requires Web Locks API.");
    }
  }

  function releaseLeadership() {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  }

  function onBeforeUnload() {
    releaseLeadership();
  }

  window.addEventListener('beforeunload', onBeforeUnload);

  function destroy() {
    destroyed = true;
    window.removeEventListener('beforeunload', onBeforeUnload);
    releaseLeadership();
    handlers = [];
  }

  // Request lock immediately
  acquireLock();

  return {
    get isLeader() { return isLeader; },
    get tabId() { return myTabId; },
    get leaderSessionId() { return leaderSessionId; },
    release: releaseLeadership,
    destroy,
    onChange(handler: () => void) {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter(h => h !== handler);
      };
    }
  };
}

export type LeaderElection = ReturnType<typeof createLeaderElection>;

/**
 * Shared tab-level leader election. All profiles in a tab share a single
 * Web Lock so that one tab is the leader for ALL profiles simultaneously.
 * Calling this multiple times in the same tab returns the same instance.
 */
let _tabLeader: LeaderElection | null = null;

export function createTabLeaderElection(): LeaderElection {
  if (_tabLeader) return _tabLeader;
  _tabLeader = createLeaderElection('__tab__');
  return _tabLeader;
}

/**
 * Tear down the shared tab leader election singleton.
 * Called during full teardown (e.g. teardownAllRuntimes).
 */
export function destroyTabLeaderElection(): void {
  if (_tabLeader) {
    _tabLeader.destroy();
    _tabLeader = null;
  }
}
