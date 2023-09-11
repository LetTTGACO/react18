import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { isSubsetOfLanes, Lane, NoLane } from './fiberLanes';

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
  // baseQueue和原来的pendingUpdate合并后的结果
  pendingUpdate: Update<State> | null,
  // 需要考虑优先级的因素
  renderLane: Lane
): {
  memoizedState: State;
  baseQueue: Update<State> | null;
  baseState: State;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null
  };
  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next as Update<State>;
    let pending = pendingUpdate.next as Update<State>;
    let newBaseState = baseState;
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;

    let newState = baseState;
    do {
      // 获取当前update自己的lane
      const updateLane = pending.lane;
      // renderLane 本次更新的lane
      // updateLane 是传进来的lane
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够 被跳过
        // console.error('不应该进入updateLane !== renderLane这里');
        const clone = createUpdate(pending.action, pending.lane);
        // 是不是第一个被跳过的update
        if (newBaseQueueFirst === null) {
          // 是第一个被跳过的，将update保存下来为环形链表
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          // 最后一个没被跳过的update计算后的结果
          newBaseState = newState;
        } else {
          // 将update保存下来为环形链表
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        // 判断之前有没有被跳过的update
        // 因为本次更新「被跳过的update及其后面的所有update」都会被保存在baseQueue中参与下次计算
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane);
          // 将update保存下来为环形链表
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
        // 没有被跳过，正常参与计算
        const action = pending.action;
        // 可以是函数
        if (action instanceof Function) {
          newState = action(baseState);
        } else {
          // 也可以是值
          newState = action;
        }
      }
      pending = pending.next as Update<State>;
    } while (first !== pending);
    if (newBaseQueueLast === null) {
      // 本次计算没有update 被跳过
      // 如果本次更新没有update被跳过，则下次更新开始时baseState === memoizedState
      newBaseState = newState;
    } else {
      // 形成环状链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memoizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
  }

  return result;
};
