import { useState, useEffect, useMemo } from 'react'
import { prepare } from '@hasura-ws/prepare'
import { buildModel } from '@hasura-ws/model'

export const ERR = Symbol('error')
export const PENDING = Symbol('pending')
export const RELOADING = Symbol('reloading')
const genInputs = variables => (variables ? Object.values(variables) : [])
const assertHookParams = (run, variables, inputs) => {
  if (typeof run !== 'function') {
    throw Error(`Hooks first arguement must be the prepare query
Hooked query always return all the values, so ensure you didn't pass .all`)
  }

  if (inputs && !Array.isArray(inputs)) {
    throw Error(
      'Hooks inputs must be an array like you would give to useEffect',
    )
  }

  if (variables && typeof variables !== 'object') {
    throw Error('Hooks variables must be a javascript object')
  }
}

const reloadState = (state, setState) => {
  if (!state || typeof state !== 'object') return
  if (state[PENDING] || state[RELOADING]) return
  const copy = Array.isArray(v) ? [...state] : { ...state }
  copy[RELOADING] = true
  setState(copy)
}

export const useQuery = (run, variables, inputs) => {
  assertHookParams(run, variables, inputs)
  const [state, setState] = useState({ [PENDING]: true })
  useEffect(() => {
    reloadState(state, setState)
    if (variables === null) return
    run(variables).then(setState, error => setState({ [ERR]: error }))
  }, inputs || genInputs(variables))
  return state
}

export const useMutation = mutate => {
  assertHookParams(mutate)
  const [pending, setPending] = useState(false)
  const run = useMemo(
    () => async variables => {
      setPending(true)
      try {
        return await mutate(variables)
      } finally {
        setPending(false)
      }
    },
    [],
  )
  return { pending, run }
}

export const useSubscribe = (subscribe, variables, inputs) => {
  assertHookParams(subscribe, variables, inputs)
  const [state, setState] = useState({ [PENDING]: true })
  useEffect(() => {
    reloadState(state, setState)
    if (variables === null) return
    const handle = subscribe(setState, variables)
    handle.execution.catch(error => setState({ [ERR]: error }))

    return handle.unsubscribe
  }, inputs || genInputs(variables))
  return state
}

const guessHook = query => {
  const match = query.match(/(query|mutation|subscription)/)
  switch (match && match[0]) {
    case 'mutation':
      return useMutation
    case 'subscription':
      return useSubscribe
    default:
      return useQuery
  }
}

export const prepareWithHooks = (client, query) => {
  const prep = prepare(client, query)
  const hook = guessHook(query)
  const map = exec => (variables, inputs) => hook(exec, variables, inputs)
  prep.use = map(prep)
  prep.useAll = map(prep.all)
  prep.useOne = map(prep.one)
  prep.useMap = mapper => map(prep.map(mapper))

  return prep
}

export const initPrepareWithHooks = client => query =>
  prepareWithHooks(client, query)

const _hasError = data => Boolean(data && data[ERR])
const _getError = data => data && data[ERR]
const _isPending = data => data && data[PENDING]
const _isReloading = data => data && data[RELOADING]
export const hasError = (...data) => data.some(_hasError)
export const getError = (...data) => _getError(data.find(_hasError))
export const isPending = (...data) => data.some(_isPending)
export const isReloading = (...data) => data.some(_isReloading)

export const buildModelWithHooks = prepare => {
  const prepModel = buildModel(prepare)

  return name => fields => {
    const model = prepModel(name)(fields)

    return {
      ...model,
      useRemove: () => useMutation(model.remove),
      useUpdate: () => useMutation(model.update),
      useAdd: () => useMutation(model.add),
      useGet: id => useQuery(model.selectQuery.one, id ? { id } : null, [id]),
      useSubscribe: id =>
        useSubscribe(model.subscribeQuery.one, id ? { id } : null, [id]),
    }
  }
}

export const initAll = client => {
  const prepare = initPrepareWithHooks(client)
  const model = buildModelWithHooks(prepare)
  return { client, prepare, model }
}
