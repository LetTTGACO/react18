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
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

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

export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}
type EffectCallback = () => void;
type EffectDeps = any[] | null;

/**
 * 函数式组件的updateQueue，用于保存effect的环状链表
 */
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 重置操作 hooks链表
  wip.memoizedState = null;
  // 重置effect链表
  wip.updateQueue = null;
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
  // 重置
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 找到当前useState对应的hook数据
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  // 表示当前mount时，fiber时需要处理副作用的
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
  hook.memoizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  );
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null
  };
  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    // 如果不存在updateQueue，则创建一个新的FCUpdateQueue
    const newUpdateQueue = createFCUpdateQueue();
    // 与自己形成环状链表
    effect.next = effect;
    newUpdateQueue.lastEffect = effect.next;
    fiber.updateQueue = newUpdateQueue;
  } else {
    // 存在则push Effect
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      // 与自己形成环状链表
      effect.next = effect;
      updateQueue.lastEffect = effect.next;
    } else {
      // 在lastEffect后面插入新的effect
      const firstEffect = lastEffect.next;
      // 最后的effect指向新的effect
      lastEffect.next = effect;
      // 最新的effect指向第一个
      effect.next = firstEffect;
      // 最新的effect就变成了lastEffect
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

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

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 找到当前useState对应的hook数据
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const preEffect = currentHook.memoizedState as Effect;
    destroy = preEffect.destroy;
    if (nextDeps !== null) {
      // 浅比较
      const preDeps = preEffect.deps;
      if (areHookInputEqual(nextDeps, preDeps)) {
        // 依赖没有变
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // 浅比较不相等, fiber标记为PassiveEffect
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memoizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

function areHookInputEqual(nextDeps: EffectDeps, preDeps: EffectDeps) {
  if (nextDeps === null || preDeps === null) {
    // 比较失败
    return false;
  }

  for (let i = 0; i < nextDeps.length && i < preDeps.length; i++) {
    if (Object.is(nextDeps[i], preDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function updateWorkInProgressHook(): Hook {
  // TODO render阶段触发的更新
  let nextCurrentHook: Hook | null = null;
  if (currentHook === null) {
    // 第一次update，currentHook =null这里肯定会进入
    // 第二次就不会了，因为hooks是一个链表，next就是下一个hook
    // FC update时的第一个hook
    // 从currentlyRenderingFiber找到当前的的hook
    const current = (currentlyRenderingFiber as FiberNode).alternate;
    if (current !== null) {
      nextCurrentHook = current.memoizedState;
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
