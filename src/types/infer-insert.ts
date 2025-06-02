import type { InferInsertModel, Table } from 'drizzle-orm';

export type InferInsert<TTable extends Table> = Required<InferInsertModel<TTable>>;
