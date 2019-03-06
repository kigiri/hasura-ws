import { execSync } from 'child_process'
import { buildClient } from '../packages/core/index.js'
import { deepStrictEqual } from 'assert'
import WebSocket from 'ws'

export const initClient = buildClient(
  address => new WebSocket(address, 'graphql-ws'),
)

console.log('starting hasura test db...')
// execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml up -d`)

const client = initClient({
  address: 'ws://localhost:3354/v1alpha1/graphql',
  adminSecret: 'TEST_ME',
  debug: true,
})

//*/

const failed = []
const tests = []
const ok = ({ description, t, expect }) => {
  const count = tests.length + 1
  tests.push(async () => {
    console.log(count, description)
    deepStrictEqual(await t(), expect)
    console.log('success\n')
  })
}

const fail = ({ description, t, expect }) => {
  const count = tests.length + 1
  tests.push(() => {
    console.log(count, description)
    return t().then(
      result =>
        Promise.reject(Object.assign(Error('Should have failed'), { result })),
      err => deepStrictEqual({ ...err, message: err.message }, expect),
    )
  })
}

ok({
  description: 'I can query the graphql __schema',
  t: () =>
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
  description: 'I get an error if send a wrong query',
  t: () => client.run('pouet', ''),
  expect: {
    message:
      'parsing ClientMessage failed: Error in $.payload.query: parsing the graphql query failed',
  },
})

tests
  .reduce((q, t, i) => q.then(t), Promise.resolve())
  .catch(err => err)
  .then(err => {
    if (err) {
      console.log('failed!')
      console.log(err)
    } else {
      console.log('all tests pass !')
    }

    console.log('stoping hasura test db...')
    // execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml down`)

    process.exit(err ? 1 : 0)
  })
