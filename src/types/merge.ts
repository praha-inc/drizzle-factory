export type Merge<T1, T2> = {
  [K in keyof T1 | keyof T2]:
  K extends keyof T1
    ? K extends keyof T2
      ? undefined extends T1[K]
        ? T2[K]
        : T1[K]
      : T1[K]
    : K extends keyof T2
      ? T2[K]
      : never;
};

export type MergeArray<T1 extends unknown[], T2> = { [K in keyof T1]: Merge<T1[K], T2> };
