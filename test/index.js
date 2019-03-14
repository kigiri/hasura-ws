import { execSync } from 'child_process'
import WebSocket from 'ws'
import { buildClient } from '../packages/core/index.js'
import { run } from './tester.js'
import './prepare.js'
import './core.js'
import './model.js'

const initClient = buildClient(address => new WebSocket(address, 'graphql-ws'))

console.log('starting hasura test db...')
execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml up -d`)

// setTimeout(() => asyncClient.connect({ adminSecret: 'TEST_ME' }), 1000)

run(() => ({
  client: initClient({
    address: 'ws://localhost:3354/v1alpha1/graphql',
    adminSecret: 'TEST_ME',
    debug: true,
  }),
}))
  .then(() => console.log('all tests pass !'))
  .catch(err => {
    console.log('failed!')
    console.log(err)
    return 1
  })
  .then(exitCode => {
    if (process.execArgv.includes('--inspect')) {
      console.log('waiting for inspector to close')
    } else {
      console.log('stoping hasura test db...')
      // execSync(`sudo docker-compose -f ${__dirname}/docker-compose.yaml down`)
      process.exit(exitCode || 0)
    }
  })
