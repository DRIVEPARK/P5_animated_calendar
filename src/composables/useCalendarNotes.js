import { computed, onMounted, onUnmounted, ref } from 'vue'
import noteIcon from '../assets/images/note.png'
import reminderIcon from '../assets/images/reminder.png'
import todoIcon from '../assets/images/todo.png'

const STORAGE_KEY = 'p5_calendar_notes'
const FIRED_STORAGE_KEY = 'p5_calendar_fired_reminders'
const ICON_BY_TYPE = {
  note: noteIcon,
  reminder: reminderIcon,
  todo: todoIcon,
}

const notes = ref({})
const firedReminders = ref({})
const toastVisible = ref(false)
const toastMessage = ref('')

let initialized = false
let notificationsAllowed = false
let reminderTimer = null
let activeConsumers = 0

export function formatKey(y, mZero, d) {
  const pad = n => String(n).padStart(2, '0')
  return `${y}-${pad(mZero + 1)}-${pad(d)}`
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    Object.keys(parsed).forEach(key => {
      if (!Array.isArray(parsed[key])) parsed[key] = []
    })
    notes.value = parsed
  } catch (err) {
    console.error('Failed to load notes', err)
    notes.value = {}
  }
}

function persistNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value))
  } catch (err) {
    console.error('Failed to save notes', err)
  }
}

// Przechowujemy tylko wpisy z dzisiejszego dnia - starsze nie są już potrzebne
function loadFiredReminders(todayKey) {
  try {
    const raw = localStorage.getItem(FIRED_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const fresh = {}
    Object.keys(parsed).forEach(fireId => {
      if (fireId.startsWith(`${todayKey}:`)) fresh[fireId] = true
    })
    firedReminders.value = fresh
  } catch (err) {
    console.error('Failed to load fired reminders', err)
    firedReminders.value = {}
  }
}

function persistFiredReminders() {
  try {
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(firedReminders.value))
  } catch (err) {
    console.error('Failed to save fired reminders', err)
  }
}

function syncNotificationPermission() {
  notificationsAllowed = 'Notification' in window && Notification.permission === 'granted'
}

// Prośba o zgodę tylko w odpowiedzi na akcję użytkownika (zapis przypomnienia),
// a nie przy starcie strony - przeglądarki blokują lub karzą automatyczne prośby
function requestNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') {
    syncNotificationPermission()
    return
  }
  Notification.requestPermission()
    .then(result => {
      notificationsAllowed = result === 'granted'
    })
    .catch(() => {})
}

function triggerReminder(fireId, todayKey, entry) {
  // Po północy odrzucamy identyfikatory z poprzednich dni
  const kept = Object.fromEntries(
    Object.keys(firedReminders.value)
      .filter(id => id.startsWith(`${todayKey}:`))
      .map(id => [id, true])
  )
  firedReminders.value = { ...kept, [fireId]: true }
  persistFiredReminders()
  toastMessage.value = `Reminder ${entry.time || ''} - ${entry.text}`.trim()
  toastVisible.value = true

  if (notificationsAllowed && 'Notification' in window) {
    try {
      new Notification('Reminder', { body: entry.text })
    } catch (err) {
      console.error('Notification error', err)
    }
  }
}

function checkReminders() {
  const now = new Date()
  const todayKey = formatKey(now.getFullYear(), now.getMonth(), now.getDate())
  const entries = notes.value[todayKey]
  if (!Array.isArray(entries)) return

  entries.forEach(entry => {
    if (entry.type !== 'reminder' || !entry.time) return
    const [h, m] = entry.time.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return

    const remindAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
    // Bez indeksu - usunięcie wcześniejszego wpisu nie może zmienić identyfikatora
    const fireId = `${todayKey}:${entry.timestamp}`
    if (now >= remindAt && !firedReminders.value[fireId]) {
      triggerReminder(fireId, todayKey, entry)
    }
  })
}

export function useCalendarNotes() {
  if (!initialized) {
    loadNotes()
    const now = new Date()
    loadFiredReminders(formatKey(now.getFullYear(), now.getMonth(), now.getDate()))
    initialized = true
  }

  const dayIcons = computed(() => {
    const map = {}
    Object.entries(notes.value).forEach(([key, entries]) => {
      if (!Array.isArray(entries)) return
      const icons = new Set(entries.map(e => ICON_BY_TYPE[e.type]).filter(Boolean))
      if (icons.size) map[key] = Array.from(icons)
    })
    return map
  })

  function addEntry(key, { type, text, time = '' }) {
    const existing = Array.isArray(notes.value[key]) ? notes.value[key] : []
    const entry = {
      type,
      text,
      time,
      done: false,
      timestamp: Date.now(),
    }
    notes.value = { ...notes.value, [key]: [...existing, entry] }
    persistNotes()
    if (type === 'reminder') requestNotificationPermission()
    checkReminders()
  }

  function toggleTodoByKey(key, index) {
    const entries = Array.isArray(notes.value[key]) ? [...notes.value[key]] : []
    const item = entries[index]
    if (!item || item.type !== 'todo') return
    entries[index] = { ...item, done: !item.done }
    notes.value = { ...notes.value, [key]: entries }
    persistNotes()
  }

  function removeEntryByKey(key, index) {
    const entries = Array.isArray(notes.value[key]) ? [...notes.value[key]] : []
    if (index < 0 || index >= entries.length) return
    entries.splice(index, 1)

    const updated = { ...notes.value, [key]: entries }
    if (!entries.length) delete updated[key]
    notes.value = updated
    persistNotes()
  }

  function closeToast() {
    toastVisible.value = false
  }

  onMounted(() => {
    activeConsumers += 1
    if (activeConsumers === 1) {
      syncNotificationPermission()
      checkReminders()
      reminderTimer = setInterval(checkReminders, 1000)
    }
  })

  onUnmounted(() => {
    activeConsumers = Math.max(0, activeConsumers - 1)
    if (activeConsumers === 0 && reminderTimer) {
      clearInterval(reminderTimer)
      reminderTimer = null
    }
  })

  return {
    notes,
    dayIcons,
    toastVisible,
    toastMessage,
    addEntry,
    toggleTodoByKey,
    removeEntryByKey,
    closeToast,
  }
}
