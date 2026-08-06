const assert = require('assert')
const { applyOrder } = require('../miniprogram/utils/queryOrder.js')

const calls = []
const query = {
  orderBy(field, direction) {
    calls.push([field, direction])
    return this
  }
}

assert.strictEqual(applyOrder(query, [
  { field: 'updatedAt', direction: 'desc' },
  { field: '_id', direction: 'desc' }
]), query)
assert.deepStrictEqual(calls, [
  ['updatedAt', 'desc'],
  ['_id', 'desc']
])

const unsupportedQuery = {}
assert.strictEqual(applyOrder(unsupportedQuery, [{ field: 'createdAt', direction: 'desc' }]), unsupportedQuery)
assert.strictEqual(applyOrder(query, [{ field: 'createdAt', direction: 'invalid' }]), query)

console.log('Query ordering contract tests passed')
