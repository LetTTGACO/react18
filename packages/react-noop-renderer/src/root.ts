// ReactDOM.createRoot(root).render(<App/>)

import {
  createContainer,
  updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { Container, Instance, TextInstance } from './hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
let containIndex = 0;
import * as Scheduler from 'scheduler';
export function createRoot() {
  const container: Container = {
    rootID: containIndex++,
    children: []
  };
  // @ts-ignore
  const root = createContainer(container);

  const getChildren = (parent: Container | Instance) => {
    if (parent) {
      return parent.children;
    }
    return null;
  };
  // 返回JSX类型的JSON
  const getChildrenAsJSX = (root: Container) => {
    const children = childrenToJSX(getChildren(root));
    if (Array.isArray(children)) {
      // Instance、TextInstance混合数组
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: REACT_FRAGMENT_TYPE,
        key: null,
        ref: null,
        props: { children },
        __mark: '1874'
      };
    }
    return children;
  };
  const childrenToJSX = (child: any): any => {
    // 文本节点
    if (typeof child === 'string' || typeof child === 'number') {
      return child;
    }
    // 数组
    // 文本、Instance、TextInstance混合数组
    if (Array.isArray(child)) {
      // 判断数组长度
      if (child.length === 0) {
        return null;
      }
      if (child.length === 1) {
        return childrenToJSX(child[0]);
      }
      const children: any = child.map(childrenToJSX);
      // 合并文本节点
      if (
        children.every(
          (child: any) => typeof child === 'string' || typeof child === 'number'
        )
      ) {
        // 合并文本节点
        children.join('');
      }
      // Instance、TextInstance混合数组
      return children;
    }
    // Instance, children有东西
    if (Array.isArray(child.children)) {
      const instance: Instance = child;
      const children = childrenToJSX(instance.children);
      const props = instance.props;
      if (children !== null) {
        props.children = children;
      }
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: instance.type,
        key: null,
        ref: null,
        props,
        __mark: '1874'
      };
    }

    // TextInstance
    return (child as TextInstance).text;
  };
  return {
    // 用于jest-react
    _Scheduler: Scheduler,
    render(element: ReactElementType) {
      return updateContainer(element, root);
    },
    getChildren() {
      return getChildren(container);
    },
    getChildrenAsJSX() {
      return getChildrenAsJSX(container);
    }
  };
}
