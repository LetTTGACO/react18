import {
  FulfilledThenable,
  PendingThenable,
  RejectedThenable,
  Thenable
} from 'shared/ReactTypes';

function noop() {}

export const SuspenseException = new Error(
  '这不是真实的错误，是Suspense工作的一部分，如果你捕获到这个错误，请继续将它抛出去'
);

let suspendedThenable: Thenable<any> | null = null;

export function getSuspenseThenable(): Thenable<any> {
  if (suspendedThenable === null) {
    throw new Error('应该存在suspendedThenable, 这是个bug');
  }
  const thenable = suspendedThenable;
  suspendedThenable = null;
  return thenable;
}

/**
 * 将用户传入的Promise包装成为Thenable
 * @param thenable
 */
export function trackUsedThenable<T>(thenable: Thenable<T>) {
  switch (thenable.status) {
    case 'fulfilled':
      return thenable.value;
    case 'rejected':
      throw thenable.reason;
    default:
      if (typeof thenable.status === 'string') {
        // 已经被包装过了
        thenable.then(noop, noop);
      } else {
        // 还没包装
        // untracked未追踪的状态
        // pending状态
        const pending = thenable as unknown as PendingThenable<T, void, any>;
        pending.status = 'pending';
        pending.then(
          (value) => {
            if (pending.status === 'pending') {
              const fulfilled = pending as unknown as FulfilledThenable<
                T,
                void,
                any
              >;
              fulfilled.status = 'fulfilled';
              fulfilled.value = value;
            }
          },
          (error) => {
            if (pending.status === 'pending') {
              const rejected = pending as unknown as RejectedThenable<
                T,
                void,
                any
              >;
              rejected.status = 'rejected';
              rejected.reason = error;
            }
          }
        );
      }
      break;
  }
  suspendedThenable = thenable;
  throw new Error('未实现的Thenable');
}
