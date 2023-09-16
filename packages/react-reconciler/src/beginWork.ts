import {
  createFiberFromFragment,
  createFiberFromOffscreen,
  createWorkInProcess,
  FiberNode,
  OffscreenProps
} from './fiber';
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent
} from './workTags';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import {
  ChildDeletion,
  DidCapture,
  NoFlags,
  Placement,
  Ref
} from './fiberFlags';
import { ReactProviderType } from 'shared/ReactTypes';
import { pushProvider } from './fiberContext';
import { pushSuspenseHandler } from './suspenseContext';

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
    case ContextProvider:
      return updateContextProvider(wip);
    case SuspenseComponent:
      return updateSuspenseComponent(wip);
    case OffscreenComponent:
      return updateFallbackComponent(wip);
    default:
      if (__DEV__) {
        console.warn('beginWork未实现的类型');
      }
      return null;
  }
};

function updateSuspenseComponent(wip: FiberNode) {
  const current = wip.alternate;
  const nextProps = wip.pendingProps;
  let showFallback = false;
  // 决定什么是否挂起，什么时候正常
  const didSuspend = (wip.flags | DidCapture) !== NoFlags;

  if (didSuspend) {
    // 挂起状态
    showFallback = true;
    wip.flags &= ~DidCapture;
  }
  // 子组件就是正常组件
  const nextPrimaryChildren = nextProps.children;
  // props上的fallback就是中间状态组件
  const nextFallbackChildren = nextProps.fallback;
  pushSuspenseHandler(wip);

  if (current === null) {
    // mount流程
    if (showFallback) {
      // mount流程下的挂起
      return mountSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      // mount流程下的正常
      return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  } else {
    // update流程
    if (showFallback) {
      // update流程下的挂起
      return updateSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      // update流程下的正常
      return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  }
}

/**
 * update时的正常状态
 */
function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment = currentPrimaryChildFragment.sibling;
  // offscreen对应的props
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  };
  // 复用的offscreen对应的fiber
  const primaryChildFragment = createWorkInProcess(
    currentPrimaryChildFragment,
    primaryChildProps
  );

  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = null;
  wip.child = primaryChildFragment;

  // 需要移除currentFallbackChildFragment
  if (currentFallbackChildFragment !== null) {
    const deletions = wip.deletions;
    if (deletions === null) {
      wip.deletions = [currentFallbackChildFragment];
      wip.flags |= ChildDeletion;
    } else {
      deletions.push(currentFallbackChildFragment);
    }
  }
  return primaryChildFragment;
}

/**
 * update时的挂起状态
 */
function updateSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment = currentPrimaryChildFragment.sibling;
  // offscreen对应的props
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  };
  // 复用的offscreen对应的fiber
  const primaryChildFragment = createWorkInProcess(
    currentPrimaryChildFragment,
    primaryChildProps
  );
  let fallbackChildFragment;
  if (currentFallbackChildFragment !== null) {
    // 可以复用
    fallbackChildFragment = createWorkInProcess(
      currentFallbackChildFragment,
      fallbackChildren
    );
  } else {
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
    fallbackChildFragment.flags |= Placement;
  }

  fallbackChildFragment.return = wip;
  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;
  return fallbackChildFragment;
}

/**
 * mount时的正常状态
 */
function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  // offscreen对应的props
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  };
  // 创建offscreen对应的fiber
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
  // 没必要提前创建fallbackChild
  primaryChildFragment.return = wip;
  wip.child = primaryChildFragment;
  return primaryChildFragment;
}

/**
 * mount时的挂起状态
 */
function mountSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  // offscreen对应的props
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  };
  // 创建offscreen对应的fiber
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

  // 因为mountSuspenseFallbackChildren的执行是在mode变成hidden时执行，
  // 而一般的flags被标记是在shouldTrackEffect时，也就是update时才会执行，
  // 而对于fallback是mount时就需要执行
  // 所以需要手动标记Placement
  fallbackChildFragment.flags |= Placement;

  primaryChildFragment.return = wip;
  fallbackChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;
  return fallbackChildFragment;
}

function updateFallbackComponent(wip: FiberNode) {
  // 创建子fiberNode
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateContextProvider(wip: FiberNode) {
  const providerType = wip.type as ReactProviderType<any>;
  const context = providerType._context;
  const newProps = wip.pendingProps;
  // currentValue的赋值操作
  pushProvider(context, newProps.value);
  const nextChildren = newProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

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
  const current = wip.alternate;
  if (current !== null) {
    current.memoizedState = memoizedState;
    // markRef(current, wip);
  }
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
