<template>
  <div class="calendar-root">
    <!-- Przycisk zamknięcia (lewy górny róg) -->
    <button class="close-btn" title="Close calendar (Esc)" @click="emit('close')">
      <img :src="closeIcon" alt="close" />
    </button>

    <!-- Boczne strzałki zmiany miesiąca na zewnątrz kalendarza (50% wysokości ekranu) -->
    <button
      class="side-nav-btn left"
      title="Previous month"
      @click.stop="changeMonth(-1)"
    >
      <img :src="prevIcon" alt="Previous month" />
    </button>

    <button
      class="side-nav-btn right"
      title="Next month"
      @click.stop="changeMonth(1)"
    >
      <img :src="nextIcon" alt="Next month" />
    </button>

    <div class="grid-overlay" @click="dismissSelection">
      <div class="calendar-shell" @click.stop="dismissSelection">
        <!-- Górny baner miesiąca w stylu Persona 5 -->
        <header class="calendar-header">
          <div class="month-banner">
            <div class="month-digits">
              <img
                v-for="(d, i) in monthDigits"
                :key="i"
                :src="getDigitSrc(d)"
                class="month-digit-img"
                alt=""
                draggable="false"
              />
            </div>
            <div class="month-slash">/</div>
            <div class="month-title-box">
              <span class="month-name">{{ monthLabel }}</span>
              <span class="year-badge">{{ viewYear }}</span>
            </div>
          </div>

          <div class="header-actions">
            <button
              v-if="!isCurrentMonthView"
              class="p5-jump-btn"
              @click.stop="resetToToday"
            >
              BACK TO TODAY
            </button>
          </div>
        </header>

        <!-- Wiersz dni tygodnia z oryginalnymi grafikami Persona 5 (day1..day6, day0) -->
        <div class="weekday-row">
          <div
            v-for="(dayImgIdx, idx) in WEEKDAY_IMG_INDICES"
            :key="idx"
            class="weekday-cell"
            :class="{ saturday: idx === 5, sunday: idx === 6 }"
          >
            <img
              :src="getDaySrc(dayImgIdx)"
              class="weekday-img"
              alt=""
              draggable="false"
            />
          </div>
        </div>

        <!-- Siatka 42 dni (High-Contrast Black & White + P5 accents) -->
        <div class="dates-grid">
          <div
            v-for="(day, idx) in grid"
            :key="idx"
            :ref="el => setCellRef(idx, el)"
            class="cell"
            :class="{
              saturday: day.dow === 5,
              sunday: day.dow === 6,
              muted: day.type !== 'current',
              hoverable: day.type === 'current',
              today: day.isToday,
              selected: activeKnifeIdx === idx,
            }"
            :tabindex="day.type === 'current' ? 0 : -1"
            :role="day.type === 'current' ? 'button' : undefined"
            :aria-label="day.type === 'current' ? cellAriaLabel(day) : undefined"
            :aria-hidden="day.type === 'current' ? undefined : 'true'"
            @click.stop="onCellClick(idx, day)"
            @keydown.enter.prevent.stop="onCellClick(idx, day)"
            @keydown.space.prevent.stop="onCellClick(idx, day)"
          >
            <!-- Sztylet wbijający się prosto w cyfrę daty -->
            <img
              v-if="activeKnifeIdx === idx"
              ref="knifeEl"
              class="knife"
              :src="knifeSrc"
              alt=""
              draggable="false"
            />

            <div class="cell-top">
              <span class="day-number">{{ day.day }}</span>
              <div class="cell-badges">
                <span
                  v-if="day.type === 'current' && cellWeather(day)"
                  class="weather-badge"
                  :title="weatherTitle(cellWeather(day))"
                >
                  <img :src="cellWeather(day).icon" alt="" draggable="false" />
                </span>
                <span v-if="day.isToday" class="today-stamp">TODAY</span>
              </div>
            </div>

            <!-- Pieczątki / wpisy dnia w stylu Persona 5 -->
            <div
              v-if="day.type === 'current' && getDayEntries(day.day).length"
              class="cell-entries"
              title="Inspect entries"
              @click.stop="openDetail(day)"
            >
              <div class="stamps-row">
                <img
                  v-for="(icon, i) in dayIcons[dayKey(day.day)]"
                  :key="i"
                  :src="icon"
                  class="stamp-icon"
                  alt=""
                  draggable="false"
                />
                <span class="stamp-count">×{{ getDayEntries(day.day).length }}</span>
              </div>

              <div class="p5-note-strip" :class="getDayEntries(day.day)[0].type">
                <span v-if="getDayEntries(day.day)[0].time" class="strip-time">
                  {{ getDayEntries(day.day)[0].time }}
                </span>
                <span class="strip-text">{{ getDayEntries(day.day)[0].text }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Komiksowy Popover akcji po wbiciu sztyletu -->
    <div
      v-if="popoverVisible"
      class="knife-popover"
      :style="{ left: `${popoverPosition.x}px`, top: `${popoverPosition.y}px` }"
      @click.stop
    >
      <div class="popover-header">
        <span class="popover-label">{{ selectedLabel }}</span>
        <button
          v-if="selectedDay && getDayEntries(selectedDay.day).length"
          class="popover-view-btn"
          @click="openDetail(selectedDay)"
        >
          VIEW ({{ getDayEntries(selectedDay.day).length }})
        </button>
      </div>
      <div class="popover-actions">
        <button class="popover-btn note" @click="openModal('note')">
          <img :src="noteIcon" alt="" />
          <span>NOTE</span>
        </button>
        <button class="popover-btn reminder" @click="openModal('reminder')">
          <img :src="reminderIcon" alt="" />
          <span>REMIND</span>
        </button>
        <button class="popover-btn todo" @click="openModal('todo')">
          <img :src="todoIcon" alt="" />
          <span>TO-DO</span>
        </button>
      </div>
    </div>

    <CalendarModals
      :modal-open="modalOpen"
      :modal-type="modalType"
      :detail-open="detailOpen"
      :selected-label="selectedLabel"
      :entries="detailEntries"
      @close-modal="modalOpen = false"
      @save-entry="saveEntry"
      @close-detail="detailOpen = false"
      @toggle-todo="toggleTodo"
      @remove-entry="removeEntry"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import gsap from 'gsap'
import CalendarModals from './CalendarModals.vue'
import { useAudio } from '../composables/useAudio'
import { formatKey, useCalendarNotes } from '../composables/useCalendarNotes'
import { useToday } from '../composables/useToday'
import { useWeather } from '../composables/useWeather'
import knifeSrc from '../assets/images/knife.png'
import closeIcon from '../assets/images/cancel.png'
import prevIcon from '../assets/images/previous.png'
import nextIcon from '../assets/images/next.png'
import noteIcon from '../assets/images/note.png'
import reminderIcon from '../assets/images/reminder.png'
import todoIcon from '../assets/images/todo.png'

const emit = defineEmits(['close'])

// Kolejność od poniedziałku (day1.png) do niedzieli (day0.png)
const WEEKDAY_IMG_INDICES = [1, 2, 3, 4, 5, 6, 0]
const KNIFE_DURATION = 0.14

const getDigitSrc = d => new URL(`../assets/images/digit${d}.png`, import.meta.url).href
const getDaySrc = i => new URL(`../assets/images/day${i}.png`, import.meta.url).href

const { today } = useToday()
const todayYear = computed(() => today.value.getFullYear())
const todayMonth = computed(() => today.value.getMonth())
const todayDate = computed(() => today.value.getDate())

const viewYear = ref(todayYear.value)
const viewMonth = ref(todayMonth.value)

const isCurrentMonthView = computed(
  () => viewYear.value === todayYear.value && viewMonth.value === todayMonth.value
)

const monthDigits = computed(() =>
  String(viewMonth.value + 1).padStart(2, '0').split('')
)

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleString('en-US', { month: 'long' })
)

