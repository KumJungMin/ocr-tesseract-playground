<script setup lang="ts">
import VideoCapture from './components/VideoCapture.vue'
</script>

<template>
  <div class="app">
    <h1>비디오 캡처3</h1>
    <VideoCapture />
  </div>
</template>

<style scoped>
.app {
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  margin-bottom: 2rem;
  color: #2c3e50;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
