export type ResolveValue<T> = {
  [K in keyof T]: T[K] extends () => Promise<infer R> ? R : T[K];
};
