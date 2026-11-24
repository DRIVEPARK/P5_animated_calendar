<template>
  <div class="weather-overlay" @click.self="emit('close')">
    <!-- Przejście jak w P5: czerwone i czarne cięcie przez ekran przed pokazaniem ramy -->
    <div ref="wipeRedEl" class="p5-wipe red" aria-hidden="true"></div>
    <div ref="wipeBlackEl" class="p5-wipe black" aria-hidden="true"></div>

    <button ref="closeBtn" class="close-btn" title="Close weather (Esc)" @click="emit('close')">
      <img :src="closeIcon" alt="Close weather" />
    </button>

    <section
      ref="shellEl"
      class="weather-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weather-modal-title"
    >
      <!-- Biała, postrzępiona ramka = ten sam clip-path na dwóch warstwach (biała pod czarną) -->
      <div class="shell-frame">
        <div class="shell-inner">
          <span class="deco-halftone" aria-hidden="true"></span>

          <!-- Nagłówek: tytuł jak list z wyciętych liter, lokalizacja na plakietce -->
          <header class="wm-header">
            <h2 id="weather-modal-title" class="ransom" aria-label="Weather">
              <span
                v-for="(letter, i) in TITLE_LETTERS"
                :key="i"
                class="r-letter"
                :class="`r${i % 4}`"
                aria-hidden="true"
              >{{ letter }}</span>
            </h2>

            <div class="place-banner">
              <span class="place-name">{{ location.label }}</span>
              <span class="place-coords">{{ coordsLabel }}</span>
            </div>

            <div class="wm-actions">
              <span v-if="updatedLabel" class="updated">UPDATED {{ updatedLabel }}</span>
              <button class="wm-btn" :disabled="locating" @click="toggleLocation">
                {{ location.isDefault ? 'USE MY LOCATION' : `BACK TO ${DEFAULT_LOCATION.label.toUpperCase()}` }}
              </button>
              <button class="wm-btn ghost" :disabled="status === 'loading'" @click="retry">REFRESH</button>
            </div>
          </header>

          <div v-if="!now && status === 'error'" class="wm-state error">
            <span>{{ errorMessage }}</span>
            <button class="wm-btn" @click="retry">RETRY</button>
          </div>
          <div v-else-if="!now" class="wm-state">SCANNING THE SKY...</div>

          <div v-else class="wm-body">
            <!-- LEWA KOLUMNA: teraz + szczegóły -->
            <aside class="wm-now">
              <!-- Teraz: ikona na białej plakietce | duża temperatura z opisem | trzy liczby obok -->
              <div class="hero" data-anim>
                <div class="hero-icon">
                  <img :src="now.icon" :alt="now.label" draggable="false" />
                </div>

                <div class="hero-main">
                  <span class="hero-temp">{{ deg(now.temperature) }}</span>
                  <span class="hero-cond">{{ now.label }}</span>
                </div>

                <dl class="hero-stats">
                  <div>
                    <dt>FEELS LIKE</dt>
                    <dd>{{ deg(now.feelsLike) }}</dd>
                  </div>
                  <div v-if="today">
                    <dt>HIGH</dt>
                    <dd>{{ deg(today.max) }}</dd>
                  </div>
                  <div v-if="today">
                    <dt>LOW</dt>
                    <dd>{{ deg(today.min) }}</dd>
                  </div>
                </dl>
              </div>

              <!-- Szczegóły w takim samym panelu jak prognozy po prawej - spokojne tło, jeden akcent -->
              <section class="panel details-panel" data-anim>
                <h3 class="panel-tag alt">RIGHT NOW</h3>
                <dl class="tiles">
                <div v-for="tile in tiles" :key="tile.label" class="tile">
                  <dt class="tile-tag">{{ tile.label }}</dt>
                  <dd>
                    <svg
                      v-if="tile.arrow !== undefined"
                      class="wind-arrow"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      :style="{ transform: `rotate(${tile.arrow}deg)` }"
                    >
                      <path d="M12 2l6 14-6-3.5L6 16z" />
                    </svg>
                    <span class="tile-value">{{ tile.value }}</span>
                    <span v-if="tile.unit" class="tile-unit">{{ tile.unit }}</span>
                  </dd>
                  <span v-if="tile.note" class="tile-note">{{ tile.note }}</span>
                </div>
                </dl>
              </section>
            </aside>

            <!-- PRAWA KOLUMNA: 24 h + 7 dni -->
            <div class="wm-forecast">
              <section class="panel hourly-panel" data-anim>
                <h3 class="panel-tag">NEXT 24 HOURS</h3>

                <div
                  class="hourly"
                  :style="{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }"
                  @mouseleave="hoverIdx = null"
                >
                  <!-- Linia temperatury: jedna seria, skala tylko temperatury -->
                  <svg class="temp-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polyline :points="linePoints" vector-effect="non-scaling-stroke" />
                  </svg>

                  <div
                    v-for="(h, i) in hours"
                    :key="h.time"
                    class="hour-col"
                    :class="{ active: hoverIdx === i, now: i === 0 }"
                    :aria-label="hourLabel(h)"
                    role="img"
                    @mouseenter="hoverIdx = i"
                  >
                    <span class="hour-icon">
                      <img v-if="i % 3 === 0" :src="h.icon" alt="" draggable="false" />
                    </span>
                    <span class="hour-plot">
                      <span class="dot" :style="{ top: `${yOf(h.temperature)}%` }"></span>
                      <span
                        v-if="i % 3 === 0 || hoverIdx === i"
                        class="dot-label"
                        :style="{ top: `${yOf(h.temperature)}%` }"
                      >
                        {{ deg(Math.round(h.temperature)) }}
                      </span>
                    </span>
                    <span class="hour-rain">
                      <span class="rain-bar" :style="{ height: `${h.precipProbability ?? 0}%` }"></span>
                    </span>
                    <span class="hour-time">{{ i === 0 ? 'NOW' : i % 3 === 0 ? h.hour : '' }}</span>
                  </div>

                  <div
                    v-if="hoverIdx !== null && hours[hoverIdx]"
                    class="hour-tip"
                    :style="tipStyle"
                    role="status"
                  >
                    <strong>{{ hoverIdx === 0 ? 'NOW' : hours[hoverIdx].hour }}</strong>
                    <span>{{ deg(Math.round(hours[hoverIdx].temperature)) }} · {{ hours[hoverIdx].label }}</span>
                    <span>RAIN CHANCE {{ hours[hoverIdx].precipProbability ?? 0 }}%</span>
                  </div>
                </div>
                <p class="axis-note">LINE - TEMPERATURE · BARS - CHANCE OF RAIN (0-100%)</p>
              </section>

              <section class="panel daily-panel" data-anim>
                <h3 class="panel-tag alt">NEXT 7 DAYS</h3>
                <ol class="daily">
                  <li v-for="(d, i) in week" :key="d.date" class="day-row" :class="{ today: i === 0 }">
                    <span class="day-name">
                      <strong>{{ dayName(d, i) }}</strong>
                      <small>{{ dayDate(d) }}</small>
                    </span>
                    <span class="day-icon"><img :src="d.icon" :alt="d.label" draggable="false" /></span>
                    <span class="day-cond">{{ d.label }}</span>
                    <span class="day-min">{{ deg(d.min) }}</span>
                    <span class="range-track" aria-hidden="true">
                      <span class="range-fill" :style="rangeStyle(d)"></span>
                    </span>
                    <span class="day-max">{{ deg(d.max) }}</span>
                    <span class="day-rain" :title="`Chance of rain ${d.precipProbability ?? 0}%`">
                      {{ d.precipProbability ?? 0 }}%
                    </span>
                    <span class="day-wind" :title="`Max wind ${d.windMax ?? '--'} km/h`">
                      {{ d.windMax ?? '--' }} <small>KM/H</small>
                    </span>
                  </li>
                </ol>
              </section>
            </div>
          </div>

          <footer class="wm-footer">
            WEATHER DATA:
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">OPEN-METEO.COM</a>
          </footer>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import gsap from 'gsap'
