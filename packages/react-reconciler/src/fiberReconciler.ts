import { Container } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { HostRoot } from './workTags';
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  UpdateQueue
} from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { requestUpdateLanes } from './fiberLanes';
import {
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_runWithPriority as runWithPriority
} from 'scheduler';

export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue<ReactElementType>();
  return root;
}
export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  runWithPriority(ImmediatePriority, () => {
    const hostRootFiber = root.current;
    // 创建优先级
    const lane = requestUpdateLanes();
    const update = createUpdate<ReactElementType | null>(element, lane);
    enqueueUpdate(
      hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
      update
    );
    scheduleUpdateOnFiber(hostRootFiber, lane);
  });
  return element;
  // hostRootFiber.updateQueue = update;
}
