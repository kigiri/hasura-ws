import { useState, useEffect, useMemo } from 'react'

const buildHook = builder => {
  const useBuilder = builder(_ => _)
  useBuilder.map = builder
  useBuilder.one = builder(_ => {
    const ret = {}
    for (const key of Object.keys(_)) {
      ret[key] = _[key][0]
    }
    return ret
  })
  return useBuilder
}

export const useQuery = buildHook(map => (run, variables, inputs) => {
  const [state, setState] = useState({ pending: true })
  useEffect(async () => {
    state.pending || setState({ pending: true })
    try {
      setState(map(await run.all(variables)))
    } catch (error) {
      setState({ error })
    }
  }, inputs || [variables])
  return state
})

export const useMutation = (mutate, variables, inputs) => {
  const [pending, setPending] = useState(false)
  const run = useMemo(
    () => async extraVariables => {
      setPending(true)
      const ret = await mutate(
        (variables || extraVariables) && { ...variables, ...extraVariables },
      )
      setPending(false)
      return ret
    },
    inputs || [variables],
  )
  return { pending, run }
}

export const useSubscribe = buildHook(map => (subscribe, variables, inputs) => {
  const [state, setState] = useState({ pending: true })
  useEffect(() => {
    state.pending || setState({ pending: true })
    const handle = subscribe.all(variables, value => map(setState))
    handle.execution.catch(error => setState({ error }))

    return handle.unsubscribe
  }, inputs || [variables])
  return state
})
