import * as cache from './idb.js'
import { hashStr } from './hash.js'

const buildQuery = query => {
  const payload = JSON.stringify({ query })
  const base = `${payload.slice(0, -1)},"variables":`
  const hash = hashStr(query)
  const noVars = { payload, hash }
  return (variables, noCache) => {
    if (!variables) return noVars
    if (typeof variables === 'function') {
      throw Error(
        'variables should not be functions, verify the order of your parameters',
      )
    }
    const jsonVariables = JSON.stringify(variables)

    return {
      payload: `${base}${jsonVariables}}`,
      hash: noCache || `${hash}-${hashStr(jsonVariables)}`,
    }
  }
}

const pending = new Map()
const memoryCache = (hash, get) => {
  const pendingValue = pending.get(hash)
  if (pendingValue) return pendingValue
  const request = get()
  pending.set(hash, request)
  setTimeout(() => pending.delete(hash), 5 * 60 * 1000)
  return request
}

export const prepareQuery = (client, query) => {
  const build = buildQuery(query)

  const runAll = variables => {
    const { payload, hash } = build(variables)
    return memoryCache(hash, async () => {
      const value = await cache.get(hash)
      if (value !== undefined) {
        return value
      }
      const pendingQuery = client.runFromString(payload)
      const queryResult = await pendingQuery
      await cache.set(hash, queryResult)
      return queryResult
    })
  }

  const run = async variables => Object.values(await runAll(variables))[0]
  run.all = runAll
  run.one = async variables => (await run(variables))[0]
  run.noCache = async variables =>
    Object.values(await client.runFromString(build(variables, true).payload))[0]
  run.noCache.one = async variables => (await run.noCache(variables))[0]
  run.noCache.all = async variables =>
    client.runFromString(build(variables, true).payload)

  return run
}

export const prepareMutation = (client, query) => {
  const build = buildQuery(query)

  const runAll = async variables =>
    client.runFromString(build(variables, true).payload)

  const run = async variables => Object.values(await runAll(variables))[0]
  run.all = runAll
  return run
}

const DATA = Symbol('data')
const dispatcher = (subs, mapper) => eventData => {
  const data = (subs[DATA] = mapper(eventData))
  for (const sub of subs) {
    sub(data)
  }
}

export const prepareSubscription = (client, query) => {
  const build = buildQuery(query)
  const subList = {}

  const subscribeMap = mapper => (sub, variables) => {
    const { payload, hash } = build(variables)
    const subs = subList[hash] || (subList[hash] = new Set())
    if (subs.size === 0) {
      subs.handler = client.subscribeFromString(
        dispatcher(subs, mapper),
        payload,
      )
    } else {
      subs.handler.execution.then(() => sub(subs[DATA]))
    }
    subs.add(sub)

    const unsubscribe = () => {
      subs.delete(sub)
      if (subs.size === 0 && subs.handler) {
        subs.handler.unsubscribe()
        subs.handler = undefined
        subList[hash] = undefined
      }
    }

    return { execution: subs.handler.execution, unsubscribe }
  }
  const subscribe = subscribeMap(_ => Object.values(_)[0])
  subscribe.all = subscribeMap(_ => _)
  subscribe.one = subscribeMap(_ => Object.values(_)[0][0])
  return subscribe
}

export const prepare = (client, query) => {
  const match = query.match(/(query|mutation|subscription)/)
  switch (match && match[0]) {
    case 'mutation':
      return prepareMutation(client, query)
    case 'subscription':
      return prepareSubscription(client, query)
    default:
      return prepareQuery(client, query)
  }
}

export const initPrepare = client => query => prepare(client, query)
