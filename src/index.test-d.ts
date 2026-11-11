import { defineRelations } from 'drizzle-orm';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql-proxy';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expectTypeOf, it, vi } from 'vitest';

import { defineFactory } from './index';

import type { Table } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

describe('defineFactory', () => {
  describe('v0', () => {
    // drizzle-orm v1 never exposes `fullSchema`, so a v0 database is reproduced by a stub.
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const values = vi.fn<() => any>(() => Promise.resolve());

    const createDatabase = <Schema extends Record<string, Table>>(schema: Schema) => ({
      _: { fullSchema: schema },
      insert: () => ({ values }),
    });

    const schema = {
      users: pgTable('users', {
        id: integer().notNull(),
        name: text().notNull(),
      }),
      posts: pgTable('posts', {
        id: integer().notNull(),
        userId: integer().notNull(),
        title: text().notNull(),
      }),
    } satisfies Record<string, Table>;

    const database = createDatabase(schema);

    const usersFactory = defineFactory({
      schema,
      table: 'users',
      resolver: ({ sequence }) => ({
        id: sequence,
        name: `name-${sequence}`,
      }),
      traits: {
        admin: ({ sequence }) => ({
          id: sequence,
          name: 'admin' as const,
        }),
      },
      seeds: {
        john: () => ({
          name: 'John Doe' as const,
        }),
      },
    });

    const postsFactory = defineFactory({
      schema,
      table: 'posts',
      resolver: ({ sequence, use }) => ({
        id: sequence,
        userId: () => use(usersFactory).create().then((user) => user.id),
        title: `title-${sequence}`,
      }),
      seeds: {
        john: async ({ use }) => {
          const john = await use(usersFactory).seeds.john.create();
          return [
            { userId: john.id, title: 'first' as const },
            { userId: john.id, title: 'second' as const },
          ];
        },
      },
    });

    describe('create', () => {
      it('should resolve with the values built by the resolver', async () => {
        const user = await usersFactory(database).create();

        expectTypeOf(user).toEqualTypeOf<{ id: number; name: string }>();
      });

      it('should resolve with the specified values overriding the resolved values', async () => {
        const user = await usersFactory(database).create({ name: 'test' as const });

        expectTypeOf(user).branded.toEqualTypeOf<{ id: number; name: 'test' }>();
      });

      it('should resolve with a tuple of the specified length', async () => {
        const users = await usersFactory(database).create(2);

        expectTypeOf(users).branded.toEqualTypeOf<[{ id: number; name: string }, { id: number; name: string }]>();
      });

      it('should resolve with an array when the length is not a literal', async () => {
        const users = await usersFactory(database).create(2 as number);

        expectTypeOf(users).toEqualTypeOf<{ id: number; name: string }[]>();
      });

      it('should resolve with a tuple of each of the specified values', async () => {
        const users = await usersFactory(database).create([{ name: 'test' }, {}]);

        expectTypeOf(users).branded.toEqualTypeOf<[{ id: number; readonly name: 'test' }, { id: number; name: string }]>();
      });

      it('should resolve with the values returned from asynchronous functions', async () => {
        const post = await postsFactory(database).create();

        expectTypeOf(post).toEqualTypeOf<{ id: number; userId: number; title: string }>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not accept a value of another type', async () => {
        // @ts-expect-error
        await usersFactory(database).create({ name: 1 });
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not accept a resolver missing a column', () => {
        defineFactory({
          schema,
          table: 'users',
          // @ts-expect-error
          resolver: ({ sequence }) => ({
            id: sequence,
          }),
        });
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not accept a table missing from the schema', () => {
        defineFactory({
          schema,
          // @ts-expect-error
          table: 'comments',
          resolver: () => ({ id: 1 }),
        });
      });
    });

    describe('traits', () => {
      it('should resolve with the values built by the trait resolver', async () => {
        const user = await usersFactory(database).traits.admin.create();

        expectTypeOf(user).toEqualTypeOf<{ id: number; name: 'admin' }>();
      });

      it('should resolve with the specified values overriding the resolved values', async () => {
        const user = await usersFactory(database).traits.admin.create({ name: 'test' });

        expectTypeOf(user).branded.toEqualTypeOf<{ id: number; name: string }>();
      });

      it('should resolve with a tuple of the specified length', async () => {
        const users = await usersFactory(database).traits.admin.create(2);

        expectTypeOf(users).branded.toEqualTypeOf<[{ id: number; name: 'admin' }, { id: number; name: 'admin' }]>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not expose an undefined trait', () => {
        // @ts-expect-error
        // oxlint-disable-next-line @typescript-eslint/no-unused-expressions
        usersFactory(database).traits.guest;
      });
    });

    describe('seeds', () => {
      it('should resolve with the seed overriding the resolved values when the seed resolver returns an object', async () => {
        const user = await usersFactory(database).seeds.john.create();

        expectTypeOf(user).branded.toEqualTypeOf<{ id: number; name: 'John Doe' }>();
      });

      it('should resolve with an array when the seed resolver returns an array', async () => {
        const posts = await postsFactory(database).seeds.john.create();

        expectTypeOf(posts).branded.toEqualTypeOf<Array<
          | { id: number; userId: number; title: 'first' }
          | { id: number; userId: number; title: 'second' }
        >>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not expose an undefined seed', () => {
        // @ts-expect-error
        // oxlint-disable-next-line @typescript-eslint/no-unused-expressions
        usersFactory(database).seeds.jane;
      });
    });

    describe('columns', () => {
      const schema = {
        records: pgTable('records', {
          nullable: integer(),
          required: integer().notNull(),
          defaulted: integer().notNull().default(0),
        }),
      } satisfies Record<string, Table>;

      const database = createDatabase(schema);

      const factory = defineFactory({
        schema,
        table: 'records',
        resolver: ({ sequence }) => ({
          nullable: sequence,
          required: sequence,
          defaulted: sequence,
        }),
      });

      it('should accept null and undefined for a nullable column', async () => {
        defineFactory({
          schema,
          table: 'records',
          resolver: () => ({ nullable: null, required: 1, defaulted: 1 }),
        });
        defineFactory({
          schema,
          table: 'records',
          resolver: () => ({ nullable: undefined, required: 1, defaulted: 1 }),
        });

        expectTypeOf(await factory(database).create({ nullable: null })).toHaveProperty('nullable').toEqualTypeOf<null>();
        expectTypeOf(await factory(database).create({ nullable: undefined })).toHaveProperty('nullable').toEqualTypeOf<undefined>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should accept neither null nor undefined for a not null column', async () => {
        defineFactory({
          schema,
          table: 'records',
          // @ts-expect-error
          resolver: () => ({ nullable: 1, required: null, defaulted: 1 }),
        });
        defineFactory({
          schema,
          table: 'records',
          // @ts-expect-error
          resolver: () => ({ nullable: 1, required: undefined, defaulted: 1 }),
        });

        // @ts-expect-error
        await factory(database).create({ required: null });
        // @ts-expect-error
        await factory(database).create({ required: undefined });
      });

      it('should accept undefined but not null for a not null column with a default', async () => {
        defineFactory({
          schema,
          table: 'records',
          resolver: () => ({ nullable: 1, required: 1, defaulted: undefined }),
        });
        defineFactory({
          schema,
          table: 'records',
          // @ts-expect-error
          resolver: () => ({ nullable: 1, required: 1, defaulted: null }),
        });

        expectTypeOf(await factory(database).create({ defaulted: undefined })).toHaveProperty('defaulted').toEqualTypeOf<undefined>();
        // @ts-expect-error
        await factory(database).create({ defaulted: null });
      });
    });

    describe('database', () => {
      type Parameter = Parameters<typeof usersFactory>[0];

      const otherSchema = {
        comments: pgTable('comments', {
          id: integer().notNull(),
        }),
      } satisfies Record<string, Table>;

      it('should accept a database exposing the schema', () => {
        expectTypeOf(database).toExtend<Parameter>();
      });

      it('should accept a database exposing an extended schema', () => {
        expectTypeOf(createDatabase({ ...schema, ...otherSchema })).toExtend<Parameter>();
      });

      it('should not accept a database exposing another schema', () => {
        expectTypeOf(createDatabase(otherSchema)).not.toExtend<Parameter>();
      });

      it('should accept a function providing the database', () => {
        expectTypeOf(() => database).toExtend<Parameter>();
      });
    });
  });

  describe('v1', () => {
    const query = () => Promise.resolve({ rows: [] });

    const schema = {
      users: pgTable('users', {
        id: integer().notNull(),
        name: text().notNull(),
      }),
      posts: pgTable('posts', {
        id: integer().notNull(),
        userId: integer().notNull(),
        title: text().notNull(),
      }),
    } satisfies Record<string, Table>;

    const relations = defineRelations(schema, (r) => ({
      users: {
        posts: r.many.posts(),
      },
      posts: {
        user: r.one.users({ from: r.posts.userId, to: r.users.id }),
      },
    }));

    const database = drizzle(query, { relations });

    const usersFactory = defineFactory({
      schema,
      table: 'users',
      resolver: ({ sequence }) => ({
        id: sequence,
        name: `name-${sequence}`,
      }),
      traits: {
        admin: ({ sequence }) => ({
          id: sequence,
          name: 'admin' as const,
        }),
      },
      seeds: {
        john: () => ({
          name: 'John Doe' as const,
        }),
      },
    });

    const postsFactory = defineFactory({
      schema,
      table: 'posts',
      resolver: ({ sequence, use }) => ({
        id: sequence,
        userId: () => use(usersFactory).create().then((user) => user.id),
        title: `title-${sequence}`,
      }),
      seeds: {
        john: async ({ use }) => {
          const john = await use(usersFactory).seeds.john.create();
          return [
            { userId: john.id, title: 'first' as const },
            { userId: john.id, title: 'second' as const },
          ];
        },
      },
    });

    describe('create', () => {
      it('should resolve with the values built by the resolver', async () => {
        const user = await usersFactory(database).create();

        expectTypeOf(user).toEqualTypeOf<{ id: number; name: string }>();
      });

      it('should resolve with the specified values overriding the resolved values', async () => {
        const user = await usersFactory(database).create({ name: 'test' as const });

        expectTypeOf(user).branded.toEqualTypeOf<{ id: number; name: 'test' }>();
      });

      it('should resolve with a tuple of the specified length', async () => {
        const users = await usersFactory(database).create(2);

        expectTypeOf(users).branded.toEqualTypeOf<[{ id: number; name: string }, { id: number; name: string }]>();
      });

      it('should resolve with an array when the length is not a literal', async () => {
        const users = await usersFactory(database).create(2 as number);

        expectTypeOf(users).toEqualTypeOf<{ id: number; name: string }[]>();
      });

      it('should resolve with a tuple of each of the specified values', async () => {
        const users = await usersFactory(database).create([{ name: 'test' }, {}]);

        expectTypeOf(users).branded.toEqualTypeOf<[{ id: number; readonly name: 'test' }, { id: number; name: string }]>();
      });

      it('should resolve with the values returned from asynchronous functions', async () => {
        const post = await postsFactory(database).create();

        expectTypeOf(post).toEqualTypeOf<{ id: number; userId: number; title: string }>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not accept a value of another type', async () => {
        // @ts-expect-error
        await usersFactory(database).create({ name: 1 });
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not accept a resolver missing a column', () => {
        defineFactory({
          schema,
          table: 'users',
          // @ts-expect-error
          resolver: ({ sequence }) => ({
            id: sequence,
          }),
        });
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not accept a table missing from the schema', () => {
        defineFactory({
          schema,
          // @ts-expect-error
          table: 'comments',
          resolver: () => ({ id: 1 }),
        });
      });
    });

    describe('traits', () => {
      it('should resolve with the values built by the trait resolver', async () => {
        const user = await usersFactory(database).traits.admin.create();

        expectTypeOf(user).toEqualTypeOf<{ id: number; name: 'admin' }>();
      });

      it('should resolve with the specified values overriding the resolved values', async () => {
        const user = await usersFactory(database).traits.admin.create({ name: 'test' });

        expectTypeOf(user).branded.toEqualTypeOf<{ id: number; name: string }>();
      });

      it('should resolve with a tuple of the specified length', async () => {
        const users = await usersFactory(database).traits.admin.create(2);

        expectTypeOf(users).branded.toEqualTypeOf<[{ id: number; name: 'admin' }, { id: number; name: 'admin' }]>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not expose an undefined trait', () => {
        // @ts-expect-error
        // oxlint-disable-next-line @typescript-eslint/no-unused-expressions
        usersFactory(database).traits.guest;
      });
    });

    describe('seeds', () => {
      it('should resolve with the seed overriding the resolved values when the seed resolver returns an object', async () => {
        const user = await usersFactory(database).seeds.john.create();

        expectTypeOf(user).branded.toEqualTypeOf<{ id: number; name: 'John Doe' }>();
      });

      it('should resolve with an array when the seed resolver returns an array', async () => {
        const posts = await postsFactory(database).seeds.john.create();

        expectTypeOf(posts).branded.toEqualTypeOf<Array<
          | { id: number; userId: number; title: 'first' }
          | { id: number; userId: number; title: 'second' }
        >>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should not expose an undefined seed', () => {
        // @ts-expect-error
        // oxlint-disable-next-line @typescript-eslint/no-unused-expressions
        usersFactory(database).seeds.jane;
      });
    });

    describe('columns', () => {
      const schema = {
        records: pgTable('records', {
          nullable: integer(),
          required: integer().notNull(),
          defaulted: integer().notNull().default(0),
        }),
      } satisfies Record<string, Table>;

      const database = drizzle(query, { relations: defineRelations(schema) });

      const factory = defineFactory({
        schema,
        table: 'records',
        resolver: ({ sequence }) => ({
          nullable: sequence,
          required: sequence,
          defaulted: sequence,
        }),
      });

      it('should accept null and undefined for a nullable column', async () => {
        defineFactory({
          schema,
          table: 'records',
          resolver: () => ({ nullable: null, required: 1, defaulted: 1 }),
        });
        defineFactory({
          schema,
          table: 'records',
          resolver: () => ({ nullable: undefined, required: 1, defaulted: 1 }),
        });

        expectTypeOf(await factory(database).create({ nullable: null })).toHaveProperty('nullable').toEqualTypeOf<null>();
        expectTypeOf(await factory(database).create({ nullable: undefined })).toHaveProperty('nullable').toEqualTypeOf<undefined>();
      });

      // oxlint-disable-next-line vitest/expect-expect
      it('should accept neither null nor undefined for a not null column', async () => {
        defineFactory({
          schema,
          table: 'records',
          // @ts-expect-error
          resolver: () => ({ nullable: 1, required: null, defaulted: 1 }),
        });
        defineFactory({
          schema,
          table: 'records',
          // @ts-expect-error
          resolver: () => ({ nullable: 1, required: undefined, defaulted: 1 }),
        });

        // @ts-expect-error
        await factory(database).create({ required: null });
        // @ts-expect-error
        await factory(database).create({ required: undefined });
      });

      it('should accept undefined but not null for a not null column with a default', async () => {
        defineFactory({
          schema,
          table: 'records',
          resolver: () => ({ nullable: 1, required: 1, defaulted: undefined }),
        });
        defineFactory({
          schema,
          table: 'records',
          // @ts-expect-error
          resolver: () => ({ nullable: 1, required: 1, defaulted: null }),
        });

        expectTypeOf(await factory(database).create({ defaulted: undefined })).toHaveProperty('defaulted').toEqualTypeOf<undefined>();
        // @ts-expect-error
        await factory(database).create({ defaulted: null });
      });
    });

    describe('database', () => {
      type Parameter = Parameters<typeof usersFactory>[0];

      const otherSchema = {
        comments: pgTable('comments', {
          id: integer().notNull(),
        }),
      } satisfies Record<string, Table>;

      const extendedRelations = defineRelations({ ...schema, ...otherSchema });
      const otherRelations = defineRelations(otherSchema);

      it('should accept a database created with the relations of the schema', () => {
        expectTypeOf(database).toExtend<Parameter>();
        expectTypeOf(drizzleMysql(query, { relations })).toExtend<Parameter>();
        expectTypeOf<SqliteRemoteDatabase<unknown, typeof relations>>().toExtend<Parameter>();
      });

      it('should accept a database created with the relations of an extended schema', () => {
        expectTypeOf(drizzle(query, { relations: extendedRelations })).toExtend<Parameter>();
      });

      it('should not accept a database created with the relations of another schema', () => {
        expectTypeOf(drizzle(query, { relations: otherRelations })).not.toExtend<Parameter>();
      });

      it('should accept a database created without relations', () => {
        expectTypeOf(drizzle(query)).toExtend<Parameter>();
        expectTypeOf(drizzleMysql(query)).toExtend<Parameter>();
        expectTypeOf<SqliteRemoteDatabase>().toExtend<Parameter>();
      });

      it('should accept a function providing the database', () => {
        expectTypeOf(() => database).toExtend<Parameter>();
      });
    });
  });
});
