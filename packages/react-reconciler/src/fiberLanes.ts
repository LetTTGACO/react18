export type Lane = number;
export type Lanes = number;

export const NoLane = 0b0000;
export const NoLanes = 0b0000;
export const SyncLane = 0b0001;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLanes() {
  return SyncLane;
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