import { compassFromDegrees, DEFAULT_LOCATION, useWeather } from '../composables/useWeather'
import { useToday } from '../composables/useToday'
import closeIcon from '../assets/images/cancel.png'

const emit = defineEmits(['close'])

const WEEK_DAYS = 7
const TITLE_LETTERS = 'WEATHER'.split('')

const { today: todayDate } = useToday()
const {
  location,
  status,
  errorMessage,
  locating,
  current,
  hourly,
  fetchedAt,
  weatherForDate,
  dailyFrom,
  retry,
  locateMe,
  resetLocation,
} = useWeather()

const shellEl = ref(null)
const closeBtn = ref(null)
const wipeRedEl = ref(null)
const wipeBlackEl = ref(null)
const hoverIdx = ref(null)

const now = computed(() => current.value)
const today = computed(() => weatherForDate(todayDate.value))
const week = computed(() => dailyFrom(todayDate.value, WEEK_DAYS))

// Tylko godziny od bieżącej - cache może mieć do 30 min
const hours = computed(() => {
  const nowHour = now.value?.time?.slice(0, 13) ?? ''
  return hourly.value.filter(h => h.time.slice(0, 13) >= nowHour).slice(0, 24)
})

const deg = v => (Number.isFinite(v) ? `${v}°` : '--')

