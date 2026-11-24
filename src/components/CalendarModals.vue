<template>
  <!-- Okno dodawania wpisu - osobny formularz dla każdego typu -->
  <div v-if="modalOpen" class="modal-backdrop" @click.self="emit('close-modal')">
    <form
      class="modal-card"
      :class="`type-${modalType}`"
      @submit.prevent="handleSave"
      @keydown.ctrl.enter.prevent="handleSave"
    >
      <div class="modal-header">
        <div class="modal-title">{{ MODAL_TITLES[modalType] }}</div>
        <div class="modal-subtitle">{{ selectedLabel }}</div>
      </div>

      <!-- NOTATKA: tytuł + treść -->
      <template v-if="modalType === 'note'">
        <input
          ref="firstFieldEl"
          v-model="title"
          class="modal-input title-input"
          maxlength="60"
          placeholder="TITLE (OPTIONAL)"
          aria-label="Note title"
          @keydown.enter.exact.prevent="noteTextEl?.focus()"
        />
        <textarea
          ref="noteTextEl"
          v-model="text"
          class="modal-textarea"
          rows="6"
          placeholder="TAKE YOUR TIME... WRITE SOMETHING..."
          aria-label="Note text"
        ></textarea>
      </template>

      <!-- TO-DO: nazwa listy + punkty do odhaczania -->
      <template v-else-if="modalType === 'todo'">
        <input
          ref="firstFieldEl"
          v-model="title"
          class="modal-input title-input"
          maxlength="60"
          placeholder="LIST NAME (OPTIONAL)"
          aria-label="List name"
          @keydown.enter.exact.prevent="itemEls[0]?.focus()"
        />
        <ol class="todo-editor">
          <li v-for="(item, i) in items" :key="item.id" class="todo-row">
            <span class="todo-index">{{ String(i + 1).padStart(2, '0') }}</span>
            <input
              :ref="el => (itemEls[i] = el)"
              v-model="item.text"
              class="modal-input todo-input"
              maxlength="120"
              :placeholder="i === 0 ? 'FIRST TASK...' : 'NEXT TASK...'"
              :aria-label="`Task ${i + 1}`"
              @keydown.enter.exact.prevent="addItem(i)"
              @keydown.backspace="removeIfEmpty($event, i)"
            />
            <button
              v-if="items.length > 1"
              type="button"
              class="row-remove"
              :aria-label="`Remove task ${i + 1}`"
              @click="removeItem(i)"
            >
              ✕
            </button>
          </li>
        </ol>
        <button type="button" class="add-item-btn" @click="addItem(items.length - 1)">+ ADD TASK</button>
        <p class="modal-hint">ENTER - next task · CTRL+ENTER - save</p>
      </template>

      <!-- PRZYPOMNIENIE: treść + wymagana godzina -->
      <template v-else>
        <textarea
          ref="firstFieldEl"
          v-model="text"
          class="modal-textarea short"
          rows="3"
          maxlength="200"
          placeholder="WHAT SHOULD I REMIND YOU ABOUT?"
          aria-label="Reminder text"
        ></textarea>
        <div class="time-row">
          <label class="modal-label" for="reminder-time">TIME</label>
          <input id="reminder-time" v-model="time" type="time" class="modal-input time-input" required />
          <template v-if="isTodaySelected">
            <button type="button" class="quick-btn" @click="setTimeFromNow(15)">+15 MIN</button>
            <button type="button" class="quick-btn" @click="setTimeFromNow(60)">+1 H</button>
          </template>
        </div>
      </template>

      <div v-if="error" class="modal-error" role="alert">{{ error }}</div>

      <div class="modal-actions">
        <button type="button" class="modal-btn ghost" @click="emit('close-modal')">CANCEL</button>
        <button type="submit" class="modal-btn">{{ SAVE_LABELS[modalType] }}</button>
      </div>
    </form>
  </div>

  <!-- Lista wpisów danego dnia -->
  <div v-if="detailOpen" class="modal-backdrop" @click.self="emit('close-detail')">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">ENTRIES</div>
        <div class="modal-subtitle">{{ selectedLabel }}</div>
      </div>

      <div v-if="entries.length" class="detail-list">
        <article
          v-for="(entry, i) in entries"
          :key="entry.timestamp"
          class="detail-item"
          :class="`type-${entry.type}`"
        >
          <header class="item-head">
            <span class="pill">{{ PILL_LABELS[entry.type] }}</span>
            <span v-if="entry.type === 'reminder'" class="detail-time">{{ entry.time || '--:--' }}</span>
            <span v-if="entry.type === 'reminder'" class="status-chip" :class="statusOf(entry)">
              {{ STATUS_LABELS[statusOf(entry)] }}
            </span>
            <span v-if="entry.type === 'todo'" class="progress-chip">
              {{ doneCount(entry) }}/{{ entry.items.length }}
            </span>
            <button
              type="button"
              class="chip-delete"
              :aria-label="`Delete ${PILL_LABELS[entry.type].toLowerCase()}`"
              @click="emit('remove-entry', i)"
            >
              DEL
            </button>
          </header>

          <!-- Notatka -->
          <template v-if="entry.type === 'note'">
            <h3 v-if="entry.title" class="item-title">{{ entry.title }}</h3>
            <p v-if="entry.text" class="note-body">{{ entry.text }}</p>
          </template>

          <!-- Lista to-do z odhaczaniem -->
          <template v-else-if="entry.type === 'todo'">
            <h3 v-if="entry.title" class="item-title">{{ entry.title }}</h3>
            <div class="progress-bar" aria-hidden="true">
              <span :style="{ width: `${(doneCount(entry) / entry.items.length) * 100}%` }"></span>
            </div>
            <ul class="checklist">
              <li v-for="item in entry.items" :key="item.id">
                <button
                  type="button"
                  class="check-row"
                  :class="{ done: item.done }"
                  :aria-pressed="item.done"
                  @click="emit('toggle-todo-item', i, item.id)"
                >
                  <span class="todo-check" aria-hidden="true"><span v-if="item.done">✓</span></span>
                  <span class="check-text">{{ item.text }}</span>
                </button>
              </li>
            </ul>
          </template>

          <!-- Przypomnienie -->
          <p v-else class="reminder-body">{{ entry.text }}</p>
        </article>
      </div>
      <div v-else class="detail-empty">NO ENTRIES FOR THIS DAY.</div>

      <div class="modal-actions">
        <button type="button" class="modal-btn" @click="emit('close-detail')">CLOSE</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { makeId, reminderStatus } from '../composables/useCalendarNotes'

