export type Flags = number;

export const NoFlags = 0b0000000;

// 插入
export const Placement = 0b0000001;
// 更新
export const Update = 0b0000010;
// 删除子节点
export const ChildDeletion = 0b0000100;
// 触发useEffect
export const PassiveEffect = 0b0001000;

export const MutationMask = Placement | Update | ChildDeletion;

export const PassiveMask = PassiveEffect | ChildDeletion;
