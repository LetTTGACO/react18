import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}
/**
 * Update实例化
 */
export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return {
    action,
    next: null,
    lane
  };
};

/**
 * UpdateQueue实例化
 */
export const createUpdateQueue = <State>(): UpdateQueue<State> => {
  return {
    shared: {
      pending: null
    },
    dispatch: null
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
  const pending = updateQueue.shared.pending;

  if (pending === null) {
    update.next = update;
  } else {
    // pending b -> a -> b
    // b.next = a
    update.next = pending.next;
    // a -> b
    pending.next = update;
  }
  // pending -> b
  updateQueue.shared.pending = update;
};

/**
 * 消费Update
 * @param baseState 初始的State
 * @param pendingUpdate 要消费的Update
 * @param renderLane 本地更新的优先级
 * @return { memoizedState } 消费后的State
 */
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  // 需要考虑优先级的因素
  renderLane: Lane
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };
  if (pendingUpdate !== null) {
    const first = pendingUpdate.next as Update<State>;
    let pending = pendingUpdate.next as Update<State>;
    do {
      // 获取当前update自己的lane
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        const action = pending.action;
        // 可以是函数
        if (action instanceof Function) {
          baseState = action(baseState);
        } else {
          // 也可以是值
          baseState = action;
        }
      } else {
        console.error('不应该进入updateLane !== renderLane这里');
      }
      pending = pending.next as Update<State>;
    } while (first !== pending);
  }
  result.memoizedState = baseState;
  return result;
};
