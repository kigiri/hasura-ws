# `@hasura-ws`

Minimal javascript graphql websocket client for `hasura`


*!! VERY EARLY, UNSTABLE, BARELY TESTED, USE WITH CAUTION !!*

## Packages

hasura-ws suite is composed of 4 blocks:

### [`@hasura-ws/browser`](packages/core) or [`@hasura-ws/node`](packages/core)
The WebSocket hasura client

### [`@hasura-ws/prepare`](packages/prepare)
Pre-compile queries and add usefull methods to reduce graphql boilerplate

### [`@hasura-ws/model`](packages/model)
Generate boilerplate crud queries for your data model

### [`@hasura-ws/hooks`](packages/hooks)
React bindings


## Example

```jsx
import { initClient } from '@hasura-ws/browser'
import { initAll, isPending, hasError } from '@hasura-ws/hooks'

const { client, model, prepare } = initAll(initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql',
  debug: true, // show in the console detailed logs (verbose filter must be on)
}))

getJWTToken() // Assuming you have a way to get your token
  .then(token => client.connect({ token, role: 'user' }))

const userModel = model('user')(`
  email
`)

const MySubscribeComponent = ({ id }) => {
  const user = userModel.useSubscribe(id)
  if (isPending(user)) return 'Loading...'
  if (hasError(user)) return 'Oops !'
  if (!user) return 'User not found !'

  return <div>{user.email}</div>
}

```
