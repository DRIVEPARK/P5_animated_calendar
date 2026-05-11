<script setup>
import { ref } from 'vue'
import CalendarArc from './components/Calendar-Arc.vue'
import Calendar from './components/Calendar.vue'
import Clouds from './components/Clouds.vue'
import Loading from './components/Loading.vue'
import MusicPlayer from './components/Music-Player.vue'
import WeatherDay from './components/WeatherDay.vue'
import './assets/style.css'

const showCalendar = ref(false)

function handleCloseCalendar() {
  showCalendar.value = false
}
</script>

<template>
  <div id="app">
    <Loading />
    <CalendarArc :calendar-visible="showCalendar" @open-calendar="showCalendar = true" />
    <Clouds />
    <WeatherDay />
    <Calendar v-if="showCalendar" @close="handleCloseCalendar" />
    <MusicPlayer />
  </div>
</template>

<style scoped>

</style>