const { playKnifeSound } = useAudio()
const { weatherFor } = useWeather()
const {
  notes,
  dayIcons,
  addEntry,
  toggleTodoByKey,
  removeEntryByKey,
} = useCalendarNotes()

const cellRefs = ref({})
const knifeEl = ref(null)
const activeKnifeIdx = ref(null)
const popoverVisible = ref(false)
const popoverPosition = ref({ x: 0, y: 0 })
const selectedDay = ref(null)
const modalOpen = ref(false)
const modalType = ref('note')
const detailOpen = ref(false)

function dayKey(dayNumber) {
  return formatKey(viewYear.value, viewMonth.value, dayNumber)
}

function getDayEntries(dayNumber) {
  return notes.value[dayKey(dayNumber)] || []
}

function cellWeather(day) {
  return weatherFor(viewYear.value, viewMonth.value, day.day)
}

function weatherTitle(weather) {
  const temp = t => (Number.isFinite(t) ? `${t}°` : '--')
  return `${weather.label}, ${temp(weather.max)} / ${temp(weather.min)}`
}

function cellAriaLabel(day) {
  const count = getDayEntries(day.day).length
  const weather = cellWeather(day)
  let label = `${monthLabel.value} ${day.day}, ${viewYear.value}${day.isToday ? ', today' : ''}`
  if (weather) label += `, ${weatherTitle(weather)}`
  if (count) label += `, ${count} ${count === 1 ? 'entry' : 'entries'}`
  return label
}

