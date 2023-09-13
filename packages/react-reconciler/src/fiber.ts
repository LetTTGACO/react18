import {
  Fragment,
  FunctionComponent,
  HostComponent,
  WorkTag
} from './workTags';
import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';

export interface PendingPassiveEffect {
  update: Effect[];
  unmount: Effect[];
}
export class FiberNode {
  tag: WorkTag;
  key: Key;
  // 例如FunctionComponent 函数本身 () => {}
  type: any;
  // 例如HostComponent的<div> 则为div DOM
  stateNode: any;
  ref: Ref | null;

  // 指向父FiberNode
  return: FiberNode | null;
  // 指向右边的兄弟节点
  sibling: FiberNode | null;
  // 指向子节点
  child: FiberNode | null;
  // 如果是多个子节点，用index来标识，例如<ul><li/><li/></ul>
  index: number;

  pendingProps: Props;
  memoizedProps: Props | null;
  memoizedState: any;
  // 用于切换current fiberNode 和workInProcess fiberNode
  alternate: FiberNode | null;
  lanes: Lanes;
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例属性
    this.tag = tag;
    this.key = key || null;
    this.stateNode = null;
    this.type = null;

    /**
     * 构成树状结构
     */

    this.return = null;

    this.sibling = null;

    this.child = null;

    this.index = 0;

    this.ref = null;

    /**
     * 作为工作单元
     */
    // 初始状态的props
    this.pendingProps = pendingProps;
    // 工作中确定的Props
    this.memoizedProps = null;
    this.memoizedState = null;

    this.alternate = null;
    // 调度
    this.lanes = NoLane;
    // 副作用
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
    this.updateQueue = null;
    this.deletions = null;
  }
}

export class FiberRootNode {
  /**
   * 保存对应宿主环境对应的节点，也就是rootElement，再浏览器环境就是Dom
   */
  container: Container;
  current: FiberNode;
  /**
   * 指向整个更新完成后的hostRootFiber
   */
  finishedWork: FiberNode | null;
  /**
   * 还未消费的Lanes集合
   */
  pendingLanes: Lanes;
  /**
   * 本次消费的Lane
   */
  finishedLane: Lane;
  /**
   * 收集的回调函数容器
   */
  pendingPassiveEffects: PendingPassiveEffect;
  callbackNode: CallbackNode | null;
  callbackPriority: Lane;

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;
    this.callbackNode = null;
    this.callbackPriority = NoLane;
    this.pendingPassiveEffects = {
      update: [],
      unmount: []
    };
  }
}

export const createWorkInProcess = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;
  if (wip === null) {
    // 首屏渲染时，workInProcess为null
    // 进行挂载 mount
    wip = new FiberNode(current.tag, pendingProps, current.key);

    wip.stateNode = current.stateNode;
    // 当前的Fiber指向
    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
    wip.deletions = null;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;
  wip.ref = current.ref;
  return wip;
};

/**
 * 从Element中创建Fiber
 * @param element
 */
export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props, ref } = element;
  let fiberTag: WorkTag = FunctionComponent;
  if (typeof type === 'string') {
    // <div/> type: "div"
    fiberTag = HostComponent;
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('未定义的type类型', element);
  }

  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  fiber.ref = ref;
  return fiber;
}

/**
 * 从Fragment中创建Fiber
 * @param elements
 * @param key
 */
export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  return new FiberNode(Fragment, elements, key);
}
