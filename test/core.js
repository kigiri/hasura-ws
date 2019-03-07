import { execSync } from 'child_process'
import WebSocket from 'ws'
import { ok, fail, run } from './tester.js'
import { buildClient } from '../packages/core/index.js'

const initClient = buildClient(address => new WebSocket(address, 'graphql-ws'))

ok({
  description: 'I can query the graphql __schema',
  test: ({ run }) =>
    run(`
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
  description: 'I get an error if send a wrong query',
  test: ({ run }) => run('pouet'),
  expect: {
    message:
      'parsing ClientMessage failed: Error in $.payload.query: parsing the graphql query failed',
  },
})

const insertTestMutation = `
mutation insert_test($test: test_insert_input!) {
  insert_test (objects: [$test]) {
    returning { id }
  }
}
`

ok({
  description: 'I get the correct result on a successfull mutation',
  test: async ({ run }) => {
    const result = await run(insertTestMutation, {
      test: { requiredField: 'wesh' },
    })
    return typeof result.insert_test.returning[0].id
  },
  expect: 'number',
})

fail({
  description: 'I get an error if a mutation has no variables',
  test: ({ run }) => run(insertTestMutation, {}),
  expect: {
    code: 'validation-failed',
    message:
      'expecting a value for non-null type: test_insert_input! in variableValues',
    path: '$',
  },
})

fail({
  description: 'I get complex error if a mutation has wrong variables values',
  test: ({ run }) => run(insertTestMutation, { test: {} }),
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

// console.log('starting hasura test db...')
// execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml up -d`)

// setTimeout(() => asyncClient.connect({ adminSecret: 'TEST_ME' }), 1000)

run(() =>
  initClient({
    address: 'ws://localhost:3354/v1alpha1/graphql',
    adminSecret: 'TEST_ME',
    // debug: true,
  }),
)
  .then(() => console.log('all tests pass !'))
  .catch(err => {
    console.log('failed!')
    console.log(err)
    return 1
  })
  .then(exitCode => {
    console.log('stoping hasura test db...')
    // execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml down`)
    process.exit(exitCode || 0)
  })
