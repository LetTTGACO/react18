import {
  createWorkInProcess,
  FiberNode,
  FiberRootNode,
  PendingPassiveEffect
} from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
  commitHookEffectListMount,
  commitHookEffectListUnmount,
  commitHookEffectListDestroy,
  commitMutationEffects,
  commitLayoutEffects
} from './commitWork';
import {
  getHighestPriorityLane,
  Lane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
  NoLane,
  SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';
import {
  unstable_cancelCallback as cancelCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';
import { getSuspenseThenable, SuspenseException } from './thenable';
import { resetHooksOnUnwind } from './fiberHooks';
import { throwException } from './fiberThrow';
import { unwindWork } from './fiberUnwindWork';

let workInProcess: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
// 阻止多次调度
let rootDoseHasPassiveEffect: boolean = false;

type RootExitStatus = number;
const RootInComplete: RootExitStatus = 1;
const RootCompleted: RootExitStatus = 2;

type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;
const NotSuspended = 0;
const SuspendedOnData = 1;
let wipSuspendedReason: SuspendedReason = NotSuspended;
let wipThrownValue: any = null;

/**
 * 初始化操作
 * @param root
 * @param lane
 */
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
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
export function ensureRootIsScheduled(root: FiberRootNode) {
  // 获取最高优先级
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  // 获取当前的callbackNode
  const existingCallbackNode = root.callbackNode;
  if (updateLane === NoLane) {
    // 不需要更新
    if (existingCallbackNode !== null) {
      // 取消调度
      cancelCallback(existingCallbackNode);
    }
    // 重置callbackNode和callbackPriority
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }
  // 记录当前的优先级
  const curPriority = updateLane;
  // 记录上次的优先级
  const prevPriority = root.callbackPriority;
  // 相同优先级，不需要再次调度
  if (curPriority === prevPriority) return;
  // 优先级不相同,更高优先级work，
  // 因为最低的会被sort掉
  if (existingCallbackNode !== null) {
    // 把之前的调度取消
    cancelCallback(existingCallbackNode);
  }
  // 新的newCallbackNode
  let newCallbackNode = null;

  if (updateLane === SyncLane) {
    // 同步优先级 微任务调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级', updateLane);
    }
    // 同步更新不需要赋值callbackNode
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 宏任务调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    // 异步更新需要赋值callbackNode
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
  // 重新赋值本次更新的信息
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

/**
 * 在FiberRootNode中记录本次更新的优先级
 * @param root
 * @param lane
 */
export function markRootUpdated(root: FiberRootNode, lane: Lane) {
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
 * 并发更新render 阶段
 * @param root
 * @param didTimeout
 */
export function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeout: boolean
): any {
  // 记录之前的callbackNode，防止被中断
  const curCallbackNode = root.callbackNode;
  // 并发更新开始前，保证之前的useEffect的回调都已经执行
  // 因为useEffect回调的优先级可能比现在更高，需要打断现在的执行
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  if (didFlushPassiveEffect) {
    // 被打断了，有更高优先级任务被调度
    if (root.callbackNode !== curCallbackNode) {
      return null;
    }
  }
  const lane = getHighestPriorityLane(root.pendingLanes);
  if (lane === NoLane) {
    return null;
  }
  const needSync = lane === SyncLane || didTimeout;
  // render阶段
  const exitStatus = renderRoot(root, lane, !needSync);

  ensureRootIsScheduled(root);
  if (exitStatus === RootInComplete) {
    // 被中断了
    // 判断中断后重新调度的回调是否和之前是同一个
    if (root.callbackNode !== curCallbackNode) {
      return null;
    }
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  if (exitStatus === RootCompleted) {
    // render结束
    root.finishedWork = root.current.alternate;
    // 更新结束，保存lane到root上
    root.finishedLane = lane;
    // wip fiberNode树 树中的flags
    commitRoot(root);
  } else {
    // TODO
    console.warn('还未实现并发更新还未结束状态');
  }
}

/**
 *
 * @param root
 * @param lane
 * @param shouldTimeSlice 是否应该时间切片
 */

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
  }
  // 初始化
  // 并发更新中断时不应该执行初始化，不是每次都需要哦初始化
  if (wipRootRenderLane !== lane) {
    prepareFreshStack(root, lane);
  }

  do {
    try {
      if (wipSuspendedReason !== NotSuspended && workInProcess !== null) {
        const thrownValue = wipThrownValue;
        wipSuspendedReason = NotSuspended;
        wipThrownValue = null;
        // unwind流程
        throwAndUnwindWorkLoop(root, workInProcess, thrownValue, lane);
      }
      // 是否开启时间切片
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      // 有可能render执行完，有可能被更高优先级的中断执行了
      break;
    } catch (e) {
      if (__DEV__) {
        console.error('workLoop失败', e);
      }
      // 重置workInProgress
      // workInProcess = null;
      handleThrow(root, e);
    }
  } while (true);
  // 中断执行 或者render执行完
  if (shouldTimeSlice && workInProcess !== null) {
    // 开启时间切片，而且workInProcess不为空，表示被中断了还没执行完
    return RootInComplete;
  }
  // render阶段执行完
  if (!shouldTimeSlice && workInProcess !== null && __DEV__) {
    console.error('render阶段结束，wip不应该不为null');
  }
  return RootCompleted;
  // TODO 报错
}

/**
 *
 * @param root
 * @param unitOfWork 当前挂起的fiber节点
 * @param throwValue 抛出的错误值
 * @param lane 优先级
 */

function throwAndUnwindWorkLoop(
  root: FiberRootNode,
  unitOfWork: FiberNode,
  throwValue: any,
  lane: Lane
) {
  // 重置FC 全局变量
  resetHooksOnUnwind();
  // 请求返回重新触发更新
  throwException(root, throwValue, lane);
  // unwind流程
  unwindUnitOfWork(unitOfWork);
}

function unwindUnitOfWork(unitOfWork: FiberNode) {
  // 向上走
  // 找离当前抛出异常的组件最近的Suspense
  let incompleteWork: FiberNode | null = unitOfWork;
  do {
    const next = unwindWork(incompleteWork);
    if (next !== null) {
      // 找到对应的suspense
      workInProcess = next;
      return;
    }
    // 没找到，就继续往上找
    const returnFiber = incompleteWork.return as FiberNode | null;
    if (returnFiber !== null) {
      // 把之前已经标记的副作用给清除
      returnFiber.deletions = null;
    }
    incompleteWork = returnFiber;
  } while (incompleteWork !== null);
  // 走到这里，代表使用了use，所以抛出了data，但是没有定义Suspense（没有Suspense包裹这个组件），所以一直没找到
  // TODO 到了root
  workInProcess = null;
}

/**
 * 统一处理错误
 * @param root
 * @param thrownValue
 */
function handleThrow(root: FiberRootNode, thrownValue: any) {
  // Error Boundary
  // use自定义错误
  if (thrownValue === SuspenseException) {
    thrownValue = getSuspenseThenable();
    wipSuspendedReason = SuspendedOnData;
  }
  wipThrownValue = thrownValue;
}

/**
 * 同步render阶段的入口
 * @param root
 */
export function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // 其他比SyncLane低的优先级
    // NoLane等
    // 以防万一再重新调度一下
    ensureRootIsScheduled(root);
    return;
  }
  // 批处理
  const exitStatus = renderRoot(root, nextLane, false);
  if (exitStatus === RootCompleted) {
    // render结束
    root.finishedWork = root.current.alternate;
    // 更新结束，保存lane到root上
    root.finishedLane = nextLane;
    // wip fiberNode树 树中的flags
    commitRoot(root);
  } else {
    // TODO
    console.warn('还未实现同步更新还未结束状态');
  }
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

  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    // 当前fiber树中存在函数组件需要执行useEffect的回调
    if (!rootDoseHasPassiveEffect) {
      rootDoseHasPassiveEffect = true;
      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }
  // mutation阶段
  // 判断是否存在3个子阶段需要执行的操作
  // root flags root subtreeFlags 是否包含副作用
  const subtreeHasEffect =
    // TODO 之前只有MutationMask
    // (finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
    (finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
  const rootHasEffect =
    (finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // 阶段1/3:beforeMutation

    // 阶段2/3:Mutation Placement对应的数组环境的操作
    commitMutationEffects(finishedWork, root);
    // Fiber Tree切换
    // fiber树的切换 发生在mutation on阶段和layout阶段之间
    root.current = finishedWork;

    // 阶段3/3:Layout
    commitLayoutEffects(finishedWork, root);
  } else {
    root.current = finishedWork;
  }
  // 重置标记
  rootDoseHasPassiveEffect = false;
  // 重新调度root
  ensureRootIsScheduled(root);
}

/**
 * 执行调度
 * @param pendingPassiveEffects
 */
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffect) {
  let didFlushPassiveEffect = false;
  // 首先触发所有unmount effect，且对于某个fiber，如果触发了unmount destroy，本次更新不会再触发update create
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    // 代表接下来的流程是useEffect的unmount的回调
    // useLayout => Layout
    commitHookEffectListDestroy(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    // 不仅useEffect要触发，而且还得标记HookHasEffect才能触发
    // 如果只有useEffect标记Passive，但是没有标记HookHasEffect，则不会触发
    commitHookEffectListUnmount(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    // 不仅useEffect要触发，而且还得标记HookHasEffect才能触发
    // 如果只有useEffect标记Passive，但是没有标记HookHasEffect，则不会触发
    commitHookEffectListMount(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  // 在useEffect中还有可能有setState更新
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

/**
 * 同步workLoop
 */
function workLoopSync() {
  while (workInProcess !== null) {
    performUnitOfWork(workInProcess);
  }
}

/**
 * 并发workLoop
 */
function workLoopConcurrent() {
  while (workInProcess !== null && !unstable_shouldYield()) {
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
