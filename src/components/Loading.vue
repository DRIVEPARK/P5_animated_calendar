<template>
	<div class="loading" ref="el">
		<img class="hat" :src="hatSrc" alt="Loading" draggable="false" />
		<div class="loading-text">LOADING...</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import gsap from 'gsap'

const el = ref(null)
const hatSrc = new URL('../assets/images/hat.gif', import.meta.url).href

onMounted(() => {
	setTimeout(() => {
		if (!el.value) return
		gsap.to(el.value, {
			opacity: 0,
			duration: 1,
			ease: 'power1.out',
			onComplete: () => {
				if (!el.value) return
				el.value.style.display = 'none'
				el.value.style.pointerEvents = 'none'
			}
		})
	}, 1500)
})
</script>

<style scoped>
@font-face {
	font-family: 'p5hatty';
	src: url('../assets/fonts/p5hatty-1.ttf') format('truetype');
	font-display: swap;
}

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
	width: clamp(250px, 12vw, 300px);
	height: clamp(250px, 12vh, 300px);
	object-fit: contain;
	transform: translateX(-10px);
}

.loading-text {
	font-size: clamp(110px, 2vw, 150px);
}
</style>
