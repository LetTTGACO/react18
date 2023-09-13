import { jsx, isValidElement as isValidElementFn } from './src/jsx';
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher
} from './src/currentDispatcher';
import currentBatchConfig from './src/currentBatchConfig';

export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
};

export const useRef: Dispatcher['useRef'] = (initialValue) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
};

export const useContext: Dispatcher['useContext'] = (context) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(context);
};

/**
 * 内部数据共享层
 */
export const __SECRET_INTERNALS = {
  currentDispatcher,
  currentBatchConfig
};
export const version = '0.0.0';
// TODO 根据环境区分使用jsx 还是jsxDev
export const createElement = jsx;
export const isValidElement = isValidElementFn;
export { createContext } from './src/context';
