// Сохранения: localStorage на устройстве + копия в облаке Telegram (синхронизируется между устройствами)
import { serialize, deserialize } from "./game/save.js";
import { TG } from "./telegram.js";

const LOCAL_KEY = "okraina_save_v1";
const SETTINGS_KEY = "okraina_settings_v1";
const CHUNK = 4000;
const MAX_CHUNKS = 200;

function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch (e) {
    return false;
  }
}

async function gzip(str) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}
async function gunzip(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const stream = new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

export function loadSettings() {
  try {
    return { hideTips: false, autoPause: true, ...(JSON.parse(lsGet(SETTINGS_KEY)) || {}) };
  } catch (e) {
    return { hideTips: false, autoPause: true };
  }
}
export function saveSettings(s) {
  lsSet(SETTINGS_KEY, JSON.stringify(s));
}

export function localSaveInfo() {
  const raw = lsGet(LOCAL_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return { savedAt: o.savedAt, day: Math.floor((o.tick + 700) / 2400), name: o.colonyName };
  } catch (e) {
    return null;
  }
}

let cloudBusy = false;
let lastCloud = 0;

export async function saveGame(w, { cloud = false } = {}) {
  const data = serialize(w);
  const json = JSON.stringify(data);
  const ok = lsSet(LOCAL_KEY, json);
  if (cloud && TG.hasCloud() && !cloudBusy) {
    cloudBusy = true;
    try {
      await cloudSave(json, data.savedAt);
      lastCloud = Date.now();
    } catch (e) {
      console.warn("cloud save failed", e);
    }
    cloudBusy = false;
  }
  return ok;
}
export function cloudDue(ms = 120000) {
  return Date.now() - lastCloud > ms;
}

async function cloudSave(json, savedAt) {
  const packed = (await gzip(json)) || null;
  const body = packed || json;
  const n = Math.ceil(body.length / CHUNK);
  if (n > MAX_CHUNKS) return;
  const tasks = [];
  for (let k = 0; k < n; k++) tasks.push(TG.cloudSet("s" + k, body.slice(k * CHUNK, (k + 1) * CHUNK)));
  const res = await Promise.all(tasks);
  if (res.some((r) => !r)) return;
  await TG.cloudSet("meta", JSON.stringify({ n, savedAt, z: !!packed }));
}

async function cloudLoad() {
  if (!TG.hasCloud()) return null;
  const m = await TG.cloudGet(["meta"]);
  if (!m || !m.meta) return null;
  const meta = JSON.parse(m.meta);
  const keys = [];
  for (let k = 0; k < meta.n; k++) keys.push("s" + k);
  const vals = await TG.cloudGet(keys);
  if (!vals) return null;
  let body = "";
  for (const k of keys) {
    if (vals[k] == null) return null;
    body += vals[k];
  }
  const json = meta.z ? await gunzip(body) : body;
  return JSON.parse(json);
}

// Возвращает самое свежее сохранение (с устройства или из облака)
export async function loadBest() {
  let local = null;
  try {
    const raw = lsGet(LOCAL_KEY);
    if (raw) local = JSON.parse(raw);
  } catch (e) {}
  let cloud = null;
  try {
    cloud = await Promise.race([cloudLoad(), new Promise((r) => setTimeout(() => r(null), 4000))]);
  } catch (e) {
    console.warn(e);
  }
  const best = !cloud ? local : !local ? cloud : (cloud.savedAt || 0) > (local.savedAt || 0) ? cloud : local;
  return best ? deserialize(best) : null;
}

export async function cloudInfo() {
  if (!TG.hasCloud()) return null;
  try {
    const m = await Promise.race([TG.cloudGet(["meta"]), new Promise((r) => setTimeout(() => r(null), 2500))]);
    return m && m.meta ? JSON.parse(m.meta) : null;
  } catch (e) {
    return null;
  }
}

export async function deleteSave() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch (e) {}
  if (TG.hasCloud()) await TG.cloudRemove(["meta"]);
}
