import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';

// HostRoot
export interface Container {
  rootID: number;
  children: (Instance | TextInstance)[];
}
// HostComponent
export interface Instance {
  id: number;
  type: string;
  children: (Instance | TextInstance)[];
  parent: number;
  props: Props;
}
// HostText
export interface TextInstance {
  text: string;
  id: number;
  parent: number;
}

let instanceCounter = 0;
export const createInstance = (type: string, props: Props): Instance => {
  const instance: Instance = {
    id: instanceCounter++,
    type,
    children: [],
    parent: -1,
    props
  };
  return instance;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  // 上一次的parentId
  const prevParentId = child.parent;
  // 判断是HostRoot还是HostComponent，得到父ID
  const parentId = 'rootID' in parent ? parent.rootID : parent.id;
  // 如果上一次的parentId不是-1（HostComponent节点）
  // 且上一次的parentId不等于父ID，说明是重复插入Child
  //  不能插入重复的Child
  if (prevParentId !== -1 && prevParentId !== parentId) {
    // TODO 这里没搞懂
    throw new Error('不能重复挂载child');
  }
  child.parent = parentId;
  parent.children.push(child);
};

export const createTextInstance = (content: string) => {
  const instance: TextInstance = {
    text: content,
    id: instanceCounter++,
    parent: -1
  };
  return instance;
};

export const appendChildToContainer = (parent: Container, child: Instance) => {
  // 上一次的parentId
  const prevParentId = child.parent;
  // 判断是HostRoot还是HostComponent，得到父ID
  const parentId = parent.rootID;
  // 如果上一次的parentId不是-1（HostComponent节点）
  // 且上一次的parentId不等于父ID，说明是重复插入Child
  //  不能插入重复的Child
  if (prevParentId !== -1 && prevParentId !== parentId) {
    // TODO 这里没搞懂
    throw new Error('不能重复挂载child');
  }
  child.parent = parentId;
  parent.children.push(child);
};

export const commitUpdate = (fiber: FiberNode) => {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps?.content;
      return commitTextUpdate(fiber.stateNode, text);
    default:
      if (__DEV__) {
        console.warn('未实现的Update类型', fiber);
      }
      break;
  }
};

export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.text = content;
}

/**
 * 删除子节点
 * @param child
 * @param container
 */
export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  const index = container.children.indexOf(child);
  if (index === -1) {
    throw new Error('child不存在');
  }
  container.children.splice(index, 1);
}

export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  const beforeIndex = container.children.indexOf(before);
  if (beforeIndex === -1) {
    throw new Error('before不存在');
  }
  const childIndex = container.children.indexOf(child);
  if (childIndex !== -1) {
    // 说明child已经存在了
    // 但是需要将child移除再插入到before之前
    container.children.splice(childIndex, 1);
  }
  // 插入到before之前
  container.children.splice(beforeIndex, 0, child);
}

/**
 * 如果当前宿主环境支持queueMicrotask微任务，就用queueMicrotask
 * 如果不支持queueMicrotask微任务，就看是否存在Promise，用Promise构造微任务
 * 如果不知道Promise，就返回setTimeout，用宏任务构造
 */
export const scheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
    ? (callback: () => void) => Promise.resolve(null).then(callback)
    : setTimeout;
