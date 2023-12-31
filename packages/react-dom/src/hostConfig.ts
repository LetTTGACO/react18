import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTags';
import { DOMElement, updateFiberProps } from './SyntheticEvent';
import { Props } from 'shared/ReactTypes';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Element;

export const createInstance = (type: string, props: Props): Instance => {
  const element = document.createElement(type) as unknown as DOMElement;
  updateFiberProps(element, props);
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

export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  return container.insertBefore(child, before);
}

export const commitUpdate = (fiber: FiberNode) => {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps?.content;
      return commitTextUpdate(fiber.stateNode, text);
    case HostComponent:
      return updateFiberProps(fiber.stateNode, fiber.memoizedProps);
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

export function hideInstance(instance: Instance) {
  const style = (instance as HTMLElement).style;
  style.setProperty('display', 'none', 'important');
}

export function unHideInstance(instance: Instance) {
  const style = (instance as HTMLElement).style;
  style.display = '';
}

export function hideTextInstance(textInstance: TextInstance) {
  textInstance.nodeValue = '';
}

export function unHideTextInstance(textInstance: TextInstance, text: string) {
  textInstance.nodeValue = text;
}
