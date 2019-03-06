import { execSync } from 'child_process'
import { deepStrictEqual } from 'assert'
import WebSocket from 'ws'
import { ok, fail, run } from './tester.js'
import { buildClient } from '../packages/core/index.js'

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

// console.log('starting hasura test db...')
// execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml up -d`)

run(() =>
  buildClient(address => new WebSocket(address, 'graphql-ws'))({
    address: 'ws://localhost:3354/v1alpha1/graphql',
    adminSecret: 'TEST_ME',
    //debug: true,
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
  
