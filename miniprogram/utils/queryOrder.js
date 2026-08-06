function applyOrder(query, rules) {
  if (!query || typeof query.orderBy !== 'function') return query
  return (Array.isArray(rules) ? rules : []).reduce((current, rule) => {
    if (!rule || !rule.field || (rule.direction !== 'asc' && rule.direction !== 'desc')) return current
    return current.orderBy(rule.field, rule.direction)
  }, query)
}

module.exports = { applyOrder }
