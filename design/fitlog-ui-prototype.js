(function () {
  'use strict'

  var root = document.documentElement
  var screens = document.querySelectorAll('.screen')
  var navItems = document.querySelectorAll('.nav-item')
  var toastTimer = null
  var agentOnline = true

  function showToast(message) {
    var toast = document.getElementById('toast')
    if (!toast) return
    toast.textContent = message || '已完成'
    toast.classList.add('is-visible')
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible')
    }, 2200)
  }

  function showScreen(name) {
    var target = document.getElementById('screen-' + name)
    if (!target) return
    screens.forEach(function (screen) {
      screen.classList.toggle('is-active', screen === target)
    })
    navItems.forEach(function (item) {
      var active = item.dataset.screen === name
      item.classList.toggle('is-active', active)
      if (active) item.setAttribute('aria-current', 'page')
      else item.removeAttribute('aria-current')
    })
    var viewport = document.querySelector('.app-viewport')
    if (viewport) viewport.scrollTop = 0
  }

  function toggleTheme() {
    var nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = nextTheme
    showToast(nextTheme === 'dark' ? '已切换深色主题' : '已切换浅色主题')
  }

  function openExerciseDetail(button) {
    var overlay = document.getElementById('detail-overlay')
    if (!overlay) return
    document.getElementById('detail-title').textContent = button.dataset.name || '动作详情'
    document.getElementById('detail-en').textContent = button.dataset.en || ''
    document.getElementById('detail-muscle').textContent = button.dataset.muscle || '未标注'
    document.getElementById('detail-equipment').textContent = button.dataset.equipment || '自重'
    overlay.hidden = false
  }

  function closeExerciseDetail() {
    var overlay = document.getElementById('detail-overlay')
    if (overlay) overlay.hidden = true
  }

  function calculateBmr(body) {
    var sexOffset = body.sex === 'female' ? -161 : 5
    return Math.round(10 * body.weight + 6.25 * body.height - 5 * body.age + sexOffset)
  }

  function renderEnergySummary() {
    var body = { weight: 68, height: 170, age: 25, sex: 'male' }
    var exercise = 326
    var bmr = calculateBmr(body)
    document.querySelectorAll('[data-energy="bmr"]').forEach(function (item) { item.textContent = bmr.toLocaleString('en-US') })
    document.querySelectorAll('[data-energy="exercise"]').forEach(function (item) { item.textContent = exercise.toLocaleString('en-US') })
    document.querySelectorAll('[data-energy="total"]').forEach(function (item) { item.textContent = (bmr + exercise).toLocaleString('en-US') })
  }

  function openEnergyDetail() {
    var overlay = document.getElementById('energy-overlay')
    if (overlay) overlay.hidden = false
  }

  function closeEnergyDetail() {
    var overlay = document.getElementById('energy-overlay')
    if (overlay) overlay.hidden = true
  }

  function setAgentAvailability(online) {
    agentOnline = online
    var screen = document.getElementById('screen-coach')
    var status = screen && screen.querySelector('.status-pill')
    var label = screen && screen.querySelector('.agent-status-label')
    var offlineMessage = document.getElementById('agent-offline-message')
    if (screen) screen.classList.toggle('agent-offline', !online)
    if (status) {
      status.classList.toggle('is-offline', !online)
      status.setAttribute('aria-pressed', String(online))
    }
    if (label) label.textContent = online ? '在线' : '离线'
    if (offlineMessage) offlineMessage.hidden = online
    document.querySelectorAll('#coach-form input, #coach-form button, #screen-coach .prompt-chip, .coach-topline .text-button').forEach(function (control) {
      control.disabled = !online
    })
  }

  function toggleAgentAvailability() {
    setAgentAvailability(!agentOnline)
    showToast(agentOnline ? '线上训练助手已连接' : '已断开线上服务，本地助手不会接管')
  }

  function pickTrainingImage() {
    if (!agentOnline) {
      showToast('训练助手离线，暂时不能上传图片')
      return
    }
    var input = document.getElementById('coach-image')
    if (input) input.click()
  }

  function handleTrainingImage(event) {
    var file = event.target.files && event.target.files[0]
    if (!file) return
    showToast('已选择图片，等待线上分析')
    event.target.value = ''
  }

  function filterExercises(value) {
    var query = (value || '').trim().toLowerCase()
    var activeFilter = document.querySelector('.filter-chip.is-active')
    var category = activeFilter ? activeFilter.dataset.filter : 'all'
    var visibleCount = 0
    document.querySelectorAll('[data-exercise]').forEach(function (item) {
      var matchesQuery = !query || item.textContent.toLowerCase().indexOf(query) >= 0
      var matchesCategory = category === 'all' || item.dataset.category === category
      var visible = matchesQuery && matchesCategory
      item.hidden = !visible
      if (visible) visibleCount += 1
    })
    document.getElementById('exercise-empty').hidden = visibleCount > 0
  }

  function appendMessage(text, type) {
    var list = document.getElementById('chat-list')
    if (!list) return
    var message = document.createElement('div')
    message.className = 'message ' + (type === 'user' ? 'user-message' : 'assistant-message')
    if (type !== 'user') {
      var label = document.createElement('span')
      label.className = 'message-label'
      label.textContent = '教练'
      message.appendChild(label)
    }
    var paragraph = document.createElement('p')
    paragraph.textContent = text
    message.appendChild(paragraph)
    list.appendChild(message)
    list.scrollTop = list.scrollHeight
  }

  function sendCoachMessage(event) {
    event.preventDefault()
    if (!agentOnline) {
      showToast('训练助手离线，暂时不能发送')
      return
    }
    var input = document.getElementById('coach-input')
    var text = input.value.trim()
    if (!text) return
    appendMessage(text, 'user')
    input.value = ''
    window.setTimeout(function () {
      appendMessage('收到。我会结合你最近的训练量，先给你一个能在今天完成的版本。', 'assistant')
    }, 420)
  }

  function selectCalendarDay(button) {
    document.querySelectorAll('.day.is-selected').forEach(function (day) {
      day.classList.remove('is-selected')
    })
    button.classList.add('is-selected')
    var day = button.dataset.day
    var detail = document.querySelector('#day-detail .eyebrow')
    var score = document.querySelector('.day-score')
    if (detail) detail.textContent = '2026年8月' + day + '日 · 星期二'
    if (score) score.textContent = button.classList.contains('trained') ? '100%' : '—'
  }

  document.addEventListener('click', function (event) {
    var screenButton = event.target.closest('[data-screen]')
    if (screenButton) {
      showScreen(screenButton.dataset.screen)
      return
    }

    var actionButton = event.target.closest('[data-action]')
    if (actionButton) {
      var action = actionButton.dataset.action
      if (action === 'toggle-theme') toggleTheme()
      if (action === 'toggle-agent') toggleAgentAvailability()
      if (action === 'pick-image') pickTrainingImage()
      if (action === 'close-detail') closeExerciseDetail()
      if (action === 'energy-detail') openEnergyDetail()
      if (action === 'close-energy') closeEnergyDetail()
      if (action === 'toast') showToast(actionButton.dataset.message)
      if (action === 'start-workout' || action === 'resume-workout') {
        actionButton.innerHTML = '<span class="button-symbol">●</span><span>训练进行中</span>'
        showToast('训练已开始，保持节奏')
      }
      if (action === 'add-exercise') {
        closeExerciseDetail()
        showToast('动作已加入训练计划')
      }
    }

    var exerciseButton = event.target.closest('[data-exercise]')
    if (exerciseButton) openExerciseDetail(exerciseButton)

    var filterButton = event.target.closest('[data-filter]')
    if (filterButton) {
      document.querySelectorAll('.filter-chip').forEach(function (chip) {
        chip.classList.toggle('is-active', chip === filterButton)
      })
      filterExercises(document.getElementById('exercise-search').value)
    }

    var promptButton = event.target.closest('[data-prompt]')
    if (promptButton && agentOnline) {
      document.getElementById('coach-input').value = promptButton.dataset.prompt
      document.getElementById('coach-input').focus()
    }

    var dayButton = event.target.closest('.day[data-day]')
    if (dayButton) selectCalendarDay(dayButton)
  })

  var search = document.getElementById('exercise-search')
  if (search) search.addEventListener('input', function () { filterExercises(search.value) })

  var coachForm = document.getElementById('coach-form')
  if (coachForm) coachForm.addEventListener('submit', sendCoachMessage)

  var imageInput = document.getElementById('coach-image')
  if (imageInput) imageInput.addEventListener('change', handleTrainingImage)

  var firstDay = document.querySelector('.day[data-day="4"]')
  if (firstDay) firstDay.classList.add('is-selected')
  renderEnergySummary()
})()