function setCellRef(idx, el) {
  if (el) cellRefs.value[idx] = el
}

function dismissSelection() {
  popoverVisible.value = false
  activeKnifeIdx.value = null
}

function changeMonth(delta) {
  dismissSelection()
  const d = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}

function resetToToday() {
  dismissSelection()
  viewYear.value = todayYear.value
  viewMonth.value = todayMonth.value
}

const grid = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDayDow = (new Date(y, m, 1).getDay() + 6) % 7 // 0=Mon ... 6=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const prevMonthDays = new Date(y, m, 0).getDate()
  const isCurrentMonth = y === todayYear.value && m === todayMonth.value
  const cells = []

  for (let i = 0; i < firstDayDow; i++) {
    cells.push({ day: prevMonthDays - firstDayDow + i + 1, type: 'prev', dow: i, isToday: false })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      type: 'current',
      dow: (firstDayDow + d - 1) % 7,
      isToday: isCurrentMonth && d === todayDate.value,
    })
  }

  while (cells.length < 42) {
    const nextDay = cells.length - (firstDayDow + daysInMonth) + 1
    cells.push({ day: nextDay, type: 'next', dow: cells.length % 7, isToday: false })
  }

  return cells
})

const selectedLabel = computed(() =>
  selectedDay.value ? `${monthLabel.value} ${selectedDay.value.day}, ${viewYear.value}` : ''
)

const detailEntries = computed(() => {
  if (!selectedDay.value) return []
  return getDayEntries(selectedDay.value.day)
})

function openModal(type) {
  if (!selectedDay.value) return
  modalType.value = type
  modalOpen.value = true
  popoverVisible.value = false
}

function saveEntry(payload) {
  if (!selectedDay.value) return
  addEntry(dayKey(selectedDay.value.day), payload)
}

function openDetail(day) {
  dismissSelection()
  selectedDay.value = day
  detailOpen.value = true
}

function toggleTodo(index) {
  if (!selectedDay.value) return
  toggleTodoByKey(dayKey(selectedDay.value.day), index)
}

function removeEntry(index) {
  if (!selectedDay.value) return
  removeEntryByKey(dayKey(selectedDay.value.day), index)
}

async function onCellClick(idx, day) {
  if (day.type !== 'current') {
    dismissSelection()
    return
  }

  popoverVisible.value = false
  activeKnifeIdx.value = idx
  await nextTick()

  const cell = cellRefs.value[idx]
  const knife = Array.isArray(knifeEl.value) ? knifeEl.value[0] : knifeEl.value
  const numEl = cell?.querySelector('.day-number')
  if (!cell || !knife || !numEl) return

  // Wyliczamy środek samej cyfry dnia
  const knifeW = knife.offsetWidth || 68
  const knifeH = knife.offsetHeight || knifeW * 1.654
  const numTargetX = numEl.offsetLeft + numEl.offsetWidth * 0.5
  const numTargetY = numEl.offsetTop + numEl.offsetHeight * 0.42

  // Czubek ostrza (15% szerokości, 95% wysokości knife.png) trafia bezpośrednio w środek cyfry
  const endX = numTargetX - knifeW * 0.15
  const endY = numTargetY - knifeH * 0.95

  // Sztylet nadlatuje z prawej-góry wzdłuż osi ostrza
  const startX = endX + 95
  const startY = endY - 145

  gsap.killTweensOf(knife)
  gsap.set(knife, {
    opacity: 0,
    x: startX,
    y: startY,
    rotate: 18,
    scale: 1.15,
    transformOrigin: '15% 95%',
  })

  gsap.to(knife, {
    opacity: 1,
    x: endX,
    y: endY,
    rotate: -4,
    scale: 1,
    duration: KNIFE_DURATION,
    ease: 'power4.in',
    onComplete: () => {
      playKnifeSound()
      gsap.fromTo(
        cell,
        { x: -3, y: 3 },
        { x: 0, y: 0, duration: 0.16, ease: 'power2.out' }
      )

      selectedDay.value = day
      const cellRect = cell.getBoundingClientRect()
      const halfPopover = 145
      const clampedX = Math.min(
        window.innerWidth - halfPopover - 14,
        Math.max(halfPopover + 14, cellRect.left + cellRect.width * 0.5)
      )
      const clampedY = Math.max(125, cellRect.top - 6)
      popoverPosition.value = { x: clampedX, y: clampedY }
      popoverVisible.value = true
    },
  })
}

