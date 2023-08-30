import internals from 'shared/internals';
import { FiberNode } from './fiber';
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
  UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;
const { currentDispatcher } = internals;

interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}
export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 重置操作
  wip.memoizedState = null;
  renderLane = lane;

  const current = wip.alternate;
  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }
  // 组件保存在type上
  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);
  // 重置操作
  currentlyRenderingFiber = null;
  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState
};

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hook数据
  const hook = updateWorkInProgressHook();
  // 计算新的state逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;
  queue.shared.pending = null;
  if (pending !== null) {
    const { memoizedState } = processUpdateQueue(
      hook.memoizedState,
      pending,
      renderLane
    );
    hook.memoizedState = memoizedState;
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function updateWorkInProgressHook(): Hook {
  // TODO render阶段触发的更新
  let nextCurrentHook: Hook | null = null;
  if (currentHook === null) {
    // 第一次update，currentHook =null这里肯定会进入
    // 第二次就不会了，因为hooks是一个链表，next就是下一个hook
    // FC update时的第一个hook
    // 从currentlyRenderingFiber找到当前的的hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // FC update时的后续的hook
    // 一旦这里赋值，上面的就不会进入了，因为hook是链表
    nextCurrentHook = currentHook.next;
  }
  if (nextCurrentHook === null) {
    // mount up1 up2 up3
    // update up1 up2 up3 up4
    // 第一次update，currentHook =null这里肯定会进入currentHook === null的情况
    // 所以拿到的nextCurrentHook是从currentlyRenderingFiber中获取
    // 第二次update时，由于hooks是一个链表，所以直接会进入下面的逻辑拿到nextCurrentHook
    // 第四次时，因为update时多了一个hook，所以currentHook.next会为null
    throw new Error(
      `组件${currentlyRenderingFiber?.type}的hooks更新时本地hook比上次多`
    );
  }
  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null
  };
  if (workInProgressHook === null) {
    // mount时 并且时第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = newHook;
      // 重新赋值，mount时的第一个hook
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount时后续的hook
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // 找到当前useState对应的hook数据
  const hook = mountWorkInProgressHook();
  let memoizedState;
  if (initialState instanceof Function) {
    // 如果是函数
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;
  return [memoizedState, dispatch];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  // 创建优先级
  const lane = requestUpdateLanes();
  // 创建一个update
  const update = createUpdate<State>(action, lane);
  enqueueUpdate<State>(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook() {
  // 对于mount时，首先需要创建hook
  const hook: Hook = {
    memoizedState: null,
    next: null,
    updateQueue: null
  };
  if (workInProgressHook === null) {
    // mount时 并且时第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = hook;
      // 重新赋值，mount时的第一个hook
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount时后续的hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}
