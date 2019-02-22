import WebSocket from 'ws'
import { buildClient } from '@hasura-ws/core'

export const initClient = buildClient(
  address => new WebSocket(address, 'graphql-ws'),
)
