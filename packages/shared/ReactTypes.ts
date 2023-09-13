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
