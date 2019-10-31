class HasuraError extends Error {
  constructor({ error, extensions, ...props }) {
    super(error)
    Object.assign(this, props)
    Object.assign(this, extensions)
    Error.captureStackTrace && Error.captureStackTrace(this, HasuraError)
  }
}

const flatErrors = (acc, err) => acc.concat(err.errors ? err.errors : [ err ])
const buildClient = openWebSocket => ({ debug, address, log, ...params }) => {
  log || (log = debug ? console.debug : () => {})
  const handlers = new Map()
  const subscribers = new Map()

  const getId = () => {
    const id = Math.random()
      .toString(36)
      .slice(2)
    return handlers.has(id) ? getId() : id
  }

  const rejectAllPending = err => {
    subscribers.clear() // TODO: store subscribers query and re-trigger them
    for (const [id, { reject }] of handlers) {
      handlers.delete(id)
      reject(err)
    }
    return err
  }

  const messageFail = (handler, payload, id) => {
    if (!handler) return log('missing-handler', { id })

    if (payload.errors) {
      payload.errors = payload.errors.reduce(flatErrors, [])
      Object.assign(payload, payload.errors[0])
    }

    handlers.delete(id)
    const err = new HasuraError(payload)
    debug && (err.trace = handler.trace.stack)
    return handler.reject(err)
  }

  const handleMessage = (data, resolve, reject) => {
    if (data === '{"type":"ka"}') return // ignore keep alive

    const { type, payload, id } = JSON.parse(data)
    const handler = handlers.get(id)

    log('raw', data)

    switch (type) {
      case 'connection_ack':
        return resolve(payload)

      case 'connection_error':
        const err = rejectAllPending(new HasuraError({ error: payload }))
        return reject(err)

      case 'data':
        if (payload.errors) return messageFail(handler, payload, id)

        const sub = subscribers.get(id)
        if (!sub) {
          return handler
            ? (handler.payload = payload)
            : log('missing-handler', { id, type: 'error' })
        }

        sub(payload.data)
        if (handler) {
          const duration = Date.now() - handler.start
          log('query', {
            id,
            type,
            payload,
            duration,
            size: data.length,
          })
          handler.resolve()
          handlers.delete(id)
        }

        return
      case 'error':
        return messageFail(handler, payload, id)

      case 'complete':
        if (!handler) return
        handlers.delete(id)
        return handler.resolve(handler.payload && handler.payload.data)
    }
  }

  const handleFail = (event, type) =>
    rejectAllPending(
      new HasuraError({ error: `WebSocket connection ${type}`, event }),
    )

  const ws = openWebSocket(address)
  const exec = (id, payload) =>
    new Promise(async (resolve, reject) => {
      const handler = { resolve, reject, id }
      handlers.set(id, handler)
      await connection
      handler.start = Date.now()
      log('start', { id, payload })
      debug && (handler.trace = Error('hasuraClient.exec error'))
      ws.send(`{"type":"start","id":"${id}","payload":${payload}}`)
    })

  const runFromString = payload => exec(getId(), payload)

  const subscribeFromString = (sub, payload) => {
    const id = getId()
    subscribers.set(id, sub)

    return {
      execution: exec(id, payload),
      unsubscribe: () => {
        subscribers.delete(id)
        log('stop', { id })
        ws.send(`{"type":"stop","id":"${id}"}`)
      },
    }
  }

  const connection = new Promise((resolve, reject) => {
    ws.on('error', event => reject(handleFail(event, 'failed')))
    ws.on('close', event => reject(handleFail(event, 'close')))
    ws.on('message', data => handleMessage(data, resolve, reject))
  })

  const connect = async ({ adminSecret, token, role, headers }) => {
    if (!ws.readyState) {
      await new Promise(s => ws.on('open', s))
    }

    const payload = {
      headers: adminSecret
        ? { 'x-hasura-admin-secret': adminSecret, ...headers }
        : { Authorization: `Bearer ${token}`, ...headers },
    }

    role && (payload.headers['x-hasura-role'] = role)

    ws.send(JSON.stringify({ type: 'connection_init', payload }))

    return connection
  }

  if (params.adminSecret || params.token) {
    connect(params)
  }

  return {
    ws,
    connect,
    connection,
    runFromString,
    subscribeFromString,
    run: (query, variables) =>
      runFromString(JSON.stringify({ query, variables })),
    subscribe: (sub, query, variables) =>
      subscribeFromString(sub, JSON.stringify({ query, variables })),
  }
}

export { buildClient }
