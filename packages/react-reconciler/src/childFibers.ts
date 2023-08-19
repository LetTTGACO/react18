import {
  createFiberFromElement,
  createWorkInProcess,
  FiberNode
} from './fiber';
import { Props, ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

/**
 * 在Mount阶段插入节点
 * @param shouldTrackEffects 是否需要追踪副作用，是否需要标记Placement等
 * @constructor
 */
function ChildReconciler(shouldTrackEffects: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      // 没有需要被删除的节点
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    work: if (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // key相同，需要比较type
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // type相同
            // 可以复用
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }
          // 删掉旧的
          deleteChild(returnFiber, currentFiber);
          break work;
          // 创建新的
        } else {
          console.error('还未实现的React类型', element);
          break work;
        }
      } else {
        // 删掉旧的
        deleteChild(returnFiber, currentFiber);
        // 创建新的
      }
    }

    // 根据element创建fiber
    const fiber = createFiberFromElement(element);
    // 父节点指向returnFiber
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    if (currentFiber !== null) {
      // update流程
      if (currentFiber.tag === HostText) {
        // 类型没变，可以复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        return existing;
      }
      // 之前是div，现在是123
      // 需要删除之前的
      deleteChild(returnFiber, currentFiber);
    }
    // 根据文本创建fiber
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  function placeSingChild(fiber: FiberNode) {
    // 应该追踪副作用 并且是首屏渲染
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  return (
    returnFiber: FiberNode, //  父Fiber
    currentFiber: FiberNode | null, // 当前Fiber
    newChild?: any // 子节点的ReactElement
  ) => {
    // 判断当前fiber的类型
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.error('未实现的reconcile类型');
            return null;
          }
      }
    }
    // TODO 多节点 ul => li * 3
    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }
    if (currentFiber !== null) {
      // 兜底操作，标记删除
      deleteChild(returnFiber, currentFiber);
    }

    if (__DEV__) {
      console.error('未实现的reconcile类型');
    }
    return null;
  };
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProcess(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
