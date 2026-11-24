import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatKey } from './useCalendarNotes'

// Pogoda z Open-Meteo (bez klucza API). Jeden wspólny stan dla całej aplikacji:
// widget i modal pogodowy korzystają z tych samych danych i jednego zapytania.
// Zapytanie zwraca: warunki bieżące, prognozę godzinową na 24 h i dzienną (-7 / +16 dni).

const API_URL = 'https://api.open-meteo.com/v1/forecast'
// v2 - cache zawiera też dane bieżące i godzinowe; stary format jest pomijany
const CACHE_KEY = 'p5_calendar_weather_cache_v2'
const LEGACY_CACHE_KEY = 'p5_calendar_weather_cache'
const HOURLY_HOURS = 24
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

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function compassFromDegrees(deg) {
  if (!Number.isFinite(deg)) return '--'
  return COMPASS[Math.round(deg / 45) % 8]
}

const location = ref(loadLocation())
const daily = ref({})
const current = ref(null)
const hourly = ref([])
const fetchedAt = ref(null)
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

const num = v => (Number.isFinite(v) ? v : null)
const rounded = v => (Number.isFinite(v) ? Math.round(v) : null)
// "2026-11-24T07:11" -> "07:11"
const clock = iso => (typeof iso === 'string' && iso.includes('T') ? iso.split('T')[1].slice(0, 5) : null)

function describe(code) {
  const condition = conditionFromCode(Number(code))
  return { code: Number(code), condition, label: CONDITIONS[condition], icon: ICONS[condition] }
}

function parseDaily(data) {
  const d = data?.daily
  if (!d || !Array.isArray(d.time)) throw new Error('No daily data')

  const result = {}
  d.time.forEach((dateKey, i) => {
    result[dateKey] = {
      date: dateKey,
      ...describe(d.weather_code?.[i]),
      max: rounded(d.temperature_2m_max?.[i]),
      min: rounded(d.temperature_2m_min?.[i]),
      sunrise: clock(d.sunrise?.[i]),
      sunset: clock(d.sunset?.[i]),
      precipProbability: rounded(d.precipitation_probability_max?.[i]),
      precipSum: num(d.precipitation_sum?.[i]),
      windMax: rounded(d.wind_speed_10m_max?.[i]),
      uvMax: num(d.uv_index_max?.[i]),
    }
  })
  return result
}

function parseCurrent(data) {
  const c = data?.current
  if (!c) return null
  return {
    time: c.time,
    ...describe(c.weather_code),
    temperature: rounded(c.temperature_2m),
    feelsLike: rounded(c.apparent_temperature),
    humidity: rounded(c.relative_humidity_2m),
    windSpeed: rounded(c.wind_speed_10m),
    windGusts: rounded(c.wind_gusts_10m),
    windDirection: num(c.wind_direction_10m),
    pressure: rounded(c.pressure_msl),
    cloudCover: rounded(c.cloud_cover),
    precipitation: num(c.precipitation),
    isDay: c.is_day === 1,
  }
}

function parseHourly(data) {
  const h = data?.hourly
  if (!h || !Array.isArray(h.time)) return []
  return h.time.map((time, i) => ({
    time,
    hour: clock(time),
    ...describe(h.weather_code?.[i]),
    temperature: num(h.temperature_2m?.[i]),
    precipProbability: rounded(h.precipitation_probability?.[i]),
  }))
}

function applyData(payload) {
  daily.value = payload.daily || {}
  current.value = payload.current || null
  hourly.value = payload.hourly || []
  fetchedAt.value = payload.fetchedAt || Date.now()
}

async function fetchWeather({ force = false } = {}) {
  const loc = location.value
  const cached = readJson(CACHE_KEY)

  // Świeży cache dla tej samej lokalizacji - bez zapytania do API (np. przy odświeżeniu strony)
  if (!force && cached?.id === cacheId(loc) && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    applyData(cached)
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
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'pressure_msl',
        'cloud_cover',
        'precipitation',
        'is_day',
      ].join(','),
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      forecast_hours: String(HOURLY_HOURS),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'precipitation_probability_max',
        'precipitation_sum',
        'wind_speed_10m_max',
        'uv_index_max',
      ].join(','),
      timezone: 'auto',
      past_days: String(PAST_DAYS),
      forecast_days: String(FORECAST_DAYS),
    })
    const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Weather API error ${response.status}`)

    const data = await response.json()
    const payload = {
      id: cacheId(loc),
      fetchedAt: Date.now(),
      daily: parseDaily(data),
      current: parseCurrent(data),
      hourly: parseHourly(data),
    }
    applyData(payload)
    status.value = 'ready'
    errorMessage.value = ''
    writeJson(CACHE_KEY, payload)
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
  applyData({})
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

  // Kolejne dni od podanej daty (do prognozy tygodniowej)
  function dailyFrom(date, count) {
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(date)
      d.setDate(d.getDate() + i)
      return weatherForDate(d)
    }).filter(Boolean)
  }

  onMounted(() => {
    activeConsumers += 1
    if (activeConsumers === 1) {
      try {
        localStorage.removeItem(LEGACY_CACHE_KEY)
      } catch {
        // brak dostępu do localStorage
      }
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
    current: computed(() => current.value),
    hourly: computed(() => hourly.value),
    fetchedAt: computed(() => fetchedAt.value),
    weatherFor,
    weatherForDate,
    dailyFrom,
    retry: () => fetchWeather({ force: true }),
    locateMe,
    resetLocation,
  }
}
