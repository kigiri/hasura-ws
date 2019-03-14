# `@hasura-ws/prepare`

Prepare a query, returning an async function to execute the query.

> Pre-stringify and share subscribes

## `initPrepare`

```js
import { initClient } from '@hasura-ws/browser'
import { initPrepare } from '@hasura-ws/prepare'

const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql', // (either ws:// or wss://)
  token: 'eyJhbGciOiJIUzI...w5c', // or a valid JWT token
})

const prepare = initPrepare(client) // pass the client to prepare
```

## `prepare`

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

// you can also specify how you want prepare to map your data with `.map`

const myUserSubscribe = userSubscribe.map(data => data.user[0].email)
myUserSubscribe(email => console.log('my email', email))

// the mapper function always takes the raw results from the client.

```
