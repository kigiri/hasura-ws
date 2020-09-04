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
  const copy = Array.isArray(state) ? [...state] : { ...state }
  copy[RELOADING] = true
  setState(copy)
}

export const useQuery = (run, variables, inputs) => {
  assertHookParams(run, variables, inputs)
  const [state, setState] = useState({ [PENDING]: true })
  useEffect(() => {
    reloadState(state, setState)
    if (variables === null) return
    let abort = false
    run(variables).then(
      newState => abort || setState(newState),
      error => abort || setState({ [ERR]: error }),
    )
    return () => abort = true
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

  return (...args) => fields => {
    const model = prepModel(...args)(fields)
    return {
      ...model,
      useRemove: () => useMutation(model.remove),
      useUpdate: () => useMutation(model.update),
      useAdd: () => useMutation(model.add),
      useGet: _ => Array.isArray(_)
        ? useQuery(model.selectQueryAll, { [model.list]: _ }, _)
        : useQuery(model.selectQuery.one, _ ? { [model.key]: _ } : null, [_]),
      useSubscribe: _ => Array.isArray(_)
        ? useSubscribe(model.subscribeQueryAll, { [model.list]: _ }, _)
        : useSubscribe(model.subscribeQuery.one, _ ? { [model.key]:_ } : null, [_]),
    }
  }
}

export const initAll = client => {
  const prepare = initPrepareWithHooks(client)
  const model = buildModelWithHooks(prepare)
  return { client, prepare, model }
}
