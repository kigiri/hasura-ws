'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var hooks = require('@hasura-ws/hooks');

const buildModel = prepare => (name, types) => {
  const all = `{id ${types}}`;
  const oneById = `($id: Int!) {
    ${name} (where: {id: {_eq: $id}} limit: 1) ${all}
  }`;

  const select = prepare(`query ${oneById}`);
  const { subscribe } = prepare(`subscription ${oneById}`);

  const insert = prepare(`
  mutation insert_${name} ($objects: [${name}_insert_input!]!){
    insert_${name} (objects: $objects) { returning { id } }
  }`);

  const update = prepare(`
  mutation update_${name}($id: Int, $changes: ${name}_set_input) {
    update_${name}(where: {id: {_eq: $id}}, _set: $changes) { affected_rows }
  }`);

  const remove = prepare(`
  mutation delete_${name} {
    delete_${name} (where: {id: {_eq: $id}}) { affected_rows }
  }`);

  return {
    queries: { insert, select, subscribe, remove },
    get: async id => (await select.run({ id }))[name][0],
    add: async o =>
      (await insert.run({ objects: [o] }))[`insert_${name}`].returning[0].id,
    update: (id, changes) => update.run({ id, changes }),
    subscribe: (id, sub) => subscribe(result => sub(result[name][0]), { id }),
    remove: id => remove.run({ id }),
    useGet: id => hooks.useQuery(select.run, { id }, [id]),
    useRemove: id => hooks.useMutation(remove.run, { id }, [id]),
    useSubscribe: id => hooks.useSubscribe(subscribe, { id }, [id]),
    useAdd: (vars, inputs) => hooks.useMutation(insert.run, vars, inputs),
    useUpdate: (vars, inputs) => hooks.useMutation(update.run, vars, inputs),
  }
};

exports.buildModel = buildModel;
