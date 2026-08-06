const stepData = {
  input: {
    kicker: '01 / INPUT',
    title: '小程序只负责收集问题',
    description: '页面读取训练记录、计划和身体数据，整理成白名单 context，再把 sessionId 一起交给 Agent API。',
    tags: ['pages/agent', 'utils/agentApi'],
    code: "agentApi.chat('training', query, context, sessionId)",
    trace: '已收集 query + context',
    time: '32 ms',
    pseudoTitle: '输入整理',
    pseudoDescription: '先从小程序侧准备有限、可解释的上下文，不把任意 CloudBase 文档直接交给模型。',
    pseudoFile: 'miniprogram/pages/agent/agent.js',
    pseudoKeyword: 'context / sessionId',
    pseudoRead: '页面准备数据，云函数保护数据，模型只生成建议。'
  },
  function: {
    kicker: '02 / FUNCTION',
    title: '云函数先确认你是谁',
    description: 'CloudBase 从服务端上下文读取 OPENID，按用户查询会话；客户端传来的 OPENID 不会参与鉴权。',
    tags: ['cloudfunctions/agent', 'OPENID', 'agentSessions'],
    code: "const openid = cloud.getWXContext().OPENID",
    trace: '身份通过，开始组织提示词',
    time: '74 ms',
    pseudoTitle: '服务端鉴权',
    pseudoDescription: '身份来自 CloudBase 服务端上下文。拿不到 OPENID 就拒绝请求，客户端不能伪造身份。',
    pseudoFile: 'cloudfunctions/agent/index.js',
    pseudoKeyword: 'OPENID / agentSessions',
    pseudoRead: '安全边界要放在服务端，而不是相信页面传来的用户标识。'
  },
  model: {
    kicker: '03 / MODEL',
    title: '用兼容接口请求模型',
    description: '云函数把 system prompt、最近 10 条消息和清洗后的上下文发到 /chat/completions。密钥只在云函数环境变量里。',
    tags: ['llm.js', 'LLM_BASE_URL', 'LLM_MODEL'],
    code: "POST /chat/completions\ntools: search_exercises\nAuthorization: Bearer <server-key>",
    trace: '模型生成结构化 JSON',
    time: '920 ms',
    pseudoTitle: '模型调用',
    pseudoDescription: '云函数把提示词、历史消息和清洗后的上下文交给 OpenAI-compatible 接口，密钥只从环境变量读取。',
    pseudoFile: 'cloudfunctions/agent/llm.js',
    pseudoKeyword: 'search_exercises / LLM_BASE_URL',
    pseudoRead: '模型是一个被保护的外部能力，超时或不可用时要返回可解释的错误。'
  },
  schema: {
    kicker: '04 / SCHEMA',
    title: '先校验，再决定能不能保存',
    description: '模型返回的 JSON 会经过字段白名单、长度和数值范围校验。无效计划只能展示文本，不能进入保存流程。',
    tags: ['schemas.js', 'planDraft', 'CloudBase'],
    code: "const plan = schemas.validateTraining(parsed)",
    trace: 'schema passed，返回前端',
    time: '146 ms',
    pseudoTitle: '校验与落库',
    pseudoDescription: '先验证 reply、计划字段和数值范围，再把会话写入 agentSessions；训练计划由前端确认后写入 plans。',
    pseudoFile: 'cloudfunctions/agent/schemas.js',
    pseudoKeyword: 'validateTraining / planDraft',
    pseudoRead: '模型可以建议，但不能越过校验和用户确认直接改变业务数据。'
  }
}

const modes = {
  training: {
    total: '2.4k tokens',
    main: '42%',
    footnote: '只传与训练相关的字段，最多 10 条近期记录。',
    donut: 'conic-gradient(var(--green) 0 42%, var(--blue) 42% 70%, var(--orange) 70% 82%, #edf1ea 82% 100%)',
    legend: [['近期训练', '42%'], ['已有计划', '28%'], ['身体数据', '12%'], ['当前问题', '18%']],
    latency: [['整理上下文', 180, '24%'], ['模型生成', 920, '100%'], ['JSON 校验', 110, '20%'], ['保存会话', 270, '30%']],
    latencyTotal: '1,480 ms',
    title: '训练助手',
    messages: ['帮我安排一个 3 天增肌计划', '可以。我会结合你最近的训练记录，先给出一个可编辑的计划草案。'],
    draft: '基础力量 · 3 天'
  },
  diet: {
    total: '2.1k tokens',
    main: '36%',
    footnote: '饮食模式会加入最近 30 条饮食记录，但不会把原始图片留在库里。',
    donut: 'conic-gradient(var(--green) 0 36%, var(--blue) 36% 58%, var(--orange) 58% 73%, #edf1ea 73% 100%)',
    legend: [['最近饮食', '36%'], ['身体数据', '22%'], ['当前问题', '15%'], ['规则提示', '27%']],
    latency: [['整理上下文', 210, '23%'], ['视觉 / 文本模型', 1_160, '100%'], ['JSON 校验', 130, '18%'], ['保存确认', 190, '20%']],
    latencyTotal: '1,690 ms',
    title: '饮食助手',
    messages: ['我刚吃了一碗米饭和鸡胸肉，帮我估算热量', '大约 520 kcal。结果是估算值，要保存到饮食记录吗？'],
    draft: '午餐 · 520 kcal'
  }
}

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => Array.from(document.querySelectorAll(selector))

