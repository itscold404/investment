import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  server: {
    https: {
      key: "./cert/key.pem",
      cert: "./cert/cert.pem",
    },
  },
  plugins: [vue()],
});
