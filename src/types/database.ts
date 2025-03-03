import type { QueryPromise, Table } from 'drizzle-orm';

type InsertBuilder = {
  values(values: unknown): QueryPromise<unknown>;
};

export type Database<Schema extends Record<string, Table>> = {
  _: {
    fullSchema: Schema;
  };
  insert(table: unknown): InsertBuilder;
};
