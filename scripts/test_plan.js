// 功能 #5 自测：纯函数 + mock 云全链路（列表/详情/预填/保存）
const path = require('path')

// ---- 全局桩 ----
global.Page = function (cfg) { global.__lastPage = cfg }
global.wx = {
  navigateTo: () => {},
  navigateBack: () => {},
  showToast: () => {},
  showLoading: () => {},
  hideLoading: () => {}
}

const ROOT = path.resolve(__dirname, '..')
function abs(p) { return path.resolve(ROOT, p) }

// mock exerciseData（仅 getById）
const mockEx = {
  getById: (id) => ({ id, name: 'en_' + id }),
  categoryOptions: () => [],
  list: () => []
}

// 注入依赖桩（覆盖 require 缓存）
function override(p, exp) {
  const f = abs(p)
  require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }
}

// mock 云库：可预置数据 + 记录写入
let MOCK_DB = {}
const mockCloud = {
  C: { PLANS: 'plans', WORKOUTS: 'workouts', SETS: 'sets' },
  db: () => ({
    collection(name) {
      const col = {
        get() { return Promise.resolve({ data: MOCK_DB[name] || [] }) },
        limit() { return col },
        add({ data }) {
          const _id = 'new_' + name
          MOCK_DB[name] = MOCK_DB[name] || []
          MOCK_DB[name].push(Object.assign({ _id }, data))
          return Promise.resolve({ _id })
        },
        doc(id) {
          return {
            get() {
              const arr = MOCK_DB[name] || []
              const found = arr.find((x) => x._id === id) || null
              return Promise.resolve({ data: found })
            },
            set({ data }) {
              const arr = MOCK_DB[name] || []
              const i = arr.findIndex((x) => x._id === id)
              if (i >= 0) arr[i] = Object.assign({}, arr[i], data)
              else arr.push(Object.assign({ _id: id }, data))
              return Promise.resolve({ _id: id })
            }
          }
        }
      }
      return col
    }
  })
}
const mockAuth = {
  ensureUser: () => Promise.resolve({ profile: { createdAt: new Date() }, created: false })
}

override('utils/cloud.js', mockCloud)
override('utils/auth.js', mockAuth)
override('utils/exerciseData.js', mockEx)

// ---- 测试工具 ----
let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg) }
  else { fail++; console.log('  ✗ ' + msg) }
}

// ============ 1) 纯函数 ============
console.log('\n[1] 纯函数 planData')
const pd = require(abs('utils/planData.js'))
const plan = {
  _id: 'p1', name: '练胸日',
  items: [
    { exerciseId: 'e1', exerciseName: '卧推', targetSets: 4, targetReps: 8, targetWeight: 60 },
    { exerciseId: 'e2', exerciseName: '飞鸟', targetSets: 3, targetReps: '', targetWeight: '' },
    { exerciseId: 'e3', exerciseName: '双杠', targetSets: 5, targetReps: 12, targetWeight: 0 }
  ]
}
const session = pd.planToSession(plan, mockEx)
ok(session.length === 3, 'planToSession 返回 3 个动作')
ok(session[0].sets.length === 4, '第1项组数=targetSets(4)')
ok(session[0].sets[0].reps === '8' && session[0].sets[0].weight === '60', '第1项预填次数/重量')
ok(session[1].sets.length === 3 && session[1].sets[0].reps === '', '第2项空目标→空字符串')
ok(session[0].nameEn === 'en_e1', 'nameEn 由 ex.getById 补全')
ok(pd.planToSession({ items: [] }, mockEx).length === 0, '空 items 返回空数组')

const s2 = pd.planSummary(plan)
ok(s2.count === 3, 'planSummary count=3')
ok(s2.namesText === '卧推、飞鸟、双杠', '恰好3项显示全部名称（不加「等N项」）')
const plan4 = { items: [
  { exerciseName: 'A' }, { exerciseName: 'B' }, { exerciseName: 'C' }, { exerciseName: 'D' }
] }
const s4 = pd.planSummary(plan4)
ok(s4.count === 4 && s4.namesText.indexOf('等4项') >= 0, '超过3项显示「等N项」')
const s1 = pd.planSummary({ items: [{ exerciseName: '卧推' }] })
ok(s1.namesText === '卧推', '单动作 summary 仅名称')