function onKeyDown(e) {
  if (e.key !== 'Escape') return
  if (modalOpen.value) {
    modalOpen.value = false
  } else if (detailOpen.value) {
    detailOpen.value = false
  } else if (popoverVisible.value || activeKnifeIdx.value !== null) {
    dismissSelection()
  } else {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.calendar-root {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  user-select: none;
  font-family: 'p5hatty', 'Persona5MenuFontPrototype-Regular', sans-serif;
}

/* Przycisk zamknięcia (X) */
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
  width: 40px;
  height: 40px;
  transition: transform 0.18s ease;
  filter: drop-shadow(3px 4px 0 #000);
}

.close-btn:hover img {
  transform: rotate(90deg) scale(1.12);
}

/* Boczne strzałki na 50% wysokości po lewej i prawej stronie ekranu */
.side-nav-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 420;
  width: clamp(52px, 4.5vw, 68px);
  height: clamp(72px, 8vh, 96px);
  background: #000;
  border: 3px solid #fff;
  box-shadow: 6px 8px 0 #1612ff, 10px 12px 0 #000;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.side-nav-btn.left {
  left: clamp(10px, 1.6vw, 26px);
  clip-path: polygon(16% 0, 100% 8%, 88% 100%, 0 90%);
}

.side-nav-btn.right {
  right: clamp(10px, 1.6vw, 26px);
  clip-path: polygon(0 8%, 84% 0, 100% 90%, 12% 100%);
}

.side-nav-btn img {
  width: clamp(28px, 2.5vw, 38px);
  height: clamp(28px, 2.5vw, 38px);
  object-fit: contain;
  transition: transform 0.15s ease;
}

.side-nav-btn:hover {
  background: #1612ff;
  box-shadow: 7px 9px 0 #fff, 12px 14px 0 #000;
}

.side-nav-btn.left:hover {
  transform: translateY(-50%) translateX(-4px) rotate(-4deg) scale(1.08);
}

.side-nav-btn.right:hover {
  transform: translateY(-50%) translateX(4px) rotate(4deg) scale(1.08);
}

/* Tło i główna wycinkowa rama kalendarza - CZYSTY HIGH CONTRAST */
.grid-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: auto;
}

.calendar-shell {
  width: min(1300px, 82vw);
  height: 88vh;
  display: flex;
  flex-direction: column;
  background: #000;
  border: 4px solid #fff;
  box-shadow:
    12px 14px 0 #1612ff,
    20px 22px 0 #000;
  padding: clamp(12px, 1.4vw, 20px);
  box-sizing: border-box;
  gap: 10px;
  transform: rotate(-0.4deg);
}

/* Górny baner miesiąca w stylu HUD Persona 5 */
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 8px 6px;
}

.month-banner {
  display: flex;
  align-items: center;
  gap: 10px;
}

