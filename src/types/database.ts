import type { QueryPromise, Table } from 'drizzle-orm';

type InsertBuilder = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: (values: any) => QueryPromise<unknown>;
  overridingSystemValue?: () => InsertBuilder;
};

export type Database<Schema extends Record<string, Table>> = {
  _: {
    fullSchema: Schema;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (table: any) => InsertBuilder;
};

export type DatabaseOrFn<Schema extends Record<string, Table>> = Database<Schema> | (() => Database<Schema>);
