<template>
  <section class="weather" :class="`is-${status}`" aria-label="Weather forecast" aria-live="polite">
    <header class="weather-head">
      <span class="weather-place">{{ location.label }}</span>
      <button
        class="loc-btn"
        :class="{ active: !location.isDefault, busy: locating }"
        :title="location.isDefault ? 'Use my location' : `Back to ${DEFAULT_LOCATION.label}`"
        :aria-label="location.isDefault ? 'Use my location' : `Back to ${DEFAULT_LOCATION.label}`"
        :disabled="locating"
        @click="toggleLocation"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2c-4 0-7 3-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-4-3-7-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z"
          />
        </svg>
      </button>
    </header>

    <div v-if="today" class="weather-main">
      <div class="icon-chip">
        <img :src="today.icon" :alt="today.label" draggable="false" />
      </div>
      <div class="weather-readout">
        <div class="temps">
          <span class="t-max">{{ formatTemp(today.max) }}</span>
          <span class="t-min">/ {{ formatTemp(today.min) }}</span>
        </div>
        <div class="cond-strip" :class="today.condition">{{ today.label }}</div>
      </div>
    </div>

    <div v-else-if="status === 'error'" class="weather-msg error">
      <span>{{ errorMessage }}</span>
      <button class="retry-btn" @click="retry">RETRY</button>
    </div>

    <div v-else class="weather-msg">SCANNING THE SKY...</div>

    <ul v-if="today && upcoming.length" class="forecast-row">
      <li v-for="day in upcoming" :key="day.date" :title="`${day.label}, ${formatTemp(day.max)} / ${formatTemp(day.min)}`">
        <span class="f-day">{{ day.weekday }}</span>
        <img :src="day.icon" :alt="day.label" draggable="false" />
        <span class="f-temp">{{ formatTemp(day.max) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { DEFAULT_LOCATION, useWeather } from '../composables/useWeather'
import { useToday } from '../composables/useToday'

const UPCOMING_DAYS = 3

const { today: todayDate } = useToday()
const {
  location,
  status,
  errorMessage,
  locating,
  weatherForDate,
  retry,
  locateMe,
  resetLocation,
} = useWeather()

const today = computed(() => weatherForDate(todayDate.value))

const upcoming = computed(() =>
  Array.from({ length: UPCOMING_DAYS }, (_, i) => {
    const d = new Date(todayDate.value)
    d.setDate(d.getDate() + i + 1)
    const weather = weatherForDate(d)
    return weather && {
      ...weather,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    }
  }).filter(Boolean)
)

function formatTemp(value) {
  return Number.isFinite(value) ? `${value}°` : '--'
}

function toggleLocation() {
  if (location.value.isDefault) locateMe()
  else resetLocation()
}
</script>

<style scoped>
.weather {
  position: fixed;
  top: 84px;
  left: 18px;
  /* Pod nakładką kalendarza (200), tak jak odtwarzacz */
  z-index: 190;
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 12px;
  background: #000;
  color: #fff;
  border: 3px solid #fff;
  box-shadow: 7px 8px 0 #1612ff, 12px 13px 0 #000;
  transform: rotate(-2deg);
  font-family: 'p5hatty', sans-serif;
  letter-spacing: 0.5px;
  user-select: none;
  animation: weather-in 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) 2.4s both;
}

@keyframes weather-in {
  from {
    opacity: 0;
    transform: translateX(-120%) rotate(-8deg) skewX(-12deg);
  }
  to {
    opacity: 1;
    transform: rotate(-2deg);
  }
}

.weather-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 2px solid #fff;
  padding-bottom: 6px;
}

.weather-place {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'p5menu', 'Persona5MenuFontPrototype-Regular', sans-serif;
  font-size: 20px;
  text-transform: uppercase;
  text-shadow: 2px 2px 0 #1612ff;
}

.loc-btn {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  background: #000;
  border: 2px solid #fff;
  cursor: pointer;
  transform: skewX(-8deg);
  transition: background 0.14s ease, transform 0.14s ease;
}