.month-digits {
  display: flex;
  align-items: center;
  filter: drop-shadow(4px 4px 0 #1612ff);
}

.month-digit-img {
  height: clamp(48px, 5vw, 68px);
  width: auto;
  object-fit: contain;
}

.month-digit-img:nth-child(1) {
  transform: rotate(-6deg) translateX(4px);
}

.month-digit-img:nth-child(2) {
  transform: rotate(4deg) translateX(-4px);
}

.month-slash {
  font-family: 'p5hatty', sans-serif;
  font-size: clamp(44px, 4.5vw, 64px);
  color: #fff;
  transform: rotate(-12deg) translateY(-2px);
  text-shadow: 4px 4px 0 #1612ff;
  margin: 0 4px;
}

.month-title-box {
  display: flex;
  align-items: baseline;
  gap: 14px;
  background: #000;
  border: 3px solid #fff;
  padding: 4px 18px 2px;
  transform: skewX(-10deg) rotate(-1.5deg);
  box-shadow: 6px 6px 0 #1612ff;
}

.month-name {
  font-family: 'p5menu', 'Persona5MenuFontPrototype-Regular', sans-serif;
  font-size: clamp(28px, 3vw, 44px);
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.year-badge {
  font-family: 'p5hatty', sans-serif;
  font-size: clamp(22px, 2.2vw, 32px);
  color: #4dffcf;
  letter-spacing: 1px;
}

.p5-jump-btn {
  background: #fff;
  color: #000;
  border: 3px solid #000;
  box-shadow: 5px 5px 0 #1612ff;
  padding: 6px 16px;
  font-family: 'p5hatty', sans-serif;
  font-size: 22px;
  letter-spacing: 1px;
  cursor: pointer;
  transform: skewX(-10deg) rotate(1.5deg);
  transition: transform 0.14s ease, background 0.14s ease;
}

.p5-jump-btn:hover {
  background: #4dffcf;
  transform: skewX(-10deg) rotate(-2deg) scale(1.06);
}

/* Wiersz dni tygodnia z oryginalnymi grafikami day0-day6 */
.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.weekday-cell {
  background: #000;
  border: 3px solid #fff;
  box-shadow: 4px 4px 0 #1612ff;
  padding: 6px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: skewX(-6deg);
}

.weekday-cell.saturday {
  border-color: #4da3ff;
  box-shadow: 4px 4px 0 #006eff;
}

.weekday-cell.sunday {
  border-color: #ff1e38;
  box-shadow: 4px 4px 0 #ff1e38;
}

.weekday-img {
  height: clamp(24px, 2.4vw, 34px);
  max-width: 90%;
  object-fit: contain;
}

/* Siatka 42 dni - SMOLISTA CZERŃ I CZYSTA BIEL */
.dates-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 6px;
  min-height: 0;
}

.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #000;
  border: 2px solid #fff;
  color: #fff;
  padding: 6px 8px;
  box-sizing: border-box;
  min-height: 0;
  min-width: 0;
  overflow: visible;
  transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
}

.cell:nth-child(odd) .day-number {
  transform: rotate(-3deg);
}

.cell:nth-child(even) .day-number {
  transform: rotate(2.5deg);
}

.cell.hoverable {
  cursor: pointer;
}

.cell.hoverable:hover {
  transform: translate(-3px, -3px) scale(1.03) rotate(-1deg);
  background: #1612ff;
  border-color: #fff;
  box-shadow: 6px 6px 0 #fff;
  z-index: 10;
}

.cell.hoverable:focus-visible {
  outline: 3px solid #4dffcf;
  outline-offset: 2px;
  z-index: 12;
}

.cell.selected {
  background: #1612ff;
  border: 3px solid #fff;
  box-shadow: 6px 6px 0 #4dffcf;
  z-index: 15;
}

