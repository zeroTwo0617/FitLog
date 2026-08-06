const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'workouts',
  'sets',
  'plans',
  'bodyMetrics',
  'nutritionLogs',
  'dietPlans',
  'agentSessions',
  'users'
]
const UPLOADS = 'agentUploads'

async function getAllUploads(openid) {
  const rows = []
  const size = 100
  for (let skip = 0; ; skip += size) {
    const result = await db.collection(UPLOADS).where({ _openid: openid }).skip(skip).limit(size).get()
    const batch = (result && result.data) || []
    rows.push(...batch)
    if (batch.length < size) return rows
  }
}

async function deleteFiles(fileIDs) {
  const failures = []
  const uniqueIDs = Array.from(new Set(fileIDs))
  for (let i = 0; i < uniqueIDs.length; i += 50) {
    const batch = uniqueIDs.slice(i, i + 50)
    try {
      await cloud.deleteFile({ fileList: batch })
    } catch (error) {
      console.error('deleteUserData file cleanup failed', error)
      // 批量接口失败时逐文件确认，避免一张失败图片阻断同批其他图片清理。
      for (const fileID of batch) {
        try {
          await cloud.deleteFile({ fileList: [fileID] })
        } catch (singleError) {
          failures.push(fileID)
          console.error('deleteUserData single file cleanup failed', singleError)
        }
      }
    }
  }
  return failures
}

async function removeUploadRecords(openid, uploads, failedFileIDs) {
  const failed = new Set(failedFileIDs)
  const recordIDs = uploads
    .filter((item) => item && item._id && (!item.fileID || !failed.has(item.fileID)))
    .map((item) => item._id)
  let removed = 0
  for (let i = 0; i < recordIDs.length; i += 10) {
    const batch = recordIDs.slice(i, i + 10)
    const result = await db.collection(UPLOADS).where({
      _openid: openid,
      _id: db.command.in(batch)
    }).remove()
    removed += result && result.stats ? (result.stats.removed || 0) : 0
  }
  return removed
}

function fail(code, message) {
  return { ok: false, code, message }
}

exports.main = async function () {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return fail('AUTH_REQUIRED', '无法确认当前用户身份')

  const removed = {}
  try {
    const uploads = await getAllUploads(openid)
    const fileIDs = uploads.map((item) => item && item.fileID).filter(Boolean)
    const fileFailures = await deleteFiles(fileIDs)
    for (const name of COLLECTIONS) {
      const result = await db.collection(name).where({ _openid: openid }).remove()
      removed[name] = result && result.stats ? (result.stats.removed || 0) : 0
    }
    // 删除成功的文件才删除登记；失败登记保留，用户可以再次发起删除请求。
    removed[UPLOADS] = await removeUploadRecords(openid, uploads, fileFailures)
    if (fileFailures.length) return { ok: false, code: 'DELETE_USER_DATA_PARTIAL', message: '部分临时图片删除失败，请稍后重试', removed, fileFailures: fileFailures.length }
    return { ok: true, removed: removed }
  } catch (error) {
    console.error('deleteUserData failed', error)
    return fail('DELETE_USER_DATA_FAILED', '数据删除未完成，请稍后重试')
  }
}
