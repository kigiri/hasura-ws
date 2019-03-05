import { useCallback } from 'react'
import { useQuery, useMutation, useSubscribe } from '@hasura-ws/hooks'

const getId = _ => _.id
export const buildModel = prepare => name => types => {
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
  mutation update_${name}($id: Int!, $changes: ${name}_set_input!) {
    update_${name}(where: {id: {_eq: $id}}, _set: $changes) { affected_rows }
  }`)

  const deleteQuery = prepare(`
  mutation delete_${name} ($id: Int!) {
    delete_${name} (where: {id: {_eq: $id}}) { affected_rows }
  }`)

  const get = async id => (await selectQuery.all({ id }))[name][0]
  get.noCache = async id => (await selectQuery.all.noCache({ id }))[name][0]
  const useGet = id => useQuery.one(selectQuery, { id }, [id])
  useGet.noCache = id => useQuery.one(selectQuery.noCache, { id }, [id])

  return {
    insertQuery,
    deleteQuery,
    updateQuery,
    selectQuery,
    get,
    add: async o => {
      const isArray = Array.isArray(o)
      const result = await insertQuery.all({ objects: isArray ? o : [o] })

      return isArray
        ? result[`insert_${name}`].returning.map(getId)
        : result[`insert_${name}`].returning[0].id
    },
    update: ({ id, ...changes }) => updateQuery({ id, changes }),
    subscribe: (id, sub) => subscribeQuery.one(sub, { id }),
    remove: id => deleteQuery({ id }),
    useGet,
    useSubscribe: id => useSubscribe.one(subscribeQuery, { id }, [id]),
    useRemove: id => useMutation(deleteQuery, { id }, [id]),
    useAdd: (o, inputs) => useMutation(insertQuery, { objects: [o] }, inputs),
    useUpdate: id => {
      const { pending, error, run } = useMutation(updateQuery, undefined, [])

      return {
        pending,
        error,
        run: useCallback(({ id: overrideId, ...changes }) => {
          return run({ id: overrideId || id, changes })
        }, [id])
      }
    },
  }
}
