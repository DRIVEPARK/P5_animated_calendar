<template>
  <div v-if="current" :key="current.id" class="reminder-layer">
    <div ref="backdropEl" class="reminder-backdrop"></div>

    <div
      ref="stageEl"
      class="reminder-stage"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reminder-alert-title"
      aria-describedby="reminder-alert-text"
    >
      <!--
        Karta renderowana dwa razy i przycięta po skosie (clip-path) - złożone połówki
        wyglądają jak jedna karta, a po cięciu nożem rozjeżdżają się w przeciwne strony.
        Górna kopia jest tylko wizualna (aria-hidden + inert).
      -->
      <div
        v-for="half in HALVES"
        :key="half"
        :ref="el => (halfEls[half] = el)"
        class="card-half"
        :class="half"
        :aria-hidden="half === 'top' ? 'true' : undefined"
        :inert="half === 'top' ? true : undefined"
      >
        <div class="reminder-card">
          <div class="card-banner">
            <img class="banner-icon" :src="reminderIcon" alt="" draggable="false" />
            <span :id="half === 'bottom' ? 'reminder-alert-title' : undefined" class="banner-title">
              REMINDER!
            </span>
          </div>

          <div class="card-when">
            <span class="card-time">{{ current.time }}</span>
            <span class="card-date">{{ dateLabel }}</span>
          </div>

          <p :id="half === 'bottom' ? 'reminder-alert-text' : undefined" class="card-text">
            {{ current.text }}
          </p>

          <div class="card-actions">
            <button
              :ref="el => half === 'bottom' && (confirmBtn = el)"
              type="button"
              class="confirm-btn"
              :disabled="cutting"
              @click="confirm"
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>

      <div ref="slashEl" class="slash" aria-hidden="true"></div>
      <img ref="knifeEl" class="alert-knife" :src="knifeSrc" alt="" draggable="false" />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import gsap from 'gsap'
import { useAudio } from '../composables/useAudio'
import { useCalendarNotes } from '../composables/useCalendarNotes'
import knifeSrc from '../assets/images/knife.png'
import reminderIcon from '../assets/images/reminder.png'

const HALVES = ['top', 'bottom']
// Linia cięcia jako ułamek wysokości karty na lewej (x=0) i prawej (x=100%) krawędzi.
// Wynika z clip-path w stylach: prosta przez (-40%, 66%) i (140%, 40%).
const CUT_LEFT = 0.66 - 0.26 * (40 / 180)
const CUT_RIGHT = 0.66 - 0.26 * (140 / 180)
const cutAt = xFraction => CUT_LEFT + (CUT_RIGHT - CUT_LEFT) * xFraction

const { activeReminder: current, dismissReminder } = useCalendarNotes()
const { playKnifeSound } = useAudio()

const backdropEl = ref(null)
const stageEl = ref(null)
const slashEl = ref(null)
const knifeEl = ref(null)
const confirmBtn = ref(null)
const halfEls = {}
const cutting = ref(false)

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const dateLabel = computed(() => {
  if (!current.value) return ''
  const [y, m, d] = current.value.dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
    .toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
})

