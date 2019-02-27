'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var hooks = require('@hasura-ws/hooks');

const buildModel = prepare => (name, types) => {
  const all = `{id ${types}}`;
  const oneById = `($id: Int!) {
    ${name} (where: {id: {_eq: $id}} limit: 1) ${all}
  }`;

  const selectQuery = prepare(`query ${oneById}`);
  const subscribeQuery = prepare(`subscription ${oneById}`);

  const insertQuery = prepare(`
  mutation insert_${name} ($objects: [${name}_insert_input!]!){
    insert_${name} (objects: $objects) { returning { id } }
  }`);

  const updateQuery = prepare(`
  mutation update_${name}($id: Int, $changes: ${name}_set_input) {
    update_${name}(where: {id: {_eq: $id}}, _set: $changes) { affected_rows }
  }`);

  const deleteQuery = prepare(`
  mutation delete_${name} {
    delete_${name} (where: {id: {_eq: $id}}) { affected_rows }
  }`);

  const useGet = id => hooks.useQuery.one(selectQuery, { id }, [id]);
  useGet.noCache = id => hooks.useQuery.one(selectQuery.noCache, { id }, [id]);

  return {
    insertQuery,
    deleteQuery,
    updateQuery,
    selectQuery,
    get: async id => (await selectQuery({ id }))[name][0],
    add: async o =>
      (await insertQuery.all({ objects: [o] }))[`insert_${name}`].returning[0]
        .id,
    update: ({ id, ...changes }) => updateQuery({ id, changes }),
    subscribe: (id, sub) => subscribeQuery.one(sub, { id }),
    remove: id => deleteQuery({ id }),
    useGet,
    useSubscribe: id => hooks.useSubscribe.one(subscribeQuery, { id }, [id]),
    useRemove: id => hooks.useMutation(deleteQuery, { id }, [id]),
    useAdd: (o, inputs) => hooks.useMutation(insertQuery, { objects: [o] }, inputs),
    useUpdate: ({ id, ...changes }, inputs) =>
      hooks.useMutation(updateQuery, { id, changes }, inputs),
  }
};

exports.buildModel = buildModel;
