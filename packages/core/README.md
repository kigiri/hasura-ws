# `@hasura-ws/core`

## `@hasura-ws/browser` or `@hasura-ws/node` (for `nodejs` only!)

### Initialize the client

```jsx
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
```jsx
const client = initClient({ address: 'ws://localhost:8080/v1alpha1/graphql' })

// later once you get the user token:
client.connect({ token: 'eyJhbGciOiJIUzI...w5c' })
```

### `client.run`

This method allow you to run queries and mutations.

Run takes 2 arguments:

- the query `(string)`
- optional variables `(object)`

```jsx
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

```jsx
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
