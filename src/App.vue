<template>
  <div v-if="!receivedError">
    <router-view></router-view>
  </div>
  <div v-else>
    <h2>Make sure you turned on server.js!</h2>
    <h4>(refresh after it has been booted up)</h4>
  </div>
</template>

<script>
const backend_port = import.meta.env.VITE_BACKEND_PORT;
import axios from "axios";
export default {
  data() {
    return {
      receivedError: false,
    };
  },
  async mounted() {
    try {
      await axios.get(`http://localhost:${backend_port}/test/printAccount`);
    } catch (err) {
      this.receivedError = true;
    }
  },
};
</script>

<style scoped>
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
