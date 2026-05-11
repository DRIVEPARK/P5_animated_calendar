<template>
  <div ref="container" class="clouds-container">
    <img
      v-for="i in 12"
      :key="i"
      :ref="el => cloudRefs[i - 1] = el"
      :src="cloudSrc(i)"
      class="cloud"
    />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, nextTick, ref } from 'vue'
import gsap from 'gsap'

const cloudRefs = []
const container = ref(null)

// bazowe pozycje (ułamki szer./wys.) odpowiadające podanym %
const layout = [
  { x: -0.005, y: -0.005, s: 1, zIndex: 1 },
  { x: 0.14, y: 0, s: 0.6, zIndex: 2 },
  { x: 0.20, y: 0.1, s: 1.05 },
  { x: 0.20, y: -0.01, s: 0.90 },
  { x: 0.29, y: 0.05, s: 0.95},
  { x: 0.37, y: 0.09, s: 1.05, zIndex: 0 },
  { x: 0.43, y: -0.01, s: 1.2 },
  { x: 0.33, y: -0.05, s: 0.90 },
  { x: 0.62, y: -0.05, s: 1.05 },
  { x: 0.81, y: 0.30, s: 1.15 },
  { x: 0.78, y: -0.02, s: 1.25 },
  { x: 0.78, y: 0.20, s: 0.95, zIndex: 0 },
]

const cloudSrc = (i) => new URL(`/src/assets/images/cloud${i}.png`, import.meta.url).href
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function positionClouds() {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()

  const baseFrac = 0.22
  const minW = 160
  const maxW = 480
  const spreadX = 1.10
  const spreadY = 1.08
  const offsetX = -0.05
  const offsetY = -0.02

  layout.forEach((cfg, i) => {
    const node = cloudRefs[i]
    if (!node) return

    const rawW = rect.width * baseFrac * cfg.s
    const w = clamp(rawW, minW * cfg.s, maxW * cfg.s)

    const left = (cfg.x * spreadX + offsetX) * rect.width
    const bottomRaw = (cfg.y * spreadY + offsetY) * rect.height
    const bottom = Math.max(bottomRaw, -0.25 * rect.height)

    node.style.width = `${w}px`
    node.style.height = 'auto'
    node.style.left = `${left}px`
    node.style.bottom = `${bottom}px`
    node.style.zIndex = cfg.zIndex ?? 1
  })
}

let ro = null

onMounted(async () => {
  await nextTick()
  positionClouds()

  cloudRefs.forEach((cloud, index) => {
    if (!cloud) return
    const dir = index % 2 === 0 ? 1 : -1
    const amp = 20
    const dur = 4 + Math.random() * 2.5
    gsap.set(cloud, { x: 0, force3D: true })
    gsap.to(cloud, {
      x: dir * amp,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      yoyoEase: true,
      force3D: true,
    })
  })

  ro = new ResizeObserver(() => positionClouds())
  if (container.value) ro.observe(container.value)
})

onBeforeUnmount(() => {
  if (ro && container.value) ro.unobserve(container.value)
})
</script>

<style>
.clouds-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.cloud {
  position: absolute;
  bottom: 0;
  will-change: transform;
}
</style>
