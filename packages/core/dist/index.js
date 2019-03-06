'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class HasuraError extends Error {
  constructor({
    error,
    ...props
  }) {
    super(error);
    Object.assign(this, props);
    Error.captureStackTrace && Error.captureStackTrace(this, HasuraError);
  }

}

const buildClient = openWebSocket => ({
  debug,
  ...params
}) => {
  const ws = openWebSocket(params.address);
  const handlers = new Map();
  const subscribers = new Map();
  ws.on('open', () => ws.send(JSON.stringify({
    type: 'connection_init',
    payload: {
      headers: params.adminSecret ? {
        'x-hasura-admin-secret': params.adminSecret
      } : {
        Authorization: `Bearer ${params.token}`
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

  const fail = (handler, error) => {
    if (!handler) {
      return debug && console.debug('missing handler for message', handler.id);
    }

    handlers.delete(handler.id);
    const err = new HasuraError(error);
    debug && (err.trace = handler.trace.stack);
    return handler.reject(err);
  };

  let connection = new Promise((resolve, reject) => {
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
      debug && console.debug(`hasura-ws: <${type}#${id}>`, payload);

      switch (type) {
        case 'connection_ack':
          return resolve(payload);

        case 'connection_error':
          const err = rejectAllPending(new HasuraError({
            error: payload
          }));
          return reject(err);

        case 'data':
          if (payload.errors) {
            return fail(handler, { ...payload.errors[0],
              ...payload
            });
          }

          const sub = subscribers.get(id);

          if (!sub) {
            return handler ? handler.payload = payload : debug && console.debug('missing handler for message', id);
          }

          sub(payload.data);

          if (handler) {
            handler.resolve();
            handlers.delete(id);
          }

        case 'error':
          return fail(handler, payload);

        case 'complete':
          if (!handler) return;
          handlers.delete(id);
          return handler.resolve(handler.payload && handler.payload.data);
      }
    });
  });

  const exec = (id, payload) => new Promise(async (resolve, reject) => {
    const handler = {
      resolve,
      reject,
      id
    };
    handlers.set(id, handler);
    await connection;

    if (debug) {
      console.debug(`hasura-ws: <start#${id}>`, JSON.parse(payload));
      handler.trace = Error('hasuraClient.exec error');
    }

    ws.send(`{"type":"start","id":"${id}","payload":${payload}}`);
  });

  const runFromString = payload => exec(getId(), payload);

  const subscribeFromString = (sub, payload) => {
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
    run: (query, variables) => runFromString(JSON.stringify({
      query,
      variables
    })),
    subscribe: (sub, query, variables) => subscribeFromString(sub, JSON.stringify({
      query,
      variables
    }))
  };
};

exports.buildClient = buildClient;
