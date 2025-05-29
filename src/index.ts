import { createSequencer } from './helpers/create-sequencer';

import type { Database } from './types/database';
import type { FixedArray } from './types/fixed-array';
import type { Merge } from './types/merge';
import type { Optional } from './types/optional';
import type { Override, OverrideArray } from './types/override';
import type { InferInsertModel, Table } from 'drizzle-orm';

export type DrizzleFactoryCreateFunction<Value> = {
  (): Promise<Value>;
  <Length extends number>(length: Length): Promise<FixedArray<Value, Length>>;
  <Input extends Optional<Value>>(value: Input): Promise<Override<Value, Input>>;
  <const Values extends Optional<Value>[]>(values: Values): Promise<OverrideArray<Values, Value>>;
  <Length extends number, Strict extends boolean = true>(
    values: Strict extends true ? FixedArray<Optional<Value>, Length> : Array<Optional<Value>>
  ): Promise<FixedArray<Value, Length>>;
};

export type DrizzleFactory<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Value extends InferInsertModel<Schema[Key]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Traits extends Record<string, DefineFactoryResolver<Schema, Key, any>>,
> = {
  (database: Database<Schema>): {
    create: DrizzleFactoryCreateFunction<Merge<InferInsertModel<Schema[Key]>, Value>>;
    traits: {
      [K in keyof Traits]: {
        create: DrizzleFactoryCreateFunction<
          Merge<InferInsertModel<Schema[Key]>, Traits[K] extends DefineFactoryResolver<Schema, Key, infer TraitValue>
            ? TraitValue
            : never
          >
        >;
      };
    };
  };
  resetSequence: () => void;
};

export type DefineFactoryResolver<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Value extends InferInsertModel<Schema[Key]>,
> = (parameters: {
  sequence: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use: <Factory extends DrizzleFactory<Schema, any, any, any>>(factory: Factory) => ReturnType<Factory>;
}) => { [K in keyof Value]: Value[K] | (() => Promise<Value[K]>) };

export type DefineFactoryOptions<
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Value extends InferInsertModel<Schema[Key]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Traits extends Record<string, DefineFactoryResolver<Schema, Key, any>>,
> = {
  schema: Schema;
  table: Key;
  resolver: DefineFactoryResolver<Schema, Key, Value>;
  traits?: Traits;
};

export const defineFactory = <
  Schema extends Record<string, Table>,
  Key extends keyof Schema,
  Value extends InferInsertModel<Schema[Key]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Traits extends Record<string, DefineFactoryResolver<Schema, Key, any>>,
>({ schema, table, resolver, traits }: DefineFactoryOptions<Schema, Key, Value, Traits>): DrizzleFactory<Schema, Key, Value, Traits> => {
  const sequencer = createSequencer();
  const factory: DrizzleFactory<Schema, Key, Value, Traits> = (database) => {
    const insert = async <Value extends InferInsertModel<Schema[Key]>>(
      resolver: DefineFactoryResolver<Schema, Key, Value>,
      values: Partial<InferInsertModel<Schema[Key]>>,
    ): Promise<Value> => {
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
      } as Value;

      return database.insert(schema[table]).values(insertValues).then(() => insertValues);
    };

    const defineCreateFunction = <Value extends InferInsertModel<Schema[Key]>>(
      resolver: DefineFactoryResolver<Schema, Key, Value>,
    ) => {
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
      }) as DrizzleFactoryCreateFunction<Merge<InferInsertModel<Schema[Key]>, Value>>;
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
  Schema extends Parameters<Factories[keyof Factories]>[0] extends Database<infer S> ? S : never,
> = {
  (database: Database<Schema>): {
    [Key in keyof Factories]: ReturnType<Factories[Key]>;
  };
  resetSequence: () => void;
};

export const composeFactory = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Factories extends { [Key in keyof Factories]: DrizzleFactory<any, Key, any, any> },
  Schema extends Parameters<Factories[keyof Factories]>[0] extends Database<infer S> ? S : never,
>(factories: Factories): ComposedDrizzleFactory<Factories, Schema> => {
  const factory: ComposedDrizzleFactory<Factories, Schema> = (database) => {
    const result: Record<string, unknown> = {};
    for (const key in factories) {
      result[key] = factories[key](database);
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
