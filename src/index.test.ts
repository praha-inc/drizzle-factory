import { defineRelations, getTableName, sql } from 'drizzle-orm';
import { int, mysqlTable, text as mysqlText } from 'drizzle-orm/mysql-core';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql-proxy';
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { integer as sqliteInteger, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';
import { drizzle as drizzleSqlite } from 'drizzle-orm/sqlite-proxy';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defineFactory, composeFactory } from './index';

import type { Database } from './index';
import type { Table } from 'drizzle-orm';

describe('defineFactory', () => {
  describe('v0', () => {
    // drizzle-orm v1 never exposes `fullSchema`, so a v0 database is reproduced by a stub.
    // Each insert is reported to `execute` as the table name and the inserted values.
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const execute = vi.fn<(table: string, values: unknown) => any>(() => Promise.resolve());
    const overridingSystemValue = vi.fn<() => void>();

    const createDatabase = <Schema extends Record<string, Table>>(schema: Schema): Database<Schema> => ({
      _: { fullSchema: schema },
      insert: (table: Table) => {
        const builder = {
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-return
          values: (values: unknown) => execute(getTableName(table), values),
          overridingSystemValue: () => {
            overridingSystemValue();
            return builder;
          },
        };
        return builder;
      },
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
          name: `admin-${sequence}`,
        }),
      },
      seeds: {
        john: () => ({
          name: 'John Doe',
        }),
        numbered: ({ sequence }) => ({
          name: `seed-${sequence}`,
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
      traits: {
        admin: ({ sequence, use }) => ({
          id: sequence,
          userId: () => use(usersFactory).traits.admin.create().then((user) => user.id),
          title: `admin-title-${sequence}`,
        }),
      },
      seeds: {
        john: async ({ use }) => {
          const john = await use(usersFactory).seeds.john.create();
          return [
            { userId: john.id, title: 'John\'s First Post' },
            { userId: john.id, title: 'John\'s Second Post' },
          ];
        },
      },
    });

    beforeEach(() => {
      usersFactory.resetSequence();
      postsFactory.resetSequence();
    });

    describe('create', () => {
      it('should insert a record built by the resolver', async () => {
        const user = await usersFactory(database).create();

        expect(user).toEqual({ id: 1, name: 'name-1' });
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'name-1' }],
        ]);
      });

      it('should override the resolved values with the specified values', async () => {
        const user = await usersFactory(database).create({ name: 'test' });

        expect(user).toEqual({ id: 1, name: 'test' });
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'test' }],
        ]);
      });

      it('should insert the specified number of records', async () => {
        const users = await usersFactory(database).create(2);

        expect(users).toEqual([
          { id: 1, name: 'name-1' },
          { id: 2, name: 'name-2' },
        ]);
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'name-1' }],
          ['users', { id: 2, name: 'name-2' }],
        ]);
      });

      it('should insert a record for each of the specified values', async () => {
        const users = await usersFactory(database).create([{ name: 'test-1' }, {}, { id: 10 }]);

        expect(users).toEqual([
          { id: 1, name: 'test-1' },
          { id: 2, name: 'name-2' },
          { id: 10, name: 'name-3' },
        ]);
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'test-1' }],
          ['users', { id: 2, name: 'name-2' }],
          ['users', { id: 10, name: 'name-3' }],
        ]);
      });

      it('should resolve the values returned from functions', async () => {
        const factory = defineFactory({
          schema,
          table: 'users',
          resolver: ({ sequence }) => ({
            id: () => sequence,
            name: () => Promise.resolve(`name-${sequence}`),
          }),
        });

        const user = await factory(database).create();

        expect(user).toEqual({ id: 1, name: 'name-1' });
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'name-1' }],
        ]);
      });

      it('should insert the records of the factories passed to use first', async () => {
        const posts = await postsFactory(database).create(2);

        expect(posts).toEqual([
          { id: 1, userId: 1, title: 'title-1' },
          { id: 2, userId: 2, title: 'title-2' },
        ]);
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'name-1' }],
          ['posts', { id: 1, userId: 1, title: 'title-1' }],
          ['users', { id: 2, name: 'name-2' }],
          ['posts', { id: 2, userId: 2, title: 'title-2' }],
        ]);
      });

      it('should not call the functions of the overridden values', async () => {
        const post = await postsFactory(database).create({ userId: 10 });

        expect(post).toEqual({ id: 1, userId: 10, title: 'title-1' });
        expect(execute.mock.calls).toEqual([
          ['posts', { id: 1, userId: 10, title: 'title-1' }],
        ]);
      });
    });

    describe('traits', () => {
      it('should insert a record built by the trait resolver', async () => {
        const user = await usersFactory(database).traits.admin.create();

        expect(user).toEqual({ id: 1, name: 'admin-1' });
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'admin-1' }],
        ]);
      });

      it('should override the resolved values with the specified values', async () => {
        const user = await usersFactory(database).traits.admin.create({ name: 'test' });

        expect(user).toEqual({ id: 1, name: 'test' });
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'test' }],
        ]);
      });

      it('should insert the specified number of records', async () => {
        const users = await usersFactory(database).traits.admin.create(2);

        expect(users).toEqual([
          { id: 1, name: 'admin-1' },
          { id: 2, name: 'admin-2' },
        ]);
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'admin-1' }],
          ['users', { id: 2, name: 'admin-2' }],
        ]);
      });

      it('should insert a record for each of the specified values', async () => {
        const users = await usersFactory(database).traits.admin.create([{ name: 'test-1' }, {}]);

        expect(users).toEqual([
          { id: 1, name: 'test-1' },
          { id: 2, name: 'admin-2' },
        ]);
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'test-1' }],
          ['users', { id: 2, name: 'admin-2' }],
        ]);
      });

      it('should insert the records of the factories passed to use first', async () => {
        const post = await postsFactory(database).traits.admin.create();

        expect(post).toEqual({ id: 1, userId: 1, title: 'admin-title-1' });
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'admin-1' }],
          ['posts', { id: 1, userId: 1, title: 'admin-title-1' }],
        ]);
      });
    });

    describe('seeds', () => {
      it('should insert a record when the seed resolver returns an object', async () => {
        const user = await usersFactory(database).seeds.john.create();

        expect(user).toEqual({ id: 1, name: 'John Doe' });
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'John Doe' }],
        ]);
      });

      it('should insert a record for each value when the seed resolver returns an array', async () => {
        const posts = await postsFactory(database).seeds.john.create();

        expect(posts).toEqual([
          { id: 1, userId: 1, title: 'John\'s First Post' },
          { id: 2, userId: 1, title: 'John\'s Second Post' },
        ]);
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'John Doe' }],
          ['posts', { id: 1, userId: 1, title: 'John\'s First Post' }],
          ['posts', { id: 2, userId: 1, title: 'John\'s Second Post' }],
        ]);
      });

      it('should pass the sequence of the record to be inserted to the seed resolver', async () => {
        await usersFactory(database).create();

        const user = await usersFactory(database).seeds.numbered.create();

        expect(user).toEqual({ id: 2, name: 'seed-2' });
      });
    });

    describe('sequence', () => {
      it('should share the sequence between the resolver, traits and seeds', async () => {
        const users = [
          await usersFactory(database).create(),
          await usersFactory(database).traits.admin.create(),
          await usersFactory(database).seeds.john.create(),
        ];

        expect(users).toEqual([
          { id: 1, name: 'name-1' },
          { id: 2, name: 'admin-2' },
          { id: 3, name: 'John Doe' },
        ]);
      });

      it('should keep a separate sequence for each factory', async () => {
        await usersFactory(database).create(2);

        const post = await postsFactory(database).create({ userId: 1 });

        expect(post).toEqual({ id: 1, userId: 1, title: 'title-1' });
      });

      it('should restart the sequence from 1 when resetSequence is called', async () => {
        await usersFactory(database).create(2);

        usersFactory.resetSequence();
        const user = await usersFactory(database).create();

        expect(user).toEqual({ id: 1, name: 'name-1' });
      });
    });

    describe('database', () => {
      it('should not call the function providing the database until a record is inserted', () => {
        const getDatabase = vi.fn(() => database);

        usersFactory(getDatabase);

        expect(getDatabase).not.toHaveBeenCalled();
      });

      it('should insert every record into the database provided by the function', async () => {
        const getDatabase = vi.fn(() => database);

        const post = await postsFactory(getDatabase).create();

        expect(post).toEqual({ id: 1, userId: 1, title: 'title-1' });
        expect(getDatabase).toHaveBeenCalledTimes(2);
        expect(execute.mock.calls).toEqual([
          ['users', { id: 1, name: 'name-1' }],
          ['posts', { id: 1, userId: 1, title: 'title-1' }],
        ]);
      });
    });

    describe('overridingSystemValue', () => {
      const schema = {
        plain: pgTable('plain', {
          id: integer().notNull(),
        }),
        generated: pgTable('generated', {
          id: integer().notNull(),
          double: integer().generatedAlwaysAs(sql`id * 2`),
        }),
        identity: pgTable('identity', {
          id: integer().generatedAlwaysAsIdentity(),
        }),
        identityGenerated: pgTable('identity_generated', {
          id: integer().generatedAlwaysAsIdentity(),
          double: integer().generatedAlwaysAs(sql`id * 2`),
        }),
        defaultIdentity: pgTable('default_identity', {
          id: integer().generatedByDefaultAsIdentity(),
        }),
      } satisfies Record<string, Table>;

      const database = createDatabase(schema);

      it('should not override the system value when the table has no generated columns', async () => {
        const factory = defineFactory({
          schema,
          table: 'plain',
          resolver: ({ sequence }) => ({ id: sequence }),
        });

        await factory(database).create();

        expect(overridingSystemValue).not.toHaveBeenCalled();
        expect(execute.mock.calls).toEqual([['plain', { id: 1 }]]);
      });

      it('should not override the system value when the table has a generated always column', async () => {
        const factory = defineFactory({
          schema,
          table: 'generated',
          resolver: ({ sequence }) => ({ id: sequence }),
        });

        const record = await factory(database).create();

        expect(record).toEqual({ id: 1 });
        expect(overridingSystemValue).not.toHaveBeenCalled();
        expect(execute.mock.calls).toEqual([['generated', { id: 1 }]]);
      });

      it('should override the system value when the table has a generated always as identity column', async () => {
        const factory = defineFactory({
          schema,
          table: 'identity',
          resolver: ({ sequence }) => ({ id: sequence }),
        });

        await factory(database).create();

        expect(overridingSystemValue).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls).toEqual([['identity', { id: 1 }]]);
      });

      it('should neither resolve nor insert the value of a generated always column', async () => {
        const resolveDouble = vi.fn(() => 2);
        const factory = defineFactory({
          schema,
          table: 'identityGenerated',
          resolver: ({ sequence }) => ({ id: sequence, double: resolveDouble }),
        });

        const record = await factory(database).create();

        expect(record).toEqual({ id: 1 });
        expect(resolveDouble).not.toHaveBeenCalled();
        expect(overridingSystemValue).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls).toEqual([['identity_generated', { id: 1 }]]);
      });

      it('should not override the system value when the table has a generated by default as identity column', async () => {
        const factory = defineFactory({
          schema,
          table: 'defaultIdentity',
          resolver: ({ sequence }) => ({ id: sequence }),
        });

        await factory(database).create();

        expect(overridingSystemValue).not.toHaveBeenCalled();
        expect(execute.mock.calls).toEqual([['default_identity', { id: 1 }]]);
      });

      it('should insert a record when the database does not support overriding the system value', async () => {
        const factory = defineFactory({
          schema,
          table: 'identity',
          resolver: ({ sequence }) => ({ id: sequence }),
        });
        const database: Database<typeof schema> = {
          _: { fullSchema: schema },
          insert: (table: Table) => ({
            // oxlint-disable-next-line @typescript-eslint/no-unsafe-return
            values: (values: unknown) => execute(getTableName(table), values),
          }),
        };

        const record = await factory(database).create();

        expect(record).toEqual({ id: 1 });
        expect(execute.mock.calls).toEqual([['identity', { id: 1 }]]);
      });
    });
  });

  describe('v1', () => {
    // Every query issued by a real drizzle-orm v1 database is reported to `query` as the SQL and its parameters.
    const query = vi.fn((_sql: string, _parameters: unknown[]) => Promise.resolve({ rows: [] }));

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

    const database = drizzle((sql, parameters) => query(sql, parameters), { relations });

    const insertUser = 'insert into "users" ("id", "name") values ($1, $2)';
    const insertPost = 'insert into "posts" ("id", "userId", "title") values ($1, $2, $3)';

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
          name: `admin-${sequence}`,
        }),
      },
      seeds: {
        john: () => ({
          name: 'John Doe',
        }),
        numbered: ({ sequence }) => ({
          name: `seed-${sequence}`,
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
      traits: {
        admin: ({ sequence, use }) => ({
          id: sequence,
          userId: () => use(usersFactory).traits.admin.create().then((user) => user.id),
          title: `admin-title-${sequence}`,
        }),
      },
      seeds: {
        john: async ({ use }) => {
          const john = await use(usersFactory).seeds.john.create();
          return [
            { userId: john.id, title: 'John\'s First Post' },
            { userId: john.id, title: 'John\'s Second Post' },
          ];
        },
      },
    });

    beforeEach(() => {
      usersFactory.resetSequence();
      postsFactory.resetSequence();
    });

    describe('create', () => {
      it('should insert a record built by the resolver', async () => {
        const user = await usersFactory(database).create();

        expect(user).toEqual({ id: 1, name: 'name-1' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'name-1']],
        ]);
      });

      it('should override the resolved values with the specified values', async () => {
        const user = await usersFactory(database).create({ name: 'test' });

        expect(user).toEqual({ id: 1, name: 'test' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'test']],
        ]);
      });

      it('should insert the specified number of records', async () => {
        const users = await usersFactory(database).create(2);

        expect(users).toEqual([
          { id: 1, name: 'name-1' },
          { id: 2, name: 'name-2' },
        ]);
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'name-1']],
          [insertUser, [2, 'name-2']],
        ]);
      });

      it('should insert a record for each of the specified values', async () => {
        const users = await usersFactory(database).create([{ name: 'test-1' }, {}, { id: 10 }]);

        expect(users).toEqual([
          { id: 1, name: 'test-1' },
          { id: 2, name: 'name-2' },
          { id: 10, name: 'name-3' },
        ]);
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'test-1']],
          [insertUser, [2, 'name-2']],
          [insertUser, [10, 'name-3']],
        ]);
      });

      it('should resolve the values returned from functions', async () => {
        const factory = defineFactory({
          schema,
          table: 'users',
          resolver: ({ sequence }) => ({
            id: () => sequence,
            name: () => Promise.resolve(`name-${sequence}`),
          }),
        });

        const user = await factory(database).create();

        expect(user).toEqual({ id: 1, name: 'name-1' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'name-1']],
        ]);
      });

      it('should insert the records of the factories passed to use first', async () => {
        const posts = await postsFactory(database).create(2);

        expect(posts).toEqual([
          { id: 1, userId: 1, title: 'title-1' },
          { id: 2, userId: 2, title: 'title-2' },
        ]);
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'name-1']],
          [insertPost, [1, 1, 'title-1']],
          [insertUser, [2, 'name-2']],
          [insertPost, [2, 2, 'title-2']],
        ]);
      });

      it('should not call the functions of the overridden values', async () => {
        const post = await postsFactory(database).create({ userId: 10 });

        expect(post).toEqual({ id: 1, userId: 10, title: 'title-1' });
        expect(query.mock.calls).toEqual([
          [insertPost, [1, 10, 'title-1']],
        ]);
      });
    });

    describe('traits', () => {
      it('should insert a record built by the trait resolver', async () => {
        const user = await usersFactory(database).traits.admin.create();

        expect(user).toEqual({ id: 1, name: 'admin-1' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'admin-1']],
        ]);
      });

      it('should override the resolved values with the specified values', async () => {
        const user = await usersFactory(database).traits.admin.create({ name: 'test' });

        expect(user).toEqual({ id: 1, name: 'test' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'test']],
        ]);
      });

      it('should insert the specified number of records', async () => {
        const users = await usersFactory(database).traits.admin.create(2);

        expect(users).toEqual([
          { id: 1, name: 'admin-1' },
          { id: 2, name: 'admin-2' },
        ]);
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'admin-1']],
          [insertUser, [2, 'admin-2']],
        ]);
      });

      it('should insert a record for each of the specified values', async () => {
        const users = await usersFactory(database).traits.admin.create([{ name: 'test-1' }, {}]);

        expect(users).toEqual([
          { id: 1, name: 'test-1' },
          { id: 2, name: 'admin-2' },
        ]);
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'test-1']],
          [insertUser, [2, 'admin-2']],
        ]);
      });

      it('should insert the records of the factories passed to use first', async () => {
        const post = await postsFactory(database).traits.admin.create();

        expect(post).toEqual({ id: 1, userId: 1, title: 'admin-title-1' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'admin-1']],
          [insertPost, [1, 1, 'admin-title-1']],
        ]);
      });
    });

    describe('seeds', () => {
      it('should insert a record when the seed resolver returns an object', async () => {
        const user = await usersFactory(database).seeds.john.create();

        expect(user).toEqual({ id: 1, name: 'John Doe' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'John Doe']],
        ]);
      });

      it('should insert a record for each value when the seed resolver returns an array', async () => {
        const posts = await postsFactory(database).seeds.john.create();

        expect(posts).toEqual([
          { id: 1, userId: 1, title: 'John\'s First Post' },
          { id: 2, userId: 1, title: 'John\'s Second Post' },
        ]);
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'John Doe']],
          [insertPost, [1, 1, 'John\'s First Post']],
          [insertPost, [2, 1, 'John\'s Second Post']],
        ]);
      });

      it('should pass the sequence of the record to be inserted to the seed resolver', async () => {
        await usersFactory(database).create();

        const user = await usersFactory(database).seeds.numbered.create();

        expect(user).toEqual({ id: 2, name: 'seed-2' });
      });
    });

    describe('sequence', () => {
      it('should share the sequence between the resolver, traits and seeds', async () => {
        const users = [
          await usersFactory(database).create(),
          await usersFactory(database).traits.admin.create(),
          await usersFactory(database).seeds.john.create(),
        ];

        expect(users).toEqual([
          { id: 1, name: 'name-1' },
          { id: 2, name: 'admin-2' },
          { id: 3, name: 'John Doe' },
        ]);
      });

      it('should keep a separate sequence for each factory', async () => {
        await usersFactory(database).create(2);

        const post = await postsFactory(database).create({ userId: 1 });

        expect(post).toEqual({ id: 1, userId: 1, title: 'title-1' });
      });

      it('should restart the sequence from 1 when resetSequence is called', async () => {
        await usersFactory(database).create(2);

        usersFactory.resetSequence();
        const user = await usersFactory(database).create();

        expect(user).toEqual({ id: 1, name: 'name-1' });
      });
    });

    describe('database', () => {
      it('should insert a record into the database created without relations', async () => {
        const database = drizzle((sql, parameters) => query(sql, parameters));

        const user = await usersFactory(database).create();

        expect(user).toEqual({ id: 1, name: 'name-1' });
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'name-1']],
        ]);
      });

      it('should not call the function providing the database until a record is inserted', () => {
        const getDatabase = vi.fn(() => database);

        usersFactory(getDatabase);

        expect(getDatabase).not.toHaveBeenCalled();
      });

      it('should insert every record into the database provided by the function', async () => {
        const getDatabase = vi.fn(() => database);

        const post = await postsFactory(getDatabase).create();

        expect(post).toEqual({ id: 1, userId: 1, title: 'title-1' });
        expect(getDatabase).toHaveBeenCalledTimes(2);
        expect(query.mock.calls).toEqual([
          [insertUser, [1, 'name-1']],
          [insertPost, [1, 1, 'title-1']],
        ]);
      });
    });

    describe('overridingSystemValue', () => {
      describe('PostgreSQL', () => {
        const schema = {
          plain: pgTable('plain', {
            id: integer().notNull(),
          }),
          generated: pgTable('generated', {
            id: integer().notNull(),
            double: integer().generatedAlwaysAs(sql`id * 2`),
          }),
          identity: pgTable('identity', {
            id: integer().generatedAlwaysAsIdentity(),
          }),
          identityGenerated: pgTable('identity_generated', {
            id: integer().generatedAlwaysAsIdentity(),
            double: integer().generatedAlwaysAs(sql`id * 2`),
          }),
          defaultIdentity: pgTable('default_identity', {
            id: integer().generatedByDefaultAsIdentity(),
          }),
        } satisfies Record<string, Table>;

        const database = drizzle((sql, parameters) => query(sql, parameters), {
          relations: defineRelations(schema),
        });

        it('should not override the system value when the table has no generated columns', async () => {
          const factory = defineFactory({
            schema,
            table: 'plain',
            resolver: ({ sequence }) => ({ id: sequence }),
          });

          await factory(database).create();

          expect(query.mock.calls).toEqual([
            ['insert into "plain" ("id") values ($1)', [1]],
          ]);
        });

        it('should not override the system value when the table has a generated always column', async () => {
          const factory = defineFactory({
            schema,
            table: 'generated',
            resolver: ({ sequence }) => ({ id: sequence }),
          });

          const record = await factory(database).create();

          expect(record).toEqual({ id: 1 });
          expect(query.mock.calls).toEqual([
            ['insert into "generated" ("id") values ($1)', [1]],
          ]);
        });

        it('should override the system value when the table has a generated always as identity column', async () => {
          const factory = defineFactory({
            schema,
            table: 'identity',
            resolver: ({ sequence }) => ({ id: sequence }),
          });

          await factory(database).create();

          expect(query.mock.calls).toEqual([
            ['insert into "identity" ("id") overriding system value values ($1)', [1]],
          ]);
        });

        it('should neither resolve nor insert the value of a generated always column', async () => {
          const resolveDouble = vi.fn(() => 2);
          const factory = defineFactory({
            schema,
            table: 'identityGenerated',
            resolver: ({ sequence }) => ({ id: sequence, double: resolveDouble }),
          });

          const record = await factory(database).create();

          expect(record).toEqual({ id: 1 });
          expect(resolveDouble).not.toHaveBeenCalled();
          expect(query.mock.calls).toEqual([
            ['insert into "identity_generated" ("id", "double") overriding system value values ($1, default)', [1]],
          ]);
        });

        it('should not override the system value when the table has a generated by default as identity column', async () => {
          const factory = defineFactory({
            schema,
            table: 'defaultIdentity',
            resolver: ({ sequence }) => ({ id: sequence }),
          });

          await factory(database).create();

          expect(query.mock.calls).toEqual([
            ['insert into "default_identity" ("id") values ($1)', [1]],
          ]);
        });
      });

      describe('MySQL', () => {
        const schema = {
          generated: mysqlTable('generated', {
            id: int().notNull(),
            name: mysqlText().notNull(),
            double: int().generatedAlwaysAs(sql`id * 2`),
          }),
        } satisfies Record<string, Table>;

        const database = drizzleMysql((sql, parameters) => query(sql, parameters), {
          relations: defineRelations(schema),
        });

        it('should insert a record without overriding the system value when the table has a generated always column', async () => {
          const factory = defineFactory({
            schema,
            table: 'generated',
            resolver: ({ sequence }) => ({ id: sequence, name: `name-${sequence}` }),
          });

          const record = await factory(database).create();

          expect(record).toEqual({ id: 1, name: 'name-1' });
          expect(query.mock.calls).toEqual([
            ['insert into `generated` (`id`, `name`) values (?, ?)', [1, 'name-1']],
          ]);
        });
      });

      describe('SQLite', () => {
        const schema = {
          generated: sqliteTable('generated', {
            id: sqliteInteger().notNull(),
            name: sqliteText().notNull(),
            double: sqliteInteger().generatedAlwaysAs(sql`id * 2`),
          }),
        } satisfies Record<string, Table>;

        const database = drizzleSqlite({
          run: (sql, parameters) => query(sql, parameters),
          all: () => Promise.resolve([]),
          get: () => Promise.resolve(undefined),
        }, {
          relations: defineRelations(schema),
        });

        it('should insert a record without overriding the system value when the table has a generated always column', async () => {
          const factory = defineFactory({
            schema,
            table: 'generated',
            resolver: ({ sequence }) => ({ id: sequence, name: `name-${sequence}` }),
          });

          const record = await factory(database).create();

          expect(record).toEqual({ id: 1, name: 'name-1' });
          expect(query.mock.calls).toEqual([
            ['insert into "generated" ("id", "name") values (?, ?)', [1, 'name-1']],
          ]);
        });
      });
    });
  });
});