.loc-btn svg {
  width: 18px;
  height: 18px;
  fill: #fff;
}

.loc-btn:hover {
  background: #1612ff;
  transform: skewX(-8deg) scale(1.1);
}

.loc-btn.active {
  background: #4dffcf;
}

.loc-btn.active svg {
  fill: #000;
}

.loc-btn.busy {
  opacity: 0.5;
  cursor: progress;
}

.loc-btn:focus-visible,
.retry-btn:focus-visible {
  outline: 3px solid #4dffcf;
  outline-offset: 2px;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Ikony mają czarne kontury - stoją na białej, pochylonej plakietce jak w HUD-zie P5 */
.icon-chip {
  flex-shrink: 0;
  width: 78px;
  height: 64px;
  display: grid;
  place-items: center;
  background: #fff;
  border: 3px solid #000;
  box-shadow: 4px 4px 0 #1612ff;
  transform: skewX(-8deg) rotate(-3deg);
}

.icon-chip img {
  width: 62px;
  height: 52px;
  object-fit: contain;
  transform: skewX(8deg);
}

.weather-readout {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.temps {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 0.9;
}

.t-max {
  font-size: 44px;
  text-shadow: 3px 3px 0 #1612ff;
}

.t-min {
  font-size: 20px;
  color: #9a9a9a;
}

.cond-strip {
  align-self: flex-start;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 8px;
  background: #fff;
  color: #000;
  border: 2px solid #000;
  box-shadow: 3px 3px 0 #000;
  font-size: 15px;
  text-transform: uppercase;
  transform: skewX(-10deg) rotate(-1deg);
}

.cond-strip.sunny {
  background: #ffd166;
}

.cond-strip.part-cloudy,
.cond-strip.cloudy,
.cond-strip.fog {
  background: #d9d9d9;
}

.cond-strip.rain-light,
.cond-strip.rain-heavy {
  background: #4da3ff;
}

.cond-strip.snow {
  background: #4dffcf;
}

.cond-strip.storm {
  background: #ff1e38;
  color: #fff;
}

.forecast-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.forecast-row li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 2px;
  background: #fff;
  color: #000;
  border: 2px solid #000;
  box-shadow: 2px 3px 0 #1612ff;
  transform: skewX(-6deg);
}

.forecast-row li:nth-child(2) {
  transform: skewX(-6deg) translateY(2px);
}

.f-day {
  font-size: 13px;
}

.forecast-row img {
  width: 34px;
  height: 24px;
  object-fit: contain;
}

.f-temp {
  font-size: 15px;
}

.weather-msg {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 17px;
  color: #cfcfcf;
}

.weather-msg.error {
  color: #ff4d5e;
}

.retry-btn {
  background: #fff;
  color: #000;
  border: 2px solid #000;
  box-shadow: 3px 3px 0 #1612ff;
  padding: 2px 10px;
  font-family: 'p5hatty', sans-serif;
  font-size: 15px;
  cursor: pointer;
  transform: skewX(-8deg);
}

.retry-btn:hover {
  background: #4dffcf;
}

/* Telefon: kompaktowa wersja - sama dzisiejsza pogoda */
@media (max-width: 600px) {
  .weather {
    top: 76px;
    left: 10px;
    width: 168px;
    padding: 6px 8px 8px;
    gap: 6px;
    border-width: 2px;
    box-shadow: 5px 6px 0 #1612ff;
  }

  .weather-place {
    font-size: 15px;
  }

  .loc-btn {
    width: 24px;
    height: 24px;
  }

  .loc-btn svg {
    width: 14px;
    height: 14px;
  }

  .weather-main {
    gap: 8px;
  }

  .icon-chip {
    width: 52px;
    height: 44px;
    border-width: 2px;
  }

  .icon-chip img {
    width: 42px;
    height: 34px;
  }

  .t-max {
    font-size: 30px;
  }

  .t-min {
    font-size: 14px;
  }

  .cond-strip,
  .forecast-row {
    display: none;
  }

  .weather-msg {
    min-height: 44px;
    font-size: 13px;
  }
}
</style>
