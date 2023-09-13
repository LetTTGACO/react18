import { FiberNode } from './fiber';
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { Ref } from './fiberFlags';

/**
 * 递归中过的递阶段，向下
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  // 比较，返回子fiberNode
  switch (wip.tag) {
    case HostRoot:
      // 1. 计算状态的最新值
      // 2. 创建子fiberNode
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      // 没有子节点，直接return null
      return null;
    case FunctionComponent:
      // 没有子节点，直接return null
      return updateFunctionComponent(wip, renderLane);
    case Fragment:
      return updateFragment(wip);
    default:
      if (__DEV__) {
        console.warn('beginWork未实现的类型');
      }
      return null;
  }
};

function updateFragment(wip: FiberNode) {
  // 创建子fiberNode
  const nextChildren = wip.pendingProps;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * 函数式组件
 */
function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  // 创建子fiberNode
  const nextChildren = renderWithHooks(wip, renderLane);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  // 考虑并发更新时，这里如果赋值为null，之前的计算结果就丢失了
  updateQueue.shared.pending = null;
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
  // 最新状态, 对应的就是<App/>的reactElement
  wip.memoizedState = memoizedState;

  const nextChildren = wip.memoizedState;
  reconcileChildren(wip, nextChildren);
  return wip.child;
  // wip.alternate?.child;
}

function updateHostComponent(wip: FiberNode) {
  // 没办法触发更新
  // 创建子fiberNode
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  markRef(wip.alternate, wip);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: any) {
  // 1. 获取父节点的currentNode
  const current = wip.alternate;
  // 比较子节点的属性
  if (current !== null) {
    // update
    wip.child = reconcileChildFibers(wip, current?.child, children);
  } else {
    // mount阶段，currentChildren为null
    wip.child = mountChildFibers(wip, null, children);
  }
}

/**
 * beginWork阶段标记Ref
 * @param current
 * @param wip
 */
function markRef(current: FiberNode | null, wip: FiberNode) {
  // mount时：存在Ref
  // update时：ref变化
  // 以上情况就需要标记Ref
  if (
    // mount时：存在Ref
    (current === null && wip.ref !== null) ||
    // update时：ref变化
    (current !== null && current.ref !== wip.ref)
  ) {
    wip.flags |= Ref;
  }
}
