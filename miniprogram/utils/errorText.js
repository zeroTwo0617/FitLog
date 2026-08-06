const MESSAGES = {
  AUTH_REQUIRED: '请先完成微信授权后重试。',
  CLOUD_NOT_READY: '云服务尚未就绪，请稍后重试。',
  DELETE_USER_DATA_PARTIAL: '部分临时图片删除失败，请稍后再次执行删除。',
  DELETE_USER_DATA_FAILED: '数据删除未完成，请稍后重试。',
  INVALID_DATE: '日期无效，请重新选择。',
  INVALID_BODY_METRIC: '身体数据不符合范围要求，请检查后重试。',
  INVALID_NUTRITION: '饮食数据不符合范围要求，请检查后重试。',
  INVALID_NUTRITION_VALUES: '饮食数据不符合范围要求，请检查后重试。',
  INVALID_MEAL_TYPE: '餐次选择无效，请重新选择。',
  INVALID_MEAL: '饮食识别数据无效，请重新描述或上传图片。',
  INVALID_FILE: '图片文件无效，请重新选择。',
  FILE_DOWNLOAD_FAILED: '图片读取失败，请换一张图片重试。',
  REGISTER_UPLOAD_FAILED: '图片登记失败，请重试。',
  MODEL_TIMEOUT: '模型响应超时，请稍后重试。',
  MODEL_UNAVAILABLE: '模型服务暂时不可用，请稍后重试。',
  MODEL_INVALID_JSON: '模型返回内容暂时无法整理，请重试。',
  MODEL_CONFIG_MISSING: '助手服务暂时离线，请稍后重试。',
  MODEL_CONFIG_INVALID: '助手服务配置异常，请稍后重试。',
  SAVE_BODY_FAILED: '身体数据保存失败，请稍后重试。',
  SAVE_NUTRITION_FAILED: '饮食记录保存失败，请稍后重试。',
  SAVE_WORKOUT_FAILED: '训练保存失败，请稍后重试。'
}

function message(error, fallback) {
  const code = String(error && error.code || '')
  if (MESSAGES[code]) return MESSAGES[code]
  if (code.indexOf('MODEL_REQUEST_FAILED_401') === 0) return '助手服务鉴权失败，请稍后重试。'
  if (code.indexOf('MODEL_REQUEST_FAILED_404') === 0) return '助手服务配置异常，请稍后重试。'
  if (code.indexOf('CLOUD_FUNCTION_') === 0) return '云函数暂时不可用，请确认服务已部署后重试。'
  return fallback || '操作失败，请稍后重试。'
}

module.exports = { message }
