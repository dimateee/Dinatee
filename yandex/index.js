// Точка входа для Yandex Cloud Functions (среда Node.js 22, точка входа: index.handler).
//
// Бот написан в формате «стандартный Request → Response» (так же он работает на Netlify).
// Этот файл переводит запрос от Yandex API Gateway в Request, вызывает нужную функцию
// и возвращает ответ в формате, который ждёт Яндекс.
//
// Переменные окружения функции: BOT_TOKEN, WEBHOOK_SECRET, ADMIN_CHAT_ID и SITE_URL
// (адрес API-шлюза, например https://d5d....apigw.yandexcloud.net).
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// В архиве для Яндекса папка netlify лежит рядом с этим файлом, в репозитории — уровнем выше
const BASE = fs.existsSync(path.join(__dirname, "netlify")) ? path.join(__dirname, "netlify") : path.join(__dirname, "..", "netlify");

const ROUTES = {
  "/api/order": "functions/order.mjs",
  "/api/telegram-webhook": "functions/telegram-webhook.mjs",
  "/api/telegram-setup": "functions/telegram-setup.mjs",
};

const loaded = {};
function load(file) {
  if (!loaded[file]) loaded[file] = import(path.join(BASE, file)).then((m) => m.default);
  return loaded[file];
}

function requestPath(event) {
  const raw = String(event.url || event.path || "/");
  return raw.split("?")[0].replace(/\/+$/, "") || "/";
}

function queryString(event) {
  const multi = event.multiValueQueryStringParameters;
  const single = event.queryStringParameters || {};
  const qs = new URLSearchParams();
  if (multi && Object.keys(multi).length) {
    for (const [k, values] of Object.entries(multi)) for (const v of [].concat(values)) qs.append(k, v);
  } else {
    for (const [k, v] of Object.entries(single)) qs.append(k, v);
  }
  const s = qs.toString();
  return s ? "?" + s : "";
}

function origin(headers) {
  const fromEnv = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = headers.get("x-forwarded-host") || headers.get("host");
  return host ? "https://" + host : "https://localhost";
}

exports.handler = async function (event) {
  const file = ROUTES[requestPath(event)];
  if (!file) return { statusCode: 404, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Not found" };

  const headers = new Headers();
  for (const [k, v] of Object.entries(event.headers || {})) {
    if (v != null) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  }

  const method = String(event.httpMethod || "GET").toUpperCase();
  let body;
  if (method !== "GET" && method !== "HEAD" && event.body != null) {
    body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : String(event.body);
  }

  const req = new Request(origin(headers) + requestPath(event) + queryString(event), { method, headers, body });

  try {
    const fn = await load(file);
    const res = await fn(req);
    const outHeaders = {};
    res.headers.forEach((value, key) => { outHeaders[key] = value; });
    return { statusCode: res.status, headers: outHeaders, body: await res.text(), isBase64Encoded: false };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Server error" };
  }
};
