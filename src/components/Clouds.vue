<template>
  <div class="clouds-container">
    <img
      v-for="(cfg, i) in LAYOUT"
      :key="i"
      :ref="el => (cloudRefs[i] = el)"
      :src="getCloudSrc(i + 1)"
      :style="getCloudStyle(cfg)"
      class="cloud"
      alt=""
      draggable="false"
    />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import gsap from 'gsap'

const cloudRefs = ref([])
const tweens = []

// Spójny układ chmur + 3 płynne, ciągłe ścieżki ruchu (bez zatrzymań w rogach i bez skalowania)
// 'right-up-back' -> płynna pętla: w prawo -> w górę -> powrót
// 'left-right'    -> spokojny dryf prawo <-> lewo
// 'left-up-right' -> płynna pętla: w lewo -> w górę -> w prawo -> powrót
const LAYOUT = [
  { x: -0.005, y: -0.005, s: 1.00, zIndex: 1, pattern: 'right-up-back', ax: 24, ay: 14, dur: 3.6 }, // cloud1 (żywsza)
  { x: 0.14,   y: 0.00,   s: 0.60, zIndex: 2, pattern: 'left-right',    ax: 32, ay: 5,  dur: 2.8 }, // cloud2 (mała na przodzie - szybsza, dłuższy ruch)
  { x: 0.20,   y: 0.10,   s: 1.05, zIndex: 1, pattern: 'left-up-right', ax: 30, ay: 16, dur: 3.3 }, // cloud3 (szybsza pętla)
  { x: 0.20,   y: -0.01,  s: 0.90, zIndex: 1, pattern: 'left-right',    ax: 22, ay: 4,  dur: 4.8 }, // cloud4 (spokojniejsza baza)
  { x: 0.29,   y: 0.05,   s: 0.95, zIndex: 1, pattern: 'right-up-back', ax: 28, ay: 15, dur: 3.1 }, // cloud5 (dynamiczniejsza)
  { x: 0.37,   y: 0.09,   s: 1.05, zIndex: 0, pattern: 'left-up-right', ax: 36, ay: 18, dur: 3.7 }, // cloud6 (szeroki ruch w tle)
  { x: 0.43,   y: -0.01,  s: 1.20, zIndex: 1, pattern: 'left-right',    ax: 25, ay: 5,  dur: 5.0 }, // cloud7 (duża centralna - spokojniejsza)
  { x: 0.33,   y: -0.05,  s: 0.90, zIndex: 1, pattern: 'right-up-back', ax: 26, ay: 13, dur: 2.9 }, // cloud8 (pierwszy plan - szybsza)
  { x: 0.62,   y: -0.05,  s: 1.05, zIndex: 1, pattern: 'left-up-right', ax: 28, ay: 14, dur: 3.5 }, // cloud9 (żywsza)
  { x: 0.81,   y: 0.30,   s: 1.15, zIndex: 1, pattern: 'right-up-back', ax: 22, ay: 16, dur: 3.8 }, // cloud10 (prawa góra)
  { x: 0.78,   y: -0.02,  s: 1.25, zIndex: 1, pattern: 'left-right',    ax: 24, ay: 4,  dur: 4.9 }, // cloud11 (duża prawa - spokojniejsza)
  { x: 0.78,   y: 0.20,   s: 0.95, zIndex: 0, pattern: 'left-up-right', ax: 30, ay: 16, dur: 3.0 }, // cloud12 (szybsza w tle po prawej)
]

const getCloudSrc = i => new URL(`../assets/images/cloud${i}.png`, import.meta.url).href

function getCloudStyle(cfg) {
  const left = (cfg.x * 1.1 - 0.05) * 100
  const bottom = Math.max(cfg.y * 1.08 - 0.04, -0.25) * 100
  return {
    width: `clamp(${160 * cfg.s}px, ${22 * cfg.s}vw, ${480 * cfg.s}px)`,
    left: `${left}%`,
    bottom: `${bottom}%`,
    zIndex: cfg.zIndex ?? 1,
  }
}

function startContinuousMotion(cloud, cfg, index) {
  const { pattern, ax, ay, dur } = cfg
  const phaseOffset = (index * 0.27) % 1

  // Przesunięcie fazowe między osią X a osią Y o 1/4 cyklu (0.5 trwania yoyo)
  // sprawia, że gdy X zwalnia na końcu wychylenia, Y jest w pełnym ruchu - chmura NIGDY się nie zatrzymuje
  if (pattern === 'right-up-back') {
    const tweenX = gsap.fromTo(
      cloud,
      { x: 0 },
      { x: ax, duration: dur, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }
    )
    const tweenY = gsap.fromTo(
      cloud,
      { y: 0 },
      { y: -ay, duration: dur, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }
    )
    tweenX.totalProgress(phaseOffset)
    tweenY.totalProgress((phaseOffset + 0.25) % 1)
    tweens.push(tweenX, tweenY)
  } else if (pattern === 'left-up-right') {
    const tweenX = gsap.fromTo(
      cloud,
      { x: -ax },
      { x: ax, duration: dur, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }
    )
    const tweenY = gsap.fromTo(
      cloud,
      { y: 0 },
      { y: -ay, duration: dur, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }
    )
    tweenX.totalProgress(phaseOffset)
    tweenY.totalProgress((phaseOffset + 0.25) % 1)
    tweens.push(tweenX, tweenY)
  } else {
    // 'left-right' - spokojny ruch prawo-lewo z minimalnym wygładzeniem na nawrotach
    const tweenX = gsap.fromTo(
      cloud,
      { x: -ax },
      { x: ax, duration: dur, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }
    )
    const tweenY = gsap.fromTo(
      cloud,
      { y: -ay },
      { y: ay, duration: dur * 0.85, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }
    )
    tweenX.totalProgress(phaseOffset)
    tweenY.totalProgress((phaseOffset + 0.25) % 1)
    tweens.push(tweenX, tweenY)
  }
}

onMounted(() => {
  // Ciągły ruch chmur to czysta dekoracja - pomijamy go przy prefers-reduced-motion
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  cloudRefs.value.forEach((cloud, index) => {
    if (!cloud) return
    startContinuousMotion(cloud, LAYOUT[index], index)
  })
})

onBeforeUnmount(() => {
  tweens.forEach(t => t.kill())
  tweens.length = 0
})
</script>

<style scoped>
.clouds-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.cloud {
  position: absolute;
  height: auto;
  will-change: transform;
}
</style>
