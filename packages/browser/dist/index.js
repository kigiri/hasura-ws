'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var core = require('@hasura-ws/core');

const initClient = core.buildClient(address => {
  const ws = new WebSocket(address, 'graphql-ws');
  ws.on = (type, listener) =>
    ws.addEventListener(type, event => listener(event.data));
  return ws
});

exports.initClient = initClient;
