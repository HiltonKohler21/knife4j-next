import { del as deleteIndexedDbKey, keys as listIndexedDbKeys } from 'idb-keyval';

/**
 * Every persistent Knife4j value must use a key or prefix declared here and be
 * added to the matching registry below. Cleanup must never broaden to an
 * entire browser storage area or IndexedDB store.
 */
export const KNIFE4J_STORAGE_KEYS = {
  settings: 'Knife4jGlobalSettings',
  language: 'knife4j-lang',
  legacyGlobalParams: 'knife4j_global_params',
  legacyAuth: 'knife4j_auth',
  legacyAuthMigrated: 'knife4j_auth_migrated',
  tabItems: 'knife4j-next:tab-items',
  tabActive: 'knife4j-next:tab-active',
  /** Internal cross-context coordination lease; never treated as user data. */
  resetLease: 'knife4j-next:storage-reset-lease',
  /** Legacy mutation lease: reserved for older pages, never allocated by current writers. */
  mutationLease: 'knife4j-next:storage-mutation-lease',
  /** Durable cross-tab request-cache cleanup epoch; an expired record retains the latest generation. */
  requestCacheEpoch: 'knife4j-next:request-cache-cleanup-epoch',
  /** Last completed or active reset generation, retained to invalidate stale in-memory state. */
  resetGeneration: 'knife4j-next:storage-reset-generation',
} as const;

export const KNIFE4J_STORAGE_PREFIXES = {
  debugCache: 'knife4j-next:debug-cache:',
  debugHistory: 'knife4j-next:debug-history:',
  /** Per-document baseline used by per-operation API change prompts. */
  apiVersionBaseline: 'knife4j-next:api-version-baseline:',
  /** Exact-URI hash grants for one immutable OAS document scope; never stores response bodies or full query values. */
  resourceGrants: 'knife4j-next:resource-grants:',
  groupGlobalParams: 'knife4j:global-params:',
  applicationGlobalParams: 'knife4j:application-global-params:',
  oauth2Pending: 'knife4j:oauth2:pending:',
  authIndexedDb: 'knife4j:auth:',
  /** Per-reset fallback contenders; retained only while acquiring the lease. */
  resetClaim: 'knife4j-next:storage-reset-claim:',
  /** Legacy mutation contenders: reserved so cleanup does not disturb older pages. */
  mutationClaim: 'knife4j-next:storage-mutation-claim:',
} as const;

export type Knife4jStorageCleanupScope = 'request-cache' | 'all-local-data';
export type Knife4jStorageArea = 'localStorage' | 'sessionStorage' | 'indexedDB';

type RegisteredEntry = {
  match: 'exact' | 'prefix';
  value: string;
  scope: Knife4jStorageCleanupScope;
  preserveDuringCleanup?: boolean;
};

export const KNIFE4J_STORAGE_REGISTRY = {
  localStorage: [
    { match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.debugCache, scope: 'request-cache' },
    { match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.debugHistory, scope: 'request-cache' },
    { match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.apiVersionBaseline, scope: 'request-cache' },
    { match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.resourceGrants, scope: 'all-local-data' },
    { match: 'exact', value: KNIFE4J_STORAGE_KEYS.settings, scope: 'all-local-data' },
    { match: 'exact', value: KNIFE4J_STORAGE_KEYS.language, scope: 'all-local-data' },
    { match: 'exact', value: KNIFE4J_STORAGE_KEYS.legacyGlobalParams, scope: 'all-local-data' },
    { match: 'exact', value: KNIFE4J_STORAGE_KEYS.legacyAuth, scope: 'all-local-data' },
    { match: 'exact', value: KNIFE4J_STORAGE_KEYS.legacyAuthMigrated, scope: 'all-local-data' },
    { match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.groupGlobalParams, scope: 'all-local-data' },
    { match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.applicationGlobalParams, scope: 'all-local-data' },
    {
      match: 'exact',
      value: KNIFE4J_STORAGE_KEYS.resetLease,
      scope: 'all-local-data',
      preserveDuringCleanup: true,
    },
    {
      match: 'exact',
      value: KNIFE4J_STORAGE_KEYS.resetGeneration,
      scope: 'all-local-data',
      preserveDuringCleanup: true,
    },
    {
      match: 'prefix',
      value: KNIFE4J_STORAGE_PREFIXES.resetClaim,
      scope: 'all-local-data',
      preserveDuringCleanup: true,
    },
    {
      match: 'exact',
      value: KNIFE4J_STORAGE_KEYS.mutationLease,
      scope: 'all-local-data',
      preserveDuringCleanup: true,
    },
    {
      match: 'exact',
      value: KNIFE4J_STORAGE_KEYS.requestCacheEpoch,
      scope: 'request-cache',
      preserveDuringCleanup: true,
    },
    {
      match: 'prefix',
      value: KNIFE4J_STORAGE_PREFIXES.mutationClaim,
      scope: 'all-local-data',
      preserveDuringCleanup: true,
    },
  ],
  sessionStorage: [
    { match: 'exact', value: KNIFE4J_STORAGE_KEYS.tabItems, scope: 'request-cache' },
    { match: 'exact', value: KNIFE4J_STORAGE_KEYS.tabActive, scope: 'request-cache' },
    { match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.oauth2Pending, scope: 'all-local-data' },
  ],
  indexedDB: [{ match: 'prefix', value: KNIFE4J_STORAGE_PREFIXES.authIndexedDb, scope: 'all-local-data' }],
} as const satisfies Record<Knife4jStorageArea, readonly RegisteredEntry[]>;

export interface Knife4jWebStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Knife4jIndexedDbStorage {
  keys(): Promise<IDBValidKey[]>;
  delete(key: IDBValidKey): Promise<void>;
}

export interface Knife4jStorageAdapters {
  localStorage: Knife4jWebStorage | null;
  sessionStorage: Knife4jWebStorage | null;
  indexedDB: Knife4jIndexedDbStorage | null;
}

export interface Knife4jStorageCleanupFailure {
  area: Knife4jStorageArea;
  key?: string;
  reason: string;
}

export interface Knife4jStorageCleanupResult {
  scope: Knife4jStorageCleanupScope;
  removed: Record<Knife4jStorageArea, number>;
  failures: Knife4jStorageCleanupFailure[];
}

export interface Knife4jStorageLockManager {
  request<T>(
    name: string,
    options: { mode: 'shared' | 'exclusive'; ifAvailable?: boolean },
    callback: (lock: { name: string } | null) => T | PromiseLike<T>,
  ): Promise<T>;
}

const pendingKnife4jStorageWrites = new Set<Promise<unknown>>();
let allLocalDataCleanupCount = 0;
const KNIFE4J_STORAGE_RESET_LOCK = 'knife4j-next:storage-reset';
const KNIFE4J_STORAGE_RESET_LEASE_VERSION = 1;
const KNIFE4J_STORAGE_RESET_LEASE_TTL_MS = 2 * 60 * 1000;
const KNIFE4J_STORAGE_RESET_LEASE_POLL_MS = 50;
const KNIFE4J_STORAGE_QUOTA_RECOVERY_PREFIX = '!';
const KNIFE4J_STORAGE_COORDINATION_DB = 'knife4j-next-storage-coordination';
const KNIFE4J_STORAGE_COORDINATION_STORE = 'locks';
const KNIFE4J_STORAGE_COORDINATION_KEY = 'storage-mutation';
let storageCoordinationDatabase: Promise<IDBDatabase> | null = null;

export interface Knife4jStorageResetSnapshot {
  readonly generation: string;
  readonly active: boolean;
}

/** Value plus the reset/cache epochs observed by the read that produced it. */
export interface Knife4jStorageItemSnapshot {
  readonly value: string | null;
  readonly resetGeneration: string;
  readonly resetActive: boolean;
  readonly requestCacheGeneration?: string;
}

