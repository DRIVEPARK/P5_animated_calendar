<template>
  <div v-if="modalOpen" class="modal-backdrop" @click.self="emit('close-modal')">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title" :class="modalType">{{ modalTitle }}</div>
        <div class="modal-subtitle">{{ selectedLabel }}</div>
      </div>

      <textarea
        ref="textareaEl"
        v-model="text"
        aria-label="Entry text"
        class="modal-textarea"
        rows="5"
        placeholder="TAKE YOUR TIME... WRITE SOMETHING..."
      ></textarea>

      <div v-if="modalType === 'reminder'" class="modal-field">
        <label class="modal-label" for="reminder-time">REMINDER TIME</label>
        <input id="reminder-time" v-model="time" type="time" class="modal-input" />
      </div>

      <div class="modal-actions">
        <button class="modal-btn ghost" @click="emit('close-modal')">CANCEL</button>
        <button class="modal-btn" @click="handleSave">SAVE</button>
      </div>
    </div>
  </div>

  <div v-if="detailOpen" class="modal-backdrop" @click.self="emit('close-detail')">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">ENTRIES</div>
        <div class="modal-subtitle">{{ selectedLabel }}</div>
      </div>

      <div v-if="entries.length" class="detail-list">
        <div v-for="(entry, i) in entries" :key="i" class="detail-item">
          <button
            v-if="entry.type === 'todo'"
            class="todo-check"
            :class="{ checked: entry.done }"
            :title="entry.done ? 'Mark as undone' : 'Mark as done'"
            @click="emit('toggle-todo', i)"
          >
            <span v-if="entry.done">✓</span>
          </button>
          <span class="pill" :class="entry.type">{{ entry.type }}</span>
          <span class="detail-text" :class="{ done: entry.type === 'todo' && entry.done }">
            {{ entry.text }}
          </span>
          <span v-if="entry.type === 'reminder' && entry.time" class="detail-time">
            {{ entry.time }}
          </span>
          <button class="chip-delete" @click="emit('remove-entry', i)">DEL</button>
        </div>
      </div>
      <div v-else class="detail-empty">NO ENTRIES FOR THIS DAY.</div>

      <div class="modal-actions">
        <button class="modal-btn" @click="emit('close-detail')">CLOSE</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  modalOpen: { type: Boolean, default: false },
  modalType: { type: String, default: 'note' },
  detailOpen: { type: Boolean, default: false },
  selectedLabel: { type: String, default: '' },
  entries: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'close-modal',
  'save-entry',
  'close-detail',
  'toggle-todo',
  'remove-entry',
])

const MODAL_TITLES = { note: 'NEW NOTE', reminder: 'NEW REMINDER', todo: 'NEW TO-DO' }

const text = ref('')
const time = ref('')
const textareaEl = ref(null)

const modalTitle = computed(() => MODAL_TITLES[props.modalType] || 'NEW TO-DO')

watch(
  () => props.modalOpen,
  async open => {
    if (open) {
      text.value = ''
      time.value = ''
      // Od razu można pisać - bez dodatkowego kliknięcia w pole
      await nextTick()
      textareaEl.value?.focus()
    }
  }
)

function handleSave() {
  const trimmed = text.value.trim()
  if (trimmed) {
    emit('save-entry', {
      type: props.modalType,
      text: trimmed,
      time: props.modalType === 'reminder' ? time.value : '',
    })
  }
  emit('close-modal')
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
  font-family: 'p5hatty', 'Persona5MenuFontPrototype-Regular', sans-serif;
}

.modal-card {
  width: min(500px, 90vw);
  background: #000;
  border: 4px solid #fff;
  box-shadow: 10px 12px 0 #006eff, 18px 20px 0 #000;
  transform: rotate(-1deg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #fff;
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
  font-family: 'p5menu', 'Persona5MenuFontPrototype-Regular', sans-serif;
  font-size: 32px;
  letter-spacing: 1.5px;
  color: #fff;
  text-shadow: 3px 3px 0 #006eff;
}

.modal-title.note {
  color: #ffd166;
}

.modal-title.reminder {
  color: #4da3ff;
}

.modal-title.todo {
  color: #4dffcf;
}

.modal-subtitle {
  font-family: 'p5hatty', sans-serif;
  font-size: 22px;
  color: #fff;
  background: #006eff;
  padding: 2px 10px;
  transform: skewX(-10deg);
}

.modal-textarea {
  width: 100%;
  box-sizing: border-box;
  background: #000;
  color: #fff;
  border: 2px solid #fff;
  box-shadow: 4px 4px 0 #1612ff;
  padding: 12px;
  font-family: 'p5hatty', sans-serif;
  font-size: 22px;
  letter-spacing: 0.8px;
  line-height: 1.3;
  resize: vertical;
  min-height: 130px;
}

.modal-textarea:focus,
.modal-input:focus {
  outline: none;
  border-color: #4dffcf;
  box-shadow: 4px 4px 0 #4dffcf;
}

.modal-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.modal-label {
  font-size: 22px;
  letter-spacing: 1px;
}

.modal-input {
  background: #000;
  color: #fff;
  border: 2px solid #fff;
  padding: 6px 12px;
  font-family: 'p5hatty', sans-serif;
  font-size: 20px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 6px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 6px 0;
  max-height: 320px;
  overflow-y: auto;
  /* skewX na wpisach wystaje poza listę - zapas zamiast poziomego paska */
  overflow-x: hidden;
  padding: 0 10px 6px 6px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 2px solid #fff;
  background: #000;
  box-shadow: 4px 4px 0 #1612ff;
  transform: skewX(-4deg);
}

.todo-check {
  width: 24px;
  height: 24px;
  border: 2px solid #4dffcf;
  background: #000;
  color: #000;
  font-weight: 900;
  font-size: 16px;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, transform 0.12s ease;
}

.todo-check.checked {
  background: #4dffcf;
}

.todo-check:hover {
  transform: scale(1.1);
}

.detail-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 21px;
  letter-spacing: 0.6px;
  line-height: 1.25;
}

.detail-text.done {
  text-decoration: line-through;
  opacity: 0.45;
}

.detail-time {
  font-size: 18px;
  background: #4da3ff;
  color: #000;
  border: 1.5px solid #000;
  padding: 2px 8px;
  transform: skewX(-8deg);
}

.chip-delete {
  background: #ff2a2a;
  color: #fff;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 #fff;
  padding: 4px 10px;
  font-family: 'p5hatty', sans-serif;
  font-size: 18px;
  letter-spacing: 0.8px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: transform 0.12s ease, background 0.12s ease;
}

.chip-delete:hover {
  transform: skewX(-8deg) scale(1.08);
  background: #ff4d4d;
}

.detail-empty {
  margin: 18px 0;
  font-size: 22px;
  letter-spacing: 1px;
  opacity: 0.8;
  text-align: center;
}

.pill {
  padding: 3px 10px;
  border: 1.5px solid #000;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #000;
  transform: skewX(-10deg);
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
  background: #4dffcf;
  color: #000;
}
</style>
