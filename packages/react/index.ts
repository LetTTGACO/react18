import { jsx, isValidElement as isValidElementFn } from './src/jsx';
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher
} from './src/currentDispatcher';

export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
};

/**
 * 内部数据共享层
 */
export const __SECRET_INTERNALS = {
  currentDispatcher
};
export const version = '0.0.0';
// TODO 根据环境区分使用jsx 还是jsxDev
export const createElement = jsx;
export const isValidElement = isValidElementFn;
