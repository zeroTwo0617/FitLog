const page = require('../../utils/page.js')
const theme = require('../../utils/theme.js')

const CONTENT = {
  privacy: {
    title: '隐私政策',
    eyebrow: 'PRIVACY POLICY',
    updatedAt: '版本 1.0 · 更新日期 2026-08-05',
    sections: [
      { title: '我们处理哪些信息', paragraphs: [
        'FitLog 处理你主动创建的训练记录、训练计划、身体测量、饮食记录和教练会话。小程序还会接收微信运行环境提供的用户标识，用于隔离你自己的数据。',
        '当你主动使用饮食图片识别时，我们会处理你选择或拍摄的图片。除完成识别所需的信息外，我们不会要求你提交身份证、通讯录或精确位置。'
      ] },
      { title: '我们如何使用信息', paragraphs: [
        '这些信息用于保存和展示你的训练、饮食和身体趋势，生成统计数据，并在你主动使用教练或图片识别功能时提供个性化结果。',
        '训练和营养建议仅供记录和一般性参考，不构成医疗、诊断或治疗意见。出现疼痛、疾病或异常身体反应时，请咨询专业人士。'
      ] },
      { title: '存储与共享', paragraphs: [
        '数据存储在当前小程序配置的 CloudBase 环境中，并通过当前用户标识进行隔离。我们不会出售你的个人信息，也不会将你的训练记录公开展示。',
        '使用 AI 教练或图片识别时，完成请求所需的最少内容可能会发送给实际配置的模型服务商。上线前应在微信公众平台和服务商隐私文件中补充真实服务商名称、所在地、保存期限和联系方式。'
      ] },
      { title: '你的权利', paragraphs: [
        '你可以在设置页查看本政策、健康数据说明和图片上传说明，也可以使用“删除我的数据”永久删除当前账号下的训练、计划、身体、饮食、教练会话和用户档案。',
        '数据删除成功后无法恢复。删除后再次使用小程序时，会创建新的空白用户档案。'
      ] },
      { title: '联系我们', paragraphs: [
        '隐私问题、数据更正或删除请求，请通过小程序运营主体公布的客服渠道联系。提交审核前，请将运营主体名称、客服邮箱或其他有效联系方式替换为真实信息。'
      ] }
    ]
  },
  health: {
    title: '健康数据说明',
    eyebrow: 'HEALTH DATA',
    updatedAt: '版本 1.0 · 更新日期 2026-08-05',
    sections: [
      { title: '健康数据范围', paragraphs: [
        '健康数据包括训练动作、组数、次数、重量、休息时间、训练计划、体重、身高、体脂率和围度，以及你确认保存的饮食和营养数据。',
        '这些数据属于个人健康和生活方式信息。请只填写你愿意保存的内容，不要上传病历、处方、身份证件或其他与饮食识别无关的敏感材料。'
      ] },
      { title: '使用目的', paragraphs: [
        '健康数据用于生成训练历史、日历、训练量、最大重量、1RM、BMI 和饮食汇总等功能，也可在你主动使用教练功能时作为上下文。',
        '未提供某项数据不会影响其他基础功能，但相应统计可能显示为空或无法计算。'
      ] },
      { title: '风险与边界', paragraphs: [
        'FitLog 不是医疗器械或医疗服务。数据和建议可能存在记录误差、估算误差或模型错误，不能替代医生、营养师或教练的专业判断。',
        '如果你正在治疗、怀孕、康复，或出现持续疼痛、胸闷、头晕等情况，请停止相关训练并寻求专业帮助。'
      ] },
      { title: '删除方式', paragraphs: [
        '进入“我的 → 设置 → 删除我的数据”，阅读提示并连续确认两次。系统会删除当前用户的健康数据及关联账号资料，删除成功后不可恢复。'
      ] }
    ]
  },
  image: {
    title: '图片上传说明',
    eyebrow: 'IMAGE UPLOAD',
    updatedAt: '版本 1.0 · 更新日期 2026-08-05',
    sections: [
      { title: '什么时候会上传', paragraphs: [
        '只有当你主动点击饮食图片识别并从相册或相机选择图片时，FitLog 才会上传图片。你取消选择不会上传。',
        '图片会上传到按当前用户隔离的临时路径，用于本次饮食识别，不用于头像、社交展示或公开分享。'
      ] },
      { title: '如何处理图片', paragraphs: [
        '图片可能会发送给实际配置的 AI 图片识别服务，用于估算食物、份量和营养数据。识别结果会先展示给你确认，只有你明确选择保存后，结构化营养结果才会写入饮食记录。',
        '识别完成后，云函数会尝试删除原始图片；识别失败或网络异常时，客户端也会尝试清理已上传文件。FitLog 不以原始图片作为长期饮食档案。'
      ] },
      { title: '使用建议', paragraphs: [
        '请拍摄清晰、与饮食识别相关的图片，不要上传人脸、证件、病历、聊天记录或其他无关敏感内容。图片识别出的热量和营养值只是估算，请以实际配料和份量为准。'
      ] },
      { title: '权限与删除', paragraphs: [
        '相机和相册权限只在你发起图片选择时使用。你可以在微信系统设置中关闭相关权限；关闭后仍可使用训练记录和手动饮食记录。删除全部数据时，关联的数据库记录会一并删除。'
      ] }
    ]
  }
}

page({
  data: {
    theme: 'light',
    type: 'privacy',
    title: CONTENT.privacy.title,
    eyebrow: CONTENT.privacy.eyebrow,
    updatedAt: CONTENT.privacy.updatedAt,
    sections: CONTENT.privacy.sections
  },

  onLoad(options) {
    const type = options && CONTENT[options.type] ? options.type : 'privacy'
    const content = CONTENT[type]
    this.setData({
      type: type,
      title: content.title,
      eyebrow: content.eyebrow,
      updatedAt: content.updatedAt,
      sections: content.sections
    })
    wx.setNavigationBarTitle({ title: content.title })
  },

  onShow() {
    this.setData({ theme: theme.getTheme() })
  }
})
