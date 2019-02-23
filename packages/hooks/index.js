import { useState, useEffect, useMemo } from 'react'

export const useQuery = (run, variables, inputs) => {
  const [state, setState] = useState({ pending: true })
  useEffect(async () => {
    setState({ pending: true })
    try {
      const value = await run(variables)
      setState({ value })
    } catch (error) {
      setState({ error })
    }
  }, inputs || [variables])
  return state
}

export const useMutation = (mutate, variables, inputs) => {
  const [pending, setPending] = useState(false)
  const run = useMemo(
    () => async extraVariables => {
      setPending(true)
      await mutate(
        (variables || extraVariables) && { ...variables, ...extraVariables },
      )
      setPending(false)
    },
    inputs || [variables],
  )
  return { pending, run }
}

export const useSubscribe = (subscribe, variables, inputs) => {
  const [state, setState] = useState({ pending: true })
  useEffect(() => {
    const setValue = value => setState({ value })
    const handle = subscribe(variables, setValue)
    handle.execution.catch(error => setState({ error }))

    return handle.unsubscribe
  }, inputs || [variables])
  return state
}
