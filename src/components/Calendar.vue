<template>
  <div class="calendar-root">
    <button class="close-btn" @click="emitClose">
      <img :src="closeIcon" alt="close" />
    </button>
    <div class="grid-overlay">
      <div class="grid-container">
        <div class="header-row">
          <div
            v-for="(head, idx) in header"
            :key="`h-${idx}`"
            class="cell header-cell"
            :class="{
              sunday: head.dow === 6,
              saturday: head.dow === 5
            }"
          >
            <span v-if="idx === 0" class="month-badge">{{ monthLabel }}</span>
            <span class="day-label">{{ head.label }}</span>
          </div>
        </div>

        <div class="dates-grid">
          <div
            v-for="(day, idx) in grid"
            :key="idx"
            class="cell"
            :class="{
              sunday: day.dow === 6,
              saturday: day.dow === 5,
              muted: day.type !== 'current',
              hoverable: day.type === 'current'
            }"
            :ref="el => setCellRef(idx, el)"
            @click="onCellClick(idx, day)"
          >
            <img v-if="day.type === 'current'" class="knife" :src="knifeSrc" alt="" />
            <span class="label day-number">{{ day.day }}</span>
            <div
              v-if="day.type === 'current' && dayIcons[dayKey(day.day)]?.length"
              class="day-icons"
              @click.stop="openDetail(day)"
            >
              <img v-for="(icon, i) in dayIcons[dayKey(day.day)]" :key="i" :src="icon" alt="" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="popoverVisible"
      class="knife-popover"
      :style="{ left: `${popoverPosition.x}px`, top: `${popoverPosition.y}px` }"
      @click.stop
    >
      <div class="popover-label">{{ selectedLabel }}</div>
      <div class="popover-actions">
        <button class="popover-btn" @click="openModal('note')">Add note</button>
        <button class="popover-btn" @click="openModal('reminder')">Add reminder</button>
        <button class="popover-btn" @click="openModal('todo')">Add to-do</button>
      </div>
    </div>

    <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">{{ modalTitle }}</div>
          <div class="modal-subtitle">{{ selectedLabel }}</div>
        </div>
        <textarea
          v-model="modalForm.text"
          class="modal-textarea"
          rows="5"
          placeholder="Write something memorable..."
        ></textarea>
        <div v-if="modalForm.type === 'reminder'" class="modal-field">
          <label class="modal-label">Reminder time</label>
          <input v-model="modalForm.time" type="time" class="modal-input" />
        </div>
        <div class="modal-actions">
          <button class="modal-btn ghost" @click="closeModal">Cancel</button>
          <button class="modal-btn" @click="saveNote">Save</button>
        </div>
      </div>
    </div>

    <div v-if="detailOpen" class="modal-backdrop" @click.self="closeDetail">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">Entries</div>
          <div class="modal-subtitle">{{ selectedLabel }}</div>
        </div>
        <div v-if="detailEntries.length" class="detail-list">
          <div v-for="(entry, i) in detailEntries" :key="i" class="detail-item">
            <span class="pill" :class="entry.type">{{ entry.type }}</span>
            <span class="detail-text">{{ entry.text }}</span>
            <span v-if="entry.type === 'reminder' && entry.time" class="detail-time">{{ entry.time }}</span>
            <button class="chip-delete" @click="removeEntry(i)">Delete</button>
          </div>
        </div>
        <div v-else class="detail-empty">No entries for this day.</div>
        <div class="modal-actions">
          <button class="modal-btn" @click="closeDetail">Close</button>
        </div>
      </div>
    </div>

    <div v-if="toastVisible" class="toast">
      <div class="toast-text">{{ toastMessage }}</div>
      <button class="toast-btn" @click="closeToast">Got it</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import gsap from 'gsap'

const emit = defineEmits(['close'])

