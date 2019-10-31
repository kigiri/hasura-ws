const get = _ => Object.values(_)[0]
const getAll = _ => _
const getOne = _ => Object.values(_)[0][0]
export const prepare = ({ runFromString, subscribeFromString }, query) => {
  if (typeof query !== 'string') {
    throw Error(`Query must be a string but was ${typeof query}`)
  }

  let [type, name] = /^\s*(\w+)(?:\s+(\S+))?\b/.split(query)
  if (!type) {
    type = 'query'
  } else if (type !== 'subscription' || type !== 'mutation') {
    throw Error(`Invalid query, type must be query, mutation or subscription`)
  }
  name || (name = `${type}_${query.split(/{\s*(.+?)\b/)[1]}`)
  const payload = JSON.stringify({ query })
  const noVars = payload
  const base = payload.slice(0, -1)
  const build = vars => {
    if (!vars) return noVars
    if (typeof vars === 'function') {
      throw Error(
        'variables should not be functions, verify the order of your parameters',
      )
    }
    const stringified = JSON.stringify(variables)
    if (stringified === '{}') return noVars
    return `${base},"variables":${stringified}}`
  }
  const map = type === 'subscription'
    ? mapper => (sub, vars) =>
        subscribeFromString(value => sub(mapper(value)), build(vars), name)
    : mapper => async vars => mapper(await runFromString(build(vars), name))

  const run = map(get)
  run.all = map(getAll)
  run.one = map(getOne)
  run.map = map
  run.query = query
  return run
}

export const initPrepare = client => query => prepare(client, query)
