'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var hooks = require('@hasura-ws/hooks');

const buildModel = prepare => (name, types) => {
  const all = `{id ${types}}`;
  const oneById = `($id: Int!) {
    ${name} (where: {id: {_eq: $id}} limit: 1) ${all}
  }`;

  const select = prepare(`query ${oneById}`);
  const subscribe = prepare(`subscription ${oneById}`);

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

  const updateWithId = (id, changes) => update({ id, changes });
  const updateWithoutId = ({ id, ...changes }) => update({ id, changes });

  return {
    queries: { insert, select, subscribe, remove },
    get: async id => (await select({ id }))[name][0],
    add: async o =>
      (await insert({ objects: [o] }))[`insert_${name}`].returning[0].id,
    update: (id, changes) => {
      if (typeof id === 'object') {
        if (!id) {
          throw Error(`Update need an id to select which ${name} to update`)
        }
        return updateWithoutId(id)
      }
      if (!changes || typeof changes !== 'object') {
        throw Error(`Update was called without any changes`)
      }
      return updateWithId(id, changes)
    },
    subscribe: (id, sub) => subscribe(result => sub(result[name][0]), { id }),
    remove: id => remove({ id }),
    useGet: id => hooks.useQuery(select, { id }, [id]),
    useRemove: id => hooks.useMutation(remove, { id }, [id]),
    useSubscribe: id => hooks.useSubscribe(subscribe, { id }, [id]),
    useAdd: (vars, inputs) => hooks.useMutation(insert, vars, inputs),
    useUpdate: (vars, inputs) => hooks.useMutation(update, vars, inputs),
  }
};

exports.buildModel = buildModel;
