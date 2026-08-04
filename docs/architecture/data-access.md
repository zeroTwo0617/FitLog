# Data access layer

Pages must use `utils/repositories/*` for all CloudBase database reads and writes.
Pages must not call `wx.cloud.callFunction`, `wx.cloud.database`, or collection mutation methods directly.

Repositories are the only client-side boundary for:

- workouts and sets: `repositories/workout.js`
- plans: `repositories/plan.js`
- body metrics: `repositories/body.js`
- nutrition logs and diet plans: `repositories/nutrition.js`
- users: `repositories/user.js`
- agent sessions: `repositories/agent.js`
- export tools: `repositories/system.js`

All mutations use CloudBase functions. The functions derive `_openid` from
`cloud.getWXContext()` and validate input again on the server. Client validation
is only for user feedback.

Deploy these functions after every change:

`saveWorkout`, `ensureUser`, `updateUserActive`, `savePlan`, `deletePlan`,
`saveBodyMetric`, `saveNutritionLog`, `deleteNutritionLog`, `agent`,
and `exportData`.
