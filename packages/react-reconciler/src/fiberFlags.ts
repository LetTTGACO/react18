export type Flags = number;

export const NoFlags = 0b00000000000000000000000000;

// 插入
export const Placement = 0b00000000000000000000000010;
// 更新
export const Update = 0b00000000000000000000000100;
// 删除子节点
export const ChildDeletion = 0b00000000000000000000001000;
// 触发useEffect
export const PassiveEffect = 0b00000000000000000000010000;
export const Ref = 0b00000000000000000000100000;

export const MutationMask = Placement | Update | ChildDeletion | Ref;
export const LayoutMask = Ref;

export const PassiveMask = PassiveEffect | ChildDeletion;
