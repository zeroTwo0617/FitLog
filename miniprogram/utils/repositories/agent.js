const cloud = require('../cloud.js')

function getSession(id) {
  if (!id) return Promise.resolve({ data: null })
  return cloud.callFunction('agent', { action: 'getSession', sessionId: String(id) })
    .then((result) => ({ data: result && result.session ? result.session : null }))
}

function uploadImage(cloudPath, filePath) {
  return cloud.uploadFile(cloudPath, filePath)
}

function deleteImage(fileID) {
  return cloud.deleteFile([fileID])
}

module.exports = { getSession, uploadImage, deleteImage }
