import './style.css';

import {
  unstable_ImmediatePriority as ImmediatePriority, // 同步优先级最高
  unstable_UserBlockingPriority as UserBlockingPriority, // 点击事件优先级
  unstable_NormalPriority as NormalPriority, // 正常优先级
  unstable_LowPriority as LowPriority, // 低优先级
  unstable_IdlePriority as IdlePriority, // 空闲时优先级
  unstable_scheduleCallback as scheduleCallback, // 调度器
  unstable_shouldYield as shouldYield,
  CallbackNode, // 时间切片是否用完
  unstable_getFirstCallbackNode as getFirstCallbackNode,
  unstable_cancelCallback as cancelCallback
} from 'scheduler';

const root = document.getElementById('root');

type Priority =
  | typeof ImmediatePriority
  | typeof UserBlockingPriority
  | typeof NormalPriority
  | typeof LowPriority
  | typeof IdlePriority;
interface Work {
  count: number;
  priority: Priority;
}

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
  (priority: Priority) => {
    const btn = document.createElement('button');
    root.appendChild(btn);
    btn.innerText = [
      '',
      'ImmediatePriority',
      'UserBlockingPriority',
      'NormalPriority',
      'LowPriority'
    ][priority];
    btn.onclick = () => {
      // 交互触发更新
      workList.unshift({ count: 50, priority });
      // 调度阶段微任务调度
      schedule();
    };
  }
);

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

// 调度阶段微任务调度
function schedule() {
  const cbNode = getFirstCallbackNode();
  // const work = workList.pop();
  // 取优先级最高的work
  const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

  // workList为空
  if (!curWork) {
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }
  // 策略逻辑
  const { priority: curPriority } = curWork;
  // 工作过程产生相同优先级work
  // 如果优先级相同，则不需要开启新的调度
  if (curPriority === prevPriority) return;
  // 优先级不相同,更高优先级work，因为最低的会被sort掉
  // 记录之前的callback
  // 把之前的调度取消
  cbNode && cancelCallback(cbNode);

  curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

// 类比React beginWork 和completeWork
function perform(work: Work, didTimeout?: boolean) {
  // 不可中断，如果想让这里中断，有以下几个条件
  // 1.区分work的优先级
  // 2.饥饿问题
  // 3.时间切片
  const needSync = work.priority === ImmediatePriority || didTimeout;
  while ((needSync || !shouldYield()) && work.count) {
    insertSpan(work.priority + '');
    work.count--;
  }
  // 中断执行 或者执行完
  prevPriority = work.priority;
  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1);
    // 重置为空闲优先级
    prevPriority = IdlePriority;
  }
  const preCallback = curCallback;
  // 继续调度阶段微任务调度
  schedule();
  // 如果schedule调度时产生相同的优先级work，curCallback就不会被赋值，那么前后的callback 是一样的
  // 那么就会继续调度当前的work
  const newCallback = curCallback;
  if (newCallback && newCallback === preCallback) {
    // 如果仅有一个work，且回调函数的返回值是函数，则继续调度返回的函数
    return perform.bind(null, work);
  }
}

function insertSpan(content: any) {
  const span = document.createElement('span');
  span.innerText = content;
  span.className = `pri-${content}`;
  // doSome(1000000);
  root?.appendChild(span);
}

function doSome(len: number) {
  let res = 0;
  while (len--) {
    res += length;
  }
  return res;
}
