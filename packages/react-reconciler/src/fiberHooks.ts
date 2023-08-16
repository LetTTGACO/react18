import { FiberNode } from './fiber';

export function renderWithHooks(wip: FiberNode) {
  // 组件保存在type上
  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);
  return children;
}