const coordsLabel = computed(() => {
  const { latitude: lat, longitude: lon } = location.value
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
})

const updatedLabel = computed(() => {
  if (!fetchedAt.value) return ''
  const d = new Date(fetchedAt.value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

function uvLevel(uv) {
  if (!Number.isFinite(uv)) return ''
  if (uv < 3) return 'LOW'
  if (uv < 6) return 'MODERATE'
  if (uv < 8) return 'HIGH'
  if (uv < 11) return 'VERY HIGH'
  return 'EXTREME'
}

const tiles = computed(() => {
  const c = now.value
  const t = today.value
  if (!c) return []
  return [
    { label: 'HUMIDITY', value: c.humidity ?? '--', unit: '%' },
    {
      label: 'WIND',
      value: c.windSpeed ?? '--',
      unit: 'KM/H',
      // Kierunek "skąd wieje" -> strzałka pokazuje, dokąd wieje
      arrow: Number.isFinite(c.windDirection) ? c.windDirection + 180 : undefined,
      note: `FROM ${compassFromDegrees(c.windDirection)}`,
    },
    { label: 'GUSTS', value: c.windGusts ?? '--', unit: 'KM/H' },
    { label: 'PRESSURE', value: c.pressure ?? '--', unit: 'HPA' },
    { label: 'CLOUDS', value: c.cloudCover ?? '--', unit: '%' },
    { label: 'UV MAX', value: t?.uvMax != null ? t.uvMax.toFixed(1) : '--', note: uvLevel(t?.uvMax) },
    { label: 'SUNRISE', value: t?.sunrise ?? '--' },
    { label: 'SUNSET', value: t?.sunset ?? '--' },
    {
      label: 'RAIN TODAY',
      value: t?.precipSum != null ? t.precipSum.toFixed(1) : '--',
      unit: 'MM',
      note: t?.precipProbability != null ? `${t.precipProbability}% CHANCE` : '',
    },
  ]
})

// Skala wykresu tylko z temperatur 24 h, z marginesem, żeby linia nie dotykała krawędzi
const tempRange = computed(() => {
  const temps = hours.value.map(h => h.temperature).filter(Number.isFinite)
  if (!temps.length) return { min: 0, max: 1 }
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  return max - min < 2 ? { min: min - 1, max: max + 1 } : { min, max }
})

function yOf(temp) {
  if (!Number.isFinite(temp)) return 50
  const { min, max } = tempRange.value
  return 22 + (1 - (temp - min) / (max - min)) * 60
}

const linePoints = computed(() => {
  const n = hours.value.length
  return hours.value
    .map((h, i) => `${((i + 0.5) / n) * 100},${yOf(h.temperature)}`)
    .join(' ')
})

const tipStyle = computed(() => {
  const n = hours.value.length
  const x = ((hoverIdx.value + 0.5) / n) * 100
  // Przy krawędziach podpowiedź przesuwa się do środka, żeby nie wyjść poza panel
  const shift = x < 15 ? '0%' : x > 85 ? '-100%' : '-50%'
  return { left: `${x}%`, transform: `translateX(${shift}) rotate(-2deg)` }
})

function hourLabel(h) {
  return `${h.hour}, ${Math.round(h.temperature)} degrees, ${h.label}, ${h.precipProbability ?? 0}% chance of rain`
}

// Prognoza tygodniowa: wspólna skala dla pasków zakresu temperatur
const weekRange = computed(() => {
  const mins = week.value.map(d => d.min).filter(Number.isFinite)
  const maxes = week.value.map(d => d.max).filter(Number.isFinite)
  if (!mins.length || !maxes.length) return { min: 0, max: 1 }
  const min = Math.min(...mins)
  const max = Math.max(...maxes)
  return { min, max: max === min ? min + 1 : max }
})

function rangeStyle(d) {
  if (!Number.isFinite(d.min) || !Number.isFinite(d.max)) return { display: 'none' }
  const { min, max } = weekRange.value
  const span = max - min
  const left = ((d.min - min) / span) * 100
  const width = Math.max(4, ((d.max - d.min) / span) * 100)
  return { left: `${Math.min(left, 96)}%`, width: `${width}%` }
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dayName(d, i) {
  if (i === 0) return 'TODAY'
  if (i === 1) return 'TOMORROW'
  return parseKey(d.date).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
}

function dayDate(d) {
  return parseKey(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()
}

function toggleLocation() {
  if (location.value.isDefault) locateMe()
  else resetLocation()
}

function onKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

let previousFocus = null

function playEntrance() {
  const shell = shellEl.value
  if (!shell) return
  const parts = shell.querySelectorAll('[data-anim]')

  gsap
    .timeline()
    // 1. Czerwony, potem czarny pas przecina ekran po skosie
    .fromTo(
      wipeRedEl.value,
      { x: 0, xPercent: -160, skewX: -22, opacity: 1 },
      { xPercent: 170, duration: 0.5, ease: 'power3.inOut' }
    )
    .fromTo(
      wipeBlackEl.value,
      { x: 0, xPercent: -160, skewX: -22, opacity: 1 },
      { xPercent: 170, duration: 0.5, ease: 'power3.inOut' },
      0.07
    )
    .set([wipeRedEl.value, wipeBlackEl.value], { opacity: 0 })
    // 2. Rama wpada w ślad za cięciem
    .from(
      shell,
      { opacity: 0, x: -120, rotate: -6, skewX: -12, duration: 0.38, ease: 'back.out(1.4)', clearProps: 'opacity,transform' },
      0.18
    )
    // 3. Panele i kafelki wskakują kaskadowo
    .from(
      parts,
      { opacity: 0, y: -22, rotate: -5, scale: 0.9, duration: 0.3, ease: 'back.out(1.8)', stagger: 0.03, clearProps: 'opacity,transform' },
      0.34
    )
}

onMounted(async () => {
  previousFocus = document.activeElement
  window.addEventListener('keydown', onKeyDown)
  await nextTick()
  closeBtn.value?.focus({ preventScroll: true })

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  playEntrance()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  previousFocus?.focus?.({ preventScroll: true })
})
</script>

<style scoped>
/* Paleta P5: czerwień, czerń, biel (+ niebieski tylko dla opadów) */
.weather-overlay {
  --p5-red: #ff0022;
  --p5-red-dark: #b30018;
  --rain: #4da3ff;
  --jagged: polygon(0 1.6%, 2.4% 0, 36% 1.1%, 62% 0, 97.5% 0.9%, 100% 3%, 99.3% 46%, 100% 97.5%, 96% 100%, 58% 98.8%, 21% 100%, 1.2% 98.6%, 0 70%, 0.7% 34%);

  position: fixed;
  inset: 0;
  /* Nad przyciskiem kalendarza (410) i widgetami, pod alertem przypomnienia (600) */
  z-index: 430;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.76);
  font-family: 'p5hatty', sans-serif;
  color: #fff;
  user-select: none;
}

/* Pasy przejścia */
.p5-wipe {
  position: absolute;
  top: -20%;
  bottom: -20%;
  left: 0;
  width: 70%;
  /* Pozycję ustawia wyłącznie GSAP; domyślnie (np. przy ograniczeniu ruchu) pas jest niewidoczny */
  opacity: 0;
  pointer-events: none;
  z-index: 5;
}

.p5-wipe.red {
  background: var(--p5-red);
}

.p5-wipe.black {
  background: #000;
  border-left: 10px solid #fff;
}

.close-btn {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 6;
  background: transparent;
  border: none;
  padding: 10px;
  cursor: pointer;
}

.close-btn img {
  width: 40px;
  height: 40px;
  filter: drop-shadow(3px 4px 0 var(--p5-red));
  transition: transform 0.18s ease;
}

.close-btn:hover img {
  transform: rotate(90deg) scale(1.12);
}

.close-btn:focus-visible,
.wm-btn:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}

/* Rama: cienie przez filter (clip-path obcina box-shadow), postrzępione krawędzie */
.weather-shell {
  position: relative;
  width: min(1300px, 82vw);
  height: 88vh;
  filter: drop-shadow(14px 16px 0 var(--p5-red)) drop-shadow(8px 8px 0 #000);
  transform: rotate(-0.8deg);
}

.shell-frame {
  height: 100%;
  box-sizing: border-box;
  padding: 6px;
  background: #fff;
  clip-path: var(--jagged);
}

.shell-inner {
  position: relative;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: clamp(16px, 1.6vw, 24px) clamp(18px, 1.8vw, 28px);
  background: #000;
  clip-path: var(--jagged);
  overflow: hidden;
}

/* Dekoracja w tle: tylko raster z kropek w prawym dolnym rogu (bez skośnych pasów) */
.deco-halftone {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 55%;
  height: 60%;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(circle, var(--p5-red) 1.6px, transparent 2.1px) 0 0 / 11px 11px;
  mask-image: radial-gradient(ellipse at 100% 100%, #000 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 100% 100%, #000 0%, transparent 70%);
  opacity: 0.55;
}

.wm-header,
.wm-body,
.wm-state,
.wm-footer {
  position: relative;
  z-index: 1;
}

/* Nagłówek */
.wm-header {
  display: flex;
  align-items: center;
  gap: 26px;
  flex-wrap: wrap;
}

/* "WEATHER" - każda litera wycięta z innej gazety */
.ransom {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  font-weight: normal;
}

.r-letter {
  display: inline-block;
  padding: 0 7px;
  line-height: 1.15;
  font-size: clamp(30px, 3vw, 46px);
  box-shadow: 3px 3px 0 #000;
}

.r-letter.r0 {
  background: #fff;
  color: #000;
  font-family: 'p5hatty', sans-serif;
  transform: rotate(-7deg);
}

.r-letter.r1 {
  background: #000;
  color: #fff;
  border: 3px solid #fff;
  transform: rotate(5deg) translateY(4px);
}

.r-letter.r2 {
  background: var(--p5-red);
  color: #fff;
  font-family: 'p5hatty', sans-serif;
  transform: rotate(-3deg) scale(1.18);
}

.r-letter.r3 {
  background: #fff;
  color: var(--p5-red);
  transform: rotate(8deg) translateY(-3px);
}

.place-banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform: rotate(-2deg);
}

.place-name {
  padding: 2px 26px 0 16px;
  background: #fff;
  color: #000;
  font-family: 'p5hatty', sans-serif;
  font-size: clamp(26px, 2.6vw, 38px);
  text-transform: uppercase;
  clip-path: polygon(0 0, 100% 8%, 94% 100%, 3% 92%);
}

.place-coords {
  margin: -2px 0 0 18px;
  padding: 1px 10px;
  background: var(--p5-red);
  font-size: 14px;
  letter-spacing: 1px;
  transform: skewX(-14deg);
}

.wm-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.updated {
  padding: 2px 8px;
  border: 2px solid #fff;
  font-size: 14px;
  letter-spacing: 1px;
  transform: skewX(-12deg);
}

.wm-btn {
  background: var(--p5-red);
  color: #fff;
  border: 3px solid #000;
  box-shadow: 4px 4px 0 #fff;
  padding: 4px 16px;
  font-family: 'p5hatty', sans-serif;
  font-size: 17px;
  letter-spacing: 1px;
  cursor: pointer;
  transform: skewX(-14deg) rotate(-1deg);
  transition: transform 0.14s ease, background 0.14s ease, color 0.14s ease;
}

.wm-btn.ghost {
  background: #fff;
  color: #000;
  box-shadow: 4px 4px 0 var(--p5-red);
}

.wm-btn:hover:not(:disabled) {
  background: #000;
  color: #fff;
  transform: skewX(-14deg) rotate(-3deg) scale(1.08);
}

.wm-btn:disabled {
  opacity: 0.5;
  cursor: progress;
}

.wm-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-family: 'p5hatty', sans-serif;
  font-size: 40px;
  transform: rotate(-3deg);
}

.wm-state.error {
  color: var(--p5-red);
}

/* Treść: dwie kolumny */
.wm-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.75fr);
  gap: 26px;
}

.wm-now {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

/* HERO: trzy proste strefy w jednym rzędzie, prosto ustawione i bez nakładających się efektów */
.hero {
  display: flex;
  align-items: center;
  gap: clamp(12px, 1.1vw, 18px);
  padding: 4px 4px 0;
}

/* Ikona na białej plakietce - ten sam motyw co w widgecie i prognozie 7 dni */
.hero-icon {
  flex-shrink: 0;
  width: clamp(84px, 7vw, 112px);
  aspect-ratio: 1.2;
  display: grid;
  place-items: center;
  background: #fff;
  border: 3px solid #000;
  box-shadow: 5px 5px 0 var(--p5-red);
  transform: rotate(-3deg);
}

.hero-icon img {
  width: 78%;
  height: 78%;
  object-fit: contain;
}

.hero-main {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.hero-temp {
  font-size: clamp(64px, 6vw, 92px);
  line-height: 0.85;
  color: #fff;
}

/* Opis pogody: biały tekst z czerwonym podkreśleniem zamiast postrzępionego paska */
.hero-cond {
  padding-bottom: 3px;
  border-bottom: 3px solid var(--p5-red);
  font-size: clamp(17px, 1.5vw, 21px);
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
}

.hero-stats {
  flex-shrink: 0;
  margin: 0 0 0 auto;
  padding-left: clamp(12px, 1.2vw, 18px);
  border-left: 2px solid #3a3a3a;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero-stats div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.hero-stats dt {
  font-size: 13px;
  letter-spacing: 1px;
  color: #a8a8a8;
  white-space: nowrap;
}

.hero-stats dd {
  margin: 0;
  font-size: clamp(20px, 1.8vw, 26px);
  line-height: 1;
  color: #fff;
}

/* Szczegóły: panel jak prognozy po prawej, w środku spokojna siatka 3x3 z cienkimi podziałkami */
.details-panel {
  flex: 1;
  padding-top: 24px;
  transform: rotate(-0.5deg);
}

.tiles {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  margin: 0;
}

.tile {
  position: relative;
  isolation: isolate;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  /* Lewy margines z zapasem - znacznik-romb musi zmieścić się w skośnej krawędzi plakietki */
  padding: 6px 12px 6px 20px;
  border-right: 1px solid #2e2e2e;
  border-bottom: 1px solid #2e2e2e;
  cursor: default;
}

/* Hover jak zaznaczenie pozycji w menu P5: biała pochylona plakietka wjeżdża z lewej za treść */
.tile::before,
.tile::after {
  content: '';
  position: absolute;
  inset: 8px 6px;
  clip-path: polygon(6% 0, 100% 0, 94% 100%, 0 100%);
  transform: scaleX(0) skewX(-6deg);
  transform-origin: left center;
  transition: transform 0.22s cubic-bezier(0.2, 1.3, 0.4, 1);
}

.tile::before {
  z-index: -1;
  background: #fff;
}

/* Czerwony "cień" jako osobna warstwa - clip-path obcina zwykły box-shadow */
.tile::after {
  z-index: -2;
  background: var(--p5-red);
  translate: 5px 5px;
  transition-delay: 0.03s;
}

.tile:nth-child(3n) {
  border-right: none;
}

.tile:nth-last-child(-n + 3) {
  border-bottom: none;
}

.tile:hover::before,
.tile:hover::after {
  transform: scaleX(1) skewX(-6deg) rotate(-2deg);
}

/* Na białej plakietce tekst robi się czarny, liczba "podskakuje" z czerwonym cieniem */
.tile .tile-tag,
.tile .tile-value,
.tile .tile-unit,
.tile .tile-note {
  transition: color 0.18s ease, transform 0.22s cubic-bezier(0.2, 1.4, 0.4, 1), text-shadow 0.18s ease;
}

.tile:hover .tile-tag,
.tile:hover .tile-value {
  color: #000;
}

.tile:hover .tile-unit,
.tile:hover .tile-note {
  color: #555;
}

/* Liczba rośnie od lewego dolnego rogu, a odstęp do jednostki się poszerza - nic nie nachodzi */
.tile:hover .tile-value {
  transform: rotate(-4deg) scale(1.08);
  text-shadow: 3px 3px 0 var(--p5-red);
}

.tile:hover dd {
  gap: 10px;
}

.tile:hover .tile-tag::before {
  transform: rotate(45deg) scale(1.1);
}

.tile:hover .wind-arrow {
  fill: #000;
}

/* Etykieta z małym czerwonym znacznikiem - jedyny akcent koloru w kafelku */
.tile-tag {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  letter-spacing: 1.2px;
  color: #bdbdbd;
}

.tile-tag::before {
  content: '';
  width: 9px;
  height: 9px;
  flex-shrink: 0;
  background: var(--p5-red);
  transform: skewX(-18deg);
  transition: transform 0.22s cubic-bezier(0.2, 1.4, 0.4, 1);
}

.tile dd {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 5px;
  transition: gap 0.2s ease;
}

.tile-value {
  font-size: clamp(26px, 2.4vw, 34px);
  line-height: 1;
  color: #fff;
  transform-origin: left bottom;
}

.tile-unit {
  font-size: 13px;
  color: #9a9a9a;
}

.tile-note {
  font-size: 12px;
  letter-spacing: 0.6px;
  color: #9a9a9a;
}

.wind-arrow {
  align-self: center;
  width: 18px;
  height: 18px;
  fill: #fff;
  flex-shrink: 0;
  transition: fill 0.18s ease;
}

/* Prawa kolumna */
.wm-forecast {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 22px;
}

.panel {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px 16px 10px;
  background: #0b0b0b;
  border: 3px solid #fff;
  box-shadow: 7px 7px 0 var(--p5-red);
}

.hourly-panel {
  transform: rotate(-0.7deg);
}

.daily-panel {
  transform: rotate(0.5deg);
}

/* Naklejka z tytułem wystająca nad ramkę panelu */
.panel-tag {
  position: absolute;
  top: -18px;
  left: 18px;
  z-index: 2;
  margin: 0;
  padding: 2px 16px 0;
  background: var(--p5-red);
  color: #fff;
  border: 3px solid #000;
  box-shadow: 4px 4px 0 #fff;
  font-family: 'p5hatty', sans-serif;
  font-size: 22px;
  font-weight: normal;
  letter-spacing: 1px;
  transform: rotate(-3deg) skewX(-8deg);
}

.panel-tag.alt {
  background: #fff;
  color: #000;
  box-shadow: 4px 4px 0 var(--p5-red);
  transform: rotate(2deg) skewX(-8deg);
}

/* Wykres godzinowy */
.hourly {
  position: relative;
  display: grid;
  height: clamp(160px, 22vh, 220px);
}

.temp-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 34px;
  height: calc(100% - 34px - 52px);
  width: 100%;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(3px 3px 0 var(--p5-red));
}

.temp-line polyline {
  fill: none;
  stroke: #fff;
  stroke-width: 3;
  stroke-linejoin: miter;
  stroke-linecap: square;
}

.hour-col {
  position: relative;
  display: grid;
  grid-template-rows: 34px 1fr 34px 18px;
  min-width: 0;
  cursor: default;
}

.hour-col.active {
  background: linear-gradient(180deg, transparent, rgba(255, 0, 34, 0.35));
}

.hour-icon {
  display: grid;
  place-items: center;
}

.hour-icon img {
  width: 30px;
  height: 24px;
  object-fit: contain;
  padding: 2px 3px;
  background: #fff;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 var(--p5-red);
  transform: skewX(-10deg) rotate(-4deg);
}

.hour-plot {
  position: relative;
}

/* Romby zamiast kropek */
.dot {
  position: absolute;
  left: 50%;
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  background: #fff;
  border: 2px solid #000;
  box-sizing: border-box;
  transform: rotate(45deg);
  z-index: 1;
}

.hour-col.now .dot {
  background: var(--p5-red);
  border-color: #fff;
}

.hour-col.active .dot {
  width: 15px;
  height: 15px;
  margin: -7.5px 0 0 -7.5px;
  background: var(--p5-red);
  border-color: #fff;
}

.dot-label {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -155%) rotate(-6deg);
  font-size: 16px;
  white-space: nowrap;
  text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;
}

.hour-rain {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-bottom: 2px solid #fff;
}

.rain-bar {
  width: 58%;
  min-height: 1px;
  background: var(--rain);
  clip-path: polygon(0 3px, 100% 0, 100% 100%, 0 100%);
}

.hour-time {
  font-size: 13px;
  text-align: center;
  white-space: nowrap;
  opacity: 0.75;
}

.hour-col.now .hour-time {
  opacity: 1;
  color: var(--p5-red);
}

.hour-tip {
  position: absolute;
  top: -10px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  background: #fff;
  color: #000;
  border: 3px solid #000;
  box-shadow: 5px 5px 0 var(--p5-red);
  font-size: 15px;
  white-space: nowrap;
  pointer-events: none;
}

.hour-tip strong {
  font-family: 'p5hatty', sans-serif;
  font-weight: normal;
  font-size: 18px;
  color: var(--p5-red);
}

.axis-note {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.8px;
  opacity: 0.55;
}

/* Prognoza tygodniowa: ukośne pasy jak pozycje menu w P5 */
.daily {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0 6px;
  list-style: none;
  overflow-y: auto;
  overflow-x: hidden;
}

.day-row {
  position: relative;
  flex: 1;
  min-height: 28px;
  display: grid;
  grid-template-columns: 130px 52px minmax(0, 1fr) 44px minmax(80px, 1.3fr) 44px 52px 74px;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  isolation: isolate;
  transition: transform 0.16s ease, color 0.16s ease;
}

/* Tło pasa jako pochylony pseudo-element - treść zostaje prosta */
.day-row::before {
  content: '';
  position: absolute;
  inset: 0 4px;
  z-index: -1;
  background: #141414;
  border-left: 5px solid #fff;
  transform: skewX(-16deg);
  transition: background 0.16s ease, border-color 0.16s ease;
}

.day-row:nth-child(even)::before {
  background: #0a0a0a;
}

.day-row.today::before {
  background: var(--p5-red);
  border-left-color: #000;
}

.day-row:hover {
  color: #000;
  transform: translateX(8px);
}

.day-row:hover::before {
  background: #fff;
  border-left-color: var(--p5-red);
}

.day-name {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

.day-name strong {
  font-family: 'p5hatty', sans-serif;
  font-weight: normal;
  font-size: 18px;
}

.day-name small {
  font-size: 12px;
  opacity: 0.7;
}

.day-icon img {
  width: 42px;
  height: 26px;
  object-fit: contain;
  padding: 2px 4px;
  background: #fff;
  border: 2px solid #000;
  transform: skewX(-10deg);
}

.day-cond {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  text-transform: uppercase;
  opacity: 0.85;
}

.day-min,
.day-max {
  font-size: 18px;
}

.day-min {
  text-align: right;
  opacity: 0.7;
}

.range-track {
  position: relative;
  height: 8px;
  background: rgba(255, 255, 255, 0.18);
  transform: skewX(-20deg);
}

.range-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  background: #fff;
}

.day-row.today .range-track {
  background: rgba(0, 0, 0, 0.35);
}

.day-row:hover .range-track {
  background: #ddd;
}

.day-row:hover .range-fill {
  background: var(--p5-red);
}

.day-rain {
  font-size: 15px;
  text-align: right;
  color: var(--rain);
}

.day-row.today .day-rain,
.day-row:hover .day-rain {
  color: inherit;
}

.day-wind {
  font-size: 15px;
  text-align: right;
  white-space: nowrap;
}

.day-wind small {
  font-size: 11px;
  opacity: 0.7;
}

.wm-footer {
  font-size: 12px;
  letter-spacing: 1px;
  opacity: 0.6;
}

.wm-footer a {
  color: inherit;
}

/* Węższe ekrany: jedna kolumna z przewijaniem (pełny widok mobilny - do przebudowy) */
@media (max-width: 1000px) {
  .weather-shell {
    width: calc(100vw - 32px);
    height: 90vh;
  }

  .shell-inner {
    overflow-y: auto;
  }

  .wm-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .tiles {
    grid-auto-rows: auto;
  }

  .day-row {
    grid-template-columns: 96px 48px 36px minmax(50px, 1fr) 36px;
  }

  .day-cond,
  .day-rain,
  .day-wind {
    display: none;
  }
}
</style>
