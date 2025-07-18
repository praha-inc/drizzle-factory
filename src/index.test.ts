import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defineFactory, composeFactory } from './index';

import type { Database } from './types/database';
import type { Table } from 'drizzle-orm';

describe('defineFactory', () => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    resolver: ({ sequence }) => {
      return {
        id: sequence,
        name: `name-${sequence}`,
      };
    },
    traits: {
      admin: ({ sequence }) => {
        return {
          id: sequence,
          name: `admin-${sequence}`,
        };
      },
    },
  });

  const postsFactory = defineFactory({
    schema,
    table: 'posts',
    resolver: ({ sequence, use }) => {
      return {
        id: sequence,
        userId: () => use(usersFactory).create().then((user) => user.id),
        title: `title-${sequence}`,
      };
    },
    traits: {
      admin: ({ sequence, use }) => {
        return {
          id: sequence,
          userId: () => use(usersFactory).traits.admin.create().then((user) => user.id),
          title: `admin-title-${sequence}`,
        };
      },
    },
  });

  beforeEach(() => {
    usersFactory.resetSequence();
    postsFactory.resetSequence();
  });

  describe('when creating a user', () => {
    describe('when creating a single user', () => {
      describe('when no values are specified', () => {
        it('should automatically set the values', async () => {
          const user = await usersFactory(database).create();

          expect(user).toEqual({
            id: 1,
            name: 'name-1',
          });
        });

        it('should call values', async () => {
          await usersFactory(database).create();

          expect(values).toHaveBeenCalledTimes(1);
          expect(values).toHaveBeenCalledWith({
            id: 1,
            name: 'name-1',
          });
        });
      });

      describe('when values are specified', () => {
        it('should set the specified values', async () => {
          const user = await usersFactory(database).create({ name: 'test' });

          expect(user).toEqual({
            id: 1,
            name: 'test',
          });
        });

        it('should call values', async () => {
          await usersFactory(database).create({ name: 'test' });

          expect(values).toHaveBeenCalledTimes(1);
          expect(values).toHaveBeenCalledWith({
            id: 1,
            name: 'test',
          });
        });
      });

      describe('when using a trait', () => {
        describe('when no values are specified', () => {
          it('should automatically set the values', async () => {
            const user = await usersFactory(database).traits.admin.create();

            expect(user).toEqual({
              id: 1,
              name: 'admin-1',
            });
          });

          it('should call values', async () => {
            await usersFactory(database).traits.admin.create();

            expect(values).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledWith({
              id: 1,
              name: 'admin-1',
            });
          });
        });

        describe('when values are specified', () => {
          it('should set the specified values', async () => {
            const user = await usersFactory(database).traits.admin.create({ name: 'test' });

            expect(user).toEqual({
              id: 1,
              name: 'test',
            });
          });

          it('should call values', async () => {
            await usersFactory(database).create({ name: 'test' });

            expect(values).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledWith({
              id: 1,
              name: 'test',
            });
          });
        });
      });
    });

    describe('when creating multiple users', () => {
      describe('when no values are specified', () => {
        it('should automatically set the values', async () => {
          const users = await usersFactory(database).create(2);

          expect(users).toEqual([
            {
              id: 1,
              name: 'name-1',
            },
            {
              id: 2,
              name: 'name-2',
            },
          ]);
        });

        it('should call values', async () => {
          await usersFactory(database).create(2);

          expect(values).toHaveBeenCalledTimes(2);
          expect(values).toHaveBeenNthCalledWith(1, {
            id: 1,
            name: 'name-1',
          });
          expect(values).toHaveBeenNthCalledWith(2, {
            id: 2,
            name: 'name-2',
          });
        });
      });

      describe('when values are specified', () => {
        it('should set the specified values', async () => {
          const users = await usersFactory(database).create([{ name: 'test' }, { name: 'test2' }]);

          expect(users).toEqual([
            {
              id: 1,
              name: 'test',
            },
            {
              id: 2,
              name: 'test2',
            },
          ]);
        });

        it('should call values', async () => {
          await usersFactory(database).create([{ name: 'test' }, { name: 'test2' }]);

          expect(values).toHaveBeenCalledTimes(2);
          expect(values).toHaveBeenNthCalledWith(1, {
            id: 1,
            name: 'test',
          });
          expect(values).toHaveBeenNthCalledWith(2, {
            id: 2,
            name: 'test2',
          });
        });
      });

      describe('when using a trait', () => {
        describe('when no values are specified', () => {
          it('should automatically set the values', async () => {
            const users = await usersFactory(database).traits.admin.create(2);

            expect(users).toEqual([
              {
                id: 1,
                name: 'admin-1',
              },
              {
                id: 2,
                name: 'admin-2',
              },
            ]);
          });

          it('should call values', async () => {
            await usersFactory(database).traits.admin.create(2);

            expect(values).toHaveBeenCalledTimes(2);
            expect(values).toHaveBeenNthCalledWith(1, {
              id: 1,
              name: 'admin-1',
            });
            expect(values).toHaveBeenNthCalledWith(2, {
              id: 2,
              name: 'admin-2',
            });
          });
        });

        describe('when values are specified', () => {
          it('should set the specified values', async () => {
            const users = await usersFactory(database).traits.admin.create([{ name: 'test' }, { name: 'test2' }]);

            expect(users).toEqual([
              {
                id: 1,
                name: 'test',
              },
              {
                id: 2,
                name: 'test2',
              },
            ]);
          });

          it('should call values', async () => {
            await usersFactory(database).traits.admin.create([{ name: 'test' }, { name: 'test2' }]);

            expect(values).toHaveBeenCalledTimes(2);
            expect(values).toHaveBeenNthCalledWith(1, {
              id: 1,
              name: 'test',
            });
            expect(values).toHaveBeenNthCalledWith(2, {
              id: 2,
              name: 'test2',
            });
          });
        });
      });
    });
  });

  describe('when creating a post', () => {
    describe('when creating a single post', () => {
      describe('when no values are specified', () => {
        it('should automatically set the values', async () => {
          const post = await postsFactory(database).create();

          expect(post).toEqual({
            id: 1,
            userId: 1,
            title: 'title-1',
          });
        });

        it('should call values', async () => {
          await postsFactory(database).create();

          expect(values).toHaveBeenCalledTimes(2);
          expect(values).toHaveBeenNthCalledWith(1, {
            id: 1,
            name: 'name-1',
          });
          expect(values).toHaveBeenNthCalledWith(2, {
            id: 1,
            userId: 1,
            title: 'title-1',
          });
        });
      });

      describe('when values are specified', () => {
        it('should set the specified values', async () => {
          const post = await postsFactory(database).create({ userId: 10, title: 'test' });

          expect(post).toEqual({
            id: 1,
            userId: 10,
            title: 'test',
          });
        });

        it('should call values', async () => {
          await postsFactory(database).create({ userId: 10, title: 'test' });

          expect(values).toHaveBeenCalledTimes(1);
          expect(values).toHaveBeenCalledWith({
            id: 1,
            userId: 10,
            title: 'test',
          });
        });

        it('should not call the user factory', async () => {
          await postsFactory(database).create({ userId: 10, title: 'test' });

          expect(values).toHaveBeenCalledTimes(1);
        });
      });

      describe('when using a trait', () => {
        describe('when no values are specified', () => {
          it('should automatically set the values', async () => {
            const post = await postsFactory(database).traits.admin.create();

            expect(post).toEqual({
              id: 1,
              userId: 1,
              title: 'admin-title-1',
            });
          });

          it('should call values', async () => {
            await postsFactory(database).traits.admin.create();

            expect(values).toHaveBeenCalledTimes(2);
            expect(values).toHaveBeenNthCalledWith(1, {
              id: 1,
              name: 'admin-1',
            });
            expect(values).toHaveBeenNthCalledWith(2, {
              id: 1,
              userId: 1,
              title: 'admin-title-1',
            });
          });
        });

        describe('when values are specified', () => {
          it('should set the specified values', async () => {
            const post = await postsFactory(database).traits.admin.create({ userId: 10, title: 'test' });

            expect(post).toEqual({
              id: 1,
              userId: 10,
              title: 'test',
            });
          });

          it('should call values', async () => {
            await postsFactory(database).traits.admin.create({ userId: 10, title: 'test' });

            expect(values).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledWith({
              id: 1,
              userId: 10,
              title: 'test',
            });
          });

          it('should not call the user factory', async () => {
            await postsFactory(database).traits.admin.create({ userId: 10, title: 'test' });

            expect(values).toHaveBeenCalledTimes(1);
          });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  });
});
