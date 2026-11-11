import { defineRelations } from 'drizzle-orm';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql-proxy';
import { integer, pgTable } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/pg-proxy';
import { describe, expectTypeOf, it, vi } from 'vitest';

import { defineFactory } from './index';

import type { Database } from './index';
import type { Table } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

describe('defineFactory', () => {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  const values = vi.fn<() => any>(() => Promise.resolve());

  describe('nullable', () => {
    const schema = {
      users: pgTable('users', {
        id: integer(),
      }),
    } satisfies Record<string, Table>;

    const database: Database<typeof schema> = {
      _: {
        fullSchema: schema,
      },
      insert: () => ({ values }),
    };

    describe('when resolver returns undefined', () => {
      const factory = defineFactory({
        schema,
        table: 'users',
        resolver: () => ({
          id: undefined,
        }),
      });

      it('should resolve with id as undefined when no override is provided', async () => {
        const user = await factory(database).create();

        expectTypeOf(user).toMatchObjectType<{ id: undefined }>();
      });

      it('should resolve with id as undefined when override is explicitly undefined', async () => {
        const user = await factory(database).create({ id: undefined });

        expectTypeOf(user).toMatchObjectType<{ id: undefined }>();
      });

      it('should resolve with id as null when override is null', async () => {
        const user = await factory(database).create({ id: null });

        expectTypeOf(user).toMatchObjectType<{ id: null }>();
      });

      it('should resolve with id as number when override is a number', async () => {
        const user = await factory(database).create({ id: 1 });

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });
    });

    describe('when resolver returns null', () => {
      const factory = defineFactory({
        schema,
        table: 'users',
        resolver: () => ({
          id: null,
        }),
      });

      it('should resolve with id as null when no override is provided', async () => {
        const user = await factory(database).create();

        expectTypeOf(user).toMatchObjectType<{ id: null }>();
      });

      it('should resolve with id as null when override is null', async () => {
        const user = await factory(database).create({ id: null });

        expectTypeOf(user).toMatchObjectType<{ id: null }>();
      });

      it('should resolve with id as undefined when override is undefined', async () => {
        const user = await factory(database).create({ id: undefined });

        expectTypeOf(user).toMatchObjectType<{ id: undefined }>();
      });

      it('should resolve with id as number when override is a number', async () => {
        const user = await factory(database).create({ id: 1 });

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });
    });

    describe('when resolver returns a number', () => {
      const factory = defineFactory({
        schema,
        table: 'users',
        resolver: () => ({
          id: 1,
        }),
      });

      it('should resolve with id as number when no override is provided', async () => {
        const user = await factory(database).create();

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });

      it('should resolve with id as number when override is the same number', async () => {
        const user = await factory(database).create({ id: 1 });

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });

      it('should resolve with id as undefined when override is undefined', async () => {
        const user = await factory(database).create({ id: undefined });

        expectTypeOf(user).toMatchObjectType<{ id: undefined }>();
      });

      it('should resolve with id as null when override is null', async () => {
        const user = await factory(database).create({ id: null });

        expectTypeOf(user).toMatchObjectType<{ id: null }>();
      });
    });
  });

  describe('not null', () => {
    const schema = {
      users: pgTable('users', {
        id: integer().notNull(),
      }),
    } satisfies Record<string, Table>;

    const database: Database<typeof schema> = {
      _: {
        fullSchema: schema,
      },
      insert: () => ({ values }),
    };

    describe('when resolver returns a number', () => {
      const factory = defineFactory({
        schema,
        table: 'users',
        resolver: () => ({
          id: 1,
        }),
      });

      it('should resolve with id as number when no override is provided', async () => {
        const user = await factory(database).create();

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });

      it('should resolve with id as number when override is the same number', async () => {
        const user = await factory(database).create({ id: 1 });

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should raise a type error when override is undefined', async () => {
        // @ts-expect-error
        await factory(database).create({ id: undefined });
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should raise a type error when override is null', async () => {
        // @ts-expect-error
        await factory(database).create({ id: null });
      });
    });
  });

  describe('not null has default', () => {
    const schema = {
      users: pgTable('users', {
        id: integer().notNull().default(0),
      }),
    } satisfies Record<string, Table>;

    const database: Database<typeof schema> = {
      _: {
        fullSchema: schema,
      },
      insert: () => ({ values }),
    };

    describe('when resolver returns undefined', () => {
      const factory = defineFactory({
        schema,
        table: 'users',
        resolver: () => ({
          id: undefined,
        }),
      });

      it('should resolve with id as undefined when no override is provided', async () => {
        const user = await factory(database).create();

        expectTypeOf(user).toMatchObjectType<{ id: undefined }>();
      });

      it('should resolve with id as undefined when override is explicitly undefined', async () => {
        const user = await factory(database).create({ id: undefined });

        expectTypeOf(user).toMatchObjectType<{ id: undefined }>();
      });

      it('should resolve with id as number when override is a number', async () => {
        const user = await factory(database).create({ id: 1 });

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should raise a type error when override is null', async () => {
        // @ts-expect-error
        await factory(database).create({ id: null });
      });
    });

    describe('when resolver returns a number', () => {
      const factory = defineFactory({
        schema,
        table: 'users',
        resolver: () => ({
          id: 1,
        }),
      });

      it('should resolve with id as number when no override is provided', async () => {
        const user = await factory(database).create();

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });

      it('should resolve with id as number when override is the same number', async () => {
        const user = await factory(database).create({ id: 1 });

        expectTypeOf(user).toMatchObjectType<{ id: number }>();
      });

      it('should resolve with id as undefined when override is undefined', async () => {
        const user = await factory(database).create({ id: undefined });

        expectTypeOf(user).toMatchObjectType<{ id: undefined }>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should raise a type error when override is null', async () => {
        // @ts-expect-error
        await factory(database).create({ id: null });
      });
    });
  });
});

describe('Database', () => {
  const schema = {
    users: pgTable('users', {
      id: integer().notNull(),
    }),
  } satisfies Record<string, Table>;

  const otherSchema = {
    posts: pgTable('posts', {
      id: integer().notNull(),
    }),
  } satisfies Record<string, Table>;

  const relations = defineRelations(schema);
  const extendedRelations = defineRelations({ ...schema, ...otherSchema });
  const otherRelations = defineRelations(otherSchema);

  const query = () => Promise.resolve({ rows: [] });

  it('should accept a database exposing the full schema', () => {
    expectTypeOf<{ _: { fullSchema: typeof schema }; insert: Database<typeof schema>['insert'] }>()
      .toExtend<Database<typeof schema>>();
  });

  it('should accept a database created without relations', () => {
    expectTypeOf(drizzlePg(query)).toExtend<Database<typeof schema>>();
    expectTypeOf(drizzleMysql(query)).toExtend<Database<typeof schema>>();
    expectTypeOf<SqliteRemoteDatabase>().toExtend<Database<typeof schema>>();
  });

  it('should accept a database created with relations of the same schema', () => {
    expectTypeOf(drizzlePg(query, { relations })).toExtend<Database<typeof schema>>();
    expectTypeOf<SqliteRemoteDatabase<unknown, typeof relations>>().toExtend<Database<typeof schema>>();
  });

  it('should accept a database created with relations of an extended schema', () => {
    expectTypeOf(drizzlePg(query, { relations: extendedRelations })).toExtend<Database<typeof schema>>();
  });

  it('should not accept a database created with relations of another schema', () => {
    expectTypeOf(drizzlePg(query, { relations: otherRelations })).not.toExtend<Database<typeof schema>>();
  });
});
