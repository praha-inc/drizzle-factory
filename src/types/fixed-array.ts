type _FixedArray<T, N extends number, R extends T[] = []> = R['length'] extends N ? R : _FixedArray<T, N, [...R, T]>;

export type FixedArray<T, N extends number> = number extends N ? T[] : _FixedArray<T, N>;
