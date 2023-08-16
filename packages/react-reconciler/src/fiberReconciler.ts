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
  const hostRootFiber = root.current;
  const update = createUpdate<ReactElementType | null>(element);
  enqueueUpdate(
    // TODO 为啥这里要传Action
    // @ts-ignore
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
    update
  );
  scheduleUpdateOnFiber(hostRootFiber);
  return element;
  // hostRootFiber.updateQueue = update;
}
