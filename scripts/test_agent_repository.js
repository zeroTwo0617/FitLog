const assert = require('assert')

const calls = []
global.wx = {
  cloud: {
    callFunction: ({ name, data }) => {
      calls.push({ name, data })
      return Promise.resolve({ result: { ok: true, session: { _id: 'session-test' } } })
    },
    uploadFile: ({ cloudPath, filePath, success }) => success({ fileID: 'cloud://test/file.jpg', cloudPath, filePath }),
    deleteFile: ({ fileList, success }) => success({ fileList })
  }
}

const agentRepo = require('../miniprogram/utils/repositories/agent.js')

Promise.resolve()
  .then(() => agentRepo.getSession('session-test'))
  .then((result) => {
    assert.strictEqual(result.data._id, 'session-test')
    assert.deepStrictEqual(calls[0], { name: 'agent', data: { action: 'getSession', sessionId: 'session-test' } })
    return agentRepo.uploadImage('diet/test.jpg', '/tmp/meal.jpg')
  })
  .then((upload) => {
    assert.strictEqual(upload.fileID, 'cloud://test/file.jpg')
    return agentRepo.deleteImage(upload.fileID)
  })
  .then((deleted) => {
    assert.deepStrictEqual(deleted.fileList, ['cloud://test/file.jpg'])
    console.log('Agent repository contract tests passed')
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
