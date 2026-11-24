<script setup>
import { ref } from 'vue'
import CalendarArc from './components/Calendar-Arc.vue'
import Calendar from './components/Calendar.vue'
import Clouds from './components/Clouds.vue'
import Loading from './components/Loading.vue'
import MusicPlayer from './components/Music-Player.vue'
import WeatherWidget from './components/WeatherWidget.vue'
import { useCalendarNotes } from './composables/useCalendarNotes'
import './assets/style.css'

const showCalendar = ref(false)
const { toastVisible, toastMessage, closeToast } = useCalendarNotes()
</script>

<template>
  <div class="app-root">
    <Loading />
    <CalendarArc :calendar-visible="showCalendar" @open-calendar="showCalendar = true" />
    <Clouds />
    <WeatherWidget />
    <Calendar v-if="showCalendar" @close="showCalendar = false" />
    <MusicPlayer />

    <div v-if="toastVisible" class="toast">
      <div class="toast-text">{{ toastMessage }}</div>
      <button class="toast-btn" @click="closeToast">Got it</button>
    </div>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 18px 22px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.55);
  z-index: 450;
  min-width: 320px;
  max-width: 90vw;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-family: 'p5menu', 'Persona5MenuFontPrototype-Regular', sans-serif;
}

.toast-text {
  flex: 1;
  font-size: 16px;
  line-height: 1.35;
}

.toast-btn {
  background: linear-gradient(135deg, #4da3ff, #4dffcf);
  color: #000;
  border: none;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.12s ease;
}

.toast-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}
</style>
