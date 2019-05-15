export const buildModel = prepare => (name, key = 'id', type = 'Int') => {
  const list = `${key}_list`
  const insertQuery = prepare(`
  mutation insert_${name} ($objects: [${name}_insert_input!]!){
    insert_${name} (objects: $objects) { returning { ${key} } }
  }`)

  const updateQuery = prepare(`
  mutation update_${name}($${key}: ${type}!, $changes: ${name}_set_input!) {
    update_${name}(where: {${key}: {_eq: $${key}}}, _set: $changes) { affected_rows }
  }`)

  const updateQueryAll = prepare(`
  mutation update_${name}($${list}: [${type}!], $changes: ${name}_set_input!) {
    update_${name}(where: {${key}: {_in: $${list}}}, _set: $changes) { affected_rows }
  }`)

  const deleteQuery = prepare(`
  mutation delete_${name} ($${key}: ${type}!) {
    delete_${name} (where: {${key}: {_eq: $${key}}}) { affected_rows }
  }`)

  const deleteQueryAll = prepare(`
  mutation delete_${name} ($${list}: [${type}!]) {
    delete_${name} (where: {id: {_in: $${list}} }) { affected_rows }
  }`)

  const getKey = _ => _[key]
  const updateOne = ({ [key]: _, ...changes }) => updateQuery({ [key]: _, changes })

  const mutations = {
    key,
    list,
    insertQuery,
    deleteQuery,
    updateQuery,
    updateQueryAll,
    deleteQueryAll,
    remove: _ => Array.isArray(_)
      ? deleteQueryAll({ [list]: _ })
      : deleteQuery({ [key]: _ }),
    update: (changes, _) => {
      if (!_) return updateOne(changes)
      return Array.isArray(_)
        ? updateQueryAll({ changes, [list]: _ })
        : updateQuery({ changes, [key]: _ })
    },
    add: async _ => {
      const isArray = Array.isArray(_)
      const result = await insertQuery.all({ objects: isArray ? _ : [_] })

      return isArray
        ? result[`insert_${name}`].returning.map(getKey)
        : result[`insert_${name}`].returning[0][key]
    },
  }

  return fields => {
    const oneById = `($${key}: ${type}!) {
      ${name} (where: {${key}: {_eq: $${key}}} limit: 1) {${key} ${fields}}
    }`

    const allById = `($${list}: [${type}!]) {
      ${name} (where: {${key}: {_in: $${list}}}) {${key} ${fields}}
    }`

    const selectQuery = prepare(`query ${oneById}`)
    const selectQueryAll = prepare(`query ${allById}`)
    const subscribeQuery = prepare(`subscription ${oneById}`)
    const subscribeQueryAll = prepare(`subscription ${allById}`)

    return {
      ...mutations,
      selectQuery,
      selectQueryAll,
      subscribeQuery,
      subscribeQueryAll,
      get: _ => Array.isArray(_)
        ? selectQueryAll({ [list]: _ })
        : selectQuery.one({ [key]: _ }),
      subscribe: (sub, _) => Array.isArray(_)
        ? subscribeQueryAll(sub, { [list]: _ })
        : subscribeQuery.one(sub, { [key]: _ }),
    }
  }
}
