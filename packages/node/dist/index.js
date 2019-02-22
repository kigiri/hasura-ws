'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var WebSocket = _interopDefault(require('ws'));
var core = require('@hasura-ws/core');

const initClient = core.buildClient(address => new WebSocket(address, 'graphql-ws'));

exports.initClient = initClient;
