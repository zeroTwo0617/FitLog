const crypto = require('crypto')

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

function normalizeRequestId(value) {
  const requestId = String(value == null ? '' : value).trim()
  return REQUEST_ID_PATTERN.test(requestId) ? requestId : ''
}

function workoutIdFor(openid, requestId) {
  return 'req_' + crypto.createHash('sha256').update(`${openid}:${requestId}`).digest('hex').slice(0, 32)
}

module.exports = { normalizeRequestId, workoutIdFor }
