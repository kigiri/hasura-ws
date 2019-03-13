const buildQuery = query => {
  const payload = JSON.stringify({ query })
  const noVars = payload
  const base = payload.slice(0, -1)
  return variables => {
    if (!variables) return noVars
    if (typeof variables === 'function') {
      throw Error(
        'variables should not be functions, verify the order of your parameters',
      )
    }

    return `${base},"variables":${JSON.stringify(variables)}}`
  }
}

export const prepareQuery = (client, query) => {
  const build = buildQuery(query)
  const runAll = variables => client.runFromString(build(variables))
  const run = async variables => Object.values(await runAll(variables))[0]
  run.all = runAll
  run.one = async variables => (await run(variables))[0]
  run.query = query
  return run
}

export const prepareSubscription = (client, query) => {
  const build = buildQuery(query)
  const subscribeMap = mapper => (sub, variables) =>
    client.subscribeFromString(
      value => sub(mapper(variables)),
      build(variables),
    )

  const subscribe = subscribeMap(_ => Object.values(_)[0])
  subscribe.all = subscribeMap(_ => _)
  subscribe.one = subscribeMap(_ => Object.values(_)[0][0])
  subscribe.query = query
  return subscribe
}

export const prepare = (client, query) =>
  query.test(/^\s*subscription\s/)
    ? prepareSubscription(client, query)
    : prepareQuery(client, query)

export const initPrepare = client => query => prepare(client, query)

export { cache, hashStr }
