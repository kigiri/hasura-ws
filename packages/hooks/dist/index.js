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

const useQuery = buildHook(map => (run, variables, inputs) => {
  const [state, setState] = react.useState({ pending: true });
  react.useEffect(async () => {
    state.pending || setState({ pending: true });
    try {
      setState(map(await run.all(variables)));
    } catch (error) {
      setState({ error });
    }
  }, inputs || [variables]);
  return state
});

const useMutation = (mutate, variables, inputs) => {
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
    inputs || [variables],
  );
  return { pending, run }
};

const useSubscribe = buildHook(map => (subscribe, variables, inputs) => {
  const [state, setState] = react.useState({ pending: true });
  react.useEffect(() => {
    state.pending || setState({ pending: true });
    const handle = subscribe.all(variables, value => map(setState));
    handle.execution.catch(error => setState({ error }));

    return handle.unsubscribe
  }, inputs || [variables]);
  return state
});

exports.useQuery = useQuery;
exports.useMutation = useMutation;
exports.useSubscribe = useSubscribe;