const today = new Date()
const year = today.getFullYear()
const month = today.getMonth()
const monthLabel = today.toLocaleString('en-US', { month: 'long' })
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const knifeSrc = new URL('../assets/images/knife.png', import.meta.url).href
const noteIcon = new URL('../assets/images/note.png', import.meta.url).href
const reminderIcon = new URL('../assets/images/reminder.png', import.meta.url).href
const todoIcon = new URL('../assets/images/todo.png', import.meta.url).href
const closeIcon = new URL('../assets/images/cancel.png', import.meta.url).href
const KNIFE_DURATION = 0.15
const STORAGE_KEY = 'p5_calendar_notes'
const cellRefs = ref({})
const activeKnifeIdx = ref(null)
const popoverVisible = ref(false)
const popoverPosition = ref({ x: 0, y: 0 })
const selectedDay = ref(null)
const modalOpen = ref(false)
const modalForm = ref({ type: 'note', text: '', time: '' })
const notes = ref({})
const detailOpen = ref(false)
const detailEntries = ref([])
const firedReminders = ref({})
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer = null
let reminderTimer = null
let notificationsAllowed = false

function emitClose() {
  emit('close')
}

const firstDay = new Date(year, month, 1)
const startDowSunday = firstDay.getDay() // 0=Sun
const startDowMonday = (startDowSunday + 6) % 7 // 0=Mon ... 6=Sun
const daysInMonth = new Date(year, month + 1, 0).getDate()
const prevMonthDays = new Date(year, month, 0).getDate()

const grid = computed(() => {
  const cells = []
  const total = 42 // 6 tygodni * 7 kolumn

  for (let i = 0; i < startDowMonday; i++) {
    cells.push({ day: prevMonthDays - startDowMonday + i + 1, type: 'prev', dow: i })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (startDowMonday + d - 1) % 7
    cells.push({ day: d, type: 'current', dow })
  }

  while (cells.length < total) {
    const nextDay = cells.length - (startDowMonday + daysInMonth) + 1
    const dow = cells.length % 7
    cells.push({ day: nextDay, type: 'next', dow })
  }

  return cells
})

const header = computed(() => {
  return dayNames.map((name, i) => ({ label: name, type: 'dow', dow: i === 6 ? 6 : i === 5 ? 5 : i }))
})

const selectedLabel = computed(() => {
  if (!selectedDay.value) return ''
  return `${monthLabel} ${selectedDay.value.day}, ${year}`
})

const modalTitle = computed(() => {
  if (modalForm.value.type === 'note') return 'Note'
  if (modalForm.value.type === 'reminder') return 'Reminder'
  return 'To-do'
})

const dayIcons = computed(() => {
  const map = {}
  Object.entries(notes.value).forEach(([key, entries]) => {
    const icons = new Set()
    if (Array.isArray(entries)) {
      entries.forEach(entry => {
        if (entry.type === 'note') icons.add(noteIcon)
        if (entry.type === 'reminder') icons.add(reminderIcon)
        if (entry.type === 'todo') icons.add(todoIcon)
      })
    }
    if (icons.size) map[key] = Array.from(icons)
  })
  return map
})

onMounted(() => {
  loadNotes()
  initNotifications()
  checkReminders()
  reminderTimer = setInterval(checkReminders, 1000)
})

onUnmounted(() => {
  if (reminderTimer) clearInterval(reminderTimer)
})

function setCellRef(idx, el) {
  if (el) cellRefs.value[idx] = el
}

function formatKey(y, mZero, d) {
  const pad = n => String(n).padStart(2, '0')
  return `${y}-${pad(mZero + 1)}-${pad(d)}`
}

function dayKey(dayNumber) {
  return formatKey(year, month, dayNumber)
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

function initNotifications() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    notificationsAllowed = true
    return
  }
  Notification.requestPermission().then(result => {
    notificationsAllowed = result === 'granted'
  }).catch(() => {})
}

function showToast(message) {
  toastMessage.value = message
  toastVisible.value = true
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
}

function closeToast() {
  toastVisible.value = false
}

function triggerReminder(fireId, entry) {
  firedReminders.value = { ...firedReminders.value, [fireId]: true }
  const message = `Reminder ${entry.time || ''} - ${entry.text}`
  showToast(message.trim())
  if (notificationsAllowed && 'Notification' in window) {
    try {
      new Notification('Reminder', { body: entry.text })
    } catch (err) {
      console.error('Notification error', err)
    }
  }
}

function openPopover(rect) {
  popoverPosition.value = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2 - 8
  }
  popoverVisible.value = true
}

function closePopover() {
  popoverVisible.value = false
}

