import type { QueryPromise, Table } from 'drizzle-orm';

type InsertBuilder = {
  values: (values: unknown) => QueryPromise<unknown>;
  overridingSystemValue?: () => InsertBuilder;
};

export type Database<Schema extends Record<string, Table>> = {
  _: {
    fullSchema: Schema;
  };
  insert: (table: unknown) => InsertBuilder;
};
