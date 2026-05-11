<template>
	<div class="player-shell">
		<div class="cover" :style="{ backgroundImage: `url(${currentThumb})` }"></div>
		<div class="info">
			<div class="title">{{ currentLabel }}</div>
			<div class="controls">
				<button class="icon-btn" @click="prev" :disabled="!ready">
					<img :src="icons.prev" alt="prev" />
				</button>
				<button class="icon-btn play-btn" @click="toggle" :disabled="!ready">
					<img :src="playing ? icons.pause : icons.play" :alt="playing ? 'pause' : 'play'" />
				</button>
				<button class="icon-btn" @click="next" :disabled="!ready">
					<img :src="icons.next" alt="next" />
				</button>
			</div>
		</div>
		<div ref="playerEl" class="hidden-iframe"></div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const icons = {
	play: new URL('../assets/images/play.png', import.meta.url).href,
	pause: new URL('../assets/images/pause.png', import.meta.url).href,
	next: new URL('../assets/images/next.png', import.meta.url).href,
	prev: new URL('../assets/images/previous.png', import.meta.url).href
}

// Wklej URL lub samo ID playlisty (parametr list=)
const PLAYLIST_URL = 'https://www.youtube.com/watch?v=SmQ1ZXTHNKA&list=PLu-mDJ3rZ5Yu7BxOoeQjYtGQiy1TUNqbT'
const fallbackCover = new URL('../assets/images/p5 grafika.png', import.meta.url).href

const playerEl = ref(null)
const player = ref(null)
const ready = ref(false)
const playing = ref(false)
const playlistId = computed(() => extractPlaylistId(PLAYLIST_URL))
const currentThumb = ref(fallbackCover)
const currentLabel = ref(playlistId.value ? 'YouTube playlist' : 'Set playlist URL')

function extractPlaylistId(input) {
	if (!input) return ''
	try {
		const asUrl = new URL(input, 'https://youtube.com')
		const list = asUrl.searchParams.get('list')
		if (list) return list
	} catch (e) {
		// not a URL, could already be an ID
	}
	return input.startsWith('PL') || input.startsWith('UU') || input.startsWith('OL') ? input : ''
}

function ensureYouTubeAPI() {
	return new Promise(resolve => {
		if (window.YT && window.YT.Player) {
			resolve(window.YT)
			return
		}

		const onReady = () => resolve(window.YT)
		if (window.__ytApiLoading) {
			window.__ytApiCallbacks.push(onReady)
			return
		}

		window.__ytApiLoading = true
		window.__ytApiCallbacks = [onReady]
		const tag = document.createElement('script')
		tag.src = 'https://www.youtube.com/iframe_api'
		document.body.appendChild(tag)
		window.onYouTubeIframeAPIReady = () => {
			window.__ytApiCallbacks.forEach(cb => cb())
			window.__ytApiCallbacks = []
		}
	})
}

function updateMeta() {
	if (!player.value) return
	const data = player.value.getVideoData?.()
	const vid = data?.video_id
	if (vid) {
		currentThumb.value = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`
		currentLabel.value = data?.title || 'YouTube playlist'
	} else {
		currentThumb.value = fallbackCover
		currentLabel.value = playlistId.value ? 'YouTube playlist' : 'Set playlist URL'
	}
}

function buildPlayer() {
	if (!playerEl.value || !window.YT) return
	if (!playlistId.value) return
	player.value = new window.YT.Player(playerEl.value, {
		height: '0',
		width: '0',
		playerVars: {
			autoplay: 0,
			controls: 0,
			modestbranding: 1,
			rel: 0,
			listType: 'playlist',
			list: playlistId.value
		},
		events: {
			onReady: () => {
				ready.value = true
				updateMeta()
				setTimeout(updateMeta, 300)
			},
			onStateChange: event => {
				if (event.data === window.YT.PlayerState.PLAYING) playing.value = true
				if (event.data === window.YT.PlayerState.PAUSED) playing.value = false
				if (
					event.data === window.YT.PlayerState.PLAYING ||
					event.data === window.YT.PlayerState.CUED ||
					event.data === window.YT.PlayerState.BUFFERING
				) {
					updateMeta()
				}
				if (event.data === window.YT.PlayerState.ENDED) next()
			}
		}
	})
}

async function init() {
	await ensureYouTubeAPI()
	buildPlayer()
}

function toggle() {
	if (!player.value) return
	if (playing.value) {
		player.value.pauseVideo()
	} else {
		player.value.playVideo()
	}
}

function next() {
	if (!player.value) return
	player.value.nextVideo()
}

function prev() {
	if (!player.value) return
	player.value.previousVideo()
}

onMounted(() => {
	init()
})

onBeforeUnmount(() => {
	try {
		player.value?.destroy()
	} catch (e) {
		// noop
	}
})
</script>

<style scoped>
.player-shell {
	position: fixed;
	right: 18px;
	bottom: 18px;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px;
	background: rgba(0, 0, 0, 0.75);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 14px;
	box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
	color: #fff;
	z-index: 500;
	max-width: 320px;
}

.cover {
	width: 64px;
	height: 64px;
	border-radius: 10px;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	border: 1px solid rgba(255, 255, 255, 0.18);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 6px 14px rgba(0, 0, 0, 0.45);
}

.info {
	display: flex;
	flex-direction: column;
	gap: 6px;
	flex: 1;
	min-width: 0;
}

.title {
	font-weight: 800;
	font-size: 14px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.controls {
	display: flex;
	align-items: center;
	gap: 8px;
}

.icon-btn {
	width: 38px;
	height: 38px;
	display: grid;
	place-items: center;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 10px;
	cursor: pointer;
	transition: transform 0.15s ease, filter 0.15s ease, background 0.15s ease;
}

.icon-btn:hover {
	transform: translateY(-1px);
	background: rgba(255, 255, 255, 0.14);
}

.icon-btn:disabled {
	opacity: 0.35;
	cursor: not-allowed;
	transform: none;
}

.icon-btn img {
	width: 20px;
	height: 20px;
	object-fit: contain;
}

.play-btn {
	width: 46px;
	height: 46px;
}

.hidden-iframe {
	width: 0;
	height: 0;
	overflow: hidden;
	position: absolute;
	pointer-events: none;
	opacity: 0;
}

@media (max-width: 600px) {
	.player-shell {
		right: 12px;
		bottom: 12px;
		padding: 10px;
		max-width: 280px;
	}

	.cover {
		width: 56px;
		height: 56px;
	}

	.icon-btn {
		width: 34px;
		height: 34px;
	}

	.play-btn {
		width: 40px;
		height: 40px;
	}
}
</style>
