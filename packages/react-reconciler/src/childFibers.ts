import { createFiberFromElement, FiberNode } from './fiber';
import { ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { Placement } from './fiberFlags';

/**
 * 在Mount阶段插入节点
 * @param shouldTrackEffects 是否需要追踪副作用，是否需要标记Placement等
 * @constructor
 */
function ChildReconciler(shouldTrackEffects: boolean) {
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
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
    newChild?: ReactElementType // 子节点的ReactElement
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
    if (__DEV__) {
      console.error('未实现的reconcile类型');
    }
    return null;
  };
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
