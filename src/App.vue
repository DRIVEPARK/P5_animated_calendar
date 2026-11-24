<script setup>
import { ref } from 'vue'
import CalendarArc from './components/Calendar-Arc.vue'
import Calendar from './components/Calendar.vue'
import Clouds from './components/Clouds.vue'
import Loading from './components/Loading.vue'
import MusicPlayer from './components/Music-Player.vue'
import ReminderAlert from './components/ReminderAlert.vue'
import WeatherModal from './components/WeatherModal.vue'
import WeatherWidget from './components/WeatherWidget.vue'
import './assets/style.css'

const showCalendar = ref(false)
const showWeather = ref(false)
</script>

<template>
  <div class="app-root">
    <Loading />
    <CalendarArc :calendar-visible="showCalendar" @open-calendar="showCalendar = true" />
    <Clouds />
    <WeatherWidget @open="showWeather = true" />
    <WeatherModal v-if="showWeather" @close="showWeather = false" />
    <Calendar v-if="showCalendar" @close="showCalendar = false" />
    <MusicPlayer />
    <!-- Zawsze zamontowany - pilnuje przypomnień także przy zamkniętym kalendarzu -->
    <ReminderAlert />
  </div>
</template>
