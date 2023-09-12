import ReactCurrentBatchConfig from 'react/src/currentBatchConfig';
import { FiberRootNode } from './fiber';
import {
  unstable_getCurrentPriorityLevel,
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority
} from 'scheduler';

export type Lane = number;
export type Lanes = number;

export const NoLane = /*               */ 0b0000000000000000000000000000000;
export const NoLanes = /*              */ 0b0000000000000000000000000000000;
export const SyncLane = /*             */ 0b0000000000000000000000000000001; // 同步，ex：onClick

export const InputContinuousLane = /*  */ 0b0000000000000000000000000000010; // 连续触发，ex：onScroll
export const DefaultLane = /*          */ 0b0000000000000000000000000000100; // 默认，ex：useEffect回调
export const TransitionLane = /*          */ 0b0000000000000000000000000001000; // useTransition
export const IdleLane = /*             */ 0b1000000000000000000000000000000; // 空闲

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLanes() {
  // 判断transition，如果是transition，则返回TransitionLane
  const isTransition = ReactCurrentBatchConfig.transition !== null;
  if (isTransition) {
    return TransitionLane;
  }
  // 从上下文环境中获取Schedule优先级
  const currentPriority = unstable_getCurrentPriorityLevel();
  // 转成React Lane
  return schedulerPriorityToLane(currentPriority);
}

/**
 * 返回优先级最高的Lane
 * @param lanes
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
  // 数字越小，优先级越高，但不能是0
  // 例如 0b0011 => 0b0001
  //     0b0110 => 0b0010
  // 始终返回最靠右的优先级
  return lanes & -lanes;
}

/**
 * 移除Lane
 */
export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}

/**
 * React Lane模型转换成Schedule优先级
 * @param lanes
 */

export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);
  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}

/**
 * Schedule优先级转成Lane优先级
 * @param schedulerPriority
 */
export function schedulerPriorityToLane(schedulerPriority: number): Lane {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;
}

/**
 * 比较一个Lane的优先级是否足够，是否在一个Lanes中
 * 这样做的好处是 一般情况下基本相当于判断set和subset全等
 * 但是如果subset为NoLane时，set & NoLane 一定会是NoLane
 * @param set 本次流程的lane
 * @param subset 传进来的lane
 */
export function isSubsetOfLanes(set: Lanes, subset: Lane) {
  return (set & subset) === subset;
}
