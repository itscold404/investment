import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import axios from "axios";

createApp(App).mount("#app");

const backend_port = import.meta.env.VITE_BACKEND_PORT;
console.log("backend port is", backend_port);
const response = await axios.get(`http://localhost:${backend_port}/test/printAccount`);
message = response.data.message;

console.log(message);
