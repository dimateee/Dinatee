// GigaChat (Sber) — российский провайдер, доступен без VPN, оплата в рублях.
// Особенности, из-за которых этот файл не похож на обычный fetch-клиент:
// 1. Сертификат. GigaChat отдаёт TLS-сертификат от НУЦ Минцифры, а не от глобального
//    доверенного центра — обычный fetch отклонит соединение с self-signed certificate.
//    Официальный путь — установить этот корневой сертификат в доверенные. Мы скачиваем
//    его один раз при первом запросе и держим в памяти контейнера (Netlify переиспользует
//    тёплые контейнеры между вызовами, так что запрос за сертификатом — не на каждый вызов).
// 2. Авторизация двухэтапная: ключ авторизации (Base64 "client_id:client_secret" из
//    личного кабинета) меняется на access_token, который живёт ~30 минут — тоже кешируем.
// 3. Картинка передаётся не как в Anthropic (base64 прямо в сообщении), а отдельным
//    шагом: сначала POST /files (multipart), потом id файла — в attachments сообщения.
import https from "node:https";
import { env } from "./telegram-auth.mjs";

const CERT_URL = "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt";
const OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const API_BASE = "https://gigachat.devices.sberbank.ru/api/v1";
const TOKEN_TTL_MS = 28 * 60 * 1000; // токен живёт 30 минут — обновляем чуть раньше

let cachedCert = null;
let cachedToken = null; // { value, expiresAt }

async function rootCA() {
  if (cachedCert) return cachedCert;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error("gigachat_cert");
  cachedCert = await res.text();
  return cachedCert;
}

// Node-овский fetch не даёт напрямую подсунуть свой доверенный сертификат для одного запроса,
// поэтому для GigaChat используем https.request с явным списком доверенных CA.
function request(url, { method = "GET", headers = {}, body, isForm } = {}) {
  return new Promise(async (resolve, reject) => {
    let ca;
    try { ca = await rootCA(); } catch (e) { return reject(Object.assign(new Error("gigachat_cert"), { code: "cert" })); }
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method,
      headers, ca, rejectUnauthorized: true,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", (err) => reject(Object.assign(err, { code: "network" })));
    if (isForm) body.pipe ? body.pipe(req) : req.end(body);
    else { if (body) req.write(body); req.end(); }
  });
}

const creds = () => String(env("GIGACHAT_AUTH_KEY") || "").trim();

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const key = creds();
  if (!key) throw Object.assign(new Error("gigachat_key_missing"), { code: "key_missing" });
  const r = await request(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${key}`,
      RqUID: crypto.randomUUID(),
      Accept: "application/json",
    },
    body: `scope=${env("GIGACHAT_SCOPE") || "GIGACHAT_API_PERS"}`,
  });
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error("gigachat_auth"), { code: "auth" });
  if (r.status !== 200) throw Object.assign(new Error("gigachat_oauth_" + r.status), { code: "upstream", status: r.status, body: r.text });
  let data;
  try { data = JSON.parse(r.text); } catch (e) { throw Object.assign(new Error("gigachat_bad_oauth"), { code: "upstream" }); }
  if (!data.access_token) throw Object.assign(new Error("gigachat_no_token"), { code: "upstream" });
  cachedToken = { value: data.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return cachedToken.value;
}

// Multipart/form-data вручную — без сторонних библиотек, файла тут максимум одна картинка
function buildMultipart(base64, mediaType) {
  const boundary = "----ritm" + crypto.randomUUID().replace(/-/g, "");
  const buf = Buffer.from(base64, "base64");
  const ext = mediaType === "image/png" ? "png" : "jpg";
  const pre = `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ngeneral\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.${ext}"\r\nContent-Type: ${mediaType}\r\n\r\n`;
  const post = `\r\n--${boundary}--\r\n`;
  return { body: Buffer.concat([Buffer.from(pre, "utf8"), buf, Buffer.from(post, "utf8")]), boundary };
}

async function uploadImage(token, base64, mediaType) {
  const { body, boundary } = buildMultipart(base64, mediaType);
  const r = await request(`${API_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": body.length },
    body,
  });
  if (r.status !== 200) throw Object.assign(new Error("gigachat_upload_" + r.status), { code: "upstream", status: r.status, body: r.text });
  const data = JSON.parse(r.text);
  return data.id;
}

// content — тот же формат блоков, что уже шлёт клиент для Anthropic: [{type:"text",text}] и/или
// [{type:"image", source:{data, media_type}}]. Возвращаем тот же формат ответа, что Anthropic,
// чтобы на клиенте вообще ничего не пришлось менять.
export async function gigachatChat(content) {
  const token = await getToken();
  const textBlock = content.find((b) => b.type === "text");
  const imageBlock = content.find((b) => b.type === "image");
  let attachments;
  if (imageBlock) {
    const fileId = await uploadImage(token, imageBlock.source.data, imageBlock.source.media_type);
    attachments = [fileId];
  }
  const r = await request(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("GIGACHAT_MODEL") || "GigaChat-2-Max",
      messages: [{ role: "user", content: textBlock?.text || "", ...(attachments ? { attachments } : {}) }],
      // Температура снижена с 0.3 до 0.2: это не творческая задача, а числовая оценка —
      // меньше температура значит меньше разброс между повторными оценками одного и того же блюда.
      temperature: Number(env("GIGACHAT_TEMPERATURE")) || 0.2,
      // Было 2000 — промпт распознавания еды подрос (добавилась таблица-якорь БЖУ по частым
      // продуктам), а на сложных тарелках с 6–7 позициями и так был риск обрезать JSON на середине.
      // 3000 даёт запас и под новый промпт, и под объект с максимумом позиций.
      max_tokens: Number(env("GIGACHAT_MAX_TOKENS")) || 3000,
    }),
  });
  if (r.status === 401) throw Object.assign(new Error("gigachat_auth"), { code: "auth" });
  if (r.status === 429) throw Object.assign(new Error("gigachat_rate"), { code: "rate" });
  if (r.status === 402 || /insufficient|баланс/i.test(r.text)) throw Object.assign(new Error("gigachat_credit"), { code: "credit" });
  if (r.status !== 200) throw Object.assign(new Error("gigachat_chat_" + r.status), { code: "upstream", status: r.status, body: r.text });
  const data = JSON.parse(r.text);
  const text = data?.choices?.[0]?.message?.content || "";
  return { content: [{ type: "text", text }] };
}
