import { FiberNode } from './fiber';
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
import {
  appendInitialChild,
  Container,
  createInstance,
  createTextInstance,
  Instance
} from 'hostConfig';
import { NoFlags, Ref, Update, Visibility } from './fiberFlags';
import { popProvider } from './fiberContext';
import { ReactContext } from 'shared/ReactTypes';
import { popSuspenseHandler } from './suspenseContext';

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

/**
 * 递归中的归阶段
 */
export const completeWork = (wip: FiberNode) => {
  // 比较，返回子fiberNode
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      // 构建离屏的DOM树 stateNode: 保存DOM节点
      if (current !== null && wip.stateNode) {
        // TODO 走更新逻辑 update
        // props是否改变
        // 如果改变需要添加Flags
        // fiberNode.updateQueue = ['变化的属性'， 变化的值]
        // n key
        // n + 1 value
        // TODO 应该先判断是否变化再标记
        // updateFiberProps(wip.stateNode, newProps);
        markUpdate(wip);
        if (current.ref !== wip.ref) {
          markRef(wip);
        }
      } else {
        // mount
        // 1.构建DOM
        const instance = createInstance(wip.type, newProps);
        // 2.将DOM插入到DOM树中
        appendAllChildren(instance, wip);
        // 将创建好的DOM挂载到stateNode下
        wip.stateNode = instance;
        // 标记Ref
        if (wip.ref !== null) {
          markRef(wip);
        }
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // 走更新逻辑 update
        const oldText = current.memoizedProps?.content;
        // 获取新text
        const newTextProps = newProps.content;
        if (oldText !== newTextProps) {
          // 标记更新
          markUpdate(wip);
        }
      } else {
        // 1.创建文本节点
        const instance = createTextInstance(newProps.content);
        // 文本节点不存在child，所以不需要append
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case FunctionComponent:
    case HostRoot:
    case Fragment:
    case OffscreenComponent:
      bubbleProperties(wip);
      return null;
    case ContextProvider:
      const context = wip.type._context as ReactContext<any>;
      popProvider(context);
      bubbleProperties(wip);
      return null;
    case SuspenseComponent:
      popSuspenseHandler();
      // 对比mode变化
      const offscreenFiber = wip.child as FiberNode;
      const isHidden = offscreenFiber.pendingProps.mode === 'hidden';
      const currentOffscreenFiber = offscreenFiber.alternate;
      if (currentOffscreenFiber !== null) {
        // update
        // completeWork时对比current Offscreen mode 与 wip Offscreen mode
        const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';
        if (wasHidden !== isHidden) {
          offscreenFiber.flags |= Visibility;
          // 这里冒泡的是wip的子组件，也就是是offscreenFiber
          bubbleProperties(offscreenFiber);
        }
      } else if (isHidden) {
        // current === null && hidden，首屏渲染时为hidden
        offscreenFiber.flags |= Visibility;
        bubbleProperties(offscreenFiber);
      }
      bubbleProperties(wip);
      return null;
    default:
      console.warn('未处理的completeWork情况');
      break;
  }
};

/**
 * complete阶段标记Ref
 * @param fiber
 */
function markRef(fiber: FiberNode) {
  fiber.flags |= Ref;
}

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
  let node = wip.child;
  // wip有可能不是一个DOM节点
  // 所以需要对wip的子节点进行递归遍历
  while (node !== null) {
    // 先往下找
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    } else if (node.child !== null) {
      // 向下寻找
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      // 向上寻找
      node = node.return;
    }
    // 寻找兄弟节点
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

/**
 * 利用completeWork向上遍历（归）的流程，将子fiberNode的flags冒泡到父fiberNode
 * @param wip
 */
function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags;

  let child = wip.child;

  while (child !== null) {
    // 按伪或操作
    // 将child的subtreeFlags附加在当前的subtreeFlags中
    // 这样subtreeFlags就包含了当前节点的子节点的subtreeFlags
    subtreeFlags |= child.subtreeFlags;
    // 还需要包含当前节点的本身的flags
    subtreeFlags |= child.flags;
    child.return = wip;
    // 继续遍历子节点的兄弟节点
    child = child.sibling;
  }

  wip.subtreeFlags |= subtreeFlags;
}
