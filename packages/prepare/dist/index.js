'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const dbp = new Promise((resolve, reject) => {
  const openreq = window.indexedDB.open('01', 1);
  openreq.onerror = () => reject(openreq.error);
  openreq.onsuccess = () => resolve(openreq.result);
  openreq.onupgradeneeded = () => openreq.result.createObjectStore('idb');
});

const call = async (type, method, ...args) => {
  const db = await dbp;
  const transaction = db.transaction('idb', type);
  const store = transaction.objectStore('idb');

  return new Promise((resolve, reject) => {
    const req = store[method](...args);
    transaction.oncomplete = () => resolve(req);
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  })
};

const get = async key => (await call('readonly', 'get', key)).result;
const set = (key, value) =>
  value === undefined
    ? call('readwrite', 'delete', key)
    : call('readwrite', 'put', value, key);

var idb = /*#__PURE__*/Object.freeze({
  call: call,
  get: get,
  set: set
});

const hashStr = str => {
  let l = str.length;
  let h = 0xbada55 ^ l;
  let i = 0;
  let k;

  while (l >= 4) {
    k =
      (str[i] & 0xff) |
      ((str[++i] & 0xff) << 8) |
      ((str[++i] & 0xff) << 16) |
      ((str[++i] & 0xff) << 24);

    k = (k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16);
    k ^= k >>> 24;
    k = (k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16);

    h =
      ((h & 0xffff) * 0x5bd1e995 +
        ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^
      k;

    l -= 4;
    ++i;
  }

  switch (l) {
    case 3:
      h ^= (str[i + 2] & 0xff) << 16;
    case 2:
      h ^= (str[i + 1] & 0xff) << 8;
    case 1:
      h ^= str[i] & 0xff;
      h =
        (h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16);
  }

  h ^= h >>> 13;
  h = (h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16);
  h ^= h >>> 15;

  return (h >>> 0).toString(36)
};

const buildQuery = query => {
  const payload = JSON.stringify({ query });
  const base = `${payload.slice(0, -1)},"variables":`;
  const hash = hashStr(query);
  const noVars = { payload, hash };
  return (variables, noCache) => {
    if (!variables) return noVars
    if (typeof variables === 'function') {
      throw Error(
        'variables should not be functions, verify the order of your parameters',
      )
    }
    const jsonVariables = JSON.stringify(variables);

    return {
      payload: `${base}${jsonVariables}}`,
      hash: noCache || `${hash}-${hashStr(jsonVariables)}`,
    }
  }
};

const pending = new Map();
const memoryCache = (hash, get) => {
  const pendingValue = pending.get(hash);
  if (pendingValue) return pendingValue
  const request = get();
  pending.set(hash, request);
  setTimeout(() => pending.delete(hash), 5 * 60 * 1000);
  return request
};

const prepareQuery = (client, query) => {
  const build = buildQuery(query);

  const runAll = variables => {
    const { payload, hash } = build(variables);
    return memoryCache(hash, async () => {
      const value = await get(hash);
      if (value !== undefined) {
        return value
      }
      const pendingQuery = client.runFromString(payload);
      const queryResult = await pendingQuery;
      await set(hash, queryResult);
      return queryResult
    })
  };

  const run = async variables => Object.values(await runAll(variables))[0];
  run.all = runAll;
  run.one = async variables => (await run(variables))[0];
  run.noCache = async variables =>
    Object.values(await client.runFromString(build(variables, true).payload))[0];
  run.noCache.one = async variables => (await run.noCache(variables))[0];
  run.noCache.all = async variables =>
    client.runFromString(build(variables, true).payload);

  return run
};

const prepareMutation = (client, query) => {
  const build = buildQuery(query);

  const runAll = async variables =>
    client.runFromString(build(variables, true).payload);

  const run = async variables => Object.values(await runAll(variables))[0];
  run.all = runAll;
  return run
};

const DATA = Symbol('data');
const dispatcher = (subs, mapper) => eventData => {
  const data = (subs[DATA] = mapper(eventData));
  for (const sub of subs) {
    sub(data);
  }
};

const prepareSubscription = (client, query) => {
  const build = buildQuery(query);
  const subList = {};

  const subscribeMap = mapper => (sub, variables) => {
    const { payload, hash } = build(variables);
    const subs = subList[hash] || (subList[hash] = new Set());
    if (subs.size === 0) {
      subs.handler = client.subscribeFromString(
        dispatcher(subs, mapper),
        payload,
      );
    } else {
      subs.handler.execution.then(() => sub(subs[DATA]));
    }
    subs.add(sub);

    const unsubscribe = () => {
      subs.delete(sub);
      if (subs.size === 0 && subs.handler) {
        subs.handler.unsubscribe();
        subs.handler = undefined;
        subList[hash] = undefined;
      }
    };

    return { execution: subs.handler.execution, unsubscribe }
  };
  const subscribe = subscribeMap(_ => Object.values(_)[0]);
  subscribe.all = subscribeMap(_ => _);
  subscribe.one = subscribeMap(_ => Object.values(_)[0][0]);
  return subscribe
};

const prepare = (client, query) => {
  const match = query.match(/(query|mutation|subscription)/);
  switch (match && match[0]) {
    case 'mutation':
      return prepareMutation(client, query)
    case 'subscription':
      return prepareSubscription(client, query)
    default:
      return prepareQuery(client, query)
  }
};

const initPrepare = client => query => prepare(client, query);

exports.prepareQuery = prepareQuery;
exports.prepareMutation = prepareMutation;
exports.prepareSubscription = prepareSubscription;
exports.prepare = prepare;
exports.initPrepare = initPrepare;
exports.cache = idb;
exports.hashStr = hashStr;
