import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatKey } from './useCalendarNotes'

// Prognoza dzienna z Open-Meteo (bez klucza API). Jeden wspólny stan dla całej aplikacji:
// widget pogody i siatka kalendarza korzystają z tych samych danych i jednego zapytania.

const API_URL = 'https://api.open-meteo.com/v1/forecast'
const CACHE_KEY = 'p5_calendar_weather_cache'
const LOCATION_KEY = 'p5_calendar_weather_location'
const CACHE_TTL_MS = 30 * 60 * 1000
const REFRESH_INTERVAL_MS = 30 * 60 * 1000
const PAST_DAYS = 7
const FORECAST_DAYS = 16

export const DEFAULT_LOCATION = Object.freeze({
  latitude: 52.2297,
  longitude: 21.0122,
  label: 'Warsaw',
  isDefault: true,
})

const ICON_FILES = import.meta.glob('../assets/images/weather/*.png', {
  eager: true,
  import: 'default',
})

const ICONS = Object.fromEntries(
  Object.entries(ICON_FILES).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url])
)

const CONDITIONS = {
  sunny: 'Sunny',
  'part-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  'rain-light': 'Light rain',
  'rain-heavy': 'Heavy rain',
  snow: 'Snow',
  storm: 'Storm',
}

// Kody pogody WMO używane przez Open-Meteo -> jedna z 8 ikon
const CODE_GROUPS = [
  [[0], 'sunny'],
  [[1, 2], 'part-cloudy'],
  [[3], 'cloudy'],
  [[45, 48], 'fog'],
  [[51, 53, 55, 56, 57, 61, 66, 80], 'rain-light'],
  [[63, 65, 67, 81, 82], 'rain-heavy'],
  [[71, 73, 75, 77, 85, 86], 'snow'],
  [[95, 96, 99], 'storm'],
]

export function conditionFromCode(code) {
  const match = CODE_GROUPS.find(([codes]) => codes.includes(code))
  return match ? match[1] : 'cloudy'
}

const location = ref(loadLocation())
const daily = ref({})
const status = ref('idle') // idle | loading | ready | error
const errorMessage = ref('')
const locating = ref(false)

let controller = null
let refreshTimer = null
let activeConsumers = 0

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error(`Failed to save ${key}`, err)
  }
}

function loadLocation() {
  const saved = readJson(LOCATION_KEY)
  if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) {
    return { ...saved, isDefault: false }
  }
  return { ...DEFAULT_LOCATION }
}

function cacheId(loc) {
  return `${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)}`
}

function parseDaily(data) {
  const d = data?.daily
  if (!d || !Array.isArray(d.time)) throw new Error('No daily data')

  const codes = d.weather_code || []
  const maxes = d.temperature_2m_max || []
  const mins = d.temperature_2m_min || []
  const result = {}

  d.time.forEach((dateKey, i) => {
    const code = Number(codes[i])
    const condition = conditionFromCode(code)
    result[dateKey] = {
      date: dateKey,
      code,
      condition,
      label: CONDITIONS[condition],
      icon: ICONS[condition],
      max: Number.isFinite(maxes[i]) ? Math.round(maxes[i]) : null,
      min: Number.isFinite(mins[i]) ? Math.round(mins[i]) : null,
    }
  })
  return result
}

async function fetchWeather({ force = false } = {}) {
  const loc = location.value
  const cached = readJson(CACHE_KEY)

  // Świeży cache dla tej samej lokalizacji - bez zapytania do API (np. przy odświeżeniu strony)
  if (!force && cached?.id === cacheId(loc) && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    daily.value = cached.daily
    status.value = 'ready'
    errorMessage.value = ''
    return
  }

  controller?.abort()
  controller = new AbortController()
  if (status.value !== 'ready') status.value = 'loading'

  try {
    const params = new URLSearchParams({
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      timezone: 'auto',
      past_days: String(PAST_DAYS),
      forecast_days: String(FORECAST_DAYS),
    })
    const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Weather API error ${response.status}`)

    daily.value = parseDaily(await response.json())
    status.value = 'ready'
    errorMessage.value = ''
    writeJson(CACHE_KEY, { id: cacheId(loc), fetchedAt: Date.now(), daily: daily.value })
  } catch (err) {
    if (err?.name === 'AbortError') return
    console.error('Weather fetch failed', err)
    // Starsze dane są lepsze niż pusty widget - błąd pokazujemy tylko, gdy nie ma nic
    if (!Object.keys(daily.value).length) {
      status.value = 'error'
      errorMessage.value = navigator.onLine === false ? 'Offline' : 'Forecast unavailable'
    }
  }
}

function setLocation(next) {
  location.value = next
  if (next.isDefault) {
    try {
      localStorage.removeItem(LOCATION_KEY)
    } catch {
      // brak dostępu do localStorage - lokalizacja zostaje tylko w pamięci
    }
  } else {
    writeJson(LOCATION_KEY, { latitude: next.latitude, longitude: next.longitude, label: next.label })
  }
  daily.value = {}
  status.value = 'loading'
  fetchWeather({ force: true })
}

// Geolokalizacja tylko po kliknięciu użytkownika - przeglądarka pyta wtedy o zgodę
function locateMe() {
  if (!('geolocation' in navigator)) {
    errorMessage.value = 'Location not supported'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      locating.value = false
      setLocation({
        latitude: Number(pos.coords.latitude.toFixed(4)),
        longitude: Number(pos.coords.longitude.toFixed(4)),
        label: 'My location',
        isDefault: false,
      })
    },
    () => {
      locating.value = false
    },
    { timeout: 10000, maximumAge: 10 * 60 * 1000 }
  )
}

function resetLocation() {
  setLocation({ ...DEFAULT_LOCATION })
}

export function useWeather() {
  function weatherFor(year, monthZero, day) {
    return daily.value[formatKey(year, monthZero, day)] || null
  }

  function weatherForDate(date) {
    return weatherFor(date.getFullYear(), date.getMonth(), date.getDate())
  }

  onMounted(() => {
    activeConsumers += 1
    if (activeConsumers === 1) {
      fetchWeather()
      refreshTimer = setInterval(() => fetchWeather({ force: true }), REFRESH_INTERVAL_MS)
    }
  })

  onUnmounted(() => {
    activeConsumers = Math.max(0, activeConsumers - 1)
    if (activeConsumers === 0) {
      clearInterval(refreshTimer)
      refreshTimer = null
      controller?.abort()
    }
  })

  return {
    location: computed(() => location.value),
    status: computed(() => status.value),
    errorMessage: computed(() => errorMessage.value),
    locating: computed(() => locating.value),
    weatherFor,
    weatherForDate,
    retry: () => fetchWeather({ force: true }),
    locateMe,
    resetLocation,
  }
}
