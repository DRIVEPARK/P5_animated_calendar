<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  latitude: { type: Number, default: 52.2297 },
  longitude: { type: Number, default: 21.0122 },
  date: {
    type: String,
    default: () => {
      const now = new Date()
      const pad = n => String(n).padStart(2, '0')
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    }
  },
  locationLabel: { type: String, default: 'Warsaw' }
})

const loading = ref(false)
const errorMessage = ref('')
const forecast = ref(null)
let controller = null

const RAW_ICONS = import.meta.glob('../assets/images/weather/*.{png,webp,jpg,jpeg}', {
  eager: true,
  import: 'default'
})

function buildIconMap(glob) {
  const map = {}
  Object.entries(glob).forEach(([path, url]) => {
    const file = path.split('/').pop() || ''
    const base = file.replace(/\.[^.]+$/, '').toLowerCase()
    map[base] = url
  })
  return map
}

const ICONS = buildIconMap(RAW_ICONS)
const fallbackIcon =
  ICONS['rain-light'] ||
  ICONS['rain-heavy'] ||
  ICONS['cloudy'] ||
  ICONS['part-cloudy'] ||
  ICONS['sunny'] ||
  ''

const CONDITION_LABELS = {
  'sunny': 'Sunny',
  'part-cloudy': 'Partly cloudy',
  'cloudy': 'Cloudy',
  'fog': 'Fog',
  'rain-light': 'Light rain',
  'rain-heavy': 'Heavy rain',
  'snow': 'Snow',
  'storm': 'Storm'
}

function resolveConditionKey(code) {
  if (code === null || code === undefined || Number.isNaN(code)) return 'cloudy'
  if (code === 0) return 'sunny'
  if (code === 1 || code === 2) return 'part-cloudy'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ([51, 53, 55, 56, 57, 61, 80].includes(code)) return 'rain-light'
  if ([63, 65, 66, 67, 81, 82].includes(code)) return 'rain-heavy'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if ([95, 96, 99].includes(code)) return 'storm'
  return 'cloudy'
}

function normalizeUnit(unit) {
  if (!unit) return 'C'
  const cleaned = String(unit).replace(/[^a-zA-Z]/g, '')
  return cleaned || 'C'
}

const hasData = computed(() => !!forecast.value && !errorMessage.value)
const conditionKey = computed(() => (hasData.value ? resolveConditionKey(forecast.value?.code) : ''))
const conditionLabel = computed(() => {
  if (!hasData.value) return '--'
  return CONDITION_LABELS[conditionKey.value] || 'Unknown'
})
const iconSrc = computed(() => (hasData.value ? (ICONS[conditionKey.value] || fallbackIcon) : ''))

const displayDate = computed(() => {
  const safeDate = props.date ? new Date(`${props.date}T00:00:00`) : new Date()
  return safeDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: '2-digit'
  })
})

const temperatureText = computed(() => {
  if (!forecast.value) return '--'
  const unit = normalizeUnit(forecast.value.unit)
  const temp = Number.isFinite(forecast.value.tempMax) ? Math.round(forecast.value.tempMax) : '--'
  return `${temp} ${unit}`
})

const locationText = computed(() => {
  if (props.locationLabel && props.locationLabel.trim()) return props.locationLabel.trim()
  const lat = Number.isFinite(props.latitude) ? props.latitude.toFixed(2) : '--'
  const lon = Number.isFinite(props.longitude) ? props.longitude.toFixed(2) : '--'
  return `${lat}, ${lon}`
})

async function fetchWeather() {
  if (!Number.isFinite(props.latitude) || !Number.isFinite(props.longitude)) {
    errorMessage.value = 'Invalid coordinates'
    forecast.value = null
    return
  }

  if (controller) controller.abort()
  controller = new AbortController()
  loading.value = true
  errorMessage.value = ''

  try {
    const params = new URLSearchParams({
      latitude: String(props.latitude),
      longitude: String(props.longitude),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      temperature_unit: 'celsius',
      timezone: 'auto'
    })

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      signal: controller.signal
    })

    if (!response.ok) throw new Error(`API error ${response.status}`)

    const data = await response.json()
    const daily = data?.daily
    if (!daily || !Array.isArray(daily.time)) throw new Error('No daily data')

    const idx = daily.time.indexOf(props.date)
    if (idx === -1) throw new Error('Date outside forecast range')

    const codes = daily.weather_code || daily.weathercode || []
    const tempMax = daily.temperature_2m_max || []
    const unit = data?.daily_units?.temperature_2m_max || 'C'

    forecast.value = {
      code: Number(codes[idx]),
      tempMax: Number(tempMax[idx]),
      unit
    }
  } catch (err) {
    if (err?.name === 'AbortError') return
    errorMessage.value = err?.message || 'Failed to load weather'
    forecast.value = null
  } finally {
    loading.value = false
  }
}

watch(() => [props.latitude, props.longitude, props.date], fetchWeather, { immediate: true })

onBeforeUnmount(() => {
  if (controller) controller.abort()
})
</script>

<template>
  <div class="weather-card" :class="{ loading: loading, error: !!errorMessage }">
    <div class="weather-location">{{ locationText }}</div>
    <div class="weather-body">
      <div class="weather-icon">
        <img v-if="iconSrc" :src="iconSrc" :alt="conditionLabel" draggable="false" />
        <div v-else class="icon-fallback">{{ conditionLabel }}</div>
      </div>
      <div class="weather-info">
        <div class="weather-temp">{{ temperatureText }}</div>
        <div class="weather-condition">{{ conditionLabel }}</div>
      </div>
    </div>

    <div v-if="loading" class="weather-status">Fetching forecast...</div>
    <div v-else-if="errorMessage" class="weather-status error">{{ errorMessage }}</div>
  </div>
</template>

<style scoped>
.weather-card {
  position: fixed;
  left: 18px;
  bottom: 18px;
  width: min(250px, 86vw);
  padding: 12px 12px 10px 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(12, 12, 12, 0.96), rgba(24, 24, 24, 0.92));
  color: #fff;
  font-family: 'p5hatty', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 460;
  overflow: hidden;
  clip-path: polygon(0 0, 100% 0, 100% 85%, 94% 100%, 0 100%);
}

.weather-location {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.85;
  position: relative;
  z-index: 1;
}

.weather-body {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  position: relative;
  z-index: 1;
}

.weather-icon {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.weather-icon img {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.icon-fallback {
  font-size: 10px;
  text-align: center;
  line-height: 1.2;
  padding: 6px;
}

.weather-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.weather-condition {
  font-size: 12px;
  font-weight: 700;
}

.weather-temp {
  font-size: 22px;
  font-weight: 800;
}

.weather-status {
  margin-top: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.75);
  position: relative;
  z-index: 1;
}

.weather-status.error {
  color: #ff4b4b;
}

@media (max-width: 640px) {
  .weather-card {
    left: 12px;
    bottom: 12px;
    width: min(220px, 92vw);
    padding: 10px;
  }

  .weather-icon {
    width: 58px;
    height: 58px;
  }

  .weather-icon img {
    width: 50px;
    height: 50px;
  }

  .weather-temp {
    font-size: 18px;
  }
}
</style>
