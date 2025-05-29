export type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type OverrideArray<T1 extends unknown[], T2> = { [K in keyof T1]: Override<T2, T1[K]> };
