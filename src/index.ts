import { createSequencer } from './helpers/create-sequencer';

import type { Database } from './types/database';
import type { FixedArray } from './types/fixed-array';
import type { InferInsertModel, Table } from 'drizzle-orm';

export type DrizzleFactoryCreateFunction<TTable extends Table> = {
  (): Promise<InferInsertModel<TTable>>;
  <Length extends number>(length: Length): Promise<FixedArray<InferInsertModel<TTable>, Length>>;
  (value: Partial<InferInsertModel<TTable>>): Promise<InferInsertModel<TTable>>;
  <const Values extends Partial<InferInsertModel<TTable>>[]>(values: Values): Promise<FixedArray<InferInsertModel<TTable>, Values['length']>>;
  <Length extends number, Strict extends boolean = true>(
    values: Strict extends true ? FixedArray<Partial<InferInsertModel<TTable>>, Length> : Array<Partial<InferInsertModel<TTable>>>
  ): Promise<FixedArray<InferInsertModel<TTable>, Length>>;
};

export type DrizzleFactory<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Traits extends string,
> = (database: Database<Schema>) => {
  create: DrizzleFactoryCreateFunction<Schema[Key]>;
  traits: Record<Traits, {
    create: DrizzleFactoryCreateFunction<Schema[Key]>;
  }>;
};

export type DefineFactoryResolver<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
> = (parameters: {
  sequence: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use: <Factory extends DrizzleFactory<Schema, keyof Schema, any>>(factory: Factory) => ReturnType<Factory>;
}) => { [K in keyof InferInsertModel<Schema[Key]>]: InferInsertModel<Schema[Key]>[K] | (() => Promise<InferInsertModel<Schema[Key]>[K]>) };

export type DefineFactoryOptions<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Traits extends string,
> = {
  schema: Schema;
  table: Key;
  resolver: DefineFactoryResolver<Schema, Key>;
  traits?: Record<Traits, DefineFactoryResolver<Schema, Key>>;
};

export const defineFactory = <
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Traits extends string,
>({ schema, table, resolver, traits }: DefineFactoryOptions<Schema, Key, Traits>): DrizzleFactory<Schema, Key, Traits> => {
  const sequencer = createSequencer();
  return (database) => {
    const insert = async (
      resolver: DefineFactoryResolver<Schema, Key>,
      values: Partial<InferInsertModel<Schema[Key]>>,
    ): Promise<InferInsertModel<Schema[Key]>> => {
      const built = resolver({
        sequence: sequencer(),
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        use: (factory) => factory(database),
      });

      const insertValues = {
        ...values,
        ...Object.fromEntries(
          await Promise.all(
            Object.entries(built)
              .filter(([key]) => !Object.keys(values).includes(key))
              .map(async ([key, value]) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
                return [key, typeof value === 'function' ? await value() : value];
              }),
          ),
        ),
      } as InferInsertModel<Schema[Key]>;

      return database.insert(schema[table]).values(insertValues).then(() => insertValues);
    };

    const defineCreateFunction = (resolver: DefineFactoryResolver<Schema, Key>) => {
      return (async (value: unknown) => {
        if (!value) {
          return await insert(resolver, {});
        }

        if (typeof value === 'number') {
          const results: Array<InferInsertModel<Schema[Key]>> = [];
          for (let index = 0; index < value; index++) {
            results.push(await insert(resolver, {}));
          }
          return results;
        }

        if (Array.isArray(value)) {
          const results: Array<InferInsertModel<Schema[Key]>> = [];
          for (const item of value) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            results.push(await insert(resolver, item));
          }
          return results;
        }

        return await insert(resolver, value);
      }) as DrizzleFactoryCreateFunction<Schema[Key]>;
    };

    return {
      create: defineCreateFunction(resolver),
      traits: Object.entries(traits || {}).reduce((previous, [key, resolver]) => {
        previous[key as Traits] = {
          create: defineCreateFunction(resolver as DefineFactoryResolver<Schema, Key>),
        };
        return previous;
      }, {} as Record<Traits, { create: DrizzleFactoryCreateFunction<Schema[Key]> }>),
    };
  };
};

export type ComposedDrizzleFactory<
  Schema extends Record<string, Table>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Factories extends { [Key in keyof Factories]: DrizzleFactory<Schema, keyof Schema, any> },
> = (database: Database<Schema>) => {
  [Key in keyof Factories]: ReturnType<Factories[Key]>;
};

export const composeFactory = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Factories extends { [Key in keyof Factories]: DrizzleFactory<any, Key, any> },
  Schema extends Parameters<Factories[keyof Factories]>[0] extends Database<infer S> ? S : never,
>(factories: Factories): ComposedDrizzleFactory<Schema, Factories> => {
  return (database) => {
    const result: Record<string, unknown> = {};
    for (const key in factories) {
      result[key] = factories[key](database);
    }
    return result as ReturnType<ComposedDrizzleFactory<Schema, Factories>>;
  };
};
