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
    seeds: {
      john: () => {
        return {
          name: 'John Doe',
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

    describe('when using a seed', () => {
      it('should create a user', async () => {
        const user = await usersFactory(database).seeds.john.create();

        expect(user).toEqual({
          id: 1,
          name: 'John Doe',
        });
      });

      it('should call values', async () => {
        await usersFactory(database).seeds.john.create();

        expect(values).toHaveBeenCalledTimes(1);
        expect(values).toHaveBeenNthCalledWith(1, {
          id: 1,
          name: 'John Doe',
        });
      });

      it('should increment sequence', async () => {
        await usersFactory(database).seeds.john.create();
        const user = await usersFactory(database).create();

        expect(user).toEqual({
          id: 2,
          name: 'name-2',
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

    describe('when using a seed', () => {
      it('should create posts', async () => {
        const posts = await postsFactory(database).seeds.john.create();

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

      it('should call values', async () => {
        await postsFactory(database).seeds.john.create();

        expect(values).toHaveBeenCalledTimes(3);
        expect(values).toHaveBeenNthCalledWith(1, {
          id: 1,
          name: 'John Doe',
        });
        expect(values).toHaveBeenNthCalledWith(2, {
          id: 1,
          userId: 1,
          title: 'John\'s First Post',
        });
        expect(values).toHaveBeenNthCalledWith(3, {
          id: 2,
          userId: 1,
          title: 'John\'s Second Post',
        });
      });

      it('should increment sequence', async () => {
        await postsFactory(database).seeds.john.create();
        const post = await postsFactory(database).create();

        expect(post).toEqual({
          id: 3,
          userId: 2,
          title: 'title-3',
        });
      });
    });
  });

  describe('when database supports overridingSystemValue', () => {
    describe('when tables has no generated columns', () => {
      const schema = {
        users: pgTable('users', {
          id: integer().notNull(),
          name: text().notNull(),
        }),
      } satisfies Record<string, Table>;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values = vi.fn<() => any>(() => Promise.resolve());
      const overridingSystemValue = vi.fn(() => ({ values }));
      const insert = vi.fn(() => ({ overridingSystemValue, values }));

      const database: Database<typeof schema> = {
        _: {
          fullSchema: schema,
        },
        insert,
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

      beforeEach(() => {
        usersFactory.resetSequence();
      });

      it('should not call overridingSystemValue method when available', async () => {
        await usersFactory(database).create();

        expect(insert).toHaveBeenCalledWith(schema.users);
        expect(overridingSystemValue).not.toHaveBeenCalled();
        expect(values).toHaveBeenCalledWith({
          id: 1,
          name: 'name-1',
        });
      });

      it('should not call overridingSystemValue method when using a trait', async () => {
        await usersFactory(database).traits.admin.create();

        expect(insert).toHaveBeenCalledWith(schema.users);
        expect(overridingSystemValue).not.toHaveBeenCalled();
        expect(values).toHaveBeenCalledWith({
          id: 1,
          name: 'admin-1',
        });
      });
    });

    describe('when table has generated columns', () => {
      const schema = {
        users: pgTable('users', {
          id: integer().notNull(),
          name: text().notNull().generatedAlwaysAs('name'),
        }),
      } satisfies Record<string, Table>;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values = vi.fn<() => any>(() => Promise.resolve());
      const overridingSystemValue = vi.fn(() => ({ values }));
      const insert = vi.fn(() => ({ overridingSystemValue, values }));

      const database: Database<typeof schema> = {
        _: {
          fullSchema: schema,
        },
        insert,
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

      beforeEach(() => {
        usersFactory.resetSequence();
      });

      it('should call overridingSystemValue method when available', async () => {
        await usersFactory(database).create();

        expect(insert).toHaveBeenCalledWith(schema.users);
        expect(overridingSystemValue).toHaveBeenCalledTimes(1);
        expect(values).toHaveBeenCalledWith({
          id: 1,
          name: 'name-1',
        });
      });

      it('should call overridingSystemValue method when using a trait', async () => {
        await usersFactory(database).traits.admin.create();

        expect(insert).toHaveBeenCalledWith(schema.users);
        expect(overridingSystemValue).toHaveBeenCalledTimes(1);
        expect(values).toHaveBeenCalledWith({
          id: 1,
          name: 'admin-1',
        });
      });
    });

    describe('when table has generated columns with identity', () => {
      const schema = {
        users: pgTable('users', {
          id: integer().notNull().generatedAlwaysAsIdentity(),
          name: text().notNull(),
        }),
      } satisfies Record<string, Table>;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values = vi.fn<() => any>(() => Promise.resolve());
      const overridingSystemValue = vi.fn(() => ({ values }));
      const insert = vi.fn(() => ({ overridingSystemValue, values }));

      const database: Database<typeof schema> = {
        _: {
          fullSchema: schema,
        },
        insert,
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

      beforeEach(() => {
        usersFactory.resetSequence();
      });

      it('should call overridingSystemValue method when available', async () => {
        await usersFactory(database).create();

        expect(insert).toHaveBeenCalledWith(schema.users);
        expect(overridingSystemValue).toHaveBeenCalledTimes(1);
        expect(values).toHaveBeenCalledWith({
          id: 1,
          name: 'name-1',
        });
      });

      it('should call overridingSystemValue method when using a trait', async () => {
        await usersFactory(database).traits.admin.create();

        expect(insert).toHaveBeenCalledWith(schema.users);
        expect(overridingSystemValue).toHaveBeenCalledTimes(1);
        expect(values).toHaveBeenCalledWith({
          id: 1,
          name: 'admin-1',
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
