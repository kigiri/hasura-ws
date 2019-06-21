# `@hasura-ws/model`

A model gives you a basic `CRUD` + `subscribe` for your data models

## Initialize a model

```js
import { initClient } from '@hasura-ws/browser'
import { initPrepare } from '@hasura-ws/prepare'
import { buildModel } from '@hasura-ws/model'

const client = initClient({
  address: 'ws://localhost:8080/v1alpha1/graphql',
  token: 'eyJhbGciOiJIUzI...w5c',
})

// if you want react hooks, use initPrepareWithHooks from @hasura-ws/hooks
const prepare = initPrepare(client)
const initModel = buildModel(prepare)

// initModel takes 2 arguments: the table name and the field names
const userModel = initModel('user')(`
  email
  firstname
  lastname
`)
```

## `model.add`

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

## `model.get`

takes an id

```js
const user = await userModel.get(1)
user.id // 1
user.email // 'jean@email.com'
user.firstname // 'Jean'
user.lastname // 'Valjean'
```

or an array of ids

```js
const users = await userModel.get([1, 2])
users[0].email // 'jean@email.com'
users[1].email // 'geger@hotmail.com'
```


## `model.update`

takes an object of the changes (including the id)

```js
await userModel.update({ id: 1, email: 'jean@yahoo.fr' })
```

or a an object of the changes and the id

```js
await userModel.update({ email: 'jean@yahoo.fr' }, 1)
```

or a an object of the changes and an array of ids

```js
await userModel.update({ email: 'jean@yahoo.fr' }, [1, 2])
```

## `model.subscribe`

takes a subscription callback and an id

```js
const { execution, unsubscribe } = userModel.subscribe(
  user => console.log(user),
  1,
)
```


or an array of ids and a subscription callback

```js
const { execution, unsubscribe } = userModel.subscribe(
  users => console.log(users),
  [1, 2],
)
```

## `model.remove`

takes an id

```js
await userModel.remove(1)
```

or an array of id

```js
await userModel.remove([1, 2])
```
