import { initPrepare } from '../packages/prepare/index.js'
import { ok, fail } from './tester.js'
import { isFunction } from 'util'

const a = { id: 1, field: 'value-a' }
const b = { id: 2, field: 'value-b' }
const c = { id: 3, field: 'value-c' }
const prepare = initPrepare({
  runFromString: query => ({
    first: [a, b],
    second: [c],
    __meta: { type: 'query', query },
  }),
  subscribeFromString: (sub, query) =>
    sub({
      first: [a, b],
      second: [c],
      __meta: { type: 'subscription', query },
    }),
})

// get the value from a subscribe
const call = (sub, v) => (sub(_ => (v = _)), v)

ok({
  description: 'prepare: I can prepare query',
  test: context =>
    isFunction(
      (context.query = prepare(`query ($id: Int!) {
      test (where: {id: {_eq: $id}} limit: 1) {
        id
        requiredField
      }
    }`)),
    ),
  expect: true,
})

ok({
  description: 'prepare: I can prepare subscription',
  test: context =>
    isFunction(
      (context.subscription = prepare(`subscription ($id: Int!) {
      test (where: {id: {_eq: $id}} limit: 1) {
        id
        requiredField
      }
    }`)),
    ),
  expect: true,
})

ok({
  description: 'prepare: The query type was guessed properly',
  test: async context => (await context.query.all()).__meta.type,
  expect: 'query',
})

ok({
  description: 'prepare: The subscription type was guessed properly',
  test: context => call(context.subscription.all).__meta.type,
  expect: 'subscription',
})

ok({
  description: 'prepare: Running the prepared query only return the first value',
  test: context => context.query(),
  expect: [a, b],
})

ok({
  description: 'prepare: Running the prepared subscription only return the first value',
  test: context => call(context.subscription),
  expect: [a, b],
})

ok({
  description: 'prepare: Running query.all return all values',
  test: async context => {
    const { __meta, ...rest } = await context.query.all()
    return rest
  },
  expect: { first: [a, b], second: [c] },
})

ok({
  description: 'prepare: Running subscription.all return all values',
  test: async context => {
    const { __meta, ...rest } = call(context.subscription.all)
    return rest
  },
  expect: { first: [a, b], second: [c] },
})

ok({
  description: 'prepare: Running subscription.one return [0] of the first values',
  test: context => call(context.subscription.one),
  expect: a,
})

ok({
  description: 'prepare: Running query.one return [0] of the first values',
  test: context => context.query.one(),
  expect: a,
})
