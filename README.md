# `@hasura-ws`

Minimal javascript graphql websocket client for `hasura`

## `@hasura-ws/node` or `@hasura-ws/browser`

### Initialize the client

```js
import { initClient } from '@hasura-ws/browser' // or '@hasura-ws/node' in node

// the client can take 2 parameters
// the required websocket address
// and a jwt token (or the admin secret)
const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql', // (either ws:// or wss://)
  adminSecret: '9311f0d7b5caaa183', // your hasura secret
  token: 'eyJhbGciOiJIUzI...w5c', // or a valid JWT token
})
```

> `@hasura-ws/node` use `ws` as a websocket client

### `client.run`

This method allow you to run queries and mutations.

Run takes 2 arguments:

- the query `(string)`
- optional variables `(object)`

```js
// simple usage
const data = await client.run(`query {
  user {
    email
  }
}`)

console.log(data.result.user[0].email)

// with variables
const getUserByIdQuery = `query getUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`

const data = await client.run(getUserByIdQuery, { id: 1 })
console.log(data.result.user[0].email)
```

### `client.subscribe`

This method allow you to start subscriptions.

Run takes 3 arguments:

- the listener callback `(function)`
- the subscription query `(string)`
- optional variables `(object)`

```js
const subscribeToUserByIdQuery = `subscription subscribeToUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`

const { execution, unsubscribe } = client.subscribe(
  data => console.log(data.user[0].email),
  subscribeToUserByIdQuery,
  { id: 1 },
)

// execution is the promise of the subscribe,
//   it resolve when the query is completed.

// unsubscribe is a function to call to stop subscribing
```

### `client.ws`

This is the internal websocket client.

### `client.connection`

This is a promise of the pending connection, if you want to handle reconnect.

## `@hasura-ws/prepare`

Prepare a query, returning an async function to execute the query.

> Enable caching and share subscribes

### `initPrepare`

```js
import { initClient } from '@hasura-ws/browser'
import { initPrepare } from '@hasura-ws/prepare'

const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql', // (either ws:// or wss://)
  token: 'eyJhbGciOiJIUzI...w5c', // or a valid JWT token
})

const prepare = initPrepare(client) // pass ou client to prepare
```

### `prepare`

```js
// simple query
const getUserEmail = prepare(`query {
  user {
    email
  }
}`)

const data = await getUserEmail()
console.log(data.user[0].email)

// query with variables
const getUserEmail = prepare(`query getUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

const data = await getUserEmail({ id: 1 })
console.log(data.user[0].email)

// mutation with variables
const updateUser = prepare(`
mutation update_user($id: Int, $changes: user_set_input) {
  update_user(where: {id: {_eq: $id}}, _set: $changes) {
    affected_rows
  }
}`)

await updateUser({ id: 1, changes: { email: 'jean@email.com' } })

// subscription with variables
const userSubscribe = prepare(`
subscription subscribeToUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

userSubscribe(data => console.log(data.user[0].email), { id: 1 })
// a subscribe return the returned values of client.subscribe
```

## `@hasura-ws/hooks`

Hooks are used together with `prepare` to offer a react API to consume
queries

All hooks takes 3 arguments:

- the prepared query
- the variables
- the inputs passed to `useEffect` to tell react when to refresh

### `useQuery`

```js
import { initClient } from '@hasura-ws/browser'
import { initPrepare } from '@hasura-ws/prepare'
import { useQuery } from '@hasura-ws/hooks'

const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql',
  token: 'eyJhbGciOiJIUzI...w5c',
})

const prepare = initPrepare(client)

const getUserEmail = prepare(`query getUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

const MyQueryComponent = ({ id }) => {
  const emailQuery = useQuery(getUserEmail, { id }, [id])
  if (emailQuery.pending) return 'Loading...'
  if (emailQuery.error) return 'Oops !'
  const { email } = emailQuery.value.user[0]
  return <div>{email}</div>
}
```

### `useSubscribe`

```js
const MySubscribeComponent = ({ id }) => {
  const userQuery = useSubscribe(userSubscribe, { id }, [id])
  if (userQuery.pending) return 'Loading...'
  if (userQuery.error) return 'Oops !'
  const { email } = userQuery.value.user[0]
  return <div>{email}</div>
}
```

### `useMutation`

```js
const MyMutationComponent = ({ id }) => {
  const [email, setEmail] = useState()
  const updateUser = useMutation(updateUserMutation)

  return (
    <div>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <button
        disabled={updateUser.pending}
        onClick={() => updateUser.run({ id, changes: { email } })}
      />
      <pre>
        {String(updateUser.error)}
      </pre>
    </div>
}
```

## `@hasura-ws/model`

A model gives you a basic `CRUD` + `subscribe` for your data models

### Initialize a model

```js
import { initClient } from '@hasura-ws/browser'
import { initPrepare } from '@hasura-ws/prepare'
import { buildModel } from '@hasura-ws/model'

const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql',
  token: 'eyJhbGciOiJIUzI...w5c',
})

const prepare = initPrepare(client)
const initModel = buildModel(prepare)

const userModel = initModel('email firstname lastname')
```

### `model.add`

takes an object of the values to be inserted

```js
const id = await userModel.add({
  email: 'jean@email.com'
  firstname: 'Jean',
  lastname: 'Valjean',
})
id // 1
```

### `model.get`

takes an id

```js
const user = await userModel.get(1)
user.id // 1
user.email // 'jean@email.com'
user.firstname // 'Jean'
user.lastname // 'Valjean'
```

### `model.update`

takes a object of the changes (must include the id)

```js
await userModel.update({
  id: 1,
  email: 'jean@yahoo.fr',
})
```

### `model.subscribe`

takes an id and a subscription callback

```js
await userModel.subscribe(1, user => console.log(user))
```

### `model.remove`

takes an id

```js
await userModel.remove(1)
```

### `model.use...`

The model also expose react hooks for each actions:

- `useGet(id)`
- `useAdd({ a: 1, b: 2 }, [1, 2])`
- `useRemove(id)`
- `useUpdate({ id, a: 1, b: 2 }, [1, 2])`
- `useSubscribe(id)`

It's just the correct hook and the model method.

As such `useAdd` is a kind of `useMutation` for `user.add`.