function openModal(type) {
  if (!selectedDay.value) return
  modalForm.value.type = type
  modalForm.value.text = ''
  modalForm.value.time = ''
  modalOpen.value = true
  closePopover()
}

function closeModal() {
  modalOpen.value = false
}

function saveNote() {
  if (!selectedDay.value) return
  const text = modalForm.value.text.trim()
  const time = modalForm.value.type === 'reminder' ? modalForm.value.time : ''
  if (!text) {
    closeModal()
    return
  }
  const key = dayKey(selectedDay.value.day)
  const entry = {
    type: modalForm.value.type,
    text,
    time,
    timestamp: Date.now()
  }
  const existing = Array.isArray(notes.value[key]) ? notes.value[key] : []
  notes.value = { ...notes.value, [key]: [...existing, entry] }
  persistNotes()
  // if reminder for today, run check immediately so we don't miss due times
  checkReminders()
  closeModal()
}

function openDetail(day) {
  selectedDay.value = day
  const key = dayKey(day.day)
  detailEntries.value = Array.isArray(notes.value[key]) ? notes.value[key] : []
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
}

function checkReminders() {
  const now = new Date()
  const todayKey = formatKey(now.getFullYear(), now.getMonth(), now.getDate())
  const entries = notes.value[todayKey]
  if (!Array.isArray(entries)) return

  entries.forEach((entry, idx) => {
    if (entry.type !== 'reminder' || !entry.time) return
    const [h, m] = entry.time.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return
    const remindAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
    if (now >= remindAt) {
      const fireId = `${todayKey}:${idx}:${entry.timestamp}`
      if (firedReminders.value[fireId]) return
      triggerReminder(fireId, entry)
    }
  })
}

function removeEntry(index) {
  if (!selectedDay.value) return
  const key = dayKey(selectedDay.value.day)
  const entries = Array.isArray(notes.value[key]) ? [...notes.value[key]] : []
  if (index < 0 || index >= entries.length) return
  entries.splice(index, 1)
  const updated = { ...notes.value, [key]: entries }
  // clean up empty arrays to keep storage tidy
  if (!entries.length) delete updated[key]
  notes.value = updated
  detailEntries.value = entries
  persistNotes()
}

function onCellClick(idx, day) {
  if (day.type !== 'current') return
  closePopover()
  const cell = cellRefs.value[idx]
  if (!cell) return
  const knife = cell.querySelector('.knife')
  const target = cell.querySelector('.day-number')
  if (!knife || !target) return

  // hide previous knife
  if (activeKnifeIdx.value !== null && activeKnifeIdx.value !== idx) {
    const prevCell = cellRefs.value[activeKnifeIdx.value]
    const prevKnife = prevCell?.querySelector('.knife')
    if (prevKnife) {
      gsap.killTweensOf(prevKnife)
      gsap.set(prevKnife, { opacity: 0 })
    }
  }

  const cellRect = cell.getBoundingClientRect()
  const tgtRect = target.getBoundingClientRect()
  const targetX = tgtRect.left - cellRect.left + tgtRect.width / 2
  const targetY = tgtRect.top - cellRect.top + tgtRect.height / 2

    const startX = cellRect.width * 0.5
    const startY = -cellRect.height * 0.6
    const compact = window.innerWidth <= 1024 || window.innerHeight <= 756
    const endX = compact ? 40 : 8
    const endY = compact ? -70 : -45

  gsap.killTweensOf(knife)
    gsap.set(knife, { opacity: 0, x: startX, y: startY, rotate: 35 })
    gsap.to(knife, {
      opacity: 1,
      x: endX,
      y: endY,
      rotate: -10,
      duration: KNIFE_DURATION,
      ease: 'power3.inOut',
      onComplete: () => {
        selectedDay.value = day
        const knifeRect = knife.getBoundingClientRect()
        openPopover(knifeRect)
      }
    })

  activeKnifeIdx.value = idx
}
</script>

<style scoped>
.calendar-root {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.close-btn {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 420;
  background: transparent;
  border: none;
  padding: 10px;
  cursor: pointer;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.close-btn img {
  width: 34px;
  height: 34px;
  transition: transform 0.18s ease;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}

.close-btn:hover img {
  transform: rotate(90deg);
}

.grid-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  pointer-events: auto;
}

.grid-container {
  width: 90vw;
  height: 85vh;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-family: 'p5hatty', sans-serif;
}

.header-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  min-height: 140px;
}

