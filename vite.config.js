import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Полный адрес сайта для превью ссылок (og:image и og:url в index.html). Netlify при сборке сам
// кладёт адрес сайта в переменную URL; SITE_URL — если нужно указать свой домен явно.
const siteUrl = (process.env.SITE_URL || process.env.URL || "").replace(/\/+$/, "");
const siteUrlPlugin = {
  name: "ritm-site-url",
  transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", siteUrl),
};

export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlPlugin],
});
