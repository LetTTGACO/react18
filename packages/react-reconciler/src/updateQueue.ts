import { Action } from 'shared/ReactTypes';

export interface Update<State> {
  action: Action<State>;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
}
/**
 * Update实例化
 */
export const createUpdate = <State>(
  action: Action<State>
): Update<Action<State>> => {
  return {
    action
  };
};

/**
 * UpdateQueue实例化
 */
export const createUpdateQueue = <State>(): UpdateQueue<State> => {
  return {
    shared: {
      pending: null
    }
  };
};

/**
 * 将Update插入到UpdateQueue中
 * @param updateQueue
 * @param update
 */
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  updateQueue.shared.pending = update;
};

/**
 * 消费Update
 * @param baseState 初始的State
 * @param pendingUpdate 要消费的Update
 * @return { memoizedState } 消费后的State
 */
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };
  if (pendingUpdate !== null) {
    const action = pendingUpdate.action;
    // 可以是函数
    if (action instanceof Function) {
      result.memoizedState = action(baseState);
    } else {
      // 也可以是值
      result.memoizedState = action;
    }
  }

  return result;
};
