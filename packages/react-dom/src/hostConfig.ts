import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Element;

export const createInstance = (type: string, props: any): Instance => {
  // TODO 处理props
  const element = document.createElement(type);
  return element;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export const commitUpdate = (fiber: FiberNode) => {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content;
      return commitTextUpdate(fiber.stateNode, text);
    default:
      if (__DEV__) {
        console.warn('未实现的Update类型', fiber);
      }
      break;
  }
};

export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.textContent = content;
}

/**
 * 删除子节点
 * @param childInstance
 * @param container
 */
export function removeChild(
  childInstance: Instance | TextInstance,
  container: Container
) {
  container.removeChild(childInstance);
}
