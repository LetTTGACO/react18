export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void);
export type Props = {
  [key: string]: any;
  children?: any;
};
export type ElementType = any;

export interface ReactElementType {
  $$typeof: symbol | number;
  type: ElementType;
  key: Key;
  ref: Ref;
  props: Props;
  __mark: string;
}

export type ReactContext<T> = {
  $$typeof: symbol | number;
  Provider: ReactProviderType<T> | null;
  _currentValue: T;
};

export type ReactProviderType<T> = {
  $$typeof: symbol | number;
  _context: ReactContext<T>;
};

export type Action<State> = State | ((prevState: State) => State);

export type Usable<T> = Thenable<T> | ReactContext<T>;

export interface Wakeable<Result> {
  then(
    onFulfilled: () => Result,
    onRejected: () => Result
  ): void | Wakeable<Result>;
}

export interface ThenableImpl<T, Result, Err> {
  then(
    onFulfilled: (value: T) => Result,
    onRejected: (error: Err) => Result
  ): void | Wakeable<Result>;
}

export interface UntrackedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status?: void;
}

export interface PendingThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'pending';
}

export interface FulfilledThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'fulfilled';
  value: T;
}

export interface RejectedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'rejected';
  reason: Err;
}
// 未被跟踪状态
// pending状态
// fulfilled状态 -> resolved状态
// rejected状态 -> reject状态
export type Thenable<T, Result = void, Err = any> =
  | UntrackedThenable<T, Result, Err>
  | PendingThenable<T, Result, Err>
  | FulfilledThenable<T, Result, Err>
  | RejectedThenable<T, Result, Err>;
