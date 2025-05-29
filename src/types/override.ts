export type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type OverrideArray<T1, T2 extends unknown[]> = { [K in keyof T2]: Override<T1, T2[K]> };
