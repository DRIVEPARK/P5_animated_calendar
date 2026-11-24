<template>
  <div v-if="visible" ref="el" class="loading" role="status" aria-live="polite">
    <img class="hat" :src="hatSrc" alt="" draggable="false" />
    <div class="loading-text">LOADING...</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import gsap from 'gsap'
import hatSrc from '../assets/images/hat.gif'

// Minimalny czas, żeby animacja kapelusza zdążyła się wyświetlić,
// oraz limit bezpieczeństwa, gdyby któryś zasób nigdy się nie wczytał
const MIN_VISIBLE_MS = 1200
const MAX_WAIT_MS = 6000

const el = ref(null)
const visible = ref(true)

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

function windowLoaded() {
  if (document.readyState === 'complete') return Promise.resolve()
  return new Promise(resolve => window.addEventListener('load', resolve, { once: true }))
}

function fontsLoaded() {
  return document.fonts?.ready ?? Promise.resolve()
}

onMounted(async () => {
  // Ekran znika, gdy obrazki i fonty są naprawdę wczytane, a nie po stałym czasie
  await Promise.all([
    wait(MIN_VISIBLE_MS),
    Promise.race([Promise.all([windowLoaded(), fontsLoaded()]), wait(MAX_WAIT_MS)]),
  ])

  if (!el.value) return
  gsap.to(el.value, {
    opacity: 0,
    duration: 1,
    ease: 'power1.out',
    onComplete: () => {
      visible.value = false
    },
  })
})
</script>

<style scoped>
.loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 25px;
  background: #000;
  color: #fff;
  text-align: center;
  width: 100%;
  height: 100%;
  font-family: 'p5hatty', 'Persona5MenuFontPrototype-Regular', sans-serif;
}

.hat {
  width: clamp(160px, 40vw, 300px);
  height: clamp(160px, 40vw, 300px);
  object-fit: contain;
  transform: translateX(-10px);
}

.loading-text {
  font-size: clamp(48px, 11vw, 150px);
  max-width: 100%;
}
</style>