.cell.saturday {
  border-color: #4da3ff;
  background: linear-gradient(135deg, #006eff 0px, #006eff 14px, #000 14px);
}

.cell.saturday .day-number {
  color: #4da3ff;
}

.cell.sunday {
  border-color: #ff1e38;
  background: linear-gradient(135deg, #ff1e38 0px, #ff1e38 14px, #000 14px);
}

.cell.sunday .day-number {
  color: #ff1e38;
}

.cell.saturday.hoverable:hover,
.cell.sunday.hoverable:hover {
  background: #1612ff;
}

.cell.saturday.hoverable:hover .day-number,
.cell.sunday.hoverable:hover .day-number {
  color: #fff;
}

/* DZISIAJ - Odwrócony kontrast (Biały kafelek z czarnym tekstem i niebieskim cieniem) */
.cell.today {
  background: #fff;
  border: 3px solid #000;
  box-shadow: 6px 6px 0 #1612ff, 0 0 0 2px #fff;
}

.cell.today .day-number {
  color: #000;
  text-shadow: 2px 2px 0 #4dffcf;
}

.cell.today.hoverable:hover {
  background: #ffd166;
  box-shadow: 7px 7px 0 #1612ff;
}

.cell.muted {
  background: #000;
  border: 1px solid #2a2a2a;
  pointer-events: none;
}

.cell.muted .day-number {
  color: #3a3a3a;
  text-shadow: none;
}

/* Numer dnia i pieczątka TODAY */
.cell-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
  pointer-events: none;
}

.day-number {
  display: inline-block;
  font-family: 'p5hatty', 'Persona5MenuFontPrototype-Regular', sans-serif;
  font-size: clamp(28px, 2.6vw, 40px);
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: 1px;
  color: #fff;
  text-shadow: 3px 3px 0 #000;
}

.cell-badges {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
}

/* Prognoza z useWeather - biała plakietka, bo ikony mają czarne kontury */
.weather-badge {
  display: grid;
  place-items: center;
  width: clamp(26px, 2.4vw, 36px);
  height: clamp(20px, 1.9vw, 28px);
  background: #fff;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 #1612ff;
  transform: skewX(-8deg) rotate(3deg);
  pointer-events: auto;
}

.weather-badge img {
  width: 86%;
  height: 86%;
  object-fit: contain;
}

.cell.muted .weather-badge {
  display: none;
}

.today-stamp {
  background: #000;
  color: #ffd166;
  border: 2px solid #000;
  box-shadow: 3px 3px 0 #1612ff;
  font-family: 'p5hatty', sans-serif;
  font-size: clamp(13px, 1.1vw, 17px);
  font-weight: 900;
  letter-spacing: 1px;
  padding: 1px 6px;
  transform: rotate(5deg) skewX(-10deg);
}

/* Wpisy i ikony dnia w komiksowym stylu P5 */
.cell-entries {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: auto;
  pointer-events: auto;
  z-index: 8;
}

.stamps-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.stamp-icon {
  width: clamp(22px, 2vw, 28px);
  height: clamp(22px, 2vw, 28px);
  object-fit: contain;
  filter: drop-shadow(2px 2px 0 #000);
  transform: rotate(-6deg);
  transition: transform 0.12s ease;
}

.cell-entries:hover .stamp-icon {
  transform: rotate(4deg) scale(1.15);
}

.stamp-count {
  background: #000;
  color: #fff;
  border: 2px solid #fff;
  font-family: 'p5hatty', sans-serif;
  font-size: 15px;
  padding: 0 5px;
  transform: skewX(-8deg);
}

.p5-note-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  color: #000;
  border: 2px solid #000;
  box-shadow: 3px 3px 0 #000;
  padding: 1px 6px;
  font-family: 'p5hatty', sans-serif;
  font-size: clamp(14px, 1.1vw, 17px);
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: skewX(-8deg) rotate(-1deg);
}

.p5-note-strip.note {
  background: #ffd166;
}

.p5-note-strip.reminder {
  background: #4da3ff;
}

.p5-note-strip.todo {
  background: #4dffcf;
}

.strip-time {
  background: #000;
  color: #fff;
  padding: 0 4px;
  font-size: 13px;
}

.strip-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Sztylet - pozycjonowany przez GSAP dokładnie w środek cyfry dnia */
.knife {
  position: absolute;
  top: 0;
  left: 0;
  width: clamp(58px, 4.8vw, 82px);
  aspect-ratio: 327 / 541;
  height: auto;
  object-fit: contain;
  pointer-events: none;
  opacity: 0;
  z-index: 30;
  filter: drop-shadow(4px 6px 0 rgba(0, 0, 0, 0.85));
}

/* Komiksowy Popover akcji w stylu menu walki P5 */
.knife-popover {
  position: fixed;
  transform: translate(-50%, -105%) rotate(-1.5deg);
  background: #000;
  color: #fff;
  padding: 14px 16px;
  border: 3px solid #fff;
  box-shadow: 8px 10px 0 #1612ff, 14px 16px 0 #000;
  clip-path: polygon(2% 0, 100% 3%, 98% 100%, 0 96%);
  z-index: 320;
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: 'p5hatty', 'Persona5MenuFontPrototype-Regular', sans-serif;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 2px solid #fff;
  padding-bottom: 6px;
}

.popover-label {
  font-size: 22px;
  letter-spacing: 1px;
  color: #fff;
  text-transform: uppercase;
}

.popover-view-btn {
  background: #4dffcf;
  color: #000;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 #fff;
  padding: 2px 8px;
  font-family: 'p5hatty', sans-serif;
  font-size: 16px;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: transform 0.12s ease, background 0.12s ease;
}

.popover-view-btn:hover {
  background: #ffd166;
  transform: skewX(-8deg) scale(1.08);
}

.popover-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.popover-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #fff;
  color: #000;
  border: 2px solid #000;
  box-shadow: 3px 4px 0 #1612ff;
  padding: 8px 4px;
  font-size: 19px;
  font-family: 'p5hatty', sans-serif;
  letter-spacing: 0.8px;
  cursor: pointer;
  transform: skewX(-6deg);
  transition: transform 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
}

