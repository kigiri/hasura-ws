# `@hasura-ws/hooks`

Hooks are used together with `prepare` to offer a react API to consume
queries

All hooks takes 3 arguments:

- the prepared query
- the variables
- the inputs passed to `useEffect` to tell react when to refresh

## `useQuery`

```jsx
import { initClient } from '@hasura-ws/browser'
import { initPrepare } from '@hasura-ws/prepare'
import { useQuery, isPending, hasError, isReloading } from '@hasura-ws/hooks'

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
  const users = useQuery(getUserEmail, { id }, [id])

  if (isPending(users)) return 'Loading...'
  if (hasError(users)) return 'Oops !'
  if (!users.length) return 'Not found'

  const { email } = users[0]
  return <div class={isReloading(users) ? 'loading' : ''}>{email}</div>
}

// Or using `.one` to get one user directly:
const MyQueryComponent = ({ id }) => {
  const user = useQuery(getUserEmail.one, { id }) // we can also omit inputs

  // Omitted inputs are generated using Object.values(variables),
  // so it is equivalent to [ id ] in that case.

  if (isPending(user)) return 'Loading...'
  if (hasError(user)) return 'Oops !'
  if (!user) return 'Not found'

  return <div>{user.email}</div>
}
```

## `useSubscribe`

```jsx
const userSubscribe = prepare(`
subscription subscribeToUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

const MySubscribeComponent = ({ id }) => {
  const user = useSubscribe(userSubscribe.one, { id }, [id])
  if (isPending(user)) return 'Loading...'
  if (hasError(user)) return 'Oops !'
  if (!user) return 'Not found'

  return <div>{user.email}</div>
}
```

## `useMutation`

```jsx
// You should try have the useMutation in it's separate component
// so that the pending update doesn't trigger a rerender of the rest
// of your app.
const MyUpdateButton = ({ id, email, showMessage }) => {
  const updateUser = useMutation(updateUserMutation)

  return (
    <button
      disabled={updateUser.pending}
      onClick={
        () =>
          updateUser.run({ id, changes: { email } })
            .then(() => showMessage('update successfull'))
            .catch(err => showMessage(`update failed: ${err.message}`))
            // With mutations, you need to handle errors manualy
            // they arent catched and passed for you.
      }
    />
  )
}

const MyMutationComponent = ({ id }) => {
  const [email, setEmail] = useState()
  const [message, setMessage] = useState('')

  return (
    <div>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <MyUpdateButton email={email} id={id} setMessage={message} />
      <pre>{message}</pre>
    </div>
  )
}
```

## `prepareWithHooks`
A prefered version of `prepare` that also add hooks to your query.

```jsx
import { initClient } from '@hasura-ws/browser'
import { initPrepareWithHooks, hasError, isPending } from '@hasura-ws/hooks'

const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql',
  token: 'eyJhbGciOiJIUzI...w5c',
})

const prepare = initPrepareWithHooks(client)

const userSubscribe = prepare(`
subscription subscribeToUserById($id: Int!) {
  user (where: {id: {_eq: $id}}) {
    email
  }
}`)

// prepare hooks gives a hook for each prepare methods:
// use, useOne, useAll and useMap.

// Here an example of useOne:
const MySubscribeComponent = ({ id }) => {
  const user = userSubscribe.useOne({ id })
  if (isPending(user)) return 'Loading...'
  if (hasError(user)) return 'Oops !'
  if (!user) return 'User not found !'

  return <div>{user.email}</div>
}

```

## `buildModelWithHooks`
```js
import { initClient } from '@hasura-ws/browser'
import { buildModelWithHooks, initPrepareWithHooks } from '@hasura-ws/hooks'

const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql',
  token: 'eyJhbGciOiJIUzI...w5c',
})

const prepare = initPrepareWithHooks(client)
const model = buildModelWithHooks(prepare)

```


Using hooks, the model also expose a react hooks for each actions:

- `.useGet(id)`
- `.useAdd({ a: 1, b: 2 }, [1, 2])`
- `.useRemove(id)`
- `.useUpdate({ id, a: 1, b: 2 }, [1, 2])`
- `.useSubscribe(id)`

It's just the correct hook and the model method.

As such `useAdd` is `useMutation` for `user.add`.

### `model.useUpdate`

```jsx
const MyComponent = ({ userId }) => {
  const updateUser = userModel.useUpdate()

  return (
    <button
      disabled={updateUser.pending}
      onClick={() => updateUser.run({ id: userId, email: 'jean@mail.com' })}
    />
  )
}
```

## `initAll`

This can be use to combine `prepareWithHooks` and `buildModelWithHooks`

```js
import { initClient } from '@hasura-ws/browser'
import { initAll } from '@hasura-ws/hooks'

const { client, model, prepare } = initAll(initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql',
  token: 'eyJhbGciOiJIUzI...w5c',
}))
```
