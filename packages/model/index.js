import { useQuery, useMutation, useSubscribe } from '@hasura-ws/hooks'

const withHook = (useHook, query, name) => id => {
  const ret = useHook(query, { id }, [id])
  return ret.value ? { [name]: ret.value[name][0] } : ret
}

export const buildModel = prepare => (name, types) => {
  const all = `{id ${types}}`
  const oneById = `($id: Int!) {
    ${name} (where: {id: {_eq: $id}} limit: 1) ${all}
  }`

  const selectQuery = prepare(`query ${oneById}`)
  const subscribeQuery = prepare(`subscription ${oneById}`)

  const insertQuery = prepare(`
  mutation insert_${name} ($objects: [${name}_insert_input!]!){
    insert_${name} (objects: $objects) { returning { id } }
  }`)

  const updateQuery = prepare(`
  mutation update_${name}($id: Int, $changes: ${name}_set_input) {
    update_${name}(where: {id: {_eq: $id}}, _set: $changes) { affected_rows }
  }`)

  const deleteQuery = prepare(`
  mutation delete_${name} {
    delete_${name} (where: {id: {_eq: $id}}) { affected_rows }
  }`)

  return {
    insertQuery,
    deleteQuery,
    updateQuery,
    selectQuery,
    get: async id => (await selectQuery({ id }))[name][0],
    add: async o =>
      (await insertQuery({ objects: [o] }))[`insert_${name}`].returning[0].id,
    update: ({ id, ...changes }) => updateQuery({ id, changes }),
    subscribe: (id, sub) =>
      subscribeQuery(result => sub(result[name][0]), { id }),
    remove: id => deleteQuery({ id }),
    useGet: withHook(useQuery, selectQuery, name),
    useSubscribe: withHook(useSubscribe, subscribeQuery, name),
    useRemove: id => useMutation(deleteQuery, { id }, [id]),
    useAdd: (o, inputs) => useMutation(insertQuery, { objects: [o] }, inputs),
    useUpdate: ({ id, ...changes }, inputs) =>
      useMutation(updateQuery, { id, changes }, inputs),
  }
}
