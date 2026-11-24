<template>
  <div class="player-shell">
    <div class="cover" :style="{ backgroundImage: `url(${currentThumb})` }"></div>
    <div class="info">
      <div class="title">{{ currentLabel }}</div>
      <div class="controls">
        <button class="icon-btn" :disabled="!ready" @click="prev">
          <img :src="prevIcon" alt="prev" />
        </button>
        <button class="icon-btn play-btn" :disabled="!ready" @click="toggle">
          <img :src="playing ? pauseIcon : playIcon" :alt="playing ? 'pause' : 'play'" />
        </button>
        <button class="icon-btn" :disabled="!ready" @click="next">
          <img :src="nextIcon" alt="next" />
        </button>
      </div>
    </div>
    <div ref="playerEl" class="hidden-iframe"></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import playIcon from '../assets/images/play.png'
import pauseIcon from '../assets/images/pause.png'
import nextIcon from '../assets/images/next.png'
import prevIcon from '../assets/images/previous.png'
import fallbackCover from '../assets/images/p5 grafika.png'

// Wklej URL lub samo ID playlisty (parametr list=)
const PLAYLIST_URL = 'https://www.youtube.com/watch?v=SmQ1ZXTHNKA&list=PLu-mDJ3rZ5Yu7BxOoeQjYtGQiy1TUNqbT'

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
    const list = new URL(input, 'https://youtube.com').searchParams.get('list')
    if (list) return list
  } catch {
    // nie jest pełnym URL-em
  }
  return /^(PL|UU|OL)/.test(input) ? input : ''
}

function ensureYouTubeAPI() {
  return new Promise(resolve => {
    if (window.YT?.Player) {
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
  const data = player.value?.getVideoData?.()
  const vid = data?.video_id
  if (vid) {
    currentThumb.value = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`
    currentLabel.value = data?.title || 'YouTube playlist'
  } else {
    currentThumb.value = fallbackCover
    currentLabel.value = playlistId.value ? 'YouTube playlist' : 'Set playlist URL'
  }
}

function toggle() {
  if (!player.value) return
  playing.value ? player.value.pauseVideo() : player.value.playVideo()
}

function next() {
  player.value?.nextVideo()
}

function prev() {
  player.value?.previousVideo()
}

onMounted(async () => {
  const YT = await ensureYouTubeAPI()
  if (!playerEl.value || !playlistId.value) return

  player.value = new YT.Player(playerEl.value, {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      listType: 'playlist',
      list: playlistId.value,
    },
    events: {
      onReady: () => {
        ready.value = true
        updateMeta()
        setTimeout(updateMeta, 300)
      },
      onStateChange: ({ data }) => {
        const { PLAYING, PAUSED, CUED, BUFFERING, ENDED } = YT.PlayerState
        if (data === PLAYING) playing.value = true
        if (data === PAUSED) playing.value = false
        if (data === PLAYING || data === CUED || data === BUFFERING) updateMeta()
        if (data === ENDED) next()
      },
    },
  })
})

onBeforeUnmount(() => {
  try {
    player.value?.destroy()
  } catch {
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
  font-family: 'p5hatty', sans-serif;
  letter-spacing: 0.5px;
  /* Pod nakładką kalendarza (z-index 200) - nie zasłania prawego dolnego rogu siatki */
  z-index: 190;
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