.popover-btn img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.popover-btn.note:hover {
  transform: skewX(-6deg) translateY(-3px) rotate(-2deg);
  background: #ffd166;
  box-shadow: 4px 5px 0 #fff;
}

.popover-btn.reminder:hover {
  transform: skewX(-6deg) translateY(-3px) rotate(2deg);
  background: #4da3ff;
  box-shadow: 4px 5px 0 #fff;
}

.popover-btn.todo:hover {
  transform: skewX(-6deg) translateY(-3px) rotate(-2deg);
  background: #4dffcf;
  box-shadow: 4px 5px 0 #fff;
}

@media (max-width: 1024px) {
  .calendar-shell {
    width: 86vw;
    height: 88vh;
    padding: 10px;
  }

  .p5-note-strip {
    display: none;
  }
}

/* Telefon: kalendarz na całą szerokość, strzałki miesięcy pod siatką zamiast na jej bokach */
@media (max-width: 600px) {
  .grid-overlay {
    align-items: flex-start;
    padding-top: 72px;
  }

  .calendar-shell {
    width: calc(100vw - 16px);
    height: calc(100vh - 170px);
    padding: 8px;
    gap: 6px;
    transform: none;
    box-shadow: 6px 8px 0 #1612ff;
  }

  .calendar-header {
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 2px 4px;
  }

  .month-banner {
    gap: 4px;
    min-width: 0;
  }

  .month-digit-img {
    height: 34px;
  }

  .month-slash {
    font-size: 30px;
  }

  .month-title-box {
    gap: 8px;
    padding: 2px 10px;
  }

  .month-name {
    font-size: 20px;
    letter-spacing: 1px;
  }

  .year-badge {
    font-size: 16px;
  }

  .p5-jump-btn {
    font-size: 14px;
    padding: 4px 10px;
  }

  .weekday-row,
  .dates-grid {
    gap: 3px;
  }

  .weekday-cell {
    padding: 4px 2px;
    border-width: 2px;
    box-shadow: 2px 2px 0 #1612ff;
  }

  .cell {
    padding: 3px 4px;
    border-width: 1px;
  }

  .day-number {
    font-size: 18px;
  }

  .today-stamp,
  .stamp-count {
    display: none;
  }

  .stamp-icon {
    width: 14px;
    height: 14px;
  }

  .weather-badge {
    width: 18px;
    height: 14px;
    border-width: 1px;
    box-shadow: none;
  }

  .knife {
    width: 40px;
  }

  .side-nav-btn {
    top: auto;
    bottom: 18px;
    transform: none;
    width: 64px;
    height: 56px;
  }

  .side-nav-btn.left {
    left: 16px;
  }

  .side-nav-btn.right {
    right: 16px;
  }

  .side-nav-btn.left:hover,
  .side-nav-btn.right:hover {
    transform: scale(1.05);
  }

  .knife-popover {
    width: 240px;
  }

  .popover-btn {
    font-size: 15px;
  }
}

@media (max-height: 756px) and (min-width: 601px) {
  .calendar-shell {
    width: 86vw;
    height: 92vh;
    padding: 8px;
    gap: 6px;
  }

  .p5-note-strip {
    display: none;
  }
}
</style>
