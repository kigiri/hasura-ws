export const insertTestMutation = `
mutation insert_test($test: test_insert_input!) {
  insert_test (objects: [$test]) {
    returning { id }
  }
}
`
