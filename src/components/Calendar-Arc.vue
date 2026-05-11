<template>
  <div id="screen" class="calendar-root" ref="root">
    <button v-if="!calendarVisible" class="open-calendar" @click="emitOpenCalendar">
      <img :src="calendarIcon" alt="calendar" />
    </button>
    <!-- DateSloty rozmieszczone po łuku -->
    <DateSlot
      v-for="(slot, idx) in slots"
      :key="slot.id"
      :id="slot.id"
      :dayNumber="slot.dayNumber"
      :dayName="slot.dayName"
      :is-today="slot.id === 4"
      :knife-trigger="slot.id === 4 ? knifeTrigger : 0"
      :ref="el => slotRefs[slot.id] = el?.$el ?? el"
      :style="{ position: 'absolute', transformOrigin: 'center center' }"
    />

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import gsap from 'gsap'
import DateSlot from './DateSlot.vue'
import calendarIconAsset from '../assets/images/calendar.png'

const emit = defineEmits(['open-calendar'])
const props = defineProps({
  calendarVisible: {
    type: Boolean,
    default: true
  }
})

function buildSlotsAroundToday() {
  const today = new Date()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return Array.from({ length: 7 }, (_, idx) => {
    const delta = idx - 3 // id:4 ma offset 0 => dzisiaj
    const d = new Date(today)
    d.setDate(today.getDate() + delta)
    return {
      id: idx + 1,
      dayNumber: d.getDate(),
      dayName: dayNames[d.getDay()],
    }
  })
}

const slots = ref(buildSlotsAroundToday())
const knifeTrigger = ref(0)
const root = ref(null)
const slotRefs = ref({})
const calendarIcon = calendarIconAsset

function emitOpenCalendar() {
  emit('open-calendar')
}

const ARC_CONFIG = {
  startX: 0.2,   // węższy łuk, bliżej środka
  endX: 0.8,
  startY: 0.90,   // punkt A niżej
  endY: 0.1,     // punkt B wyżej
  controlX: 0.37,  // kontrolny środek
  controlY: 0.15 // mocniejsze wyciągnięcie w górę
}

// Sloty opisujemy profilem (pozycja na łuku, nie ID daty)
const SLOT_PROFILES = [
  { scale: 0.9, lean: -20,  dx: 2.0,  dy: 1.2 },  // slot 1
  { scale: 1.05, lean: -40, dx: 3.6,  dy: 1.15 },  // slot 2
  { scale: 1.30, lean: -15,  dx: 3.2,  dy: 1.2 },  // slot 3
  { scale: 0.95, lean: -15,  dx: 2.7,  dy: 1.1 },  // slot 4
  { scale: 0.75, lean: -12,  dx: 3.0,  dy: 1.0 },  // slot 5
  { scale: 0.85, lean: -10,  dx: 3.2,  dy: 1.0 },  // slot 6
]

function bezierPoint(t, p0, p1, p2) {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  return {
    x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
    y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y,
  }
}

function bezierTangent(t, p0, p1, p2) {
  const u = 1 - t
  return {
    x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  }
}

function computeArcPositions(rect) {
  const start = {
    x: rect.width * ARC_CONFIG.startX,
    y: rect.height * ARC_CONFIG.startY,
  }
  const end = {
    x: rect.width * ARC_CONFIG.endX,
    y: rect.height * ARC_CONFIG.endY,
  }
  const ctrl = {
    x: rect.width * ARC_CONFIG.controlX,
    y: rect.height * ARC_CONFIG.controlY,
  }

  const total = slots.value.length
  const visibleCount = Math.max(1, Math.min(6, total - 1))
  const hasExtra = total > visibleCount
  const baseStep = visibleCount > 1 ? 1 / (visibleCount - 1) : 1
  const ts = Array.from({ length: visibleCount }, (_, i) => i * baseStep)

  if (hasExtra) ts.push(1) // 7. slot poza górną granicą wzdłuż stycznej

  const baseScale = Math.min(1.25, Math.max(0.75, rect.width / 1200))
  const baseShift = Math.min(18, Math.max(8, rect.width * 0.012))

  const positions = ts.map((t, idx) => {
    const p = bezierPoint(t, start, ctrl, end)
    const tangent = bezierTangent(t, start, ctrl, end)
    const angle = Math.atan2(tangent.y, tangent.x)

    const isExtra = hasExtra && idx === total - 1
    const profile = SLOT_PROFILES[idx] ?? SLOT_PROFILES[SLOT_PROFILES.length - 1]
    const scale = isExtra ? 0.65 : profile.scale * baseScale
    const zIndex = isExtra ? 1 : 90 - idx * 5
    const lean = isExtra ? profile.lean : profile.lean
    const dayDx = isExtra ? 0 : profile.dx * baseShift
    const dayDy = isExtra ? 0 : -profile.dy * baseShift

    return { x: p.x, y: p.y, scale, rotation: lean, zIndex, angle, t, offscreen: isExtra, dayDx, dayDy }
  })

  if (hasExtra && positions.length === total) {
    const lastVisible = positions[visibleCount - 1]
    const tangentAngle = lastVisible.angle
    positions[total - 1] = {
      ...positions[total - 1],
      x: lastVisible.x,
      y: lastVisible.y,
      rotation: lastVisible.rotation,
      zIndex: 0,
      offscreen: true,
      angle: tangentAngle,
    }
  }

  return positions
}

