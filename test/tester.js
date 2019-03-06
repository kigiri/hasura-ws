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
export const fail = tester(t => args =>
  Promise.resolve(args)
    .then(t)
    .then(
      result =>
        Promise.reject(Object.assign(Error('Should have failed'), { result })),
      err => ({ ...err, message: err.message }),
    ),
)

export const run = setup =>
  tests.reduce((q, t, i) => q.then(t), Promise.resolve(setup()))
