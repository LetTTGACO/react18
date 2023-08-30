let syncQueue: ((...args: any) => void)[] | null = null;

let isFlushingSyncQueue = false;

/**
 * 调度同步回调函数
 * @param callback
 */
export function scheduleSyncCallback(callback: (...args: any) => void) {
  if (syncQueue === null) {
    // 第一个回调
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

/**
 * 执行
 */
export function flushSyncCallbacks() {
  if (!isFlushingSyncQueue && syncQueue) {
    try {
      isFlushingSyncQueue = true;
      syncQueue.forEach((callback) => callback());
      syncQueue = null;
    } catch (e) {
      if (__DEV__) {
        console.warn('flushSyncCallback错误', e);
      }
    } finally {
      isFlushingSyncQueue = false;
    }
  }
}