// --- Ustawianie pozycji (z animacją GSAP)
async function arrange(animate = true) {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const positions = computeArcPositions(rect)
  if (!positions.length) return
  await nextTick()

  for (let i = 0; i < slots.value.length; i++) {
    const slot = slots.value[i]
    const comp = slotRefs.value[slot.id]
    if (!comp) continue
    const node = comp.$el ?? comp.el ?? comp
    if (!node) continue
    const p = positions[i]
    if (!p) continue

    node.style.zIndex = p.zIndex

    const halfW = node.offsetWidth ? node.offsetWidth / 2 : 0
    const halfH = node.offsetHeight ? node.offsetHeight / 2 : 0

    const rectHeight = root.value?.getBoundingClientRect().height ?? 0
    const offscreenMargin = rectHeight * 0.1

    let targetX = p.x - halfW
    let targetY = p.y - halfH

    if (p.offscreen) {
      // wypchnij ponad górną krawędź niezależnie od rozdzielczości
      const nodeH = node.offsetHeight || 0
      targetY = -nodeH * p.scale - offscreenMargin
    }

    if (p.dayDx !== undefined) node.style.setProperty('--day-dx', `${p.dayDx}px`)
    if (p.dayDy !== undefined) node.style.setProperty('--day-dy', `${p.dayDy}px`)

    const props = {
      x: targetX,
      y: targetY,
      scale: p.scale,
      rotate: p.rotation,
      transformOrigin: '50% 50%'
    }

    if (animate) {
      gsap.to(node, { ...props, duration: 0.6, ease: 'power3.out' })
    } else {
      gsap.set(node, props)
    }
  }
}

// animowane przesunięcie wstecz: pierwszy slot na koniec; ostatni wypychany w dół ekranu
async function shiftBackward() {
  if (!root.value) return
  knifeTrigger.value += 1
  const rect = root.value.getBoundingClientRect()
  const before = computeArcPositions(rect)
  if (!before.length) return

  // obróć kolejność
  slots.value.push(slots.value.shift())

  await nextTick()
  const after = computeArcPositions(rect)
  if (!after.length) return

  for (let i = 0; i < slots.value.length; i++) {
    const slot = slots.value[i]
    const comp = slotRefs.value[slot.id]
    if (!comp) continue
    const node = comp.$el ?? comp.el ?? comp
    if (!node) continue

    const from = before[i]
    const to = after[i]
    if (!to || !from) continue

    node.style.zIndex = to.offscreen ? 120 : to.zIndex
    const halfW = node.offsetWidth ? node.offsetWidth / 2 : 0
    const halfH = node.offsetHeight ? node.offsetHeight / 2 : 0
    const rectHeight = rect.height
    const offMargin = rectHeight * 0.12

    const target = { x: to.x - halfW, y: to.y - halfH, scale: to.scale, rotate: to.rotation }

    // jeżeli nowy slot jest offscreen, wypchnij w dół
    if (to.offscreen) {
      const nodeH = node.offsetHeight || 0
      target.y = rectHeight + nodeH * to.scale + offMargin
      target.x = target.x - rect.width * 0.8 // mocniej w lewo przy wylocie
    }

    // ustaw offsety tekstu
    if (to.dayDx !== undefined) node.style.setProperty('--day-dx', `${to.dayDx}px`)
    if (to.dayDy !== undefined) node.style.setProperty('--day-dy', `${to.dayDy}px`)

    gsap.to(node, { ...target, duration: 0.6, ease: 'power3.inOut' })
  }

  // po animacji ustaw na miejscu (bez animacji) by skorygować ewentualne różnice
  await new Promise(r => setTimeout(r, 650))
  arrange(false)
}

let ro = null
let autoShiftTimer = null
onMounted(() => {
  // pierwsze ustawienie bez animacji
  arrange(false)

  autoShiftTimer = setTimeout(() => {
    shiftBackward()
  }, 4000)

  ro = new ResizeObserver(() => {
    // zmiana pozycji luku po zmianie szerokosci/wysokosci okna
    arrange(false)
  })
  if (root.value) ro.observe(root.value)
})

onBeforeUnmount(() => {
  if (ro && root.value) ro.unobserve(root.value)
  if (autoShiftTimer) clearTimeout(autoShiftTimer)
})
</script>

<style scoped>
.calendar-root{
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.open-calendar {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 410;
  background: transparent;
  border: none;
  padding: 10px;
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.open-calendar img {
  width: 38px;
  height: 38px;
  transition: transform 0.2s ease, filter 0.2s ease;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}

.open-calendar:hover {
  transform: translateY(-2px);
}

.open-calendar:hover img {
  transform: rotate(8deg) scale(1.05);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
}

</style>