.dates-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: 1fr;
}

.cell {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  font-size: clamp(32px, 2.6vw, 44px);
  font-weight: 600;
  padding: 14px;
  box-sizing: border-box;
  position: relative;
}

.cell.hoverable {
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;
}

.cell.hoverable:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.06);
}

.header-cell {
  background: rgba(255, 255, 255, 0.08);
  font-size: clamp(20px, 2.8vw, 38px);
  font-weight: 700;
  text-transform: capitalize;
  justify-content: center;
  align-items: center;
}

.month-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  font-size: clamp(18px, 2.4vw, 30px);
  font-weight: 700;
  text-transform: capitalize;
  opacity: 0.9;
}

.day-label {
  pointer-events: none;
  display: block;
  transform: translateY(10px);
}

.cell.saturday {
  color: #4da3ff;
  border-color: #4da3ff;
}

.cell.sunday {
  color: #ff4d4d;
  border-color: #ff4d4d;
}

.cell.muted {
  opacity: 0.35;
  pointer-events: none;
}

.label {
  pointer-events: none;
}

.day-number {
  position: relative;
}

.knife {
  position: absolute;
  top: 0;
  left: 0;
  width: 2.2em;
  height: auto;
  object-fit: contain;
  transform-origin: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
  opacity: 0;
  z-index: 5;
}

.knife-popover {
  position: fixed;
  transform: translate(-50%, -110%);
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  z-index: 300;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: p5hatty, 'Persona5MenuFontPrototype-Regular', sans-serif;
}

.popover-label {
  font-size: 16px;
  opacity: 0.85;
}

.popover-actions {
  display: flex;
  gap: 8px;
}

.popover-btn {
  flex: 1;
  background: #fff;
  color: #000;
  border: none;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 19px;
  font-family: p5hatty, 'Persona5MenuFontPrototype-Regular', sans-serif;
  transition: transform 0.15s ease, filter 0.15s ease, background 0.15s ease;
}

.popover-btn:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #4da3ff, #4dffcf);
  filter: brightness(1.03);
}

.day-icons {
  position: absolute;
  right: 10px;
  bottom: 8px;
  display: flex;
  gap: 6px;
  pointer-events: auto;
  z-index: 6;
}

.day-icons img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 350;
}

.modal-card {
  width: min(480px, 90vw);
  background: rgba(15, 15, 15, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #fff;
}

.modal-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-title {
  font-size: 22px;
  font-weight: 800;
}

.modal-subtitle {
  font-size: 14px;
  opacity: 0.8;
}

.modal-textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  resize: vertical;
  min-height: 140px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 10px 0 6px;
  max-height: 320px;
  overflow-y: auto;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.detail-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.detail-time {
  font-size: 13px;
  opacity: 0.8;
}

.chip-delete {
  background: rgba(255, 77, 77, 0.15);
  color: #ffb3b3;
  border: 1px solid rgba(255, 77, 77, 0.4);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.12s ease;
}

.chip-delete:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 18px 22px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.55);
  z-index: 400;
  min-width: 320px;
  max-width: 90vw;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
}

.toast-text {
  flex: 1;
  font-size: 16px;
  line-height: 1.35;
}

.toast-btn {
  background: linear-gradient(135deg, #4da3ff, #4dffcf);
  color: #000;
  border: none;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.12s ease;
}

.toast-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.detail-empty {
  margin: 12px 0;
  font-size: 14px;
  opacity: 0.8;
}

.pill {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #000;
}

.pill.note {
  background: #ffd166;
}

.pill.reminder {
  background: #4da3ff;
}

.pill.todo {
  background: #4dffcf;
}

.modal-btn {
  background: linear-gradient(135deg, #4da3ff, #4dffcf);
  color: #000;
  border: none;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.modal-btn.ghost {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

@media (max-width: 1024px) {
  .grid-container {
    width: 100vw;
    height: 90vh;
    border-radius: 0;
    border-width: 0;
  }

  .grid-overlay {
    padding: 0;
  }
}

@media (max-height: 756px) {
  .calendar-root {
    height: 100vh;
  }


  .grid-container {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }
}

</style>
