import { createSequencer } from './helpers/create-sequencer';

import type { DatabaseOrFn } from './types/database';
import type { FixedArray } from './types/fixed-array';
import type { InferInsert } from './types/infer-insert';
import type { Override, OverrideArray } from './types/override';
import type { Column, Table } from 'drizzle-orm';

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
  Value extends InferInsert<Schema[Key]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Traits extends Record<string, DefineFactoryResolver<Schema, Key, any>>,
> = {
  (databaseOrFn: DatabaseOrFn<Schema>): {
    create: DrizzleFactoryCreateFunction<InferInsert<Schema[Key]>, Value>;
    traits: {
      [K in keyof Traits]: {
        create: DrizzleFactoryCreateFunction<
          InferInsert<Schema[Key]>,
          Traits[K] extends DefineFactoryResolver<Schema, Key, infer TraitValue> ? TraitValue : never
        >;
      };
    };
  };
  resetSequence: () => void;
};

export type DefineFactoryResolver<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Value extends InferInsert<Schema[Key]>,
> = (parameters: {
  sequence: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use: <Factory extends DrizzleFactory<Schema, any, any, any>>(factory: Factory) => ReturnType<Factory>;
}) => { [K in keyof Value]: Value[K] | (() => Promise<Value[K]>) };

export type DefineFactoryOptions<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Value extends InferInsert<Schema[Key]>,
  Traits extends Record<string, DefineFactoryResolver<Schema, Key, Value>>,
> = {
  schema: Schema;
  table: Key;
  resolver: DefineFactoryResolver<Schema, Key, Value>;
  traits?: Traits;
};

export const defineFactory = <
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Value extends InferInsert<Schema[Key]>,
  Traits extends Record<string, DefineFactoryResolver<Schema, Key, Value>>,
>({ schema, table, resolver, traits }: DefineFactoryOptions<Schema, Key, Value, Traits>): DrizzleFactory<Schema, Key, Value, Traits> => {
  const sequencer = createSequencer();
  const factory: DrizzleFactory<Schema, Key, Value, Traits> = (databaseOrFn) => {
    const insert = async <Value extends InferInsert<Schema[Key]>>(
      resolver: DefineFactoryResolver<Schema, Key, Value>,
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

    const defineCreateFunction = <Value extends InferInsert<Schema[Key]>>(
      resolver: DefineFactoryResolver<Schema, Key, Value>,
    ) => {
      return (async (value: unknown) => {
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
      }) as DrizzleFactoryCreateFunction<InferInsert<Schema[Key]>, Value>;
    };

    return {
      create: defineCreateFunction(resolver),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      traits: Object.fromEntries(
        Object.entries(traits || {}).map(([key, traitResolver]) => [
          key,
          {
            create: defineCreateFunction(traitResolver),
          },
        ]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any,
    };
  };

  factory.resetSequence = sequencer.reset;
  return factory;
};

export type ComposedDrizzleFactory<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Factories extends { [Key in keyof Factories]: DrizzleFactory<any, Key, any, any> },
  Schema extends Parameters<Factories[keyof Factories]>[0] extends DatabaseOrFn<infer S> ? S : never,
> = {
  (DatabaseOrFn: DatabaseOrFn<Schema>): {
    [Key in keyof Factories]: ReturnType<Factories[Key]>;
  };
  resetSequence: () => void;
};

export const composeFactory = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Factories extends { [Key in keyof Factories]: DrizzleFactory<any, Key, any, any> },
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
