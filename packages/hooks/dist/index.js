'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var react = require('react');

const buildHook = builder => {
  const useBuilder = builder(_ => _);
  useBuilder.map = builder;
  useBuilder.one = builder(_ => {
    const ret = {};
    for (const key of Object.keys(_)) {
      ret[key] = _[key][0];
    }
    return ret
  });
  return useBuilder
};

const genInputs = variables => (variables ? Object.values(variables) : []);
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
};

const useQuery = buildHook(map => (run, variables, inputs) => {
  assertHookParams(run.all, variables, inputs);
  const [state, setState] = react.useState({ pending: true });
  react.useEffect(() => {
    state.pending || setState({ pending: true });
    if (variables === null) return
    run
      .all(variables)
      .then(value => setState(map(value)), error => setState({ error }));
  }, inputs || genInputs(variables));
  return state
});

const useMutation = (mutate, variables, inputs) => {
  assertHookParams(mutate, variables, inputs);
  const [pending, setPending] = react.useState(false);
  const run = react.useMemo(
    () => async extraVariables => {
      setPending(true);
      const ret = await mutate(
        (variables || extraVariables) && { ...variables, ...extraVariables },
      );
      setPending(false);
      return ret
    },
    inputs || genInputs(variables),
  );
  return { pending, run }
};

const useSubscribe = buildHook(map => (subscribe, variables, inputs) => {
  assertHookParams(subscribe.all, variables, inputs);
  const [state, setState] = react.useState({ pending: true });
  react.useEffect(() => {
    state.pending || setState({ pending: true });
    if (variables === null) return
    const handle = subscribe.all(value => setState(map(value)), variables);
    handle.execution.catch(error => setState({ error }));

    return handle.unsubscribe
  }, inputs || genInputs(variables));
  return state
});

exports.useQuery = useQuery;
exports.useMutation = useMutation;
exports.useSubscribe = useSubscribe;
