import { createWorkInProcess, FiberNode, FiberRootNode } from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';
import { MutationMask, NoFlags } from './fiberFlags';
import { commitMutationEffects } from './commitWork';

let workInProcess: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
  // root.current 指向hostRootFiber
  workInProcess = createWorkInProcess(root.current, {});
}

/**
 * 在Fiber中调度Update
 * 连接Container和renderRoot方法
 */
export function scheduleUpdateOnFiber(fiber: FiberNode) {
  // TODO 调度功能
  const root = markUpdateFromFiberToRoot(fiber);
  renderRoot(root);
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
export function renderRoot(root: FiberRootNode) {
  // 初始化
  prepareFreshStack(root);

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
  // 重置
  root.finishedWork = null;
  // 判断是否存在3个子阶段需要执行的操作
  // root flags root subtreeFlags 是否包含副作用
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation阶段
    // mutation阶段 Placement对应的数组环境的操作
    commitMutationEffects(finishedWork);
    // fiber树的切换 发生在mutati on阶段和layout阶段之间
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
  const next = beginWork(fiber);
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
