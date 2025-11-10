/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSequencer } from './helpers/create-sequencer';

import type { Column, InferInsertModel, QueryPromise, Table } from 'drizzle-orm';

type MaybePromise<T> = T | Promise<T>;

type _FixedArray<T, N extends number, R extends T[] = []> = R['length'] extends N ? R : _FixedArray<T, N, [...R, T]>;

type FixedArray<T, N extends number> = number extends N ? T[] : _FixedArray<T, N>;

type Override<T1, T2> = Omit<T1, keyof T2> & T2;

type OverrideArray<T1, T2 extends unknown[]> = { [K in keyof T2]: Override<T1, T2[K]> };

type ResolveValue<T> = {
  [K in keyof T]: T[K] extends () => Promise<infer R> ? R : T[K];
};

type InferInsert<TTable extends Table> = Required<InferInsertModel<TTable>>;

type InsertBuilder = {
  values: (values: any) => QueryPromise<unknown>;
  overridingSystemValue?: () => InsertBuilder;
};

export type Database<Schema extends Record<string, Table>> = {
  _: {
    fullSchema: Schema;
  };
  insert: (table: any) => InsertBuilder;
};

export type DatabaseOrFn<Schema extends Record<string, Table>> = Database<Schema> | (() => Database<Schema>);

export type DefineFactoryResolver<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
> = (parameters: {
  sequence: number;
  use: <Factory extends DrizzleFactory<Schema, any, any, any, any>>(factory: Factory) => ReturnType<Factory>;
}) => { [K in keyof InferInsert<Schema[Key]>]: InferInsert<Schema[Key]>[K] | (() => MaybePromise<InferInsert<Schema[Key]>[K]>) };

export type DefineFactorySeedResolver<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
> = (parameters: {
  sequence: number;
  use: <Factory extends DrizzleFactory<Schema, any, any, any, any>>(factory: Factory) => ReturnType<Factory>;
}) => MaybePromise<Partial<InferInsert<Schema[Key]>> | Partial<InferInsert<Schema[Key]>>[]>;

export type DrizzleFactoryCreateFunction<Insert, Base> = {
  (): Promise<Base>;
  <Length extends number>(length: Length): Promise<FixedArray<Base, Length>>;
  <Input extends Partial<Insert>>(value: Input): Promise<Override<Base, Input>>;
  <const Values extends Partial<Insert>[]>(values: Values): Promise<OverrideArray<Base, Values>>;
  <Length extends number, Strict extends boolean = true>(
    values: Strict extends true ? FixedArray<Partial<Insert>, Length> : Array<Partial<Insert>>
  ): Promise<FixedArray<Base, Length>>;
};

export type DrizzleFactory<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Resolver extends DefineFactoryResolver<Schema, Key>,
  Traits extends Record<string, DefineFactoryResolver<Schema, Key>>,
  Seeds extends Record<string, DefineFactorySeedResolver<Schema, Key>>,
> = {
  (databaseOrFn: DatabaseOrFn<Schema>): {
    create: DrizzleFactoryCreateFunction<InferInsert<Schema[Key]>, ResolveValue<Awaited<ReturnType<Resolver>>>>;
    traits: {
      [K in keyof Traits]: {
        create: DrizzleFactoryCreateFunction<
          InferInsert<Schema[Key]>,
          ResolveValue<Awaited<ReturnType<Traits[K]>>>
        >;
      };
    };
    seeds: {
      [K in keyof Seeds]: {
        create: () => Promise<
          Awaited<ReturnType<Seeds[K]>> extends Array<any>
            ? OverrideArray<ResolveValue<Awaited<ReturnType<Resolver>>>, Awaited<ReturnType<Seeds[K]>>>
            : Override<ResolveValue<Awaited<ReturnType<Resolver>>>, Awaited<ReturnType<Seeds[K]>>>
        >;
      };
    };
  };
  resetSequence: () => void;
};

export type DefineFactoryOptions<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Resolver extends DefineFactoryResolver<Schema, Key>,
  Traits extends Record<string, DefineFactoryResolver<Schema, Key>>,
  Seeds extends Record<string, DefineFactorySeedResolver<Schema, Key>>,
> = {
  schema: Schema;
  table: Key;
  resolver: Resolver;
  traits?: Traits;
  seeds?: Seeds;
};