function setStep(step) {
  const data = stepData[step]
  if (!data) return
  $$('.pipeline-node').forEach((node) => {
    const active = node.dataset.step === step
    node.classList.toggle('is-active', active)
    node.setAttribute('aria-selected', String(active))
  })
  $('#stepKicker').textContent = data.kicker
  $('#stepTitle').textContent = data.title
  $('#stepDescription').textContent = data.description
  $('#stepCode').textContent = data.code
  $('#traceText').textContent = data.trace
  $('#traceTime').textContent = data.time
  $('#stepTags').innerHTML = data.tags.map((tag) => `<span>${tag}</span>`).join('')
  $$('#pseudoCode .code-line').forEach((line) => line.classList.toggle('is-focus', line.dataset.step === step))
  $('#pseudoTitle').textContent = data.pseudoTitle
  $('#pseudoDescription').textContent = data.pseudoDescription
  $('#pseudoFile').textContent = data.pseudoFile
  $('#pseudoKeyword').textContent = data.pseudoKeyword
  $('#pseudoRead').textContent = data.pseudoRead
}

function setMode(mode) {
  const data = modes[mode]
  if (!data) return
  $$('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
  })
  $('#contextTotal').textContent = data.total
  $('#contextMainValue').textContent = data.main
  $('#contextDonut').style.background = data.donut
  $('#contextFootnote').textContent = data.footnote
  $$('#contextLegend > div').forEach((row, index) => {
    if (!data.legend[index]) return
    row.querySelector('span').textContent = data.legend[index][0]
    row.querySelector('b').textContent = data.legend[index][1]
  })
  $$('#latencyChart .bar-row').forEach((row, index) => {
    const item = data.latency[index]
    if (!item) return
    row.querySelector('span').textContent = item[0]
    row.querySelector('i').style.setProperty('--bar-size', item[2])
    row.querySelector('b').textContent = `${item[1].toLocaleString()} ms`
  })
  $('#latencyTotal').textContent = data.latencyTotal
  $('#conversationTitle').textContent = data.title
  $('#conversationBody').innerHTML = `<div class="message user-message">${data.messages[0]}</div><div class="message assistant-message">${data.messages[1]}</div><div class="draft-preview"><div><span>${mode === 'diet' ? 'MEAL ESTIMATE' : 'PLAN DRAFT'}</span><strong>${data.draft}</strong></div><b>${mode === 'diet' ? '待用户确认' : '可编辑草案'}</b></div>`
  const schema = mode === 'diet'
    ? { reply: '已估算一餐', dietPlanDraft: null, meal: { calories: 520, protein: 38, carbs: 55, fat: 12 } }
    : { reply: '已生成计划建议', planDraft: { name: '基础力量计划', items: [{ exerciseId: '0001', targetSets: 3, targetReps: 10, targetWeight: null }] } }
  $('#schemaCode').textContent = JSON.stringify(schema, null, 2)
}

function updateNav(target) {
  $$('[data-target]').forEach((button) => button.classList.toggle('is-active', button.dataset.target === target))
}

function runDemo() {
  const button = $('#runDemo')
  if (button.disabled) return
  button.disabled = true
  document.body.classList.add('is-running')
  const nodes = $$('.pipeline-node')
  nodes.forEach((node) => node.classList.remove('is-complete'))
  let index = 0
  const tick = () => {
    const node = nodes[index]
    if (!node) {
      button.disabled = false
      button.innerHTML = '<span>↻</span>再跑一次请求'
      document.body.classList.remove('is-running')
      return
    }
    node.classList.add('is-complete')
    setStep(node.dataset.step)
    index += 1
    window.setTimeout(tick, 480)
  }
  tick()
}

$$('[data-target]').forEach((button) => button.addEventListener('click', () => {
  updateNav(button.dataset.target)
  document.getElementById(button.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' })
}))
$$('.pipeline-node').forEach((node) => node.addEventListener('click', () => setStep(node.dataset.step)))
$$('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)))
$('#runDemo').addEventListener('click', runDemo)
$('#refreshDemo').addEventListener('click', () => { setStep('input'); setMode('training'); runDemo() })

setMode('training')
setStep('input')
