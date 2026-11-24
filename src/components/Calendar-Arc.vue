<template>
  <div id="screen" ref="root" class="calendar-root">
    <button v-if="!calendarVisible" class="open-calendar" @click="emit('open-calendar')">
      <img :src="calendarIcon" alt="calendar" />
    </button>

    <DateSlot
      v-for="slot in slots"
      :key="slot.id"
      :id="slot.id"
      :day-number="slot.dayNumber"
      :day-name="slot.dayName"
      :is-today="slot.id === 4"
      :knife-trigger="slot.id === 4 ? knifeTrigger : 0"
      :ref="el => (slotRefs[slot.id] = el?.$el ?? el)"
      :style="{ position: 'absolute', transformOrigin: 'center center' }"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import gsap from 'gsap'
import DateSlot from './DateSlot.vue'
import { useToday } from '../composables/useToday'
import calendarIcon from '../assets/images/calendar.png'

const emit = defineEmits(['open-calendar'])
defineProps({
  calendarVisible: {
    type: Boolean,
    default: true,
  },
})

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ARC_CONFIG = {
  startX: 0.2,
  endX: 0.8,
  startY: 0.9,
  endY: 0.1,
  controlX: 0.37,
  controlY: 0.15,
}

const SLOT_PROFILES = [
  { scale: 0.9,  lean: -20, dx: 2.0, dy: 1.2 },
  { scale: 1.05, lean: -40, dx: 3.6, dy: 1.15 },
  { scale: 1.3,  lean: -15, dx: 3.2, dy: 1.2 },
  { scale: 0.95, lean: -15, dx: 2.7, dy: 1.1 },
  { scale: 0.75, lean: -12, dx: 3.0, dy: 1.0 },
  { scale: 0.85, lean: -10, dx: 3.2, dy: 1.0 },
]

function buildSlotsAroundToday(today) {
  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(today)
    d.setDate(today.getDate() + (idx - 3)) // id: 4 (idx: 3) = dzisiaj
    return {
      id: idx + 1,
      dayNumber: d.getDate(),
      dayName: DAY_NAMES[d.getDay()],
    }
  })
}

const { today } = useToday()
const slots = ref(buildSlotsAroundToday(today.value))
const knifeTrigger = ref(0)
const root = ref(null)
const slotRefs = ref({})

function bezierPoint(t, p0, p1, p2) {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

function computeArcPositions(rect) {
  const start = { x: rect.width * ARC_CONFIG.startX, y: rect.height * ARC_CONFIG.startY }
  const end = { x: rect.width * ARC_CONFIG.endX, y: rect.height * ARC_CONFIG.endY }
  const ctrl = { x: rect.width * ARC_CONFIG.controlX, y: rect.height * ARC_CONFIG.controlY }

  const visibleCount = SLOT_PROFILES.length
  const baseScale = Math.min(1.25, Math.max(0.75, rect.width / 1200))
  const baseShift = Math.min(18, Math.max(8, rect.width * 0.012))

  const positions = SLOT_PROFILES.map((profile, idx) => {
    const t = idx / (visibleCount - 1)
    const p = bezierPoint(t, start, ctrl, end)
    return {
      x: p.x,
      y: p.y,
      scale: profile.scale * baseScale,
      rotation: profile.lean,
      zIndex: 90 - idx * 5,
      dayDx: profile.dx * baseShift,
      dayDy: -profile.dy * baseShift,
      offscreen: false,
    }
  })

  // 7. slot (zapasowy, poza widocznym łukiem)
  const last = positions[positions.length - 1]
  positions.push({
    x: last.x,
    y: last.y,
    scale: 0.65,
    rotation: last.rotation,
    zIndex: 0,
    dayDx: 0,
    dayDy: 0,
    offscreen: true,
  })

  return positions
}

async function arrange({ animate = false, exitDown = false, ease = 'power3.out' } = {}) {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const positions = computeArcPositions(rect)
  await nextTick()

  slots.value.forEach((slot, i) => {
    const comp = slotRefs.value[slot.id]
    const node = comp?.$el ?? comp?.el ?? comp
    const p = positions[i]
    if (!node || !p) return

    node.style.zIndex = p.offscreen && exitDown ? 120 : p.zIndex
    node.style.setProperty('--day-dx', `${p.dayDx}px`)
    node.style.setProperty('--day-dy', `${p.dayDy}px`)

    const halfW = (node.offsetWidth || 0) / 2
    const halfH = (node.offsetHeight || 0) / 2
    const nodeH = node.offsetHeight || 0

    let targetX = p.x - halfW
    let targetY = p.y - halfH

    if (p.offscreen) {
      if (exitDown) {
        targetX -= rect.width * 0.8
        targetY = rect.height + nodeH * p.scale + rect.height * 0.12
      } else {
        targetY = -nodeH * p.scale - rect.height * 0.1
      }
    }

    const tweenProps = {
      x: targetX,
      y: targetY,
      scale: p.scale,
      rotate: p.rotation,
      transformOrigin: '50% 50%',
    }

    if (animate) {
      gsap.to(node, { ...tweenProps, duration: 0.6, ease })
    } else {
      gsap.set(node, tweenProps)
    }
  })
}

async function shiftBackward() {
  if (!root.value) return
  knifeTrigger.value += 1
  slots.value.push(slots.value.shift())

  await arrange({ animate: true, exitDown: true, ease: 'power3.inOut' })
  await new Promise(r => setTimeout(r, 650))
  await arrange({ animate: false })
}

let ro = null
let autoShiftTimer = null

// O północy odtwarzamy animację zmiany dnia - łuk przesuwa się na nową datę
watch(today, async newToday => {
  if (autoShiftTimer) clearTimeout(autoShiftTimer)
  slots.value = buildSlotsAroundToday(newToday)
  await arrange({ animate: false })
  autoShiftTimer = setTimeout(shiftBackward, 600)
})

onMounted(() => {
  arrange({ animate: false })
  autoShiftTimer = setTimeout(shiftBackward, 4000)

  ro = new ResizeObserver(() => arrange({ animate: false }))
  if (root.value) ro.observe(root.value)
})

onBeforeUnmount(() => {
  if (ro && root.value) ro.unobserve(root.value)
  if (autoShiftTimer) clearTimeout(autoShiftTimer)
})
</script>

<style scoped>
.calendar-root {
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
