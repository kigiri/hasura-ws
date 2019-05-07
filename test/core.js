import { ok, fail, run } from './tester.js'
import { insertTestMutation } from './queries.js'

ok({
  description: 'client.run: I can query the graphql __schema',
  test: ({ client }) =>
    client.run(`
  query {
    __schema {
      queryType {
        name
      }
    }
  }`),
  expect: {
    __schema: {
      queryType: {
        name: 'query_root',
      },
    },
  },
})

fail({
  description: 'client.run: I get an error if send a wrong query',
  test: ({ client }) => client.run('pouet'),
  expect: {
    code: 'validation-failed',
    message: 'not a valid graphql query',
    path: '$.query',
  },
})

ok({
  description: 'client.run: I get the correct result on a successfull mutation',
  test: async ({ client }) => {
    const result = await client.run(insertTestMutation, {
      test: { requiredField: 'wesh' },
    })
    return typeof result.insert_test.returning[0].id
  },
  expect: 'number',
})

fail({
  description: 'client.run: I get an error if a mutation has no variables',
  test: ({ client }) => client.run(insertTestMutation, {}),
  expect: {
    code: 'validation-failed',
    message: 'expecting a value for non-nullable variable: test of type: test_insert_input! in variableValues',
    path: '$.variableValues',
  },
})

fail({
  description: 'client.run: I get complex error if a mutation has wrong variables values',
  test: ({ client }) => client.run(insertTestMutation, { test: {} }),
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
