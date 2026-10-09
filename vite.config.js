import { defineConfig } from "vite";

export default defineConfig({
  // Относительные пути: сборка работает на любом хостинге и в подпапке
  base: "./",
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
  },
});