const props = defineProps({
  modalOpen: { type: Boolean, default: false },
  modalType: { type: String, default: 'note' },
  detailOpen: { type: Boolean, default: false },
  selectedLabel: { type: String, default: '' },
  dateKey: { type: String, default: '' },
  entries: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'close-modal',
  'save-entry',
  'close-detail',
  'toggle-todo-item',
  'remove-entry',
])

const MODAL_TITLES = { note: 'NEW NOTE', reminder: 'NEW REMINDER', todo: 'NEW TO-DO' }
const SAVE_LABELS = { note: 'SAVE NOTE', reminder: 'SET REMINDER', todo: 'SAVE LIST' }
const PILL_LABELS = { note: 'NOTE', reminder: 'REMINDER', todo: 'TO-DO' }
const STATUS_LABELS = { upcoming: 'UPCOMING', done: 'DONE', 'no-time': 'NO TIME' }

const title = ref('')
const text = ref('')
const time = ref('')
const items = ref([])
const error = ref('')
const firstFieldEl = ref(null)
const noteTextEl = ref(null)
const itemEls = ref([])

const pad = n => String(n).padStart(2, '0')

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const isTodaySelected = computed(() => props.dateKey === todayKey())

// Domyślna godzina: dziś - najbliższe pełne 5 minut za kwadrans, inny dzień - 9:00
function defaultTime() {
  if (!isTodaySelected.value) return '09:00'
  const d = new Date(Date.now() + 15 * 60 * 1000)
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
  // Nie przeskakujemy na jutro - wtedy zostaje ostatnia minuta dnia
  if (d.getDate() !== new Date().getDate()) return '23:59'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function setTimeFromNow(minutes) {
  const d = new Date(Date.now() + minutes * 60 * 1000)
  if (d.getDate() !== new Date().getDate()) {
    error.value = 'THAT WOULD BE TOMORROW - PICK THE NEXT DAY IN THE CALENDAR.'
    return
  }
  time.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  error.value = ''
}

const newItem = () => ({ id: makeId(), text: '' })

watch(
  () => props.modalOpen,
  async open => {
    if (!open) return
    title.value = ''
    text.value = ''
    items.value = [newItem()]
    time.value = props.modalType === 'reminder' ? defaultTime() : ''
    error.value = ''
    // Od razu można pisać - bez dodatkowego kliknięcia w pole
    await nextTick()
    firstFieldEl.value?.focus()
  }
)

async function addItem(afterIndex) {
  items.value.splice(afterIndex + 1, 0, newItem())
  await nextTick()
  itemEls.value[afterIndex + 1]?.focus()
}

async function removeItem(index) {
  items.value.splice(index, 1)
  itemEls.value.length = items.value.length
  await nextTick()
  itemEls.value[Math.max(0, index - 1)]?.focus()
}

function removeIfEmpty(event, index) {
  if (items.value[index].text || items.value.length === 1) return
  event.preventDefault()
  removeItem(index)
}

function validate() {
  if (props.modalType === 'note') {
    if (!title.value.trim() && !text.value.trim()) return 'WRITE A TITLE OR SOME TEXT.'
  } else if (props.modalType === 'todo') {
    if (!items.value.some(item => item.text.trim())) return 'ADD AT LEAST ONE TASK.'
  } else {
    if (!text.value.trim()) return 'WHAT SHOULD I REMIND YOU ABOUT?'
    if (!time.value) return 'PICK A TIME FOR THE REMINDER.'
    if (props.dateKey < todayKey()) return 'THIS DAY IS ALREADY GONE.'
    if (isTodaySelected.value) {
      const [h, m] = time.value.split(':').map(Number)
      const now = new Date()
      if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) return 'THIS TIME HAS ALREADY PASSED.'
    }
  }
  return ''
}