describe('composeFactory', () => {
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

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  const values = vi.fn<() => any>(() => Promise.resolve());
  const database: Database<typeof schema> = {
    _: {
      fullSchema: schema,
    },
    insert: () => ({ values }),
  };

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
        name: `admin-${sequence}`,
      }),
    },
    seeds: {
      john: () => ({
        name: 'John Doe',
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
    traits: {
      admin: ({ sequence, use }) => ({
        id: sequence,
        userId: () => use(usersFactory).traits.admin.create().then((user) => user.id),
        title: `admin-title-${sequence}`,
      }),
    },
    seeds: {
      john: async ({ use }) => {
        const john = await use(usersFactory).seeds.john.create();
        return [
          {
            userId: john.id,
            title: 'John\'s First Post',
          },
          {
            userId: john.id,
            title: 'John\'s Second Post',
          },
        ];
      },
    },
  });

  const factory = composeFactory({
    users: usersFactory,
    posts: postsFactory,
  });

  beforeEach(() => {
    factory.resetSequence();
  });

  describe('when creating a user through the composed factory', () => {
    it('should create a single user', async () => {
      const user = await factory(database).users.create();

      expect(user).toEqual({
        id: 1,
        name: 'name-1',
      });
    });

    it('should create multiple users', async () => {
      const users = await factory(database).users.create(2);

      expect(users).toEqual([
        { id: 1, name: 'name-1' },
        { id: 2, name: 'name-2' },
      ]);
    });

    it('should create a user with a trait', async () => {
      const user = await factory(database).users.traits.admin.create();

      expect(user).toEqual({
        id: 1,
        name: 'admin-1',
      });
    });

    it('should create a user with a seed', async () => {
      const user = await factory(database).users.seeds.john.create();

      expect(user).toEqual({
        id: 1,
        name: 'John Doe',
      });
    });
  });

  describe('when creating a post through the composed factory', () => {
    it('should create a single post', async () => {
      const post = await factory(database).posts.create();

      expect(post).toEqual({
        id: 1,
        userId: 1,
        title: 'title-1',
      });
    });

    it('should create multiple posts', async () => {
      const posts = await factory(database).posts.create(2);

      expect(posts).toEqual([
        { id: 1, userId: 1, title: 'title-1' },
        { id: 2, userId: 2, title: 'title-2' },
      ]);
    });

    it('should create a post with a specified userId', async () => {
      const post = await factory(database).posts.create({ userId: 10, title: 'test' });

      expect(post).toEqual({
        id: 1,
        userId: 10,
        title: 'test',
      });
    });

    it('should create a post with a trait', async () => {
      const post = await factory(database).posts.traits.admin.create();

      expect(post).toEqual({
        id: 1,
        userId: 1,
        title: 'admin-title-1',
      });
    });

    it('should create a post with a seed', async () => {
      const posts = await factory(database).posts.seeds.john.create();

      expect(posts).toEqual([
        {
          id: 1,
          userId: 1,
          title: 'John\'s First Post',
        },
        {
          id: 2,
          userId: 1,
          title: 'John\'s Second Post',
        },
      ]);
    });
  });

  describe('when database is provided as a function', () => {
    const fn = vi.fn(() => database);

    it('should create a single user', async () => {
      const user = await factory(fn).users.create();

      expect(fn).toHaveBeenCalled();
      expect(user).toEqual({
        id: 1,
        name: 'name-1',
      });
    });

    it('should not call the function until create is called', () => {
      const fn = vi.fn(() => database);

      factory(fn);

      expect(fn).not.toHaveBeenCalled();
    });
  });
});