type Knife4jStorageResetListener = (snapshot: Knife4jStorageResetSnapshot) => void;

let observedResetSnapshot: Knife4jStorageResetSnapshot = { generation: '', active: false };
const resetSnapshotListeners = new Set<Knife4jStorageResetListener>();
let resetLeaseExpiryTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledResetLeaseStorage: Knife4jWebStorage | null = null;
let scheduledResetLeaseGeneration = '';
let scheduledResetLeaseExpiresAt = 0;

interface Knife4jStorageResetLease {
  version: typeof KNIFE4J_STORAGE_RESET_LEASE_VERSION;
  generation: string;
  expiresAt: number;
}

interface Knife4jStorageQuotaRecoveryEpoch {
  activeGeneration: string;
  inactiveGeneration: string;
  expiresAt: number;
}

interface PendingKnife4jWebStorageValue {
  writeId: string;
  value: string | null;
  generation: string;
  requestCacheGeneration?: string;
}

const pendingWebStorageValues = new WeakMap<object, Map<string, PendingKnife4jWebStorageValue>>();
const fallbackMutationTails = new WeakMap<object, Promise<void>>();

interface QueuedStorageSnapshot {
  storage: object;
  key: string;
  leaseStorage: Knife4jWebStorage;
  lockManager: Knife4jStorageLockManager | null;
  snapshot: Knife4jStorageItemSnapshot;
  started: boolean;
  superseded: boolean;
}

// Only adjacent full snapshots may replace one another. Public mutations seal
// this slot before any await, preserving deletion and read-modify-write order.
let queuedStorageSnapshot: QueuedStorageSnapshot | undefined;

function cancelResetLeaseExpiry(storage?: Knife4jWebStorage | null, generation?: string): void {
  if (
    resetLeaseExpiryTimer === null ||
    (storage !== undefined && scheduledResetLeaseStorage !== storage) ||
    (generation !== undefined && scheduledResetLeaseGeneration !== generation)
  ) {
    return;
  }
  clearTimeout(resetLeaseExpiryTimer);
  resetLeaseExpiryTimer = null;
  scheduledResetLeaseStorage = null;
  scheduledResetLeaseGeneration = '';
  scheduledResetLeaseExpiresAt = 0;
}

function scheduleResetLeaseExpiry(storage: Knife4jWebStorage, lease: Knife4jStorageResetLease, now = Date.now()): void {
  if (lease.expiresAt <= now) {
    cancelResetLeaseExpiry(storage, lease.generation);
    return;
  }
  if (
    resetLeaseExpiryTimer !== null &&
    scheduledResetLeaseStorage === storage &&
    scheduledResetLeaseGeneration === lease.generation &&
    scheduledResetLeaseExpiresAt === lease.expiresAt
  ) {
    return;
  }

  cancelResetLeaseExpiry();
  scheduledResetLeaseStorage = storage;
  scheduledResetLeaseGeneration = lease.generation;
  scheduledResetLeaseExpiresAt = lease.expiresAt;
  resetLeaseExpiryTimer = setTimeout(
    () => {
      resetLeaseExpiryTimer = null;
      scheduledResetLeaseStorage = null;
      scheduledResetLeaseGeneration = '';
      scheduledResetLeaseExpiresAt = 0;
      getKnife4jStorageResetSnapshot(storage);
    },
    Math.max(0, lease.expiresAt - now + 1),
  );
  (resetLeaseExpiryTimer as unknown as { unref?: () => void }).unref?.();
}

function observeResetSnapshot(generation: string, active: boolean): Knife4jStorageResetSnapshot {
  const nextGeneration = generation || observedResetSnapshot.generation;
  if (observedResetSnapshot.generation === nextGeneration && observedResetSnapshot.active === active) {
    return observedResetSnapshot;
  }

  observedResetSnapshot = { generation: nextGeneration, active };
  resetSnapshotListeners.forEach((listener) => {
    try {
      listener(observedResetSnapshot);
    } catch {
      // A consumer refresh failure must not weaken reset coordination.
    }
  });
  return observedResetSnapshot;
}

function parseResetLease(value: string | null): Knife4jStorageResetLease | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Knife4jStorageResetLease>;
    if (
      parsed.version !== KNIFE4J_STORAGE_RESET_LEASE_VERSION ||
      typeof parsed.generation !== 'string' ||
      !parsed.generation ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed as Knife4jStorageResetLease;
  } catch {
    return null;
  }
}

/** Compact `[!.]<expiry-seconds-base36>.<nonce>` marker kept small enough to replace an existing epoch at quota. */
function parseQuotaRecoveryEpoch(value: string): Knife4jStorageResetLease | null {
  const active = value.startsWith(KNIFE4J_STORAGE_QUOTA_RECOVERY_PREFIX);
  if (!active && !value.startsWith('.')) return null;
  const timestampStart = 1;
  const separator = value.indexOf('.', timestampStart);
  if (separator < 0) return null;
  if (!value.slice(separator + 1)) return null;
  const expiresAtSeconds = Number.parseInt(value.slice(timestampStart, separator), 36);
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= 0) return null;
  return {
    version: KNIFE4J_STORAGE_RESET_LEASE_VERSION,
    generation: value,
    expiresAt: active ? expiresAtSeconds * 1000 : 0,
  };
}

