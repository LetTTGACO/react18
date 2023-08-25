import { FiberNode, FiberRootNode } from './fiber';
import {
  ChildDeletion,
  MutationMask,
  NoFlags,
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

let nextEffect: FiberNode | null = null;
export const commitMutationEffects = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;
  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;
    if (
      (nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
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
        commitMutationEffectsOnFiber(nextEffect);
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

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
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
        commitDeletion(childDeletion);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
  // flags是否有Update
  // commitUpdate(finishedWork);
  // flags是否有ChildDeletion
  // commitChildDeletion(finishedWork);
};

/**
 * 删除子节点
 * @param childToDelete 即将被删除的子节点
 */
const commitDeletion = (childToDelete: FiberNode) => {
  // 递归删除
  let hostChildrenToDelete: FiberNode | null = null;
  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        if (hostChildrenToDelete === null) {
          hostChildrenToDelete = unmountFiber;
        }
        // TODO 需要解绑ref
        return;
      case HostText:
        if (hostChildrenToDelete === null) {
          hostChildrenToDelete = unmountFiber;
        }
        return;
      case FunctionComponent:
        // TODO 删除前要调用useEffect中的unmount方法
        return;
      default:
        if (__DEV__) {
          console.warn('未实现的Unmount类型', childToDelete);
        }
    }
  });
  //移除rootHostNode的DOM
  if (hostChildrenToDelete !== null) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      removeChild((hostChildrenToDelete as FiberNode).stateNode, hostParent);
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
