import { buildClient } from '@hasura-ws/core'

export const initClient = buildClient(address => {
  const ws = new WebSocket(address, 'graphql-ws')
  ws.on = (type, listener) =>
    ws.addEventListener(type, event => listener(event.data))
  return ws
})
