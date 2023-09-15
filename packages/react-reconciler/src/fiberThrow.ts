import { FiberRootNode } from './fiber';
import { Lane } from './fiberLanes';
import { Wakeable } from 'shared/ReactTypes';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';
import { getSuspenseHandler } from './suspenseContext';
import { ShouldCapture } from './fiberFlags';

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  // Error Boundary
  // thenable
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  ) {
    const wakable = value as Wakeable<any>;
    const suspenseBoundary = getSuspenseHandler();
    if (suspenseBoundary) {
      suspenseBoundary.flags |= ShouldCapture;
    }
    attachPingListener(root, wakable, lane);
  }
}

function attachPingListener(
  root: FiberRootNode,
  wakeable: Wakeable<any>,
  lane: Lane
) {
  // wakeable.then(ping, ping);
  // 处理缓存
  let pingCache = root.pingCache;
  // WeakMap{promise: Set<Lane>}
  let threadIDs: Set<Lane> | undefined;
  if (pingCache === null) {
    // 没有缓存
    threadIDs = new Set<Lane>();
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
    pingCache.set(wakeable, threadIDs);
  } else {
    threadIDs = pingCache.get(wakeable);
    if (threadIDs === undefined) {
      threadIDs = new Set<Lane>();
      pingCache.set(wakeable, threadIDs);
    }
  }
  // 是否第一次进入
  if (!threadIDs.has(lane)) {
    threadIDs.add(lane);

    // eslint-disable-next-line no-inner-declarations
    function ping() {
      if (pingCache !== null) {
        pingCache.delete(wakeable);
        markRootUpdated(root, lane);
        ensureRootIsScheduled(root);
      }
    }
    wakeable.then(ping, ping);
  }
}
