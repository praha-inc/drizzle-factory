import { integer, pgTable } from 'drizzle-orm/pg-core';
import { describe, expectTypeOf, it, vi } from 'vitest';

import { defineFactory } from './index';

import type { Database } from './types/database';
import type { Table } from 'drizzle-orm';

describe('defineFactory', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      it('should raise a type error when override is undefined', async () => {
        // @ts-expect-error
        await factory(database).create({ id: undefined });
      });

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

      it('should raise a type error when override is null', async () => {
        // @ts-expect-error
        await factory(database).create({ id: null });
      });
    });
  });
});
