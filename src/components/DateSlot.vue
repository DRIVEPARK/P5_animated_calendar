<template>
  <div
    class="date-slot"
    :aria-label="`Dzień ${dayNumber} ${dayName}`"
    role="button"
    tabindex="0"
    ref="el"
  >
    <img
      v-if="isToday"
      ref="knifeEl"
      class="knife"
      :src="knifeSrc"
      alt="Knife"
      draggable="false"
    />
    <!-- CYFRY -->
    <div class="number">
      <img
        v-for="(d, i) in digits"
        :key="i"
        class="digit-img"
        :src="getDigitSrc(d)"
        alt=""
        draggable="false"
      />
    </div>

    <!-- DZIEŃ TYGODNIA -->
    <div class="day-name">
      <img
        class="day-img"
        :src="getDaySrc(mappedDayIndex)"
        alt=""
        draggable="false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
const props = defineProps({
  id: { type: [String, Number], required: true },
  dayNumber: { type: [String, Number], required: true },
  dayName: { type: String, required: true },
  isToday: { type: Boolean, default: false },
  knifeTrigger: { type: Number, default: 0 },
})

const el = ref(null)
const knifeEl = ref(null)
const knifeSrc = new URL('../assets/images/knife.png', import.meta.url).href
const knifeSfx = new Audio(new URL('../assets/audio/p5_dagger_strike.mp3', import.meta.url).href)
knifeSfx.volume = 0.65
let audioUnlocked = false

function unlockAudio() {
  if (audioUnlocked) return
  knifeSfx.play().then(() => {
    knifeSfx.pause()
    knifeSfx.currentTime = 0
    audioUnlocked = true
  }).catch(() => {
    // still locked; will retry on next gesture
  })
}

const KNIFE_DURATION = 0.15
const SLOT_ANIM_DURATION = 0.6 // z Calendar.vue (gsap.to duration)
const KNIFE_LEAD = 0.2 // uruchom wyraźnie wcześniej
defineExpose({ el })

// ROZBICIE DNIA NA DWIE CYFRY

const digits = computed(() => {
  const str = String(props.dayNumber).padStart(2, "0")
  return str.split("")
})

function getDigitSrc(d) {
  return new URL(`../assets/images/digit${d}.png`, import.meta.url).href
}
// MAPOWANIE NAZWY DNIA NA NUMER 0-6

const dayOrder = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const mappedDayIndex = computed(() => {
  return dayOrder[props.dayName] ?? 0
})

function getDaySrc(i) {
  return new URL(`../assets/images/day${i}.png`, import.meta.url).href
}

function animateKnife() {
  if (!props.isToday || !knifeEl.value) return
  const node = knifeEl.value
  gsap.killTweensOf(node)
  gsap.set(node, { opacity: 0, x: 900, y: -900, rotate: 35 })
  const delay = Math.max(0, SLOT_ANIM_DURATION - KNIFE_DURATION - KNIFE_LEAD)
  gsap.to(node, {
    opacity: 1,
    x: 85,
    y: -95,
    rotate: 25,
    duration: KNIFE_DURATION,
    ease: 'power2.out',
    delay,
    onComplete: () => {
      try {
        knifeSfx.currentTime = 0
        knifeSfx.play()
      } catch (e) {
        // ignore autoplay errors
      }
    }
  })
}

watch(() => props.knifeTrigger, (val, prev) => {
  if (val === prev) return
  animateKnife()
})

onMounted(() => {
	window.addEventListener('pointerdown', unlockAudio, { once: true })
})

onBeforeUnmount(() => {
	window.removeEventListener('pointerdown', unlockAudio)
})
</script>

<style scoped>
.date-slot {
  position: absolute;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  user-select:none;
  width: clamp(140px, 18vw, 220px);
  height: clamp(140px, 18vw, 220px);
}

.digit-img:nth-child(1){
  transform: translateX(clamp(6px, 1vw, 12px)) translateY(clamp(4px, 0.6vw, 13px)) scale(0.89);
}

.digit-img:nth-child(2){
  transform: translateX(clamp(-12px, -1vw, -6px));
}


.date-slot img {
    width: 100%;
    height: 100%;
    object-fit: contain;

}

.number {
  display: flex;
}

.digit-img {
  width: clamp(44px, 5vw, 68px);    
  height: auto;
  object-fit: contain;
}


.day-img {
  width: clamp(68px, 6vw, 110px);     
  height: auto;
  margin-top: 0px;
  object-fit: contain;
  align-self: start;
}

.day-name {
  transform: translate(var(--day-dx, 10px), var(--day-dy, -8px));
}

.knife {
  position: absolute;
  top: -18%;
  right: -12%;
  width: clamp(50px, 5vw, 90px);
  height: auto;
  object-fit: contain;
  transform-origin: center;
  pointer-events: none;
  opacity: 0;
  z-index: 999;
}

</style>
