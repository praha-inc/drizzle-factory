# @praha/drizzle-factory

[![npm version](https://badge.fury.io/js/@praha%2Fdrizzle-factory.svg)](https://www.npmjs.com/package/@praha/drizzle-factory)
[![npm download](https://img.shields.io/npm/dm/@praha/drizzle-factory.svg)](https://www.npmjs.com/package/@praha/drizzle-factory)
[![license](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/praha-inc/drizzle-factory/blob/main/LICENSE)
[![Github](https://img.shields.io/github/followers/praha-inc?label=Follow&logo=github&style=social)](https://github.com/orgs/praha-inc/followers)

## 👏 Getting Started

### Installation

```bash
npm install @praha/drizzle-factory
```

### Usage

#### Defining a Factory

You can define a factory using the `defineFactory` function. This function allows you to specify a schema, table, and resolver function that determines how data is generated.

```ts
import { defineFactory } from '@praha/drizzle-factory';
// Replace with appropriate module for other databases (e.g., 'drizzle-orm/mysql-core' for MySQL)
import { pgTable, text, integer } from 'drizzle-orm/pg-core';

const schema = {
  users: pgTable('users', {
    id: integer().notNull(),
    name: text().notNull(),
  }),
};

const usersFactory = defineFactory({
  schema,
  table: 'users',
  resolver: ({ sequence }) => ({
    // `sequence` is an auto-incrementing value that increases each time a new record is generated.
    id: sequence,
    name: `name-${sequence}`,
  }),
});
```

#### Creating Records

The `create` function allows you to generate and insert records into the database. You can generate:

- A single record:
```ts
const user = await usersFactory(database).create();
console.log(user);
/*
{
  id: 1,
  name: 'name-1',
}
 */
```

- Multiple records:
```ts
const users = await usersFactory(database).create(3);
console.log(users);
/*
[
  { id: 1, name: 'name-1' },
  { id: 2, name: 'name-2' },
  { id: 3, name: 'name-3' },
]
 */
```

- A record with specific values:
```ts
const user = await usersFactory(database).create({ name: 'John Doe' });
console.log(user);
/*
{
  id: 1,
  name: 'John Doe',
}
 */

const users = await usersFactory(database).create([{ name: 'John Doe' }, { name: 'Jane Doe' }]);
console.log(users);
/*
[
  { id: 1, name: 'John Doe' },
  { id: 2, name: 'Jane Doe' },
]
 */
```

#### Using Other Factories within a Resolver

The `use` function inside a resolver allows you to utilize other factories when generating data. This is useful for creating related records automatically.

```ts
const postsFactory = defineFactory({
  schema,
  table: 'posts',
  resolver: ({ sequence, use }) => ({
    id: sequence,
    // When using `use`, wrap it in a function to ensure it is only executed when needed.
    // This prevents unnecessary data creation when `userId` is explicitly specified.
    userId: () => use(usersFactory).create().then((user) => user.id),
    title: `title-${sequence}`,
  }),
});
```

With this setup, calling `postsFactory.create()` will automatically generate a related user record if `userId` is not provided.

```ts
const post = await postsFactory(database).create();
console.log(post);
/*
{
  id: 1,
  userId: 1, // Auto-generated user
  title: 'title-1',
}
 */
```

#### Using Traits

Traits allow you to define variations of a factory. You can define a factory with traits like this:

```ts
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
```

Using a trait:

```ts
const adminUser = await usersFactory(database).traits.admin.create();
console.log(adminUser);
/*
{
  id: 1,
  name: 'admin-1',
}
 */
```

#### Composing Factories

You can compose multiple factories into a single factory using `composeFactory`. This is useful when dealing with related tables.

```ts
import { composeFactory } from 'drizzle-factory';

const factory = composeFactory({
  users: usersFactory,
  posts: postsFactory,
});

const user = await factory(database).users.create();
console.log(user);
/*
{
  id: 1,
  name: 'name-1',
}
 */

const post = await factory(database).posts.create({ userId: user.id });
console.log(post);
/*
{
  id: 1,
  userId: 1,
  title: 'title-1',
}
 */
```

#### Resetting Sequences

Each factory keeps an internal `sequence` number that auto-increments with every new record. If you want to reset this sequence (e.g., between test cases), you can call the `resetSequence` method.

- Resetting an individual factory’s sequence:

```ts
const users = await usersFactory(database).create(2);
console.log(users);
/*
[
  { id: 1, name: 'name-1' },
  { id: 2, name: 'name-2' },
]
 */

usersFactory.resetSequence();
const user = await usersFactory(database).create();
console.log(user);
/*
{
  id: 1,
  name: 'name-1',
}
 */
```

- Resetting sequences on a composed factory:

If you're using composeFactory, you can reset the sequence for all included factories by calling resetSequence() on the composed factory.

```ts
const factory = composeFactory({
  users: usersFactory,
  posts: postsFactory,
});

const users = await factory(database).users.create(2);
const posts = await factory(database).posts.create([{ userId: users[0].id }, { userId: users[1].id }]);
console.log(users, posts);
/*
[
  { id: 1, name: 'name-1' },
  { id: 2, name: 'name-2' },
]
[
  { id: 1, userId: 1, title: 'title-1' },
  { id: 2, userId: 2, title: 'title-2' },
]
 */

factory.resetSequence();
const user = await factory(database).users.create();
const post = await factory(database).posts.create({ userId: user.id });
console.log(user, post);
/*
{
  id: 1,
  name: 'name-1',
}
{
  id: 1,
  userId: 1,
  title: 'title-1',
}
 */
```

## 🤝 Contributing

Contributions, issues and feature requests are welcome.

Feel free to check [issues page](https://github.com/praha-inc/drizzle-factory/issues) if you want to contribute.

## 📝 License

Copyright © [PrAha, Inc.](https://www.praha-inc.com/)

This project is [```MIT```](https://github.com/praha-inc/drizzle-factory/blob/main/LICENSE) licensed.
