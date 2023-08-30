import { createWorkInProcess, FiberNode, FiberRootNode } from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';
import { MutationMask, NoFlags } from './fiberFlags';
import { commitMutationEffects } from './commitWork';
import {
  getHighestPriorityLane,
  Lane,
  markRootFinished,
  mergeLanes,
  NoLane,
  SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';

let workInProcess: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  // root.current 指向hostRootFiber
  workInProcess = createWorkInProcess(root.current, {});
  // 更新开始保存lane
  wipRootRenderLane = lane;
}

/**
 * 在Fiber中调度Update
 * 连接Container和renderRoot方法
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberToRoot(fiber);
  // 记录
  markRootUpdated(root, lane);
  // 调度
  ensureRootIsScheduled(root);
  // renderRoot(root);
}

/**
 * schedule阶段入口
 * @param root
 */
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  if (updateLane === NoLane) {
    // 不需要更新
    return;
  }
  if (updateLane === SyncLane) {
    // 同步优先级 微任务调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级', updateLane);
    }
    //
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 宏任务调度
  }
}

/**
 * 在FiberRootNode中记录本次更新的优先级
 * @param root
 * @param lane
 */
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

/**
 * 从下向上更新
 * @param fiber 当前的Fiber
 */
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    // 表示是一个普通的FiberNode（有父节点return），而不是HostRootFiberNode（没有父节点）
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    // 根节点
    return node.stateNode;
  }
  return null;
}

/**
 * render阶段的入口
 * @param root
 * @param lane
 */
export function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  // TODO 没懂为什么还要再调用一次
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // 其他比SyncLane低的优先级
    // NoLane等
    // 以防万一再重新调度一下
    ensureRootIsScheduled(root);
    return;
  }
  if (__DEV__) {
    console.warn('render阶段开始');
  }
  // 初始化
  prepareFreshStack(root, lane);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.error('workLoop失败', e);
      }

      // 重置workInProgress
      workInProcess = null;
    }
  } while (true);
  root.finishedWork = root.current.alternate;
  // 更新结束，保存lane到root上
  root.finishedLane = wipRootRenderLane;
  // wip fiberNode树 树中的flags
  commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
  //
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }
  if (__DEV__) {
    console.warn('commit阶段开始', finishedWork);
  }
  const lane = root.finishedLane;
  if (lane === NoLane && __DEV__) {
    console.warn('commit阶段finishedLane不应该是NoLane');
  }
  // 重置
  root.finishedWork = null;

  root.finishedLane = NoLane;
  // 移除root.pendingLanes
  // 移除本次更新被消费的Lane
  markRootFinished(root, lane);
  // 判断是否存在3个子阶段需要执行的操作
  // root flags root subtreeFlags 是否包含副作用
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation阶段
    // mutation阶段 Placement对应的数组环境的操作
    commitMutationEffects(finishedWork);
    // fiber树的切换 发生在mutation on阶段和layout阶段之间
    root.current = finishedWork;
    // layout阶段
  } else {
    root.current = finishedWork;
  }
}

function workLoop() {
  while (workInProcess !== null) {
    performUnitOfWork(workInProcess);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  // 先执行递，有子节点就遍历子节点
  const next = beginWork(fiber, wipRootRenderLane);
  // 执行完之后将props固化
  fiber.memoizedProps = fiber.pendingProps;
  if (next === null) {
    // 没有子fiber，说明已经递到最深层了
    completeUnitOfWork(fiber);
  } else {
    // 继续执行
    workInProcess = next;
  }
  // 再执行归
}

function completeUnitOfWork(fiber: FiberNode) {
  // 没有就遍历兄弟节点
  let node: FiberNode | null = fiber;

  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProcess = sibling;
      return;
    }
    node = node.return;
    workInProcess = node;
  } while (node !== null);
}