// Wejście: karta wpada z lewej z obrotem, jak karta wizytowa rzucona na stół
function playEntrance() {
  cutting.value = false
  const stage = stageEl.value
  if (!stage) return
  gsap.set(stage, { xPercent: -50, yPercent: -50, rotate: -3 })
  confirmBtn.value?.focus({ preventScroll: true })
  if (reducedMotion()) return

  gsap
    .timeline()
    .from(backdropEl.value, { opacity: 0, duration: 0.2 })
    .from(
      stage,
      { x: -window.innerWidth * 0.6, rotate: -28, scale: 0.6, opacity: 0, duration: 0.45, ease: 'back.out(1.5)' },
      0
    )
    .to(stage, { x: 6, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' })
    .set(stage, { x: 0 })
}

// Potwierdzenie: nóż wbija się w linię cięcia, błysk, połówki karty rozjeżdżają się i znikają
function confirm() {
  if (cutting.value || !current.value) return
  cutting.value = true
  const id = current.value.id
  const finish = () => dismissReminder(id)

  const stage = stageEl.value
  const knife = knifeEl.value
  if (reducedMotion() || !stage || !knife) {
    finish()
    return
  }

  const W = stage.offsetWidth
  const H = stage.offsetHeight
  const kW = knife.offsetWidth || 80
  const kH = knife.offsetHeight || kW * 1.654

  // Czubek ostrza (15% / 95% obrazka) trafia w linię cięcia na 58% szerokości karty
  const hitX = W * 0.58
  const hitY = H * cutAt(0.58)
  const endX = hitX - kW * 0.15
  const endY = hitY - kH * 0.95

  // Błysk startuje z lewego końca (x = -20%) i biegnie dokładnie po linii cięcia
  const angle = (Math.atan2((CUT_RIGHT - CUT_LEFT) * H, W) * 180) / Math.PI
  const slashTop = H * cutAt(-0.2)

  gsap.set(knife, {
    x: endX + 280,
    y: endY - 340,
    rotate: 34,
    opacity: 0,
    transformOrigin: '15% 95%',
  })
  gsap.set(slashEl.value, { top: slashTop, rotate: angle, scaleX: 0, opacity: 1 })

  gsap
    .timeline({ onComplete: finish })
    // 1. Nóż wlatuje i się wbija
    .to(knife, { opacity: 1, x: endX, y: endY, rotate: 10, duration: 0.18, ease: 'power4.in' })
    .add(playKnifeSound)
    // 2. Uderzenie - karta drży
    .to(stage, { x: 9, y: 5, duration: 0.045, yoyo: true, repeat: 3, ease: 'none' })
    .set(stage, { x: 0, y: 0 })
    // 3. Krótka pauza z wbitym nożem, potem biały błysk po linii cięcia
    .to(slashEl.value, { scaleX: 1, duration: 0.14, ease: 'power2.out' }, '+=0.18')
    .to(slashEl.value, { opacity: 0, duration: 0.18 }, '>-0.02')
    // 4. Połówki rozjeżdżają się w przeciwne strony, nóż spada z dolną
    .addLabel('split', '<')
    .to(halfEls.top, { x: -90, y: -70, rotate: -9, opacity: 0, duration: 0.6, ease: 'power2.in' }, 'split')
    .to(halfEls.bottom, { x: 90, y: 110, rotate: 7, opacity: 0, duration: 0.6, ease: 'power2.in' }, 'split')
    .to(knife, { x: `+=${90}`, y: `+=${160}`, rotate: 50, opacity: 0, duration: 0.55, ease: 'power2.in' }, 'split')
    .to(backdropEl.value, { opacity: 0, duration: 0.35 }, 'split+=0.3')
}

// Każde nowe przypomnienie z kolejki montuje świeży element (key = id) - odpalamy wejście
watch(
  () => current.value?.id,
  async id => {
    if (!id) return
    await nextTick()
    playEntrance()
  },
  { immediate: true }
)
</script>

<style scoped>
.reminder-layer {
  position: fixed;
  inset: 0;
  z-index: 600;
  font-family: 'p5hatty', sans-serif;
}

.reminder-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
}

.reminder-stage {
  position: absolute;
  left: 50%;
  top: 46%;
  width: min(470px, 88vw);
}

.card-half {
  will-change: transform, opacity;
}

/* Połówki zachodzą na siebie o ułamek procenta, żeby na łączeniu nie było szczeliny */
.card-half.top {
  position: relative;
  clip-path: polygon(-40% -40%, 140% -40%, 140% 40.3%, -40% 66.3%);
}

.card-half.bottom {
  position: absolute;
  inset: 0;
  clip-path: polygon(-40% 66%, 140% 40%, 140% 140%, -40% 140%);
}

.reminder-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 22px 22px;
  background:
    radial-gradient(circle, rgba(255, 30, 56, 0.22) 1.3px, transparent 1.8px) 0 0 / 10px 10px,
    #000;
  border: 4px solid #fff;
  box-shadow: 10px 12px 0 #ff1e38, 18px 20px 0 #000;
  color: #fff;
}

.card-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 -22px;
  padding: 10px 22px 8px;
  background: #ff1e38;
  border-bottom: 4px solid #000;
  clip-path: polygon(0 0, 100% 0, 100% 78%, 0 100%);
}

.banner-icon {
  width: 42px;
  height: 42px;
  object-fit: contain;
  filter: drop-shadow(2px 2px 0 #000);
  transform: rotate(-10deg);
}

.banner-title {
  font-family: 'p5hatty', sans-serif;
  font-size: 40px;
  letter-spacing: 2px;
  color: #fff;
  text-shadow: 3px 3px 0 #000;
  transform: rotate(-2deg);
}

.card-when {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.card-time {
  font-size: 64px;
  line-height: 0.9;
  text-shadow: 4px 4px 0 #ff1e38;
  transform: rotate(-3deg);
}

.card-date {
  padding: 2px 10px;
  background: #fff;
  color: #000;
  font-size: 18px;
  transform: skewX(-10deg);
}

.card-text {
  margin: 0;
  padding: 10px 14px;
  background: #fff;
  color: #000;
  border: 3px solid #000;
  box-shadow: 5px 5px 0 #1612ff;
  font-size: 24px;
  line-height: 1.25;
  letter-spacing: 0.5px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  transform: skewX(-4deg) rotate(-1deg);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.confirm-btn {
  background: #fff;
  color: #000;
  border: 3px solid #000;
  box-shadow: 5px 5px 0 #ff1e38;
  padding: 8px 26px;
  font-family: 'p5hatty', sans-serif;
  font-size: 26px;
  letter-spacing: 2px;
  cursor: pointer;
  transform: skewX(-12deg) rotate(-2deg);
  transition: transform 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.confirm-btn:hover:not(:disabled) {
  background: #ff1e38;
  color: #fff;
  transform: skewX(-12deg) rotate(-4deg) scale(1.08);
}

.confirm-btn:focus-visible {
  outline: 3px solid #4dffcf;
  outline-offset: 3px;
}

.confirm-btn:disabled {
  cursor: default;
}

/* Biały błysk cięcia - pozycję, kąt i skalę ustawia GSAP */
.slash {
  position: absolute;
  left: -20%;
  width: 140%;
  height: 7px;
  margin-top: -3px;
  background: #fff;
  box-shadow: 0 0 14px 4px rgba(255, 255, 255, 0.85), 0 0 2px 1px #ff1e38;
  opacity: 0;
  pointer-events: none;
  transform-origin: 0 50%;
}

.alert-knife {
  position: absolute;
  top: 0;
  left: 0;
  width: 96px;
  aspect-ratio: 327 / 541;
  height: auto;
  object-fit: contain;
  opacity: 0;
  pointer-events: none;
  filter: drop-shadow(5px 7px 0 rgba(0, 0, 0, 0.85));
  z-index: 3;
}
</style>
