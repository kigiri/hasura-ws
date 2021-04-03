import { execSync } from 'child_process'
import WebSocket from 'ws'
import { buildClient } from '../packages/core/index.js'
import { run } from './tester.js'
import './prepare.js'
import './core.js'
import './model.js'


process.stdout.isTTY = true
process.stderr.hasColors = () => true
process.stderr.isTTY = true

const initClient = buildClient(
  (address) => new WebSocket(address, 'graphql-ws'),
)

// console.log('starting hasura test db...')
// execSync(`docker-compose -f ./test/docker-compose.yaml up -d`)
console.log('resetting database...')
execSync(`hasura migrate apply --endpoint http://localhost:3354 --down 2`, {
 cwd: `./test/hasura`,
})
execSync(`hasura migrate apply --endpoint http://localhost:3354`, {
 cwd: `./test/hasura`,
})

console.log('connecting...')
const exitCode = await run(() => ({
  client: initClient({
    address: 'ws://localhost:3354/v1/graphql',
    adminSecret: 'TEST_ME',
    // debug: true,
  }),
})).then(
  () => console.log('all tests pass !'),
  (err) => {
    console.log('failed!')
    console.log(err)
    return 1
  },
)

if (process.execArgv.includes('--inspect')) {
  console.log('waiting for inspector to close')
} else {
  console.log('stoping hasura test db...')
  // execSync(`sudo docker-compose -f ./test/docker-compose.yaml down`)
  process.exit(exitCode || 0)
}
