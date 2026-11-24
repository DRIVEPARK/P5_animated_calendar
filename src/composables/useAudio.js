import knifeAudioUrl from '../assets/audio/p5_dagger_strike.mp3'

let knifeSfx = null
let unlockRegistered = false

function ensureAudio() {
  if (!knifeSfx && typeof Audio !== 'undefined') {
    knifeSfx = new Audio(knifeAudioUrl)
    knifeSfx.volume = 0.65
  }
  return knifeSfx
}

function unlockAudio() {
  const audio = ensureAudio()
  if (!audio) return
  audio
    .play()
    .then(() => {
      audio.pause()
      audio.currentTime = 0
    })
    .catch(() => {})
}

export function useAudio() {
  if (!unlockRegistered && typeof window !== 'undefined') {
    unlockRegistered = true
    window.addEventListener('pointerdown', unlockAudio, { once: true })
  }

  function playKnifeSound() {
    const audio = ensureAudio()
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  return {
    playKnifeSound,
  }
}
