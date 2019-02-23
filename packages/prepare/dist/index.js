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
    const jsonVariables = JSON.stringify(variables);

    return {
      payload: `${base}${jsonVariables}}`,
      hash: noCache || `${hash}-${hashStr(jsonVariables)}`,
    }
  }
};

const pending = new Map();
const memoryCache = (hash, get) => {
  if (pending.has(hash)) {
    console.log('got value from memory', hash);
    return pending.get(hash)
  }
  const request = get();
  pending.set(hash, request);
  setTimeout(() => pending.delete(hash), 5 * 60 * 1000);
  return request
};

const prepareQuery = query => {
  const build = buildQuery(query);

  const run = variables => {
    const { payload, hash } = build(variables);
    return memoryCache(hash, async () => {
      const value = await get(hash);
      if (value !== undefined) {
        console.log('got value from idb cache', hash);
        return value
      }
      const pendingQuery = client.runFromString(payload);
      const queryResult = await pendingQuery;
      console.log('got value from hasura', hash);
      await set(hash, queryResult);
      return queryResult
    })
  };

  run.noCache = async variables =>
    client.runFromString(build(variables, true).payload);

  const use = variables => {
    const [state, setState] = useState({ pending: true });
    useEffect(async () => {
      try {
        const value = await client.runFromString(variables);
        setState({ pending: false, error: undefined, value });
      } catch (error) {
        setState({ pending: false, error, value: undefined });
      }
    }, [variables]);
    return state
  };

  return { use, run }
};

const prepareMutation = query => {
  const build = buildQuery(query);

  return {
    run: async variables =>
      client.runFromString(build(variables, true).payload),
  }
};

const dispatcher = subs => data => {
  for (const sub of subs) {
    sub(data);
  }
};

const prepareSubscription = query => {
  const build = buildQuery(query);
  const subList = {};

  const subscribe = (sub, variables) => {
    const { payload, hash } = build(variables);
    const subs = subList[hash] || (subList[hash] = new Set());
    if (subs.size === 0) {
      subs.handler = client.subscribe(payload, dispatcher(subs));
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

  return { subscribe }
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
