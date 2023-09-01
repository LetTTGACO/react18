import { FiberNode, FiberRootNode, PendingPassiveEffect } from './fiber';
import {
  ChildDeletion,
  Flags,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Update
} from './fiberFlags';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';
import {
  appendChildToContainer,
  commitUpdate,
  Container,
  insertChildToContainer,
  Instance,
  removeChild
} from 'hostConfig';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;
export const commitMutationEffects = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  nextEffect = finishedWork;
  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;
    if (
      (nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
      child !== null
    ) {
      // 子阶段有flags，继续向子节点遍历
      nextEffect = child;
    } else {
      // 找到底了，或者节点不包含subtreeFlags
      // 有可能包含flags
      // 向上遍历 DFS
      up: while (nextEffect !== null) {
        // finishedWork真正存在flags的fiber节点
        commitMutationEffectsOnFiber(nextEffect, root);
        const sibling: FiberNode | null = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        nextEffect = nextEffect.return;
      }
    }
  }
};

const commitMutationEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const flags = finishedWork.flags;
  // flags是否有Placement
  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  // Update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }
  // ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childDeletion) => {
        commitDeletion(childDeletion, root);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
  // 在处理Effect的地方收集回调
  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回调
    commitPassiveEffect(finishedWork, root, 'update');
    // 移除掉PassiveEffect
    finishedWork.flags &= ~PassiveEffect;
  }
};

/**
 * 遍历effect环状链表
 * @param flags
 * @param lastEffect
 * @param callback
 */
function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;
  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

/**
 * effect卸载时的处理
 * 如果触发了unmount destroy，本次更新不会再触发update create
 * @param flags
 * @param lastEffect
 */
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
    // 组件卸载后，本次更新不会再触发update create，需要移除掉副作用标记
    effect.tag &= ~HookHasEffect;
  });
}

/**
 * effect销毁时的处理
 * 触发所有上次更新的destroy
 * @param flags
 * @param lastEffect
 */
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
  });
}

/**
 * effect创建时的处理
 * @param flags
 * @param lastEffect
 */
export function commitHookEffectListMount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === 'function') {
      // useEffect的回调函数就是creat函数，它的返回值就是destroy函数
      effect.destroy = create();
    }
  });
}

/**
 * 收集回调
 * @param fiber
 * @param root
 * @param type
 */
function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffect
) {
  // update
  if (
    fiber.tag !== FunctionComponent ||
    (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    // 非函数式组件
    // update中不含有PassiveEffect
    return;
  }
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.warn('当FC存在PassiveEffect， flags不应该不存在Effect');
    }
    // updateQueue.lastEffect是环状链表，只需要push lastEffect 就可以在后面很方便的遍历
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
  }

  // unmount
}

function recordHostChildrenToDelete(
  childrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1. 找到第一个root host节点
  const lastOne = childrenToDelete[childrenToDelete.length - 1];
  if (!lastOne) {
    childrenToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    while (node !== null) {
      if (node === unmountFiber) {
        // 2. 每找到一个host节点，判断下这个节点是不是 1 找到的那个节点的兄弟节点，如果不是就说明是Fragment
        childrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
  // 这样childToDelete留下来的全是同一级的host节点
}

/**
 * 删除子节点
 * @param childToDelete 即将被删除的子节点
 * @param root
 */
const commitDeletion = (childToDelete: FiberNode, root: FiberRootNode) => {
  // 递归删除
  const rootChildrenToDelete: FiberNode[] = [];
  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        // if (rootChildrenToDelete === null) {
        //   rootChildrenToDelete = unmountFiber;
        // }
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        // TODO 需要解绑ref
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        // TODO 解绑ref
        // 收集回调
        commitPassiveEffect(unmountFiber, root, 'unmount');
        return;
      default:
        if (__DEV__) {
          console.warn('未实现的Unmount类型', childToDelete);
        }
    }
  });
  //移除rootHostNode的DOM
  if (rootChildrenToDelete.length !== 0) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((childToDelete) => {
        // 对于Fragment来说，有可能有多个根节点
        removeChild(childToDelete.stateNode, hostParent);
      });
    }
  }
  childToDelete.return = null;
  childToDelete.child = null;
};

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);

    if (node.child !== null) {
      // 向下遍历的过程
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      // 终止条件
      return;
    }
    while (node.sibling == null) {
      if (node.return === null || node.return === root) {
        // 终止条件
        return;
      }
      // 向上归的过程
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行Placement操作', finishedWork);
  }
  // 获取父级的宿主环境对应的DOM节点
  const hostParent = getHostParent(finishedWork);
  // 找到 host sibling节点
  const sibling = getHostSibling(finishedWork);
  // 找到finishedWork 对应的 DOM
  // 并且将DOM append parent dom
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
  }
};

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;

  findSibling: while (true) {
    // 向上遍历
    while (node.sibling === null) {
      const parent = node.return;
      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        // 终止条件没找到
        return null;
      }
      node = parent;
    }

    // 向下遍历
    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 直接的兄弟节点不是一个Host类型
      // 向下遍历
      // 不稳定的兄弟节点不能作为兄弟节点
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }
      if (node.child === null) {
        // 继续寻找兄弟节点
        continue findSibling;
      } else {
        // 向下遍历
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      // 找到了Host类型的兄弟节点
      return node.stateNode;
    }
  }
}
/**
 * 获取父级的宿主环境对应的DOM节点
 * @param fiber
 */
function getHostParent(fiber: FiberNode) {
  // 向上遍历的过程
  let parent = fiber.return;

  while (parent !== null) {
    const parentTag = parent.tag;
    if (parentTag === HostComponent) {
      // 对于HostComponent也就是div等元素，其DOM节点保存在parent.stateNode中
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn('未找到host parent');
  }
  return null;
}

/**
 * 将Placement对应的node append 到对应的dom中
 */
function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before: Instance
) {
  // 向下递归遍历，直到找到HostComponent/HostText
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }

  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent, before);
    let sibling = child.sibling;
    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent, before);
      sibling = sibling.sibling;
    }
  }
}
