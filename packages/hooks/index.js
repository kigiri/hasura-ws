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

const genInputs = variables => variables ? Object.values(variables) : []
export const useQuery = buildHook(map => (run, variables, inputs) => {
  const [state, setState] = useState({ pending: true })
  useEffect(async () => {
    state.pending || setState({ pending: true })
    if (variables === null) return
    try {
      setState(map(await run.all(variables)))
    } catch (error) {
      setState({ error })
    }
  }, inputs || genInputs(variables))
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
    inputs || genInputs(variables),
  )
  return { pending, run }
}

export const useSubscribe = buildHook(map => (subscribe, variables, inputs) => {
  const [state, setState] = useState({ pending: true })
  useEffect(() => {
    state.pending || setState({ pending: true })
    if (variables === null) return
    const handle = subscribe.all(value => setState(map(value)), variables)
    handle.execution.catch(error => setState({ error }))

    return handle.unsubscribe
  }, inputs || genInputs(variables))
  return state
})