function createQuotaRecoveryEpoch(): Knife4jStorageQuotaRecoveryEpoch {
  const expiresAt = Math.ceil((Date.now() + KNIFE4J_STORAGE_RESET_LEASE_TTL_MS) / 1000) * 1000;
  const suffix = `${Math.floor(expiresAt / 1000).toString(36)}.${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
  return {
    activeGeneration: `${KNIFE4J_STORAGE_QUOTA_RECOVERY_PREFIX}${suffix}`,
    inactiveGeneration: `.${suffix}`,
    expiresAt,
  };
}

function publishQuotaRecoveryResetEpoch(
  storage: Knife4jWebStorage,
  canWrite: () => boolean,
): Knife4jStorageQuotaRecoveryEpoch | null {
  if (!canWrite()) return null;
  const epoch = createQuotaRecoveryEpoch();
  storage.setItem(KNIFE4J_STORAGE_KEYS.resetGeneration, epoch.activeGeneration);
  if (storage.getItem(KNIFE4J_STORAGE_KEYS.resetGeneration) !== epoch.activeGeneration) {
    throw new Error('quota recovery reset epoch was not persisted');
  }
  if (!canWrite()) return null;
  scheduleResetLeaseExpiry(storage, {
    version: KNIFE4J_STORAGE_RESET_LEASE_VERSION,
    generation: epoch.activeGeneration,
    expiresAt: epoch.expiresAt,
  });
  observeResetSnapshot(epoch.activeGeneration, true);
  return epoch;
}

function retainsQuotaRecoveryResetEpoch(storage: Knife4jWebStorage, epoch: Knife4jStorageQuotaRecoveryEpoch): boolean {
  const snapshot = getKnife4jStorageResetSnapshot(storage);
  return snapshot.active && snapshot.generation === epoch.activeGeneration;
}

function completeQuotaRecoveryResetEpoch(
  storage: Knife4jWebStorage | null,
  epoch: Knife4jStorageQuotaRecoveryEpoch | null,
  result: Knife4jStorageCleanupResult,
  canWrite: () => boolean,
): void {
  if (!storage || !epoch) return;
  const complete = (canWrite: () => boolean): boolean => {
    if (!canWrite()) return false;
    if (storage.getItem(KNIFE4J_STORAGE_KEYS.resetGeneration) !== epoch.activeGeneration) {
      getKnife4jStorageResetSnapshot(storage);
      return true;
    }
    storage.setItem(KNIFE4J_STORAGE_KEYS.resetGeneration, epoch.inactiveGeneration);
    if (storage.getItem(KNIFE4J_STORAGE_KEYS.resetGeneration) !== epoch.inactiveGeneration) {
      throw new Error('quota recovery reset epoch completion was not persisted');
    }
    if (!canWrite()) return false;
    cancelResetLeaseExpiry(storage, epoch.activeGeneration);
    observeResetSnapshot(epoch.inactiveGeneration, allLocalDataCleanupCount > 0);
    return true;
  };
  try {
    const completed = complete(canWrite);
    if (completed !== true && storage.getItem(KNIFE4J_STORAGE_KEYS.resetGeneration) === epoch.activeGeneration) {
      throw new Error('quota recovery reset epoch completion coordination unavailable');
    }
  } catch (error) {
    getKnife4jStorageResetSnapshot(storage);
    recordFailure(result, {
      area: 'localStorage',
      key: KNIFE4J_STORAGE_KEYS.resetGeneration,
      reason: `quota recovery reset epoch cleanup failed: ${errorMessage(error)}`,
    });
  }
}

interface Knife4jRequestCacheSnapshot {
  generation: string;
  active: boolean;
  expiresAt: number;
}

function getRequestCacheSnapshot(storage: Knife4jWebStorage | null): Knife4jRequestCacheSnapshot {
  if (!storage) return { generation: '', active: false, expiresAt: 0 };
  try {
    const stored = storage.getItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch);
    const epoch = parseResetLease(stored) ?? parseQuotaRecoveryEpoch(stored ?? '');
    if (!epoch) return { generation: '', active: false, expiresAt: 0 };
    return {
      generation: epoch.generation,
      active: epoch.expiresAt > Date.now(),
      expiresAt: epoch.expiresAt,
    };
  } catch {
    return { generation: '', active: false, expiresAt: 0 };
  }
}

function isRequestCacheStorageKey(key: string): boolean {
  return matchesRegisteredEntry(key, entriesForScope(KNIFE4J_STORAGE_REGISTRY.localStorage, 'request-cache'));
}

async function waitForRequestCacheWriteTurn(
  storage: Knife4jWebStorage | null,
  generation: string | undefined,
): Promise<boolean> {
  if (generation === undefined) return true;
  for (;;) {
    const snapshot = getRequestCacheSnapshot(storage);
    if (snapshot.generation !== generation) return false;
    if (!snapshot.active) return true;
    const remaining = Math.max(0, snapshot.expiresAt - Date.now());
    await new Promise((resolve) => setTimeout(resolve, Math.min(KNIFE4J_STORAGE_RESET_LEASE_POLL_MS, remaining)));
  }
}

function readResetLease(storage: Knife4jWebStorage | null, now = Date.now()): Knife4jStorageResetLease | null {
  if (!storage) return null;
  let lease: Knife4jStorageResetLease | null;
  try {
    lease = parseResetLease(storage.getItem(KNIFE4J_STORAGE_KEYS.resetLease));
  } catch {
    return null;
  }
  if (!lease) {
    cancelResetLeaseExpiry(storage);
    return null;
  }
  const active = lease.expiresAt > now;
  if (active) scheduleResetLeaseExpiry(storage, lease, now);
  else cancelResetLeaseExpiry(storage, lease.generation);
  observeResetSnapshot(lease.generation, active);
  if (active) return lease;
  return null;
}

/** Read the durable reset epoch and whether a full reset currently owns the lease. */
export function getKnife4jStorageResetSnapshot(
  storage: Knife4jWebStorage | null = browserStorage('localStorage'),
): Knife4jStorageResetSnapshot {
  let persistedGeneration = '';
  if (storage) {
    try {
      persistedGeneration = storage.getItem(KNIFE4J_STORAGE_KEYS.resetGeneration)?.trim() ?? '';
    } catch {
      // Keep the last generation observed in this browsing context.
    }
  }

  const now = Date.now();
  const recoveryEpoch = parseQuotaRecoveryEpoch(persistedGeneration);
  const activeLease = readResetLease(storage, now);
  const activeRecoveryEpoch = recoveryEpoch !== null && recoveryEpoch.expiresAt > now;
  if (!activeLease && activeRecoveryEpoch && storage) scheduleResetLeaseExpiry(storage, recoveryEpoch, now);
  const generation = activeLease?.generation || persistedGeneration || observedResetSnapshot.generation;
  return observeResetSnapshot(generation, allLocalDataCleanupCount > 0 || activeLease !== null || activeRecoveryEpoch);
}

/** Subscribe to reset generation or activity changes in this browsing context. */
export function subscribeKnife4jStorageReset(listener: Knife4jStorageResetListener): () => void {
  resetSnapshotListeners.add(listener);
  return () => resetSnapshotListeners.delete(listener);
}

function createResetGeneration(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall back to a non-security-sensitive unique value.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function observeResetStorageEvent(event: StorageEvent): void {
  if (event.key !== KNIFE4J_STORAGE_KEYS.resetLease && event.key !== KNIFE4J_STORAGE_KEYS.resetGeneration) return;

  const storage = browserStorage('localStorage');
  if (storage) {
    getKnife4jStorageResetSnapshot(storage);
    return;
  }

  if (event.key === KNIFE4J_STORAGE_KEYS.resetLease) {
    const lease = parseResetLease(event.newValue);
    observeResetSnapshot(lease?.generation ?? '', lease !== null && lease.expiresAt > Date.now());
  } else {
    const generation = event.newValue?.trim() ?? '';
    const recoveryEpoch = parseQuotaRecoveryEpoch(generation);
    observeResetSnapshot(
      generation,
      recoveryEpoch ? recoveryEpoch.expiresAt > Date.now() : observedResetSnapshot.active,
    );
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', observeResetStorageEvent);
}

function browserStorageLockManager(): Knife4jStorageLockManager | null {
  if (typeof navigator === 'undefined' || !navigator.locks) return null;
  return navigator.locks as unknown as Knife4jStorageLockManager;
}

function openStorageCoordinationDatabase(): Promise<IDBDatabase> {
  if (storageCoordinationDatabase) return storageCoordinationDatabase;
  storageCoordinationDatabase = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB coordination unavailable'));
      return;
    }
    let openFailed = false;
    const rejectOpen = (error: Error) => {
      openFailed = true;
      reject(error);
    };
    const request = indexedDB.open(KNIFE4J_STORAGE_COORDINATION_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(KNIFE4J_STORAGE_COORDINATION_STORE)) {
        request.result.createObjectStore(KNIFE4J_STORAGE_COORDINATION_STORE);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (openFailed) {
        database.close();
        return;
      }
      database.onversionchange = () => {
        database.close();
        storageCoordinationDatabase = null;
      };
      resolve(database);
    };
    request.onerror = () => rejectOpen(request.error ?? new Error('IndexedDB coordination open failed'));
    request.onblocked = () => rejectOpen(new Error('IndexedDB coordination open blocked'));
  }).catch((error) => {
    storageCoordinationDatabase = null;
    throw error;
  });
  return storageCoordinationDatabase;
}

/**
 * Hold a browser-managed IndexedDB transaction across a fallback mutation.
 * Unlike the expiring localStorage lease, a suspended renderer cannot let a
 * competing tab enter this critical section; a discarded renderer releases
 * the transaction without resuming its target write.
 */
async function runWithFallbackCriticalSection<T>(
  mutation: (retainsCriticalSection: () => boolean) => Promise<T> | T,
): Promise<T | undefined> {
  // Unit adapters and SSR have no competing browser context. Production
  // browsers must fail closed when IndexedDB coordination is unavailable.
  if (typeof window === 'undefined' || window !== globalThis) return mutation(() => true);

  let database: IDBDatabase;
  try {
    database = await openStorageCoordinationDatabase();
  } catch {
    return undefined;
  }

  return new Promise<T | undefined>((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(KNIFE4J_STORAGE_COORDINATION_STORE, 'readwrite');
    } catch {
      resolve(undefined);
      return;
    }

    const store = transaction.objectStore(KNIFE4J_STORAGE_COORDINATION_STORE);
    let active = true;
    let started = false;
    let settled = false;
    let failed = false;
    let result: T | undefined;
    let finished = false;
    const finish = (value: T | undefined) => {
      if (finished) return;
      finished = true;
      resolve(value);
    };

    const fail = () => {
      if (failed) return;
      active = false;
      failed = true;
      try {
        transaction.abort();
      } catch {
        finish(undefined);
      }
    };

    transaction.oncomplete = () => {
      active = false;
      finish(failed ? undefined : result);
    };
    transaction.onabort = () => {
      active = false;
      finish(undefined);
    };
    transaction.onerror = fail;

    const keepAlive = () => {
      let request: IDBRequest;
      try {
        request = store.get(KNIFE4J_STORAGE_COORDINATION_KEY);
      } catch {
        fail();
        return;
      }
      request.onsuccess = () => {
        if (!started) {
          started = true;
          void Promise.resolve()
            .then(() => mutation(() => active))
            .then(
              (value) => {
                result = value;
                settled = true;
              },
              () => {
                settled = true;
                fail();
              },
            );
        }
        if (!settled) {
          keepAlive();
          return;
        }
        if (failed) return;
        try {
          store.put(Date.now(), KNIFE4J_STORAGE_COORDINATION_KEY);
        } catch {
          fail();
        }
      };
      request.onerror = fail;
    };

    keepAlive();
  });
}

type Knife4jStorageWriteFence = (() => boolean) & { readonly generation: string };
type Knife4jRequestCacheWriteFence = (() => boolean) & { readonly generation?: string };

function createKnife4jStorageWriteFence(
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  expectedGeneration?: string,
): Knife4jStorageWriteFence {
  const generation = expectedGeneration ?? getKnife4jStorageResetSnapshot(leaseStorage).generation;
  const canWrite = () => {
    const snapshot = getKnife4jStorageResetSnapshot(leaseStorage);
    return allLocalDataCleanupCount === 0 && !snapshot.active && generation === snapshot.generation;
  };
  return Object.assign(canWrite, { generation });
}

function createRequestCacheWriteFence(
  key: string,
  storage: Knife4jWebStorage | null,
  expectedGeneration?: string,
): Knife4jRequestCacheWriteFence {
  if (!isRequestCacheStorageKey(key)) return Object.assign(() => true, { generation: undefined });
  const generation = expectedGeneration ?? getRequestCacheSnapshot(storage).generation;
  const canWrite = () => {
    const snapshot = getRequestCacheSnapshot(storage);
    return !snapshot.active && snapshot.generation === generation;
  };
  return Object.assign(canWrite, { generation });
}

function pendingWebStorageMap(storage: object): Map<string, PendingKnife4jWebStorageValue> {
  let values = pendingWebStorageValues.get(storage);
  if (!values) {
    values = new Map();
    pendingWebStorageValues.set(storage, values);
  }
  return values;
}

function publishPendingWebStorageRemovals(
  storage: Knife4jWebStorage | null,
  scope: Knife4jStorageCleanupScope,
  generation: string,
  requestCacheGeneration?: string,
): () => void {
  if (!storage) return () => {};

  const keys = new Set(pendingWebStorageValues.get(storage)?.keys() ?? []);
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) keys.add(key);
    }
  } catch {
    // The coordinated cleanup records storage enumeration failures itself.
  }

  const entries = entriesForScope(KNIFE4J_STORAGE_REGISTRY.localStorage, scope);
  const matchedKeys = Array.from(keys).filter((key) => matchesRegisteredEntry(key, entries));
  if (matchedKeys.length === 0) return () => {};

  const writeId = createResetGeneration();
  const pending = pendingWebStorageMap(storage);
  matchedKeys.forEach((key) => pending.set(key, { writeId, value: null, generation, requestCacheGeneration }));
  return () => {
    matchedKeys.forEach((key) => {
      if (pending.get(key)?.writeId === writeId) pending.delete(key);
    });
  };
}

/** Read through the local pending write/removal overlay before falling back to Web Storage. */
export function getKnife4jStorageItem(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
): string | null {
  const pending = pendingWebStorageValues.get(storage)?.get(key);
  const requestCacheKey = isRequestCacheStorageKey(key);
  const requestCacheSnapshot = requestCacheKey ? getRequestCacheSnapshot(leaseStorage) : null;
  if (pending) {
    const snapshot = getKnife4jStorageResetSnapshot(leaseStorage);
    if (
      !snapshot.active &&
      snapshot.generation === pending.generation &&
      (!requestCacheKey || pending.requestCacheGeneration === requestCacheSnapshot?.generation)
    ) {
      return pending.value;
    }
  }
  if (requestCacheSnapshot?.active) return null;
  return storage.getItem(key);
}

/**
 * Read a value together with the epochs that made the read valid. If either
 * epoch changes while reading, discard the value so a later write cannot
 * carry pre-cleanup data into the new epoch.
 */
export function getKnife4jStorageItemSnapshot(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
): Knife4jStorageItemSnapshot {
  const requestCacheKey = isRequestCacheStorageKey(key);
  const pendingBefore = pendingWebStorageValues.get(storage)?.get(key);
  const resetBefore = getKnife4jStorageResetSnapshot(leaseStorage);
  const requestCacheBefore = requestCacheKey ? getRequestCacheSnapshot(leaseStorage) : null;
  const value = getKnife4jStorageItem(storage, key, leaseStorage);
  const pendingAfter = pendingWebStorageValues.get(storage)?.get(key);
  const resetAfter = getKnife4jStorageResetSnapshot(leaseStorage);
  const requestCacheAfter = requestCacheKey ? getRequestCacheSnapshot(leaseStorage) : null;
  const stableReset = !resetBefore.active && !resetAfter.active && resetBefore.generation === resetAfter.generation;
  // An active cache epoch hides durable pre-cleanup data, but a matching local
  // pending overlay represents post-cleanup intent and must remain available to
  // this document's follow-up read-modify-write operations.
  const stablePendingValue =
    pendingBefore !== undefined &&
    pendingAfter?.writeId === pendingBefore.writeId &&
    pendingBefore.value === value &&
    pendingBefore.generation === resetBefore.generation &&
    (!requestCacheKey || pendingBefore.requestCacheGeneration === requestCacheBefore?.generation);
  const stableRequestCache =
    !requestCacheKey ||
    (requestCacheBefore !== null &&
      requestCacheAfter !== null &&
      requestCacheBefore.generation === requestCacheAfter.generation &&
      ((!requestCacheBefore.active && !requestCacheAfter.active) || stablePendingValue));

  return {
    value: stableReset && stableRequestCache ? value : null,
    resetGeneration: resetAfter.generation,
    resetActive: resetAfter.active,
    requestCacheGeneration: requestCacheAfter?.generation,
  };
}

/** Persist one registered value while sharing the same reset/mutation lock. */
export function persistKnife4jStorageItem(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  key: string,
  value: string,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  expectedSnapshot?: Knife4jStorageItemSnapshot,
): Promise<boolean> {
  queuedStorageSnapshot = undefined;
  return persistStorageItem(storage, key, value, lockManager, leaseStorage, expectedSnapshot);
}

async function persistStorageItem(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  key: string,
  value: string,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  expectedSnapshot?: Knife4jStorageItemSnapshot,
  startWrite?: () => boolean,
): Promise<boolean> {
  try {
    if (expectedSnapshot?.resetActive) return false;
    const resetCanWrite = createKnife4jStorageWriteFence(leaseStorage, expectedSnapshot?.resetGeneration);
    const requestCacheCanWrite = createRequestCacheWriteFence(
      key,
      leaseStorage,
      expectedSnapshot?.requestCacheGeneration,
    );
    if (!(await waitForRequestCacheWriteTurn(leaseStorage, requestCacheCanWrite.generation))) return false;
    if (!resetCanWrite()) return false;
    const persisted = await trackStorageWrite(
      async (canWrite) => {
        const retainsWriteFence = () => canWrite() && resetCanWrite() && requestCacheCanWrite();
        if (!retainsWriteFence()) return false;
        storage.setItem(key, value);
        if (retainsWriteFence()) return true;
        if (storage.getItem(key) === value) storage.removeItem(key);
        return false;
      },
      lockManager,
      leaseStorage,
      startWrite,
    );
    return persisted === true;
  } catch {
    return false;
  }
}

/**
 * Queue a registered Web Storage write, expose its latest value locally
 * immediately, and resolve only after durable persistence succeeds or fails.
 * Adjacent compatible snapshots that are still queued are superseded. Their
 * promises resolve false because those values were not persisted; the surviving
 * snapshot reports its own persistence result.
 */
export function setKnife4jStorageItem(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  key: string,
  value: string,
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  expectedSnapshot?: Knife4jStorageItemSnapshot,
): Promise<boolean> {
  if (!leaseStorage) {
    queuedStorageSnapshot = undefined;
    try {
      storage.setItem(key, value);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }
  const snapshot = getKnife4jStorageResetSnapshot(leaseStorage);
  if (snapshot.active || expectedSnapshot?.resetActive) return Promise.resolve(false);
  const requestCacheCanWrite = createRequestCacheWriteFence(
    key,
    leaseStorage,
    expectedSnapshot?.requestCacheGeneration,
  );
  const writeSnapshot: Knife4jStorageItemSnapshot =
    expectedSnapshot ??
    ({
      value: null,
      resetGeneration: snapshot.generation,
      resetActive: snapshot.active,
      requestCacheGeneration: requestCacheCanWrite.generation,
    } satisfies Knife4jStorageItemSnapshot);

  const writeId = createResetGeneration();
  const pending = pendingWebStorageMap(storage);
  pending.set(key, {
    writeId,
    value,
    generation: writeSnapshot.resetGeneration,
    requestCacheGeneration: writeSnapshot.requestCacheGeneration,
  });
  const previous = queuedStorageSnapshot;
  if (
    previous &&
    !previous.started &&
    previous.storage === storage &&
    previous.key === key &&
    previous.leaseStorage === leaseStorage &&
    previous.lockManager === lockManager &&
    previous.snapshot.resetGeneration === writeSnapshot.resetGeneration &&
    previous.snapshot.requestCacheGeneration === writeSnapshot.requestCacheGeneration
  ) {
    previous.superseded = true;
  }
  const queued: QueuedStorageSnapshot = {
    storage,
    key,
    leaseStorage,
    lockManager,
    snapshot: writeSnapshot,
    started: false,
    superseded: false,
  };
  queuedStorageSnapshot = queued;
  const startWrite = () => {
    if (queued.superseded) return false;
    queued.started = true;
    return true;
  };
  return persistStorageItem(storage, key, value, lockManager, leaseStorage, writeSnapshot, startWrite).finally(() => {
    if (pending.get(key)?.writeId === writeId) pending.delete(key);
    if (queuedStorageSnapshot === queued) queuedStorageSnapshot = undefined;
  });
}

export interface Knife4jStorageItemUpdateResult {
  persisted: boolean;
  value: string | null;
}

/**
 * Read and replace one registered value while holding the shared mutation
 * lock. Use this for cross-context read-modify-write operations where a value
 * calculated before lock acquisition could overwrite another tab's update.
 */
export async function updateKnife4jStorageItem(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  key: string,
  update: (currentValue: string | null) => string,
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
): Promise<Knife4jStorageItemUpdateResult> {
  queuedStorageSnapshot = undefined;
  const failed = (): Knife4jStorageItemUpdateResult => ({ persisted: false, value: null });
  try {
    if (!leaseStorage) {
      const value = update(storage.getItem(key));
      storage.setItem(key, value);
      return { persisted: true, value };
    }

    const resetSnapshot = getKnife4jStorageResetSnapshot(leaseStorage);
    if (resetSnapshot.active) return failed();
    const resetCanWrite = createKnife4jStorageWriteFence(leaseStorage, resetSnapshot.generation);
    const requestCacheCanWrite = createRequestCacheWriteFence(key, leaseStorage);
    if (!(await waitForRequestCacheWriteTurn(leaseStorage, requestCacheCanWrite.generation))) return failed();
    if (!resetCanWrite()) return failed();

    const result = await trackKnife4jStorageWrite(
      async (canWrite) => {
        const retainsWriteFence = () => canWrite() && resetCanWrite() && requestCacheCanWrite();
        if (!retainsWriteFence()) return failed();

        const value = update(storage.getItem(key));
        if (!retainsWriteFence()) return failed();
        storage.setItem(key, value);
        if (retainsWriteFence()) return { persisted: true, value };
        if (storage.getItem(key) === value) storage.removeItem(key);
        return failed();
      },
      lockManager,
      leaseStorage,
    );
    return result ?? failed();
  } catch {
    return failed();
  }
}

/** Session Storage is tab-scoped, so a synchronous write only needs the local reset fence. */
export function setKnife4jSessionStorageItem(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  key: string,
  value: string,
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
): boolean {
  queuedStorageSnapshot = undefined;
  const canWrite = createKnife4jStorageWriteFence(leaseStorage);
  if (!canWrite()) return false;
  storage.setItem(key, value);
  if (canWrite()) return true;
  if (storage.getItem(key) === value) storage.removeItem(key);
  return false;
}

/** Remove one registered value under the same cross-context mutation lock as a full reset. */
export async function removeKnife4jStorageItem(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  expectedResetSnapshot?: Knife4jStorageResetSnapshot,
): Promise<boolean> {
  queuedStorageSnapshot = undefined;
  try {
    if (!leaseStorage) {
      storage.removeItem(key);
      return true;
    }
    const snapshot = expectedResetSnapshot ?? getKnife4jStorageResetSnapshot(leaseStorage);
    if (snapshot.active) return false;
    const resetCanWrite = createKnife4jStorageWriteFence(leaseStorage, snapshot.generation);
    const requestCacheCanWrite = createRequestCacheWriteFence(key, leaseStorage);

    const writeId = createResetGeneration();
    const pending = pendingWebStorageMap(storage);
    pending.set(key, {
      writeId,
      value: null,
      generation: snapshot.generation,
      requestCacheGeneration: requestCacheCanWrite.generation,
    });
    try {
      if (!(await waitForRequestCacheWriteTurn(leaseStorage, requestCacheCanWrite.generation))) return false;
      if (!resetCanWrite()) return false;
      const removed = await trackKnife4jStorageWrite(
        async (canWrite) => {
          const retainsWriteFence = () => canWrite() && resetCanWrite() && requestCacheCanWrite();
          if (!retainsWriteFence()) return false;
          storage.removeItem(key);
          return retainsWriteFence();
        },
        lockManager,
        leaseStorage,
      );
      return removed === true;
    } finally {
      if (pending.get(key)?.writeId === writeId) pending.delete(key);
    }
  } catch {
    return false;
  }
}

/**
 * Serialize every Knife4j persistence operation with full resets running in
 * other same-origin browsing contexts. A mutation queued behind a reset keeps
 * its original generation fence and is refused after the reset completes.
 */
export function withKnife4jStorageWriteLock<T>(
  write: (canWrite: () => boolean) => Promise<T>,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  onCoordinationError?: (error: unknown) => void,
): Promise<T | undefined> {
  queuedStorageSnapshot = undefined;
  return withStorageWriteLock(write, lockManager, leaseStorage, onCoordinationError);
}

/** One browser-owned mutex per path. The fallback shares its store with older pages. */
function withStorageMutex<T>(
  operation: (canWrite: () => boolean) => T | Promise<T>,
  lockManager: Knife4jStorageLockManager | null,
  storage: Knife4jWebStorage | null,
): Promise<T | undefined> {
  if (lockManager) {
    return lockManager.request(KNIFE4J_STORAGE_RESET_LOCK, { mode: 'exclusive' }, () => operation(() => true));
  }
  if (!storage) return Promise.resolve().then(() => operation(() => true));
  return enqueueFallbackMutation(storage, () => runWithFallbackCriticalSection(operation));
}

function withStorageWriteLock<T>(
  write: (canWrite: () => boolean) => Promise<T>,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  onCoordinationError?: (error: unknown) => void,
  startWrite: () => boolean = () => true,
): Promise<T | undefined> {
  const resetCanWrite = createKnife4jStorageWriteFence(leaseStorage);
  return withStorageMutex(
    (retainsMutex) => {
      const canWrite = () => retainsMutex() && resetCanWrite();
      return startWrite() && canWrite() ? write(canWrite) : undefined;
    },
    lockManager,
    leaseStorage,
  ).catch((error: unknown) => {
    onCoordinationError?.(error);
    throw error;
  });
}

function enqueueFallbackMutation<T>(
  storage: Knife4jWebStorage,
  mutation: () => Promise<T | undefined>,
): Promise<T | undefined> {
  const previous = fallbackMutationTails.get(storage) ?? Promise.resolve();
  const current = previous.then(mutation, mutation);
  const tail = current.then(
    () => undefined,
    () => undefined,
  );
  fallbackMutationTails.set(storage, tail);
  void tail.finally(() => {
    if (fallbackMutationTails.get(storage) === tail) fallbackMutationTails.delete(storage);
  });
  return current;
}

/**
 * Register an asynchronous Knife4j persistence operation. A full reset waits
 * for writes that already started and suppresses new writes until its final
 * deletion pass has completed.
 */
export function trackKnife4jStorageWrite<T>(
  write: (canWrite: () => boolean) => Promise<T>,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
): Promise<T | undefined> {
  queuedStorageSnapshot = undefined;
  return trackStorageWrite(write, lockManager, leaseStorage);
}

function trackStorageWrite<T>(
  write: (canWrite: () => boolean) => Promise<T>,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
  leaseStorage: Knife4jWebStorage | null = browserStorage('localStorage'),
  startWrite?: () => boolean,
): Promise<T | undefined> {
  if (allLocalDataCleanupCount > 0) return Promise.resolve(undefined);

  const pending = withStorageWriteLock(write, lockManager, leaseStorage, undefined, startWrite);
  pendingKnife4jStorageWrites.add(pending);
  void pending.then(
    () => pendingKnife4jStorageWrites.delete(pending),
    () => pendingKnife4jStorageWrites.delete(pending),
  );
  return pending;
}

async function waitForPendingKnife4jStorageWrites(): Promise<void> {
  while (pendingKnife4jStorageWrites.size > 0) {
    await Promise.allSettled(Array.from(pendingKnife4jStorageWrites));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isQuotaExceededError(error: unknown): boolean {
  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error.name)
  ) {
    return true;
  }
  return /quota/i.test(errorMessage(error));
}

function entriesForScope(
  registry: readonly RegisteredEntry[],
  scope: Knife4jStorageCleanupScope,
): readonly RegisteredEntry[] {
  return registry.filter(
    (entry) => !entry.preserveDuringCleanup && (scope === 'all-local-data' || entry.scope === 'request-cache'),
  );
}

function matchesRegisteredEntry(key: string, entries: readonly RegisteredEntry[]): boolean {
  return entries.some((entry) => (entry.match === 'exact' ? key === entry.value : key.startsWith(entry.value)));
}

function recordFailure(result: Knife4jStorageCleanupResult, failure: Knife4jStorageCleanupFailure): void {
  const duplicate = result.failures.some(
    (existing) => existing.area === failure.area && existing.key === failure.key && existing.reason === failure.reason,
  );
  if (!duplicate) result.failures.push(failure);
}

function recordUnavailable(result: Knife4jStorageCleanupResult, area: Knife4jStorageArea): void {
  recordFailure(result, { area, reason: `${area} unavailable` });
}

function recordFallbackCriticalSectionUnavailable(
  result: Knife4jStorageCleanupResult,
  operation: 'request cache' | 'storage reset',
): void {
  recordFailure(result, {
    area: 'indexedDB',
    key: KNIFE4J_STORAGE_COORDINATION_DB,
    reason: `${operation} coordination unavailable`,
  });
}

function supersedeRequestCacheCleanupEpoch(
  storage: Knife4jWebStorage | null,
  result: Knife4jStorageCleanupResult,
  retainsResetLease: () => boolean,
): boolean {
  if (!storage || !retainsResetLease()) return false;
  try {
    const stored = storage.getItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch);
    const compactEpoch = parseQuotaRecoveryEpoch(stored ?? '');
    const current = parseResetLease(stored) ?? compactEpoch;
    if (!current || current.expiresAt <= Date.now()) return retainsResetLease();
    if (compactEpoch) {
      const completedGeneration = createQuotaRecoveryEpoch().inactiveGeneration;
      storage.setItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch, completedGeneration);
      const persisted = parseQuotaRecoveryEpoch(storage.getItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch) ?? '');
      if (persisted?.generation !== completedGeneration || persisted.expiresAt !== 0) {
        throw new Error('compact request cache epoch replacement was lost');
      }
      return retainsResetLease();
    }
    const epoch: Knife4jStorageResetLease = {
      version: KNIFE4J_STORAGE_RESET_LEASE_VERSION,
      generation: createResetGeneration(),
      expiresAt: 0,
    };
    storage.setItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch, JSON.stringify(epoch));
    const persisted = parseResetLease(storage.getItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch));
    if (persisted?.generation !== epoch.generation || persisted.expiresAt !== 0) {
      throw new Error('request cache epoch replacement was lost');
    }
    return retainsResetLease();
  } catch (error) {
    recordFailure(result, {
      area: 'localStorage',
      key: KNIFE4J_STORAGE_KEYS.requestCacheEpoch,
      reason: `request cache invalidation failed: ${errorMessage(error)}`,
    });
    return false;
  }
}

function waitForResetLeaseTurn(lease: Knife4jStorageResetLease): Promise<void> {
  const remaining = Math.max(0, lease.expiresAt - Date.now());
  return new Promise((resolve) => setTimeout(resolve, Math.min(KNIFE4J_STORAGE_RESET_LEASE_POLL_MS, remaining)));
}

/** Publish reset state inside the browser mutex, after checking older-page leases. */
async function acquireResetLease(
  storage: Knife4jWebStorage | null,
  result: Knife4jStorageCleanupResult,
  recordCoordinationFailure = true,
  onCoordinationError?: (error: unknown) => void,
): Promise<Knife4jStorageResetLease | null> {
  if (!storage) return null;
  let candidateLease: Knife4jStorageResetLease | null = null;
  try {
    const lease: Knife4jStorageResetLease = {
      version: KNIFE4J_STORAGE_RESET_LEASE_VERSION,
      generation: createResetGeneration(),
      expiresAt: Date.now() + KNIFE4J_STORAGE_RESET_LEASE_TTL_MS,
    };
    candidateLease = lease;
    storage.setItem(KNIFE4J_STORAGE_KEYS.resetLease, JSON.stringify(lease));
    if (parseResetLease(storage.getItem(KNIFE4J_STORAGE_KEYS.resetLease))?.generation !== lease.generation) {
      throw new Error('reset lease was not persisted');
    }
    storage.setItem(KNIFE4J_STORAGE_KEYS.resetGeneration, lease.generation);
    if (storage.getItem(KNIFE4J_STORAGE_KEYS.resetGeneration) !== lease.generation) {
      throw new Error('reset generation was not persisted');
    }
    observeResetSnapshot(lease.generation, true);
    return lease;
  } catch (error) {
    onCoordinationError?.(error);
    if (candidateLease) {
      try {
        const persisted = parseResetLease(storage.getItem(KNIFE4J_STORAGE_KEYS.resetLease));
        if (persisted?.generation === candidateLease.generation) {
          storage.removeItem(KNIFE4J_STORAGE_KEYS.resetLease);
        }
      } catch {
        // The coordination failure below already makes the reset incomplete.
      }
    }
    if (recordCoordinationFailure) {
      recordFailure(result, {
        area: 'localStorage',
        key: KNIFE4J_STORAGE_KEYS.resetLease,
        reason: `reset coordination failed: ${errorMessage(error)}`,
      });
    }
    return null;
  }
}

function renewResetLease(
  storage: Knife4jWebStorage,
  lease: Knife4jStorageResetLease,
  result: Knife4jStorageCleanupResult,
): boolean {
  try {
    const current = parseResetLease(storage.getItem(KNIFE4J_STORAGE_KEYS.resetLease));
    if (current) observeResetSnapshot(current.generation, current.expiresAt > Date.now());
    if (current?.generation !== lease.generation) throw new Error('reset lease ownership was lost');
    if (current.expiresAt <= Date.now()) throw new Error('reset lease expired');
    lease.expiresAt = Date.now() + KNIFE4J_STORAGE_RESET_LEASE_TTL_MS;
    storage.setItem(KNIFE4J_STORAGE_KEYS.resetLease, JSON.stringify(lease));
    const persisted = parseResetLease(storage.getItem(KNIFE4J_STORAGE_KEYS.resetLease));
    if (persisted?.generation !== lease.generation) throw new Error('reset lease renewal was lost');
    return true;
  } catch (error) {
    recordFailure(result, {
      area: 'localStorage',
      key: KNIFE4J_STORAGE_KEYS.resetLease,
      reason: `reset coordination renewal failed: ${errorMessage(error)}`,
    });
    return false;
  }
}

function startResetLeaseHeartbeat(
  storage: Knife4jWebStorage | null,
  lease: Knife4jStorageResetLease | null,
  result: Knife4jStorageCleanupResult,
): () => void {
  if (!storage || !lease) return () => {};
  const timer = setInterval(() => {
    if (!renewResetLease(storage, lease, result)) clearInterval(timer);
  }, KNIFE4J_STORAGE_RESET_LEASE_TTL_MS / 4);
  return () => clearInterval(timer);
}

function releaseResetLease(
  storage: Knife4jWebStorage | null,
  lease: Knife4jStorageResetLease | null,
  result: Knife4jStorageCleanupResult,
): void {
  if (!storage || !lease) return;
  try {
    const current = parseResetLease(storage.getItem(KNIFE4J_STORAGE_KEYS.resetLease));
    if (current?.generation !== lease.generation) throw new Error('reset lease ownership was lost');
    storage.removeItem(KNIFE4J_STORAGE_KEYS.resetLease);
    cancelResetLeaseExpiry(storage, lease.generation);
    observeResetSnapshot(
      storage.getItem(KNIFE4J_STORAGE_KEYS.resetGeneration)?.trim() || lease.generation,
      allLocalDataCleanupCount > 0,
    );
  } catch (error) {
    getKnife4jStorageResetSnapshot(storage);
    recordFailure(result, {
      area: 'localStorage',
      key: KNIFE4J_STORAGE_KEYS.resetLease,
      reason: `reset coordination cleanup failed: ${errorMessage(error)}`,
    });
  }
}

function clearWebStorage(
  area: 'localStorage' | 'sessionStorage',
  storage: Knife4jWebStorage | null,
  registry: readonly RegisteredEntry[],
  result: Knife4jStorageCleanupResult,
  retainsResetLease: () => boolean = () => true,
): void {
  if (!storage) {
    recordUnavailable(result, area);
    return;
  }

  const entries = entriesForScope(registry, result.scope);
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) keys.push(key);
    }
  } catch (error) {
    recordFailure(result, { area, reason: errorMessage(error) });
    return;
  }

  for (const key of keys) {
    if (!matchesRegisteredEntry(key, entries)) continue;
    if (!retainsResetLease()) return;
    try {
      storage.removeItem(key);
      result.removed[area] += 1;
    } catch (error) {
      recordFailure(result, { area, key, reason: errorMessage(error) });
    }
  }
}

async function clearIndexedDbStorage(
  storage: Knife4jIndexedDbStorage | null,
  result: Knife4jStorageCleanupResult,
  retainsResetLease: () => boolean,
): Promise<void> {
  if (result.scope !== 'all-local-data') return;
  if (!storage) {
    recordUnavailable(result, 'indexedDB');
    return;
  }

  let keys: IDBValidKey[];
  try {
    keys = await storage.keys();
  } catch (error) {
    recordFailure(result, { area: 'indexedDB', reason: errorMessage(error) });
    return;
  }

  const entries = entriesForScope(KNIFE4J_STORAGE_REGISTRY.indexedDB, result.scope);
  for (const key of keys) {
    if (typeof key !== 'string' || !matchesRegisteredEntry(key, entries)) continue;
    if (!retainsResetLease()) return;
    try {
      await storage.delete(key);
      result.removed.indexedDB += 1;
    } catch (error) {
      recordFailure(result, { area: 'indexedDB', key, reason: errorMessage(error) });
    }
  }
}

export async function clearRegisteredKnife4jStorage(
  scope: Knife4jStorageCleanupScope,
  adapters: Knife4jStorageAdapters,
  lockManager: Knife4jStorageLockManager | null = browserStorageLockManager(),
): Promise<Knife4jStorageCleanupResult> {
  queuedStorageSnapshot = undefined;
  const guardsAsyncWrites = scope === 'all-local-data';
  if (guardsAsyncWrites) {
    allLocalDataCleanupCount += 1;
    getKnife4jStorageResetSnapshot(adapters.localStorage);
  }

  const result: Knife4jStorageCleanupResult = {
    scope,
    removed: { localStorage: 0, sessionStorage: 0, indexedDB: 0 },
    failures: [],
  };

  if (!guardsAsyncWrites) {
    const resetCanWrite = createKnife4jStorageWriteFence(adapters.localStorage);
    const releasePendingRemovals = publishPendingWebStorageRemovals(
      adapters.localStorage,
      scope,
      resetCanWrite.generation,
      getRequestCacheSnapshot(adapters.localStorage).generation,
    );
    try {
      const completed = await withStorageMutex(
        (retainsMutex) => {
          const canWrite = () => retainsMutex() && resetCanWrite();
          if (!canWrite()) return false;
          const storage = adapters.localStorage;
          if (!storage) {
            recordUnavailable(result, 'localStorage');
            clearWebStorage(
              'sessionStorage',
              adapters.sessionStorage,
              KNIFE4J_STORAGE_REGISTRY.sessionStorage,
              result,
              canWrite,
            );
            return true;
          }
          const epoch: Knife4jStorageResetLease = {
            version: KNIFE4J_STORAGE_RESET_LEASE_VERSION,
            generation: createResetGeneration(),
            expiresAt: Date.now() + KNIFE4J_STORAGE_RESET_LEASE_TTL_MS,
          };
          let activeValue = JSON.stringify(epoch);
          let completedValue = JSON.stringify({ ...epoch, expiresAt: 0 });
          try {
            storage.setItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch, activeValue);
          } catch (error) {
            if (!isQuotaExceededError(error)) throw error;
            const compact = createQuotaRecoveryEpoch();
            activeValue = compact.activeGeneration;
            completedValue = compact.inactiveGeneration;
            storage.setItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch, activeValue);
          }
          const ownsEpoch = () => storage.getItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch) === activeValue;
          if (!ownsEpoch()) throw new Error('request cache epoch was not persisted');
          const retainsCleanup = () => canWrite() && ownsEpoch();
          try {
            clearWebStorage('localStorage', storage, KNIFE4J_STORAGE_REGISTRY.localStorage, result, retainsCleanup);
            clearWebStorage(
              'sessionStorage',
              adapters.sessionStorage,
              KNIFE4J_STORAGE_REGISTRY.sessionStorage,
              result,
              retainsCleanup,
            );
            return retainsCleanup();
          } finally {
            // Do not complete an epoch superseded by an older page's reset.
            if (retainsCleanup()) {
              try {
                storage.setItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch, completedValue);
                if (storage.getItem(KNIFE4J_STORAGE_KEYS.requestCacheEpoch) !== completedValue) {
                  recordFailure(result, {
                    area: 'localStorage',
                    key: KNIFE4J_STORAGE_KEYS.requestCacheEpoch,
                    reason: 'request cache epoch cleanup failed: request cache epoch completion was not persisted',
                  });
                }
              } catch (error) {
                recordFailure(result, {
                  area: 'localStorage',
                  key: KNIFE4J_STORAGE_KEYS.requestCacheEpoch,
                  reason: `request cache epoch cleanup failed: ${errorMessage(error)}`,
                });
              }
            }
          }
        },
        lockManager,
        adapters.localStorage,
      );
      if (completed === undefined) recordFallbackCriticalSectionUnavailable(result, 'request cache');
      else if (!completed)
        recordFailure(result, {
          area: 'localStorage',
          key: KNIFE4J_STORAGE_KEYS.requestCacheEpoch,
          reason: 'request cache coordination ownership was lost',
        });
    } catch (error) {
      recordFailure(result, {
        area: 'localStorage',
        key: KNIFE4J_STORAGE_KEYS.requestCacheEpoch,
        reason: `request cache coordination failed: ${errorMessage(error)}`,
      });
    } finally {
      releasePendingRemovals();
    }
    return result;
  }

  let lease: Knife4jStorageResetLease | null = null;
  let quotaRecoveryEpoch: Knife4jStorageQuotaRecoveryEpoch | null = null;
  let stopResetLeaseHeartbeat = () => {};
  const retainsResetLease = (): boolean =>
    adapters.localStorage !== null && lease !== null && renewResetLease(adapters.localStorage, lease, result);

  const performCleanup = async (retainsCriticalSection: () => boolean = () => true): Promise<void> => {
    const retainsCleanupLease = () => retainsCriticalSection() && retainsResetLease();
    if (guardsAsyncWrites) await waitForPendingKnife4jStorageWrites();
    if (!retainsCleanupLease()) return;

    clearWebStorage(
      'localStorage',
      adapters.localStorage,
      KNIFE4J_STORAGE_REGISTRY.localStorage,
      result,
      retainsCleanupLease,
    );
    clearWebStorage(
      'sessionStorage',
      adapters.sessionStorage,
      KNIFE4J_STORAGE_REGISTRY.sessionStorage,
      result,
      retainsCleanupLease,
    );
    await clearIndexedDbStorage(adapters.indexedDB, result, retainsCleanupLease);
    if (guardsAsyncWrites) {
      await waitForPendingKnife4jStorageWrites();
      if (!retainsCleanupLease()) return;
      await clearIndexedDbStorage(adapters.indexedDB, result, retainsCleanupLease);
      if (!retainsCleanupLease()) return;
      clearWebStorage(
        'localStorage',
        adapters.localStorage,
        KNIFE4J_STORAGE_REGISTRY.localStorage,
        result,
        retainsCleanupLease,
      );
      clearWebStorage(
        'sessionStorage',
        adapters.sessionStorage,
        KNIFE4J_STORAGE_REGISTRY.sessionStorage,
        result,
        retainsCleanupLease,
      );
      supersedeRequestCacheCleanupEpoch(adapters.localStorage, result, retainsCleanupLease);
    }
  };

  const performCoordinatedCleanup = async (retainsMutex: () => boolean): Promise<boolean> => {
    if (!retainsMutex()) return true;
    // Older pages publish their lease before acquiring IndexedDB. Never wait
    // for them while holding the mutex they need to finish their reset.
    if (readResetLease(adapters.localStorage)) return false;
    try {
      let resetLeaseError: unknown;
      lease = await acquireResetLease(adapters.localStorage, result, false, (error) => {
        resetLeaseError = error;
      });
      if (!lease && adapters.localStorage && isQuotaExceededError(resetLeaseError)) {
        try {
          quotaRecoveryEpoch = publishQuotaRecoveryResetEpoch(adapters.localStorage, retainsMutex);
          if (quotaRecoveryEpoch) {
            const retainsRecovery = () =>
              retainsMutex() &&
              quotaRecoveryEpoch !== null &&
              retainsQuotaRecoveryResetEpoch(adapters.localStorage!, quotaRecoveryEpoch);
            clearWebStorage(
              'localStorage',
              adapters.localStorage,
              KNIFE4J_STORAGE_REGISTRY.localStorage,
              result,
              retainsRecovery,
            );
            if (!retainsRecovery()) {
              recordFailure(result, {
                area: 'localStorage',
                key: KNIFE4J_STORAGE_KEYS.resetGeneration,
                reason: 'quota recovery reset epoch ownership was lost',
              });
              return true;
            }
            lease = await acquireResetLease(adapters.localStorage, result, false, (error) => {
              resetLeaseError = error;
            });
          }
        } catch (error) {
          resetLeaseError = error;
        }
      }
      if (!lease) {
        if (!adapters.localStorage) recordUnavailable(result, 'localStorage');
        else
          recordFailure(result, {
            area: 'localStorage',
            key: KNIFE4J_STORAGE_KEYS.resetLease,
            reason: `reset coordination failed: ${errorMessage(resetLeaseError ?? 'unavailable')}`,
          });
        return true;
      }
      stopResetLeaseHeartbeat = startResetLeaseHeartbeat(adapters.localStorage, lease, result);
      await performCleanup(retainsMutex);
      if (!retainsMutex()) recordFallbackCriticalSectionUnavailable(result, 'storage reset');
      return true;
    } finally {
      stopResetLeaseHeartbeat();
      releaseResetLease(adapters.localStorage, lease, result);
      completeQuotaRecoveryResetEpoch(adapters.localStorage, quotaRecoveryEpoch, result, retainsMutex);
    }
  };

  try {
    await waitForPendingKnife4jStorageWrites();
    for (;;) {
      const activeLease = readResetLease(adapters.localStorage);
      if (activeLease) {
        await waitForResetLeaseTurn(activeLease);
        continue;
      }
      const completed = await withStorageMutex(performCoordinatedCleanup, lockManager, adapters.localStorage);
      if (completed === undefined) recordFallbackCriticalSectionUnavailable(result, 'storage reset');
      if (completed !== false) break;
    }
  } finally {
    allLocalDataCleanupCount -= 1;
    getKnife4jStorageResetSnapshot(adapters.localStorage);
  }
  return result;
}

function browserStorage(area: 'localStorage' | 'sessionStorage'): Knife4jWebStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window[area];
  } catch {
    return null;
  }
}

function browserIndexedDb(): Knife4jIndexedDbStorage | null {
  if (typeof indexedDB === 'undefined') return null;
  return {
    keys: () => listIndexedDbKeys(),
    delete: (key) => deleteIndexedDbKey(key),
  };
}

export function clearKnife4jStorage(scope: Knife4jStorageCleanupScope): Promise<Knife4jStorageCleanupResult> {
  return clearRegisteredKnife4jStorage(scope, {
    localStorage: browserStorage('localStorage'),
    sessionStorage: browserStorage('sessionStorage'),
    indexedDB: browserIndexedDb(),
  });
}

export function removedKnife4jStorageEntryCount(result: Knife4jStorageCleanupResult): number {
  return Object.values(result.removed).reduce((total, count) => total + count, 0);
}
