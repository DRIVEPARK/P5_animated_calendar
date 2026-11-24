<template>
  <div
    ref="el"
    class="date-slot"
    :aria-label="`${dayName} ${dayNumber}${isToday ? ', today' : ''}`"
    role="img"
  >
    <img
      v-if="isToday"
      ref="knifeEl"
      class="knife"
      :src="knifeSrc"
      alt=""
      draggable="false"
    />

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

    <div class="day-name">
      <img
        class="day-img"
        :src="getDaySrc(dayIndex)"
        alt=""
        draggable="false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import gsap from 'gsap'
import { useAudio } from '../composables/useAudio'
import knifeSrc from '../assets/images/knife.png'

const props = defineProps({
  id: { type: [String, Number], required: true },
  dayNumber: { type: [String, Number], required: true },
  dayName: { type: String, required: true },
  isToday: { type: Boolean, default: false },
  knifeTrigger: { type: Number, default: 0 },
})

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const KNIFE_DURATION = 0.15
const SLOT_ANIM_DURATION = 0.6
const KNIFE_LEAD = 0.2

const { playKnifeSound } = useAudio()
const el = ref(null)
const knifeEl = ref(null)
defineExpose({ el })

const digits = computed(() => String(props.dayNumber).padStart(2, '0').split(''))
const dayIndex = computed(() => Math.max(0, DAY_NAMES.indexOf(props.dayName)))

const getDigitSrc = d => new URL(`../assets/images/digit${d}.png`, import.meta.url).href
const getDaySrc = i => new URL(`../assets/images/day${i}.png`, import.meta.url).href

function animateKnife() {
  if (!props.isToday || !knifeEl.value || !el.value) return
  const node = knifeEl.value
  const numEl = el.value.querySelector('.number')
  if (!numEl) return
  const delay = Math.max(0, SLOT_ANIM_DURATION - KNIFE_DURATION - KNIFE_LEAD)

  // Czubek ostrza (15% szerokości, 95% wysokości knife.png) trafia w cyfry dzisiejszej daty,
  // zamiast stałego przesunięcia, które wypadało nad sąsiednim dniem
  const knifeW = node.offsetWidth || 70
  const knifeH = node.offsetHeight || knifeW * 1.654
  const targetX = numEl.offsetLeft + numEl.offsetWidth * 0.6
  const targetY = numEl.offsetTop + numEl.offsetHeight * 0.35
  const endX = targetX - knifeW * 0.15
  const endY = targetY - knifeH * 0.95

  gsap.killTweensOf(node)
  gsap.set(node, {
    opacity: 0,
    x: endX + 900,
    y: endY - 900,
    rotate: 35,
    transformOrigin: '15% 95%',
  })
  gsap.to(node, {
    opacity: 1,
    x: endX,
    y: endY,
    rotate: 25,
    duration: KNIFE_DURATION,
    ease: 'power2.out',
    delay,
    onComplete: playKnifeSound,
  })
}

watch(() => props.knifeTrigger, (val, prev) => {
  if (val !== prev) animateKnife()
})
</script>

<style scoped>
.date-slot {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  user-select: none;
  width: clamp(140px, 18vw, 220px);
  height: clamp(140px, 18vw, 220px);
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

.digit-img:nth-child(1) {
  transform: translateX(clamp(6px, 1vw, 12px)) translateY(clamp(4px, 0.6vw, 13px)) scale(0.89);
}

.digit-img:nth-child(2) {
  transform: translateX(clamp(-12px, -1vw, -6px));
}

.day-name {
  transform: translate(var(--day-dx, 10px), var(--day-dy, -8px));
}

.day-img {
  width: clamp(68px, 6vw, 110px);
  height: auto;
  object-fit: contain;
  align-self: start;
}

/* Pozycję ustawia GSAP względem cyfr; wyższa specyficzność nadpisuje .date-slot img */
.date-slot .knife {
  position: absolute;
  top: 0;
  left: 0;
  width: clamp(50px, 5vw, 90px);
  height: auto;
  aspect-ratio: 327 / 541;
  object-fit: contain;
  pointer-events: none;
  opacity: 0;
  z-index: 999;
}
</style>
