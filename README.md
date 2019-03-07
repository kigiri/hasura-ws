# `@hasura-ws`

Minimal javascript graphql websocket client for `hasura`


*!! VERY EARLY, UNSTABLE, BARELY TESTED, USE WITH CAUTION !!*


## `@hasura-ws/browser` or `@hasura-ws/node` (for `nodejs` only!)

### Initialize the client

```js
import { initClient } from '@hasura-ws/browser'

// the client can take 2 parameters
// the required websocket address
// and a jwt token (or the admin secret)
const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql', // (either ws:// or wss://)
  debug: false, // log additional information for sent and recieved messages

  // Crendentials :
  adminSecret: '9311f0d7b5caaa183', // your hasura secret
  token: 'eyJhbGciOiJIUzI...w5c', // or a valid JWT token
})

```

You can also delay the connection by passing the crendentials later on:
```js
const client = initClient({ address: 'ws://localhost:8080/v1alpha1/graphql' })

// later once you get the user token:
client.connect({ token: 'eyJhbGciOiJIUzI...w5c' })
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

const prepare = initPrepare(client) // pass the client to prepare
```

### `prepare`

```js
// simple query
const getUserEmail = prepare(`query {
  user {
    email
  }
}`)

const users = await getUserEmail()
console.log(users[0].email)

// query with variables
const getUserEmail = prepare(`query getUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

// by default the function return only the first ressource:
const users = await getUserEmail({ id: 1 })
console.log(users[0].email)

// you can get the untouched client result with `.all`:
const data = await getUserEmail.all({ id: 1 })
console.log(data.user[0].email)

// If your query is limited to 1 result, you can access it with `.one`:
const user = await getUserEmail.one({ id: 1 })
console.log(user.email)

// in all of those case, you can bypass the cache with `.noCache`
getUserEmail.noCache({ id: 1 })
getUserEmail.noCache.all({ id: 1 })
getUserEmail.noCache.one({ id: 1 })

// mutation with variables
const updateUser = prepare(`
mutation update_user($id: Int, $changes: user_set_input) {
  update_user(where: {id: {_eq: $id}}, _set: $changes) {
    affected_rows
  }
}`)

// by default it only returns the results of the first mutation,
// but like in queries you have `.all` if you do multiple mutations at once.
const result = await updateUser({ id: 1, changes: { email: 'jean@email.com' } })

console.log(result.affected_rows)

// subscription with variables
const userSubscribe = prepare(`
subscription subscribeToUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

// a subscribe return the returned values of client.subscribe
const { execution, unsubscribe } = userSubscribe(
  user => console.log(user[0].email), // callback
  { id: 1 }, // variables
)

// like queries you can use `.one`, here, you get the first user directly
userSubscribe.one(({ email }) => console.log(email), { id: 1 })

// and you get `.all` for having the raw result from the client
userSubscribe.all(data => console.log(data.user[0].email), { id: 1 })

// subscriptions are live so never cached, no `.noCache` here
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
  const { email } = emailQuery.user[0]
  return <div>{email}</div>
}

// Or using `.one` to get one user directly:
const MyQueryComponent = ({ id }) => {
  const { pending, error, user } = useQuery.one(getUserEmail, { id }, [id])
  if (pending) return 'Loading...'
  if (error) return 'Oops !'
  return <div>{user.email}</div>
}
```

### `useSubscribe`

```js
const userSubscribe = prepare(`
subscription subscribeToUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

const MySubscribeComponent = ({ id }) => {
  const userQuery = useSubscribe(userSubscribe, { id }, [id])
  if (userQuery.pending) return 'Loading...'
  if (userQuery.error) return 'Oops !'
  const { email } = userQuery.user[0]
  return <div>{email}</div>
}
```

> `useSubscribe` also has a `.one` method and it works exactly like `useQuery`

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

// initModel takes 2 arguments: the table name and the field names
const userModel = initModel('user')(`
  email
  firstname
  lastname
`)
```

### `model.add`

takes an object of the values to be inserted

```js
// adding a single element
const id = await userModel.add({
  email: 'jean@email.com'
  firstname: 'Jean',
  lastname: 'Valjean',
})
id // 1


// or an array of elements
const ids = await userModel.add([
  {
    email: 'jean@email.com'
    firstname: 'Jean',
    lastname: 'Valjean',
  },
  {
    email: 'geger@hotmail.com'
    firstname: 'Geraldine',
    lastname: 'Mercado',
  }
])

ids // [ 1, 2 ]
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
const { execution, unsubscribe } = userModel.subscribe(1, user =>
  console.log(user),
)
```

### `model.remove`

takes an id

```js
await userModel.remove(1)
```

### `model.use...`

The model also expose react hooks for each actions:

- `useGet(id)`
- `useGet.one(id)`
- `useAdd({ a: 1, b: 2 }, [1, 2])`
- `useRemove(id)`
- `useUpdate({ id, a: 1, b: 2 }, [1, 2])`
- `useSubscribe(id)`
- `useSubscribe.one(id)`

It's just the correct hook and the model method.

As such `useAdd` is a kind of `useMutation` for `user.add`.


### `model.useUpdate`

```jsx
const MyComponent = ({ userId }) => {
  const updateUser = userModel.useUpdate(userId)

  return (
    <button
      disabled={updateUser.pending}
      onClick={() => updateUser.run({ email: 'jean@mail.com' })}
    />
  )
}
```