export const defineFactory = <
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Resolver extends DefineFactoryResolver<Schema, Key>,
  Traits extends Record<string, DefineFactoryResolver<Schema, Key>>,
  Seeds extends Record<string, DefineFactorySeedResolver<Schema, Key>>,
>({
  schema,
  table,
  resolver,
  traits,
  seeds,
}: DefineFactoryOptions<Schema, Key, Resolver, Traits, Seeds>): DrizzleFactory<Schema, Key, Resolver, Traits, Seeds> => {
  const sequencer = createSequencer();
  const factory: DrizzleFactory<Schema, Key, Resolver, Traits, Seeds> = (databaseOrFn) => {
    const insert = async <Value extends InferInsert<Schema[Key]>>(
      resolver: DefineFactoryResolver<Schema, Key>,
      values: Partial<InferInsert<Schema[Key]>>,
    ): Promise<Value> => {
      const built = resolver({
        sequence: sequencer(),
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        use: (factory) => factory(databaseOrFn),
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
      } as Value;

      const hasSystemValueColumn = Object.values(schema[table]!).some((column: Column) => {
        return column.generated?.type === 'always' || column.generatedIdentity?.type === 'always';
      });

      const database = typeof databaseOrFn === 'function' ? databaseOrFn() : databaseOrFn;
      const builder = database.insert(schema[table]);
      if (hasSystemValueColumn && 'overridingSystemValue' in builder) builder.overridingSystemValue();
      return builder.values(insertValues).then(() => insertValues);
    };

    const defineCreateFunction = (
      resolver: DefineFactoryResolver<Schema, Key>,
    ) => {
      return async (value: unknown) => {
        if (!value) {
          return await insert(resolver, {});
        }

        if (typeof value === 'number') {
          const results: Array<InferInsert<Schema[Key]>> = [];
          for (let index = 0; index < value; index++) {
            results.push(await insert(resolver, {}));
          }
          return results;
        }

        if (Array.isArray(value)) {
          const results: Array<InferInsert<Schema[Key]>> = [];
          for (const item of value) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            results.push(await insert(resolver, item));
          }
          return results;
        }

        return await insert(resolver, value);
      };
    };

    const defineSeedFunction = (
      seedResolver: DefineFactorySeedResolver<Schema, Key>,
    ) => {
      const create = defineCreateFunction(resolver);
      return async () => {
        const seed = await seedResolver({
          sequence: sequencer.current(),
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          use: (factory) => factory(databaseOrFn),
        });
        return Array.isArray(seed) ? create(seed) : create(seed);
      };
    };

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      create: defineCreateFunction(resolver) as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      traits: Object.fromEntries(
        Object.entries(traits || {}).map(([key, traitResolver]) => [
          key,
          {
            create: defineCreateFunction(traitResolver),
          },
        ]),
      ) as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      seeds: Object.fromEntries(
        Object.entries(seeds || {}).map(([key, seedResolver]) => [
          key,
          {
            create: defineSeedFunction(seedResolver),
          },
        ]),
      ) as any,
    };
  };

  factory.resetSequence = sequencer.reset;
  return factory;
};

export type ComposedDrizzleFactory<
  Factories extends { [Key in keyof Factories]: DrizzleFactory<any, Key, any, any, any> },
  Schema extends Parameters<Factories[keyof Factories]>[0] extends DatabaseOrFn<infer S> ? S : never,
> = {
  (DatabaseOrFn: DatabaseOrFn<Schema>): {
    [Key in keyof Factories]: ReturnType<Factories[Key]>;
  };
  resetSequence: () => void;
};

export const composeFactory = <
  Factories extends { [Key in keyof Factories]: DrizzleFactory<any, Key, any, any, any> },
  Schema extends Parameters<Factories[keyof Factories]>[0] extends DatabaseOrFn<infer S> ? S : never,
>(factories: Factories): ComposedDrizzleFactory<Factories, Schema> => {
  const factory: ComposedDrizzleFactory<Factories, Schema> = (databaseOrFn) => {
    const result: Record<string, unknown> = {};
    for (const key in factories) {
      result[key] = factories[key](databaseOrFn);
    }
    return result as ReturnType<ComposedDrizzleFactory<Factories, Schema>>;
  };

  factory.resetSequence = () => {
    for (const key in factories) {
      factories[key].resetSequence();
    }
  };

  return factory;
};
