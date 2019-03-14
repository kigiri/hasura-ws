export const buildModel = prepare => (name, key = 'id', type = 'Int') => {
  const insertQuery = prepare(`
  mutation insert_${name} ($objects: [${name}_insert_input!]!){
    insert_${name} (objects: $objects) { returning { ${key} } }
  }`)

  const updateQuery = prepare(`
  mutation update_${name}($${key}: ${type}!, $changes: ${name}_set_input!) {
    update_${name}(where: {${key}: {_eq: $${key}}}, _set: $changes) { affected_rows }
  }`)

  const deleteQuery = prepare(`
  mutation delete_${name} ($${key}: ${type}!) {
    delete_${name} (where: {${key}: {_eq: $${key}}}) { affected_rows }
  }`)

  const getKey = _ => _[key]
  const mutations = {
    insertQuery,
    deleteQuery,
    updateQuery,
    remove: _ => deleteQuery({ [key]: _ }),
    update: ({ [key]: _, ...changes }) => updateQuery({ [key]: _, changes }),
    add: async o => {
      const isArray = Array.isArray(o)
      const result = await insertQuery.all({ objects: isArray ? o : [o] })

      return isArray
        ? result[`insert_${name}`].returning.map(getKey)
        : result[`insert_${name}`].returning[0][key]
    },
  }

  return fields => {
    const oneById = `($${key}: ${type}!) {
      ${name} (where: {${key}: {_eq: $${key}}} limit: 1) {${key} ${fields}}
    }`

    const selectQuery = prepare(`query ${oneById}`)
    const subscribeQuery = prepare(`subscription ${oneById}`)

    return {
      ...mutations,
      selectQuery,
      subscribeQuery,
      get: _ => selectQuery.one({ [key]: _ }),
      subscribe: (sub, _) => subscribeQuery.one(sub, { [key]: _ }),
    }
  }
}
