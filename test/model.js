import { initAll } from '../packages/hooks/index.js'
import { ok, fail } from './tester.js'
import { div, h2, hh } from 'react-hyperscript-helpers'
import { types, isFunction } from 'util'

/*
 * Setup
 */
ok({
  description: 'model: I can init prepare and build my model',
  test: context => {
    Object.assign(context, initAll(context.client))
    return isFunction(context.model) && isFunction(context.prepare)
  },
  expect: true,
})

const getAllPrepareMethods = preparedQuery => [
  preparedQuery,
  preparedQuery.all,
  preparedQuery.one,
  preparedQuery.map,
]

ok({
  description: 'model: I can create a test model',
  test: context => {
    const testModel = (context.test = context.model('test')(`
      requiredField
    `))

    return [
      // Prepared queries
      ...getAllPrepareMethods(testModel.deleteQuery),
      ...getAllPrepareMethods(testModel.updateQuery),
      ...getAllPrepareMethods(testModel.insertQuery),
      ...getAllPrepareMethods(testModel.selectQuery),
      ...getAllPrepareMethods(testModel.subscribeQuery),

      // CRUD methods
      testModel.remove,
      testModel.update,
      testModel.add,
      testModel.get,
      testModel.subscribe,

      // Hooks
      testModel.useRemove,
      testModel.useUpdate,
      testModel.useAdd,
      testModel.useGet,
      testModel.useSubscribe,
    ].every(isFunction)
  },
  expect: true,
})

/*
 * Model.add
 */
ok({
  description: 'model.add: Adding a single element',
  test: async ({ test }) => {
    const id = await test.add({ requiredField: 'wesh-1' })
    return typeof id
  },
  expect: 'number',
})

ok({
  description: 'model.add: Adding multiple element',
  test: async context => {
    const ids = await context.test.add([
      { requiredField: 'wesh-2' },
      { requiredField: 'wesh-3' },
    ])
    context.ids = ids // used for testing get, update and remove later on
    return [typeof ids[0], typeof ids[1]]
  },
  expect: ['number', 'number'],
})

fail({
  description:
    'model.add: I get an error if I try to add without the required fields',
  test: ({ test }) => test.add({}),
  expect: {
    code: 'constraint-violation',
    data: null,
    errors: [
      {
        code: 'constraint-violation',
        error:
          'Not-NULL violation. null value in column "requiredField" violates not-null constraint',
        path: '$.selectionSet.insert_test.args.objects',
      },
    ],
    message:
      'Not-NULL violation. null value in column "requiredField" violates not-null constraint',
    path: '$.selectionSet.insert_test.args.objects',
  },
})

/*
 * Model.get
 */
const getFirstInsertedElementRequiredField = async ({ test, ids }) => {
  const element = await test.get(ids[0])
  if (element.id !== ids[0]) {
    throw Error('Element id missmatch')
  }
  return element.requiredField
}

ok({
  description: 'model.get: I can get elements',
  test: getFirstInsertedElementRequiredField,
  expect: 'wesh-2',
})

ok({
  description: 'model.get: Not found element should return undefined',
  test: ({ test, ids }) => test.get(ids[1] + 1),
})

fail({
  description: 'model.get: wrong key type should fail',
  test: ({ test }) => test.get('pouet'),
  expect: {
    code: 'data-exception',
    data: null,
    errors: [
      {
        code: 'data-exception',
        error: 'invalid input syntax for integer: "pouet"',
        path: '$',
      },
    ],
    message: 'invalid input syntax for integer: "pouet"',
    path: '$',
  },
})

/*
 * Model.update
 */
ok({
  description: 'model.update: I can update an element',
  test: ({ test, ids }) => test.update({ id: ids[0], requiredField: 'yep' }),
  expect: { affected_rows: 1 },
})

ok({
  description: 'model.get: I can get the updated element',
  test: getFirstInsertedElementRequiredField,
  expect: 'yep',
})

fail({
  description: 'model.update: I get an error if I mix a field type',
  test: ({ test, ids }) => test.update({ id: ids[0], requiredField: 1 }),
  expect: {
    code: 'parse-failed',
    message: 'expected Text, encountered Number',
    path: '$.variableValues.requiredField',
  },
})

/*
 * Model.subscribe
 */

const shouldChange = async (data, timeout = 2000) => {
  let interval
  const currentSize = data.length
  try {
    await new Promise((s, f) => {
      setTimeout(f, timeout, Error('Update subscribe took too long'))
      interval = setInterval(() => data.length > currentSize && s())
    })
  } finally {
    clearInterval(interval)
  }
}

ok({
  description: 'model.subscribe: I can subscribe to an element',
  test: async ({ test, ids: [id] }) => {
    const data = []
    const { unsubscribe, execution } = test.subscribe(e => data.push(e), id)

    await execution

    if (!data.length) {
      throw Error('I should have recieve the initial value after execution')
    }

    if (data[0].requiredField !== 'yep') {
      throw Error(`Unexpected requiredField value: ${data[0].requiredField}`)
    }

    await test.update({ id, requiredField: 'updated' })
    await shouldChange(data)
    unsubscribe()
    await test.update({ id, requiredField: 'after-math' })

    return data.map(e => e.requiredField)
  },
  expect: ['yep', 'updated'],
})

fail({
  description: 'model.subscribe: subscribing with an invalid id should fail',
  test: ({ test }) => test.subscribe(_ => _, 'pouet').execution,
  expect: {
    data: null,
    path: '$',
    code: 'data-exception',
    message: 'invalid input syntax for integer: "pouet"',
    errors: [
      {
        extensions: {
          code: 'data-exception',
          path: '$',
        },
        message: 'invalid input syntax for integer: "pouet"',
      },
    ],
  },
})
