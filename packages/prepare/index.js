import * as cache from './idb.js'
import { hashStr } from './hash.js'

const buildQuery = query => {
  const payload = JSON.stringify({ query })
  const base = `${payload.slice(0, -1)},"variables":`
  const hash = hashStr(query)
  const noVars = { payload, hash }
  return (variables, noCache) => {
    if (!variables) return noVars
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

export const prepareQuery = query => {
  const build = buildQuery(query)

  const run = variables => {
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

  run.noCache = async variables =>
    client.runFromString(build(variables, true).payload)

  return run
}

export const prepareMutation = query => {
  const build = buildQuery(query)

  return async variables => client.runFromString(build(variables, true).payload)
}

const dispatcher = subs => data => {
  for (const sub of subs) {
    sub(data)
  }
}

export const prepareSubscription = query => {
  const build = buildQuery(query)
  const subList = {}

  const subscribe = (sub, variables) => {
    const { payload, hash } = build(variables)
    const subs = subList[hash] || (subList[hash] = new Set())
    if (subs.size === 0) {
      subs.handler = client.subscribe(payload, dispatcher(subs))
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
