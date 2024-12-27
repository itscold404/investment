import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import axios from "axios";
import router from "./router/router.js";

createApp(App).use(router).mount("#app");

// Print out some account info to check that it is connected
try {
  const backend_port = import.meta.env.VITE_BACKEND_PORT;
  const response = await axios.get(`http://localhost:${backend_port}/test/printAccount`);
  message = response.data.message;
  console.log(message);
} catch (err) {
  console.log(err);
}
