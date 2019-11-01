'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const get = _ => Object.values(_)[0];
const getAll = _ => _;
const getOne = _ => Object.values(_)[0][0];
const prepare = ({ runFromString, subscribeFromString }, query) => {
  if (typeof query !== 'string') {
    throw Error(`Query must be a string but was ${typeof query}`)
  }

  let [_, type, name] = query.split(/^\s*(\w+)(?:\s+(\w+))?\b/);
  if (!type) {
    type = 'query';
  } else if (!/^(subscription|mutation|query)$/.test(type)) {
    throw Error(`Invalid query, type must be query, mutation or subscription`)
  }
  name || (name = `${type}_${query.split(/{\s*(.+?)\b/)[1]}`);
  const payload = JSON.stringify({ query });
  const noVars = payload;
  const base = payload.slice(0, -1);
  const build = vars => {
    if (!vars) return noVars
    if (typeof vars === 'function') {
      throw Error(
        'variables should not be functions, verify the order of your parameters',
      )
    }
    const stringified = JSON.stringify(vars);
    if (stringified === '{}') return noVars
    return `${base},"variables":${stringified}}`
  };
  const map = type === 'subscription'
    ? mapper => (sub, vars) =>
        subscribeFromString(value => sub(mapper(value)), build(vars), name)
    : mapper => async vars => mapper(await runFromString(build(vars), name));

  const run = map(get);
  run.all = map(getAll);
  run.one = map(getOne);
  run.map = map;
  run.query = query;
  return run
};

const initPrepare = client => query => prepare(client, query);

exports.initPrepare = initPrepare;
exports.prepare = prepare;
