'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var react = require('react');

const useQuery = (run, variables, inputs) => {
  const [state, setState] = react.useState({ pending: true });
  react.useEffect(async () => {
    setState({ pending: true });
    try {
      const value = await run(variables);
      setState({ value });
    } catch (error) {
      setState({ error });
    }
  }, inputs || [variables]);
  return state
};

const useMutation = (mutate, variables, inputs) => {
  const [pending, setPending] = react.useState(false);
  const run = react.useMemo(
    () => async extraVariables => {
      setPending(true);
      await mutate(
        (variables || extraVariables) && { ...variables, ...extraVariables },
      );
      setPending(false);
    },
    inputs || [variables],
  );
  return { pending, run }
};

const useSubscribe = (subscribe, variables, inputs) => {
  const [state, setState] = react.useState({ pending: true });
  react.useEffect(() => {
    const setValue = value => setState({ value });
    const handle = subscribe(variables, setValue);
    handle.execution.catch(error => setState({ error }));

    return handle.unsubscribe
  }, inputs || [variables]);
  return state
};

exports.useQuery = useQuery;
exports.useMutation = useMutation;
exports.useSubscribe = useSubscribe;
