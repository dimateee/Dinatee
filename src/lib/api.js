/* Запросы к серверным функциям Netlify. Подпись Telegram передаём в заголовке —
   сервер по ней узнаёт, какой пользователь спрашивает */
import { tg } from "./telegram.js";

async function call(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-telegram-init-data": tg?.initData || "" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка сервера (${res.status})`);
  return data;
}

export const api = {
  me: () => call("/api/me"),
  subscribe: (method) => call("/api/subscribe", { method }),
};
