import { jsxDEV } from './src/jsx';
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher
} from './src/currentDispatcher';

export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

/**
 * 内部数据共享层
 */
export const __SECRET_INTERNALS = {
  currentDispatcher
};

export default {
  version: '0.0.0',
  createElement: jsxDEV
};
