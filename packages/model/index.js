export const buildModel = prepare => (name, key = 'id', type = 'Int') => {
  const list = `${key}_list`
  const insertQuery = prepare(`
  mutation insert_${name} ($objects: [${name}_insert_input!]!){
    insert_${name} (objects: $objects) { returning { ${key} } }
  }`)

  const updateQuery = prepare(`
  mutation update_${name} ($${key}: ${type}!, $changes: ${name}_set_input!) {
    update_${name} (where: {${key}: {_eq: $${key}}}, _set: $changes) { affected_rows }
  }`)

  const updateQueryAll = prepare(`
  mutation update_${name} ($${list}: [${type}!], $changes: ${name}_set_input!) {
    update_${name} (where: {${key}: {_in: $${list}}}, _set: $changes) { affected_rows }
  }`)

  const deleteQuery = prepare(`
  mutation delete_${name} ($${key}: ${type}!) {
    delete_${name} (where: {${key}: {_eq: $${key}}}) { affected_rows }
  }`)

  const deleteQueryAll = prepare(`
  mutation delete_${name} ($${list}: [${type}!]) {
    delete_${name} (where: {id: {_in: $${list}} }) { affected_rows }
  }`)

  const getCountQuery = prepare(`
  query ${name}_count {
    ${name}_aggregate { aggregate { count } }
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

    const byWhere = `($where: ${name}_bool_exp!) {
      ${name} (where: $where) {${key} ${fields}}
    }`

    const toPaginateWithCount = `(
      $where: ${name}_bool_exp!, $orderBy: ${name}_order_by!, $limit: Int!, $offset: Int!,
    ) {
      ${name} ( order_by: [$orderBy] offset: $offset limit: $limit where: $where ) { ${fields} }
      ${name}_aggregate (where: $where offset: $offset limit: $limit) { aggregate { count } } 
    }`

    const selectQuery = prepare(`query ${oneById}`)
    const selectQueryAll = prepare(`query ${allById}`)
    const selectQueryWhere = prepare(`query ${byWhere}`)
    const selectQueryPaginatedWithCount = prepare(
      `query get_${name}_with_count ${toPaginateWithCount}`,
    )
    const subscribeQuery = prepare(`subscription ${oneById}`)
    const subscribeQueryAll = prepare(`subscription ${allById}`)
    const subscribeQueryWhere = prepare(`subscription ${byWhere}`)

    return {
      ...mutations,
      selectQuery,
      selectQueryAll,
      selectQueryWhere,
      subscribeQuery,
      subscribeQueryAll,
      subscribeQueryWhere,
      get: _ => {
        if (Array.isArray(_)) return selectQueryAll({ [list]: _ })
        return (_ && typeof _ === "object")
          ? selectQueryWhere({ where: _ })
          : selectQuery.one({ [key]: _ })
      },
      subscribe: (sub, _) => {
        if (Array.isArray(_)) return subscribeQueryAll(sub, { [list]: _ })
        return (_ && typeof _ === "object")
          ? subscribeQueryWhere(sub, { where: _ })
          : subscribeQuery.one(sub, { [key]: _ })
      },
      getCount: async elems => (await getCountQuery(elem)).aggregate.count,
      getPaginatedWithCount: async elems => {
        const elemsWithCount = await selectQueryPaginatedWithCount.all(elems)

        return {
          [name]: elemsWithCount[name],
          count: elemsWithCount[`${name}_aggregate`].aggregate.count,
        }
      },
    }
  }
}
