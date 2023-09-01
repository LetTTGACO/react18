import { Props } from 'shared/ReactTypes';
import { Container } from 'hostConfig';

export const elementPropsKey = '__props';
const validEventTypeList = ['click'];
type EventCallback = (e: Event) => void;
interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

interface SyntheticEvent extends Event {
  __stopPropagation: boolean;
}

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

export const updateFiberProps = (node: DOMElement, props: Props) => {
  node[elementPropsKey] = props;
};

export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn('不支持的事件类型', eventType);
  }
  if (__DEV__) {
    console.log('初始化事件', eventType);
  }
  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e);
  });
}

function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent;
  syntheticEvent.__stopPropagation = false;
  // syntheticEvent.stopPropagation()
  const originStopPropagation = e.stopPropagation.bind(e);
  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };
  return syntheticEvent;
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;
  if (targetElement === null) {
    console.warn('事件不存在taget', e);
    return;
  }
  // 1.收集沿途的事件
  const { capture, bubble } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType
  );
  // 2.构造合成事件
  const se = createSyntheticEvent(e);
  if (__DEV__) {
    console.log('模拟事件捕获阶段：', eventType);
  }
  // 3.遍历capture捕获数组
  triggerEventFlow(capture, se);
  // 如果__stopPropagation为true，就不应该触发冒泡事件了
  if (!se.__stopPropagation) {
    if (__DEV__) {
      console.log('模拟事件冒泡阶段：', eventType);
    }
    // 4。遍历bubble冒泡数组
    triggerEventFlow(bubble, se);
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    callback.call(null, se);
    if (se.__stopPropagation) {
      break;
    }
  }
}

function getEventCallbackNameFromEventType(eventType: string) {
  return {
    // 0-捕获阶段
    // 1-冒泡阶段
    click: ['onClickCapture', 'onClick']
  }[eventType];
}
function collectPaths(
  targetElement: DOMElement,
  container: Container,
  eventType: string
) {
  // 存储捕获/冒泡事件的回调函数
  const paths: Paths = {
    capture: [],
    bubble: []
  };

  while (targetElement && targetElement !== container) {
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) {
      //拿到事件的映射关系
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackNane, i) => {
          // 从Props中拿到事件回调
          const eventCallback = elementProps[callbackNane];
          if (eventCallback) {
            if (i === 0) {
              // 捕获,反向插入，就是为了模拟捕获阶段的最外层元素先执行
              // 在这个循环中，因为是从下到上循环
              // 如果直接push插入后面再循环的话，最下面的元素先执行callback了，这与捕获相反
              // 所以需要在这里反向插入，这样在后面遍历时顺序就正确了
              paths.capture.unshift(eventCallback);
            } else {
              // 冒泡阶段
              // 这里也反着执行，直接push，这样第一个push的后面就会先执行
              paths.bubble.push(eventCallback);
            }
          }
        });
      }
    }

    targetElement = targetElement.parentNode as DOMElement;
  }

  return paths;
}
