import {
  createFiberFromElement,
  createFiberFromFragment,
  createWorkInProcess,
  FiberNode
} from './fiber';
import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Fragment, HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

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

  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null
  ) {
    if (!shouldTrackEffects) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      // 将兄弟节点全部标记为删除
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
  }
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    while (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // key相同，需要比较type
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            let props = element.props;
            if (element.type === REACT_FRAGMENT_TYPE) {
              props = element.props.children;
            }
            // type相同
            // 当前节点可以复用
            const existing = useFiber(currentFiber, props);
            existing.return = returnFiber;
            // 对于多节点来说，标记剩下的节点删除
            deleteRemainingChildren(returnFiber, currentFiber.sibling);
            return existing;
          }
          // key相同，typ不同
          // 删掉所有旧的
          deleteRemainingChildren(returnFiber, currentFiber);
          break;
          // 创建新的
        } else {
          console.error('还未实现的React类型', element);
          break;
        }
      } else {
        // key不同，删掉当前key不同的节点，然后继续遍历其他的节点
        // 删掉旧的
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }

    // 根据element创建fiber
    let fiber;
    if (element.type === REACT_FRAGMENT_TYPE) {
      fiber = createFiberFromFragment(element.props.children, key);
    } else {
      fiber = createFiberFromElement(element);
    }

    // 父节点指向returnFiber
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    while (currentFiber !== null) {
      // update流程
      if (currentFiber.tag === HostText) {
        // 类型没变，可以复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        // 对于多节点来说，标记剩下的节点删除
        deleteRemainingChildren(returnFiber, currentFiber.sibling);
        return existing;
      }
      // 之前是div，现在是123
      // 需要删除之前的
      deleteChild(returnFiber, currentFiber);
      // 继续遍历兄弟节点
      currentFiber = currentFiber.sibling;
    }
    // 根据文本创建fiber
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  /**
   * 处理同级多节点的新的child
   */
  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[]
  ) {
    // 最后一个可复用fiber在Map中的current的index
    let lastPlacedIndex = 0;
    // 创建的最后一个Fiber
    let lastNewFiber: FiberNode | null = null;
    // 创建的第一个Fiber
    let firstNewFiber: FiberNode | null = null;
    // 1. 将current（也就是更新前，也是一个FiberNode）中所有同级的fiber保存的Map，
    // 如果可复用就删除Map中的元素，剩余的就是都需要删除的，统一删除
    const existingChildren: ExistingChildren = new Map();
    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildren.set(keyToUse, current);
      current = current.sibling;
    }

    for (let i = 0; i < newChild.length; i++) {
      // 2.遍历新的newChild数组，寻找是否可复用
      const after = newChild[i];
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
      if (newFiber === null) {
        // 继续遍历其他节点
        continue;
      }
      // 3.判断是插入还是移动
      newFiber.index = i;
      newFiber.return = returnFiber;
      // lastNewFiber始终指向的是最后一个新的Fiber
      // firstNewFiber始终指向的是第一个新的Fiber
      if (lastNewFiber === null) {
        lastNewFiber = newFiber;

        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }
      if (!shouldTrackEffects) {
        continue;
      }

      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          // 移动
          newFiber.flags |= Placement;
        } else {
          // 不移动
          lastPlacedIndex = newFiber.index;
        }
      } else {
        // mount 插入
        newFiber.flags |= Placement;
      }
    }

    // 4.最后Map中剩下的都删除
    existingChildren.forEach((fiber) => {
      deleteChild(returnFiber, fiber);
    });
    return firstNewFiber;
  }

  /**
   * 从existingChildren Map中和当前遍历到child element中判断是否可复用
   * @param returnFiber
   * @param existingChildren
   * @param index
   * @param element
   * @return FiberNode 可复用的FiberNode或者一个FiberNode
   */
  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    const before = existingChildren.get(keyToUse);
    // element是HostText，对比current的type，一样的话可复用
    if (typeof element === 'string' || typeof element === 'number') {
      // HostText
      if (before) {
        if (before.tag === HostText) {
          // 删除可复用的元素
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element + '' });
        }
        return new FiberNode(HostText, { content: element + '' }, null);
      }
    }
    //element是其他ReactElement，对比current的type和key，都一样的话可复用
    if (typeof element === 'object') {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (element.type === REACT_FRAGMENT_TYPE) {
            updateFragment(
              returnFiber,
              before,
              element,
              keyToUse,
              existingChildren
            );
          }
          if (before) {
            if (before.type === element.type) {
              //type和key都一样,可复用
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }
          return createFiberFromElement(element);
      }
      if (Array.isArray(element) && __DEV__) {
        console.warn('还未实现数组类型的Child');
      }
    }
    if (Array.isArray(element)) {
      return updateFragment(
        returnFiber,
        before,
        element,
        keyToUse,
        existingChildren
      );
    }
    return null;
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
    // 判断Fragment
    const isUnKeyedTopLevelFragment =
      typeof newChild === 'object' &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null;
    if (isUnKeyedTopLevelFragment) {
      // 1.Fragment包裹其他组件 所以他的children才是真正的child
      newChild = newChild.props.children;
    }

    // 判断当前fiber的类型
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
      }
      // 多节点 ul => li * 3
      // 如果newChild是数组
      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFiber, newChild);
      }
    }

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // HostText
      return placeSingChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }
    if (currentFiber !== null) {
      // 兜底操作，标记删除
      deleteRemainingChildren(returnFiber, currentFiber);
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

function updateFragment(
  returnFiber: FiberNode,
  current: FiberNode | undefined,
  elements: any[],
  key: Key,
  existingChildren: ExistingChildren
) {
  let fiber;
  if (!current || current.tag !== Fragment) {
    fiber = createFiberFromFragment(elements, key);
  } else {
    existingChildren.delete(key);
    fiber = useFiber(current, elements);
  }
  fiber.return = returnFiber;
  return fiber;
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
