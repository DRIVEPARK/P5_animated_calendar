import { computed, onMounted, onUnmounted, ref } from 'vue'
import noteIcon from '../assets/images/note.png'
import reminderIcon from '../assets/images/reminder.png'
import todoIcon from '../assets/images/todo.png'

// Wpisy kalendarza trzymane w localStorage pod kluczem dnia "RRRR-MM-DD".
// Trzy typy o różnej strukturze:
//   note     { type, title, text, timestamp }
//   todo     { type, title, items: [{ id, text, done }], timestamp }
//   reminder { type, text, time: "HH:MM", timestamp }

const STORAGE_KEY = 'p5_calendar_notes'
const FIRED_STORAGE_KEY = 'p5_calendar_fired_reminders'
const ICON_BY_TYPE = {
  note: noteIcon,
  reminder: reminderIcon,
  todo: todoIcon,
}

const notes = ref({})
const firedReminders = ref({})
// Kolejka przypomnień do pokazania - kilka może wypaść o tej samej godzinie
const reminderQueue = ref([])

let initialized = false
let notificationsAllowed = false
let reminderTimer = null
let activeConsumers = 0

export function formatKey(y, mZero, d) {
  const pad = n => String(n).padStart(2, '0')
  return `${y}-${pad(mZero + 1)}-${pad(d)}`
}

export function makeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

// Stare wpisy (jeden tekst + done) przechodzą na nowy format bez utraty danych
function migrateEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  const base = { ...entry, timestamp: entry.timestamp || Date.now() }

  if (base.type === 'todo') {
    if (Array.isArray(base.items)) {
      // Nowy format - tylko uzupełniamy brakujące pola, żeby uszkodzony wpis nie wywrócił widoku
      const items = base.items
        .filter(item => item && typeof item.text === 'string')
        .map(item => ({ id: item.id || makeId(), text: item.text, done: !!item.done }))
      return items.length ? { title: '', ...base, items } : null
    }
    // Stary format: jeden tekst + done -> lista z jednym punktem
    const { text, done, time, ...rest } = base
    return text ? { ...rest, title: '', items: [{ id: makeId(), text, done: !!done }] } : null
  }
  if (base.type === 'note') {
    return { title: '', text: '', ...base }
  }
  if (base.type === 'reminder') {
    return { text: '', time: '', ...base }
  }
  return null
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const clean = {}
    Object.entries(parsed).forEach(([key, entries]) => {
      if (!Array.isArray(entries)) return
      const migrated = entries.map(migrateEntry).filter(Boolean)
      if (migrated.length) clean[key] = migrated
    })
    notes.value = clean
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

  reminderQueue.value = [
    ...reminderQueue.value,
    { id: fireId, text: entry.text, time: entry.time, dateKey: todayKey },
  ]

  // Powiadomienie systemowe - przydaje się, gdy karta z aplikacją jest w tle
  if (notificationsAllowed && 'Notification' in window) {
    try {
      new Notification(`Reminder ${entry.time}`, { body: entry.text, tag: fireId })
    } catch (err) {
      console.error('Notification error', err)
    }
  }
}

function parseTime(time, base) {
  const [h, m] = String(time || '').split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0)
}

function checkReminders() {
  const now = new Date()
  const todayKey = formatKey(now.getFullYear(), now.getMonth(), now.getDate())
  const entries = notes.value[todayKey]
  if (!Array.isArray(entries)) return

  entries.forEach(entry => {
    if (entry.type !== 'reminder') return
    const remindAt = parseTime(entry.time, now)
    if (!remindAt) return

    // Bez indeksu - usunięcie wcześniejszego wpisu nie może zmienić identyfikatora
    const fireId = `${todayKey}:${entry.timestamp}`
    if (now >= remindAt && !firedReminders.value[fireId]) {
      triggerReminder(fireId, todayKey, entry)
    }
  })
}

// Status przypomnienia do pokazania na liście wpisów
export function reminderStatus(dateKey, entry, now = new Date()) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const remindAt = parseTime(entry.time, new Date(y, m - 1, d))
  if (!remindAt) return 'no-time'
  return now >= remindAt ? 'done' : 'upcoming'
}

// Krótki opis wpisu na pasku w komórce kalendarza
export function entrySummary(entry) {
  if (entry.type === 'todo') {
    const done = entry.items.filter(i => i.done).length
    const label = entry.title || entry.items[0]?.text || 'To-do'
    return `${label} ${done}/${entry.items.length}`
  }
  if (entry.type === 'note') return entry.title || entry.text
  return entry.text
}

function buildEntry(type, payload) {
  const timestamp = Date.now()
  if (type === 'todo') {
    const items = (payload.items || [])
      .map(text => String(text).trim())
      .filter(Boolean)
      .map(text => ({ id: makeId(), text, done: false }))
    if (!items.length) return null
    return { type, title: (payload.title || '').trim(), items, timestamp }
  }
  if (type === 'note') {
    const title = (payload.title || '').trim()
    const text = (payload.text || '').trim()
    if (!title && !text) return null
    return { type, title, text, timestamp }
  }
  if (type === 'reminder') {
    const text = (payload.text || '').trim()
    if (!text || !payload.time) return null
    return { type, text, time: payload.time, timestamp }
  }
  return null
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

  const activeReminder = computed(() => reminderQueue.value[0] || null)

  function updateEntries(key, updater) {
    const entries = Array.isArray(notes.value[key]) ? [...notes.value[key]] : []
    const next = updater(entries)
    const updated = { ...notes.value, [key]: next }
    if (!next.length) delete updated[key]
    notes.value = updated
    persistNotes()
  }

  function addEntry(key, payload) {
    const entry = buildEntry(payload.type, payload)
    if (!entry) return false
    updateEntries(key, entries => [...entries, entry])
    if (entry.type === 'reminder') {
      requestNotificationPermission()
      checkReminders()
    }
    return true
  }

  function toggleTodoItem(key, entryIndex, itemId) {
    updateEntries(key, entries => {
      const entry = entries[entryIndex]
      if (!entry || entry.type !== 'todo') return entries
      entries[entryIndex] = {
        ...entry,
        items: entry.items.map(item => (item.id === itemId ? { ...item, done: !item.done } : item)),
      }
      return entries
    })
  }

  function removeEntryByKey(key, index) {
    updateEntries(key, entries => {
      if (index >= 0 && index < entries.length) entries.splice(index, 1)
      return entries
    })
  }

  function dismissReminder(id) {
    reminderQueue.value = reminderQueue.value.filter(r => r.id !== id)
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
    activeReminder,
    addEntry,
    toggleTodoItem,
    removeEntryByKey,
    dismissReminder,
  }
}
