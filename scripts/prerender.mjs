// После `vite build` вставляет готовый HTML лендинга в dist/index.html и пишет robots.txt и sitemap.xml.
// Если что-то пойдёт не так, сайт всё равно работает: остаётся обычная страница с загрузкой через JavaScript.
import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexPath = resolve(root, "dist/index.html");
const siteUrl = (process.env.SITE_URL || process.env.URL || "").replace(/\/+$/, "");

try {
  const { render } = await import(pathToFileURL(resolve(root, "dist-ssr/prerender.js")).href);
  const html = render();
  const page = readFileSync(indexPath, "utf8");
  if (!page.includes("<!--prerender-->")) throw new Error("нет метки <!--prerender--> в index.html");
  writeFileSync(indexPath, page.replace("<!--prerender-->", `<div id="prerender">${html}</div>`));
  console.log(`prerender: лендинг вставлен в dist/index.html (${Math.round(html.length / 1024)} КБ HTML)`);
} catch (e) {
  console.warn("prerender: пропущено —", e.message);
} finally {
  rmSync(resolve(root, "dist-ssr"), { recursive: true, force: true });
}

// Файлы кода приложения (App-*.js и его статические импорты) — в index.html (метка __APP_CHUNKS__):
// в режиме приложения (Mini App, /app, установленное) браузер начинает качать их сразу, параллельно
// с основным скриптом, а не после него. Имена файлов меняются при каждой сборке, поэтому — здесь.
try {
  const assets = resolve(root, "dist/assets");
  const app = readdirSync(assets).find((f) => /^App-[\w-]+\.js$/.test(f));
  const page = readFileSync(indexPath, "utf8");
  if (app && page.includes('"__APP_CHUNKS__"')) {
    // Статические импорты стоят в начале файла: import{…}from"./x.js" или import"./x.js"
    // (динамические import("./…") сюда не попадают — их грузить заранее не нужно)
    const head = readFileSync(resolve(assets, app), "utf8").slice(0, 6000);
    const deps = [...head.matchAll(/(?:from|import)\s*"\.\/([\w.-]+\.js)"/g)].map((m) => m[1]);
    const list = [app, ...new Set(deps)].map((f) => `/assets/${f}`).join(",");
    writeFileSync(indexPath, page.replace('"__APP_CHUNKS__"', JSON.stringify(list)));
    console.log(`prerender: предзагрузка кода приложения — ${list}`);
  }
} catch (e) {
  console.warn("prerender: предзагрузка кода приложения пропущена —", e.message);
}

// robots.txt — всегда; sitemap.xml — только если известен полный адрес сайта (на Netlify — переменная URL)
const robots = ["User-agent: *", "Allow: /", "Disallow: /app", "Disallow: /api/"];
if (siteUrl) {
  robots.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  writeFileSync(resolve(root, "dist/sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
${["offer", "terms", "privacy", "consent"].map((p) => `  <url><loc>${siteUrl}/${p}</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>`).join("\n")}
</urlset>
`);
}
writeFileSync(resolve(root, "dist/robots.txt"), robots.join("\n") + "\n");
