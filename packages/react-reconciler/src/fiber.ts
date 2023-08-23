import { FunctionComponent, HostComponent, WorkTag } from './workTags';
import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
  tag: WorkTag;
  key: Key;
  // 例如FunctionComponent 函数本身 () => {}
  type: any;
  // 例如HostComponent的<div> 则为div DOM
  stateNode: any;
  ref: Ref;

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
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例属性
    this.tag = tag;
    this.key = key;
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

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
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
  return wip;
};

export function createFiberFromElement(element: ReactElementType) {
  const { type, key, props } = element;
  let fiberTag: WorkTag = FunctionComponent;
  if (typeof type === 'string') {
    // <div/> type: "div"
    fiberTag = HostComponent;
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('未定义的type类型', element);
  }

  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}
