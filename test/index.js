import { execSync } from 'child_process'
import { initClient } from '../packages/node/index.js'
import { deepStrictEqual } from 'assert'

console.log('starting hasura test db...')
execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml up -d`)

const client = initClient({
  address: 'ws://localhost:3354/v1alpha1/graphql',
  adminSecret: 'TEST_ME',
  // debug: true,
})

//*/

let passCount = 0
const tests = []
const test = (description, t, expect) => {
  const count = tests.length + 1
  tests.push(async () => {
    console.log(count, description)
    deepStrictEqual(await t(), expect)
    passCount++
    console.log('success\n')
  })
}

test('I can query the graphql __schema', () => client.run(`
query {
  __schema {
    queryType {
      name
    }
  }
}`, {
  __schema: {
    queryType: {
      name: 'query_root'
    }
  }
}))


tests.reduce((q, t) => q.then(t), Promise.resolve())
  .catch(err => err)
  .then(err => {
  if (err) {
    console.log('failed!')
    console.log(err)
  } else {
    console.log('all tests pass !')
  }

  console.log('stoping hasura test db...')
  execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml down`)

  process.exit(err ? 1 : 0)
})
