import { deepStrictEqual } from 'assert'

// Amazing 30 lines testing "framework" made by kigiri #theBest
const tests = []
const tester = f => ({ description, test, expect }) => {
  const count = tests.length + 1
  tests.push(async ctx => {
    console.debug(count, description)
    deepStrictEqual(await f(test)(ctx), expect)
    console.debug('success\n')
    return ctx
  })
}

export const ok = tester(test => test)
export const fail = tester(test => async args => {
  try {
    const err = Error('Should have failed')
    err.result = await test(args)
    return Promise.reject(err)
  } catch (err) {
    return { ...err, message: err.message }
  }
})

export const run = setup =>
  tests.reduce((q, test) => q.then(test), Promise.resolve(setup()))
