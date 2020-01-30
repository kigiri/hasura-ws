import { initPrepare } from '../packages/prepare/index.js'
import { buildModel } from '../packages/model/index.js'
import { ok, fail } from './tester.js'
import { types, isFunction } from 'util'

/*
 * Setup
 */
ok({
  description: 'model: I can init prepare and build my model',
  test: context => {
    context.prepare = initPrepare(context.client)
    context.model = buildModel(context.prepare)
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
    ].every(isFunction)
  },
  expect: true,
})

/*
 * Model.add
 */
ok({
  description: 'model.add: Adding a single element',
  test: async context => {
    const id = await context.test.add({ requiredField: 'wesh-1' })
    context.firstId = id
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
  description: 'model.get: I can get one element',
  test: getFirstInsertedElementRequiredField,
  expect: 'wesh-2',
})

ok({
  description: 'model.get: I can get multiple elements',
  test: async ({ test, ids }) => (await test.get(ids)).map(r => r.requiredField),
  expect: [ 'wesh-2', 'wesh-3' ]

ok({
  description: 'model.get: I can get elements for pagination with count',
  test: async ({ test }) =>
    await test.getPaginatedWithCount({
      where: {},
      offset: 0,
      limit: 10,
      orderBy: {},
    }),
  expect: {
    test: [
      { requiredField: 'wesh' },
      { requiredField: 'wesh-1' },
      { requiredField: 'wesh-2' },
      { requiredField: 'wesh-3' },
    ],
    count: 4,
  },
})

ok({
  description:
    'model.get: I can get paginated (filtered, limited, sorted) elements with count',
  test: async ({ test }) =>
    await test.getPaginatedWithCount({
      where: { requiredField: { _neq: 'wesh-1' } },
      offset: 1,
      limit: 1,
      orderBy: { requiredField: 'desc' },
    }),
  expect: {
    test: [{ requiredField: 'wesh-2' }],
    count: 1,
  },
})

ok({
  description: 'model.get: Not found element should return undefined',
  test: ({ test, ids }) => test.get(ids[1] + 1),
})

ok({
  description: 'model.get: I can use a custom where query instead of id',
  test: async ({ test, ids }) => {
    const [element] = await test.get({ id: { _eq: ids[0] } })
    if (element.id !== ids[0]) {
      throw Error('Element id missmatch')
    }
    return element.requiredField
  },
  expect: 'wesh-2',
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
  test: ({ test, ids }) => test.update({ id: ids[0], requiredField: 'plop' }),
  expect: { affected_rows: 1 },
})

ok({
  description: 'model.get: I can get the updated element',
  test: getFirstInsertedElementRequiredField,
  expect: 'plop',
})

ok({
  description: 'model.update: I can update multiple elements',
  test: ({ test, ids }) => test.update({ requiredField: 'yep' }, ids),
  expect: { affected_rows: 2 },
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
    path: '$.variableValues.changes.requiredField'
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

    await test.update({ requiredField: 'updated' }, id)
    await shouldChange(data)
    unsubscribe()
    await test.update({ requiredField: 'after-math' }, id)

    return data.map(e => e.requiredField)
  },
  expect: ['yep', 'updated'],
})

ok({
  description: 'model.subscribe: I can subscribe to multiple elements',
  test: async ({ test, ids }) => {
    const data = []
    const { unsubscribe, execution } = test.subscribe(e => data.push(e), ids)

    await execution

    if (!data.length) {
      throw Error('I should have recieve the initial value after execution')
    }

    const requireFields = data[0].map(e => e.requiredField).sort().join()
    if (requireFields !== 'after-math,yep') {
      throw Error(`Unexpected requiredField value: ${requireFields}`)
    }

    await test.update({ requiredField: 'updated' }, ids)
    await shouldChange(data)
    unsubscribe()
    await test.update({ requiredField: 'after-math' }, ids)

    return data.flat().map(e => e.requiredField).sort()
  },
  expect: ['yep', 'after-math', 'updated', 'updated'].sort(),
})

fail({
  description: 'model.subscribe: subscribing with an invalid id should fail',
  test: ({ test }) => test.subscribe(_ => _, 'pouet').execution,
  expect: {
    path: '$',
    code: 'data-exception',
    message: 'invalid input syntax for integer: "pouet"',
  },
})


/*
 * Model.remove
 */
ok({
  description: 'model.remove: Removing a single element',
  test: ({ test, ids }) => test.remove(ids.pop()),
  expect: { affected_rows: 1 },
})

ok({
  description: 'model.remove: Removing multiple element',
  test: ({ test, ids, firstId }) => test.remove([firstId, ...ids]),
  expect: { affected_rows: 2 },
})

ok({
  description: 'model.remove: Clean db for next test running',
  test: async ({ test }) => {
    const elements = (await test.get({
      requiredField: { _ilike: `%wesh%` },
    })).map(({ id }) => id)

    return test.remove(elements)
  },
  expect: { affected_rows: 1 },
})