function handleSave() {
  error.value = validate()
  if (error.value) return

  emit('save-entry', {
    type: props.modalType,
    title: title.value,
    text: text.value,
    time: time.value,
    items: items.value.map(item => item.text),
  })
  emit('close-modal')
}

function doneCount(entry) {
  return entry.items.filter(item => item.done).length
}

function statusOf(entry) {
  return reminderStatus(props.dateKey, entry)
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 350;
  font-family: 'p5hatty', sans-serif;
}

.modal-card {
  --accent: #4dffcf;
  width: min(520px, 90vw);
  max-height: 88vh;
  box-sizing: border-box;
  background: #000;
  border: 4px solid #fff;
  box-shadow: 10px 12px 0 #006eff, 18px 20px 0 #000;
  transform: rotate(-1deg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #fff;
  margin: 0;
}

.modal-card.type-note {
  --accent: #ffd166;
}

.modal-card.type-reminder {
  --accent: #4da3ff;
}

.modal-card.type-todo {
  --accent: #4dffcf;
}

.modal-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 3px solid #fff;
  padding-bottom: 8px;
}

.modal-title {
  font-family: 'p5hatty', sans-serif;
  font-size: 30px;
  letter-spacing: 1.5px;
  color: var(--accent);
  text-shadow: 3px 3px 0 #006eff;
}

.modal-subtitle {
  flex-shrink: 0;
  font-size: 20px;
  color: #fff;
  background: #006eff;
  padding: 2px 10px;
  transform: skewX(-10deg);
}

.modal-input,
.modal-textarea {
  width: 100%;
  box-sizing: border-box;
  background: #000;
  color: #fff;
  border: 2px solid #fff;
  box-shadow: 4px 4px 0 #1612ff;
  padding: 8px 12px;
  font-family: 'p5hatty', sans-serif;
  font-size: 20px;
  letter-spacing: 0.8px;
}

.modal-textarea {
  line-height: 1.3;
  resize: vertical;
  min-height: 130px;
  padding: 12px;
}

.modal-textarea.short {
  min-height: 84px;
}

.title-input {
  font-size: 24px;
  border-color: var(--accent);
}

.modal-input:focus,
.modal-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 4px 4px 0 var(--accent);
}

.modal-input::placeholder,
.modal-textarea::placeholder {
  color: #6b6b6b;
}

/* Edytor listy to-do */
.todo-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 4px 4px 0;
  list-style: none;
  max-height: 34vh;
  overflow-y: auto;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.todo-index {
  flex-shrink: 0;
  width: 34px;
  font-size: 20px;
  color: var(--accent);
  text-shadow: 2px 2px 0 #1612ff;
}

.todo-input {
  flex: 1;
  min-width: 0;
  font-size: 18px;
  padding: 6px 10px;
}

.row-remove {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  background: #000;
  color: #fff;
  border: 2px solid #fff;
  font-size: 14px;
  cursor: pointer;
  transform: skewX(-8deg);
}

.row-remove:hover {
  background: #ff1e38;
}

.add-item-btn,
.quick-btn {
  align-self: flex-start;
  background: #000;
  color: var(--accent);
  border: 2px dashed var(--accent);
  padding: 4px 12px;
  font-family: 'p5hatty', sans-serif;
  font-size: 17px;
  letter-spacing: 1px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: background 0.12s ease, color 0.12s ease;
}

.add-item-btn:hover,
.quick-btn:hover {
  background: var(--accent);
  color: #000;
}

.modal-hint {
  margin: -6px 0 0;
  font-size: 13px;
  color: #777;
  letter-spacing: 0.8px;
}

/* Przypomnienie - wiersz z godziną */
.time-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.modal-label {
  font-size: 22px;
  letter-spacing: 1px;
  color: var(--accent);
}

