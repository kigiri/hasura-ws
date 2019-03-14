'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const get = _ => Object.values(_)[0];
const getAll = _ => _;
const getOne = _ => Object.values(_)[0][0];
const prepare = ({ runFromString, subscribeFromString }, query) => {
  if (typeof query !== 'string') {
    throw Error(`Query must be a string but was ${typeof query}`)
  }

  const payload = JSON.stringify({ query });
  const noVars = payload;
  const base = payload.slice(0, -1);
  const build = variables => {
    if (!variables) return noVars
    if (typeof variables === 'function') {
      throw Error(
        'variables should not be functions, verify the order of your parameters',
      )
    }
    const stringified = JSON.stringify(variables);
    if (stringified === '{}') return noVars
    return `${base},"variables":${stringified}}`
  };
  const map = /^\s*subscription\s/.test(query)
    ? mapper => (sub, variables) =>
        subscribeFromString(value => sub(mapper(value)), build(variables))
    : mapper => async variables => mapper(await runFromString(build(variables)));

  const run = map(get);
  run.all = map(getAll);
  run.one = map(getOne);
  run.map = map;
  run.query = query;
  return run
};

const initPrepare = client => query => prepare(client, query);

exports.prepare = prepare;
exports.initPrepare = initPrepare;
