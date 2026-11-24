import { onMounted, onUnmounted, readonly, ref } from 'vue'

// Wspólna, reaktywna data "dzisiaj" - aktualizuje się sama o północy,
// więc aplikacja otwarta przez noc nie pokazuje wczorajszego dnia
const today = ref(new Date())

let midnightTimer = null
let activeConsumers = 0

function msUntilNextMidnight() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  return next.getTime() - now.getTime()
}

function scheduleMidnightUpdate() {
  clearTimeout(midnightTimer)
  midnightTimer = setTimeout(() => {
    today.value = new Date()
    scheduleMidnightUpdate()
  }, msUntilNextMidnight())
}

function refreshIfDayChanged() {
  const now = new Date()
  if (now.toDateString() !== today.value.toDateString()) {
    today.value = now
  }
}

// Po uśpieniu komputera setTimeout może się spóźnić - sprawdzamy datę przy powrocie do karty
function onVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  refreshIfDayChanged()
  scheduleMidnightUpdate()
}

export function useToday() {
  onMounted(() => {
    activeConsumers += 1
    if (activeConsumers === 1) {
      refreshIfDayChanged()
      scheduleMidnightUpdate()
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  })

  onUnmounted(() => {
    activeConsumers = Math.max(0, activeConsumers - 1)
    if (activeConsumers === 0) {
      clearTimeout(midnightTimer)
      midnightTimer = null
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  return { today: readonly(today) }
}