.time-input {
  width: auto;
  font-size: 24px;
  padding: 4px 10px;
  color-scheme: dark;
}

.modal-error {
  align-self: flex-start;
  background: #ff1e38;
  color: #fff;
  border: 2px solid #000;
  box-shadow: 3px 3px 0 #fff;
  padding: 3px 10px;
  font-size: 16px;
  letter-spacing: 0.8px;
  transform: skewX(-8deg) rotate(-1deg);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 6px;
}

.modal-btn {
  background: #fff;
  color: #000;
  border: 2px solid #000;
  box-shadow: 4px 4px 0 #006eff;
  padding: 8px 18px;
  font-family: 'p5hatty', sans-serif;
  font-size: 22px;
  letter-spacing: 1px;
  cursor: pointer;
  transform: skewX(-10deg);
  transition: transform 0.14s ease, background 0.14s ease;
}

.modal-btn.ghost {
  background: #000;
  color: #fff;
  border: 2px solid #fff;
  box-shadow: none;
}

.modal-btn:hover {
  transform: skewX(-10deg) translateY(-2px) scale(1.05);
  background: var(--accent);
  color: #000;
}

.modal-btn:focus-visible,
.check-row:focus-visible,
.add-item-btn:focus-visible,
.quick-btn:focus-visible,
.chip-delete:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

/* Lista wpisów dnia */
.detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 6px 0;
  max-height: 56vh;
  overflow-y: auto;
  /* skewX na wpisach wystaje poza listę - zapas zamiast poziomego paska */
  overflow-x: hidden;
  padding: 0 10px 6px 6px;
}

.detail-item {
  --accent: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 2px solid #fff;
  border-left: 8px solid var(--accent);
  background: #000;
  box-shadow: 4px 4px 0 #1612ff;
}

.detail-item.type-note {
  --accent: #ffd166;
}

.detail-item.type-reminder {
  --accent: #4da3ff;
}

.detail-item.type-todo {
  --accent: #4dffcf;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill {
  padding: 2px 10px;
  border: 1.5px solid #000;
  background: var(--accent);
  font-size: 15px;
  letter-spacing: 0.8px;
  color: #000;
  transform: skewX(-10deg);
}

.detail-time,
.progress-chip {
  font-size: 18px;
  background: #fff;
  color: #000;
  border: 1.5px solid #000;
  padding: 1px 8px;
  transform: skewX(-8deg);
}

.status-chip {
  font-size: 14px;
  padding: 1px 8px;
  border: 1.5px solid currentColor;
  transform: skewX(-8deg);
}

.status-chip.upcoming {
  color: #4dffcf;
}

.status-chip.done,
.status-chip.no-time {
  color: #8a8a8a;
}

.chip-delete {
  margin-left: auto;
  background: #ff2a2a;
  color: #fff;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 #fff;
  padding: 3px 10px;
  font-family: 'p5hatty', sans-serif;
  font-size: 16px;
  letter-spacing: 0.8px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: transform 0.12s ease, background 0.12s ease;
}

.chip-delete:hover {
  transform: skewX(-8deg) scale(1.08);
  background: #ff4d4d;
}

.item-title {
  margin: 0;
  font-family: 'p5hatty', sans-serif;
  font-size: 22px;
  font-weight: normal;
  letter-spacing: 1px;
  color: var(--accent);
  overflow-wrap: anywhere;
}

.note-body,
.reminder-body {
  margin: 0;
  font-size: 19px;
  line-height: 1.3;
  letter-spacing: 0.5px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Lista to-do z odhaczaniem */
.progress-bar {
  height: 6px;
  background: #222;
  border: 1px solid #444;
}

.progress-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.25s ease;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.check-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
  background: transparent;
  color: #fff;
  border: none;
  font-family: 'p5hatty', sans-serif;
  font-size: 19px;
  letter-spacing: 0.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.check-row:hover {
  background: #1612ff;
}

.todo-check {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 2px solid var(--accent);
  background: #000;
  color: #000;
  font-size: 15px;
  transform: skewX(-8deg);
  transition: background 0.15s ease, transform 0.12s ease;
}

.check-row.done .todo-check {
  background: var(--accent);
}

.check-row:active .todo-check {
  transform: skewX(-8deg) scale(0.85);
}

.check-text {
  min-width: 0;
  overflow-wrap: anywhere;
  transition: opacity 0.15s ease;
}

.check-row.done .check-text {
  text-decoration: line-through;
  text-decoration-thickness: 2px;
  opacity: 0.45;
}

.detail-empty {
  margin: 18px 0;
  font-size: 22px;
  letter-spacing: 1px;
  opacity: 0.8;
  text-align: center;
}
</style>
