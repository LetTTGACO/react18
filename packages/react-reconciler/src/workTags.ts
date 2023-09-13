export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment
  | typeof ContextProvider;

/**
 * 函数式组件
 */
export const FunctionComponent = 0;

/**
 *项目挂载的根节点
 */
export const HostRoot = 3;

/**
 * <div></div>对应的节点类型
 */
export const HostComponent = 5;

/**
 * <div>123</div>中的123文本对应的节点类型
 */
export const HostText = 6;

/**
 * <></>Fragment对应的Tag
 */
export const Fragment = 7;

/**
 * ContextProvider对应的Tag
 */
export const ContextProvider = 8;
