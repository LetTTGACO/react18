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
export const IdleLane = /*             */ 0b1000000000000000000000000000000; // 空闲

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLanes() {
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
function schedulerPriorityToLane(schedulerPriority: number): Lane {
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
