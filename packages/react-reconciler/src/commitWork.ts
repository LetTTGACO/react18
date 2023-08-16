import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';
import { appendChildToContainer, Container } from 'hostConfig';

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
  // flags是否有Update
  // commitUpdate(finshedWork);
  // flags是否有ChildDeletion
  // commitChildDeletion(finshedWork);
};

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行Placement操作', finishedWork);
  }
  // 获取父级的宿主环境对应的DOM节点
  const hostParent = getHostParent(finishedWork);
  // 找到finishedWork 对应的 DOM
  // 并且将DOM append parent dom
  if (hostParent !== null) {
    appendPlacementNodeIntoContainer(finishedWork, hostParent);
  }
};

/**
 * 获取父级的宿主环境对应的DOM节点
 * @param fiber
 */
function getHostParent(fiber: FiberNode): Container | null {
  // 向上遍历的过程
  let parent = fiber.return;

  while (parent) {
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
function appendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container
) {
  // 向下递归遍历，直到找到HostComponent/HostText
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(hostParent, finishedWork.stateNode);
    return;
  }

  const child = finishedWork.child;
  if (child !== null) {
    appendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;
    while (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