// ============ 2) 页面加载/保存（mock 云） ============
console.log('\n[2] 页面链路（mock 云）')

// 预置一个计划
MOCK_DB = { plans: [{ _id: 'p1', name: '练胸日', items: [
  { exerciseId: 'e1', exerciseName: '卧推', targetSets: 4, targetReps: 8, targetWeight: 60 },
  { exerciseId: 'e2', exerciseName: '飞鸟', targetSets: 3, targetReps: '', targetWeight: '' }
] }] }

function loadPage(rel) {
  const f = abs(rel)
  delete require.cache[f]      // 清缓存，确保每次重新执行 Page() 拿到最新 cfg
  delete global.__lastPage
  require(f)
  const cfg = global.__lastPage
  const inst = Object.assign({}, cfg)
  inst.setData = function (obj) { Object.assign(this.data, obj) }
  return inst
}

// 2.1 plans 列表
;(async () => {
  const plans = loadPage('pages/plans/plans.js')
  await plans.onShow.call(plans)
  ok(plans.data.list.length === 1, 'plans 列表加载 1 条')
  ok(plans.data.list[0].count === 2 && plans.data.list[0].namesText === '卧推、飞鸟', 'plans 卡片带 count/namesText')

  // 2.2 plan-detail 加载
  const detail = loadPage('pages/plan-detail/plan-detail.js')
  await detail.onLoad.call(detail, { id: 'p1' })
  ok(detail.data.plan && detail.data.plan.name === '练胸日', 'plan-detail 加载计划名正确')

  // 2.3 record 从计划预填
  const rec = loadPage('pages/record/record.js')
  await rec.onLoad.call(rec, { planId: 'p1' })
  ok(rec.data.session.length === 2, 'record 从计划预填 2 个动作')
  ok(rec.data.session[0].sets.length === 4, 'record 预填组数=4')
  ok(rec.data.planId === 'p1' && rec.data.title === '练胸日', 'record 写入 planId/title')

  // 2.4 plan-edit 新建保存
  MOCK_DB = { plans: [] }
  const edit = loadPage('pages/plan-edit/plan-edit.js')
  edit.data.name = '练腿日'
  edit.data.items = [{ exerciseId: 'e9', exerciseName: '深蹲', targetSets: 5, targetReps: 10, targetWeight: 100 }]
  await edit.save.call(edit)
  ok(MOCK_DB.plans.length === 1, 'plan-edit 新建写入 plans')
  ok(MOCK_DB.plans[0].name === '练腿日' && MOCK_DB.plans[0].items[0].targetSets === 5, 'plan-edit 数据转换正确(Number)')

  // 2.5 record 从计划保存训练（写 workout + sets + planId）
  MOCK_DB = { plans: [{ _id: 'p1', name: '练胸日', items: [
    { exerciseId: 'e1', exerciseName: '卧推', targetSets: 2, targetReps: 8, targetWeight: 60 }
  ] }], workouts: [], sets: [] }
  const rec2 = loadPage('pages/record/record.js')
  await rec2.onLoad.call(rec2, { planId: 'p1' })
  await rec2.save.call(rec2)
  ok(MOCK_DB.workouts.length === 1, 'record 保存写 1 条 workout')
  ok(MOCK_DB.workouts[0].planId === 'p1', 'workout 关联 planId')
  ok(MOCK_DB.workouts[0].title === '练胸日', 'workout 带计划名 title')
  ok(MOCK_DB.sets.length === 2, 'record 保存写 2 条 sets')

  console.log('\n========================================')
  console.log(`  功能 #5 自测结果：${pass} 通过 / ${fail} 失败`)
  console.log('========================================')
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => { console.error('自测异常', e); process.exit(1) })
