'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class HasuraError extends Error {
  constructor({
    error,
    ...props
  }) {
    super(error);
    Object.assign(this, ...props);
    Error.captureStackTrace(this, HasuraError);
  }

}

const stringify = fn => (query, variables) => fn(JSON.stringify({
  query,
  variables
}));

const buildClient = openWebSocket => ({
  address,
  adminSecret,
  token
}) => {
  const ws = openWebSocket(address);
  const handlers = new Map();
  const subscribers = new Map();
  ws.on('open', () => ws.send(JSON.stringify({
    type: 'connection_init',
    payload: {
      headers: adminSecret ? {
        'x-hasura-admin-secret': adminSecret
      } : {
        Authorization: `Bearer ${token}`
      }
    }
  })));

  const getId = () => {
    const id = Math.random().toString(36).slice(2);
    return handlers.has(id) ? getId() : id;
  };

  const rejectAllPending = err => {
    subscribers.clear(); // TODO: store subscribers query and re-trigger them

    for (const [id, {
      reject
    }] of handlers) {
      handlers.delete(id);
      reject(err);
    }

    return err;
  };

  const connection = new Promise((resolve, reject) => {
    ws.on('error', event => reject(rejectAllPending(new HasuraError({
      error: 'WebSocket connection failed',
      event
    }))));
    ws.on('close', event => reject(rejectAllPending(new HasuraError({
      error: 'WebSocket connection closed',
      event
    }))));
    ws.on('message', data => {
      if (data === '{"type":"ka"}') return; // ignore keep alive

      const {
        type,
        payload,
        id
      } = JSON.parse(data);
      const handler = handlers.get(id);

      switch (type) {
        case 'connection_ack':
          return resolve(payload);

        case 'connection_error':
          return reject(new HasuraError(payload));

        case 'data':
          const sub = subscribers.get(id);

          if (sub) {
            sub(payload.data);

            if (handler) {
              handler.resolve();
              handlers.delete(id);
            }

            break;
          }

        case 'error':
          handler && (handler[type] = payload);
          break;

        case 'complete':
          if (!handler) return; // should never happen

          handlers.delete(id);
          return handler.error ? handler.reject(new HasuraError(handler.error)) : handler.resolve(handler.data && handler.data.data);
      }
    });
  });

  const exec = (id, payload) => new Promise(async (resolve, reject) => {
    handlers.set(id, {
      resolve,
      reject
    });
    await connection;
    ws.send(`{"type":"start","id":"${id}","payload":${payload}}`);
  });

  const runFromString = payload => exec(getId(), payload);

  const subscribeFromString = (payload, sub) => {
    const id = getId();
    subscribers.set(id, sub);
    return {
      execution: exec(id, payload),
      unsubscribe: () => {
        subscribers.delete(id);
        ws.send(`{"type":"stop","id":"${id}"}`);
      }
    };
  };

  return {
    ws,
    connection,
    runFromString,
    subscribeFromString,
    run: stringify(runFromString),
    subscribe: stringify(subscribeFromString)
  };
};

exports.buildClient = buildClient;
