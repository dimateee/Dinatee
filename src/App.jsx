import { useState, useEffect, useLayoutEffect, useMemo, useRef, useId, Component } from "react";
import {
  Home, Dumbbell, Footprints, CalendarDays, Settings as SettingsIcon,
  Check, Plus, ChevronLeft, ChevronRight, Flame, Lock, Crown, Send, X, Timer,
  Trash2, Star, Camera, Image as ImageIcon, PenLine, Sparkles, AlertTriangle, Apple, ScanBarcode,
  BookOpen, Folder, GripVertical, ListPlus, Repeat, Droplets, Minus, Bell, Clock, Wind, PlayCircle, Mic, MicOff, Volume2, Moon, Activity, RotateCcw, Scale, Download, Trophy,
  Flag, ListFilter, AlignLeft, ChevronDown, Tag,
  TrendingUp, Award, Library, Medal, LayoutGrid, Target, Ban, RefreshCcw, NotebookPen, Feather, Share2, Ruler, ShoppingCart, Heart, MoreHorizontal,
  LayoutDashboard, ChevronUp, EyeOff, Eye, Sunrise, Coffee,
  Users, UserPlus, BarChart3,
  LogIn, LogOut, Smartphone, Share, Monitor, UserRound, Cloud, SquarePlus,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Browser as CapBrowser } from "@capacitor/browser";
import { Health } from "capacitor-health";
import {
  inTelegram, tgApp, readSession, saveSession, clearSession, isGuest, setGuest,
  startTelegramLogin, pollTelegramLogin, useInstall, ANDROID_APK_URL,
  savePendingTx, readPendingTx, clearPendingTx,
} from "./web.js";
import {
  RUB_PRICE, YEAR_SAVINGS_PCT, PRO_COMPARISON_ROWS,
  FREE_SCANS, FREE_HABITS, FREE_WORKOUTS, FREE_HISTORY, FREE_ASSISTANT,
} from "./plans.js";
import { CountUp, observeReveal } from "./motion.jsx";
import { goal, goalOnce } from "./analytics.js";

/* ============ Отдельные приложения (iOS через Capacitor, Windows через Electron) ============ */
// RITM остаётся собой и внутри Telegram, и в виде отдельных приложений — определяем,
// в какой среде мы работаем, и по-разному включаем то, что зависит от Telegram.
const isCapacitorNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };
// electron/preload.js выставляет этот флаг через contextBridge — так страница узнаёт,
// что она в окне настольного приложения, а не в обычном браузере.
const isElectron = () => typeof window !== "undefined" && !!window.RITM_ELECTRON;
const isNativeShell = () => isCapacitorNative() || isElectron();
// «Отдельное приложение» — запущено не внутри Telegram (нет initData), но как родное приложение
// (iOS или Windows). В таком запуске: Pro включён сразу (незачем платить самому себе), а
// напоминания идут через уведомления системы, а не через Telegram-бота.
const isStandalone = () => isNativeShell() && !window.Telegram?.WebApp?.initData;
// Внутри Telegram сайт и есть сервер — относительный путь "/api/..." работает сам собой.
// В отдельном приложении страница загружена не с сайта (из пакета на iOS, с локального
// сервера в Electron на Windows), поэтому запросы к серверу нужно слать на настоящий адрес —
// см. VITE_API_BASE_URL в README.
const apiUrl = (path) => `${(isNativeShell() && import.meta.env.VITE_API_BASE_URL) || ""}${path}`;
// Сайт или приложение, установленное с сайта (PWA): не Telegram и не нативная сборка.
// Здесь вход — через Telegram-бота (src/web.js), а данные синхронизируются через сервер.
const isWeb = () => !inTelegram() && !isNativeShell();

// Кто сейчас пользуется приложением: в Telegram — из подписанных данных запуска,
// на сайте — из сессии после входа через бота. В обоих случаях это Telegram-аккаунт.
const currentUser = () => tgApp()?.initDataUnsafe?.user || (isWeb() ? readSession()?.user : null) || null;

// Заголовки для запросов к нашему серверу: подпись Telegram, токен сессии сайта
// или (в нативной сборке) общий секрет приложения.
function authHeaders(extra = {}) {
  const h = { ...extra };
  const tg = tgApp();
  if (tg?.initData) h["X-Telegram-Init-Data"] = tg.initData;
  else if (isWeb() && readSession()?.token) h.Authorization = `Bearer ${readSession().token}`;
  if (isStandalone() && import.meta.env.VITE_APP_STANDALONE_SECRET) h["X-App-Secret"] = import.meta.env.VITE_APP_STANDALONE_SECRET;
  return h;
}

// Лёгкий виброотклик на действие: в Telegram — его API, на сайте (Android) — navigator.vibrate
function tapFeedback() {
  try {
    const tg = tgApp();
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    else if (isWeb()) navigator.vibrate?.(8);
  } catch (e) { /* виброотклик необязателен */ }
}

// Общий способ открыть внешнюю ссылку: в Telegram — его встроенный браузер, в iOS-приложении —
// системный (Safari поверх приложения), в Electron и в обычном браузере — просто window.open
// (в Electron он перехватывается в main.js и тоже открывает системный браузер).
function openExternalLink(url) {
  const tg = tgApp();
  if (tg?.openLink) { tg.openLink(url); return; }
  if (isCapacitorNative()) { CapBrowser.open({ url }).catch(() => window.open(url, "_blank", "noopener,noreferrer")); return; }
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ============ Apple Health / Google Health Connect (только отдельное iOS/Android-приложение) ============ */
// Доступно только в нативной сборке — в Telegram Mini App плагин HealthKit физически недоступен
// (это не веб-API), поэтому весь этот блок молча ничего не делает вне isCapacitorNative().
// Важно: используемый плагин не умеет читать сон вообще (ни на iOS, ни на Android) — поэтому
// синхронизация ниже ограничена шагами и весом, а в интерфейсе это явно написано пользователю.
async function healthIsAvailable() {
  if (!isCapacitorNative()) return false;
  try {
    const r = await Health.isHealthAvailable();
    return !!r?.available;
  } catch (e) { return false; }
}
async function requestHealthAccess() {
  if (!isCapacitorNative()) return false;
  try {
    const avail = await healthIsAvailable();
    if (!avail) return false;
    await Health.requestHealthPermissions({ permissions: ["READ_STEPS", "READ_WEIGHT"] });
    return true;
  } catch (e) { return false; }
}
// Возвращает { steps: {ключ-дата: число}, weight: {ключ-дата: число в кг} } за последние `days` дней.
async function fetchHealthData(days = 14) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const steps = {};
  const weight = {};
  try {
    const stepsRes = await Health.queryAggregated({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dataType: "steps",
      bucket: "day",
    });
    for (const row of stepsRes?.aggregatedData || []) {
      const v = Math.round(Number(row.value) || 0);
      if (!v) continue;
      steps[keyOf(new Date(row.startDate || row.date))] = v;
    }
  } catch (e) { /* шаги не считались (нет данных или нет разрешения) — просто пропускаем */ }
  try {
    const weightRes = await Health.queryRecords({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dataType: "weight",
    });
    for (const row of weightRes?.records || []) {
      const kg = Number(row.value);
      if (!kg) continue;
      weight[keyOf(new Date(row.date || row.startDate))] = Math.round(kg * 10) / 10;
    }
  } catch (e) { /* вес не считался — например, в Здоровье ни разу не вносили вес */ }
  return { steps, weight };
}
// Синхронизация пишет в st.steps/st.weight напрямую: Health считается точнее ручного ввода,
// поэтому перезаписывает дни, которые Здоровье знает, и не трогает остальные.
async function syncHealthData(up) {
  const { steps, weight } = await fetchHealthData(14);
  up((s) => ({
    steps: { ...s.steps, ...steps },
    weight: { ...s.weight, ...weight },
    healthKit: { ...(s.healthKit || {}), connected: true, lastSyncAt: Date.now() },
  }));
  return { stepsCount: Object.keys(steps).length, weightCount: Object.keys(weight).length };
}

/* ============ Темы ============
   a/b — два акцентных цвета (обязательно в виде #RRGGBB: к ним местами дописывается прозрачность),
   grad — основной градиент кнопок и активных элементов, on — цвет текста поверх grad,
   card/line — фон и обводка карточек, surface — фон шторок и окон, glow — тень активных элементов.
   «Ритм» — тема нового дизайна по умолчанию для новых пользователей; у тех, кто уже выбрал
   другую тему, она сохраняется. Свечение (glow) у всех тем — мягкая тень под кнопкой. */
const THEMES = {
  ritm: {
    name: "Ритм",
    bg: "radial-gradient(110% 55% at 0% -10%, rgba(198,255,61,0.13) 0%, rgba(0,0,0,0) 55%), radial-gradient(90% 50% at 100% 105%, rgba(56,224,200,0.10) 0%, rgba(0,0,0,0) 60%), #08090B",
    card: "rgba(255,255,255,0.04)",
    line: "rgba(255,255,255,0.08)",
    surface: "#101114",
    a: "#C6FF3D",
    b: "#38E0C8",
    grad: "linear-gradient(135deg,#D4FF5C 0%,#9BF26A 45%,#38E0C8 100%)",
    glow: "0 10px 32px rgba(170,255,80,0.22)",
    on: "#0A0B0D",
    preview: "linear-gradient(135deg,#08090B 0%,#1d2a12 45%,#C6FF3D 80%,#38E0C8 100%)",
  },
  mono: {
    name: "Монохром",
    bg: "radial-gradient(130% 70% at 50% -20%, #4a4a4f 0%, #141416 40%, #000000 75%)",
    card: "rgba(255,255,255,0.04)",
    line: "rgba(255,255,255,0.09)",
    surface: "#111113",
    a: "#FFFFFF",
    b: "#8E8E96",
    grad: "linear-gradient(135deg,#FFFFFF 0%,#C9C9D0 55%,#8a8a92 100%)",
    glow: "0 10px 32px rgba(255,255,255,0.16)",
    on: "#000000",
    preview: "linear-gradient(135deg,#000 0%,#3a3a3f 60%,#e4e4e8 100%)",
  },
  pulse: {
    name: "Красно-синий",
    bg: "radial-gradient(80% 55% at 0% 0%, rgba(255,45,85,0.30) 0%, rgba(0,0,0,0) 60%), radial-gradient(80% 55% at 100% 100%, rgba(47,107,255,0.34) 0%, rgba(0,0,0,0) 60%), #000000",
    card: "rgba(255,255,255,0.045)",
    line: "rgba(255,255,255,0.10)",
    surface: "#0E0E13",
    a: "#FF2D55",
    b: "#2F6BFF",
    grad: "linear-gradient(135deg,#FF2D55 0%,#2F6BFF 100%)",
    glow: "0 10px 32px rgba(255,45,85,0.30)",
    on: "#FFFFFF",
    preview: "linear-gradient(135deg,#FF2D55 0%,#000 50%,#2F6BFF 100%)",
  },
  amber: {
    name: "Янтарный",
    bg: "radial-gradient(130% 70% at 50% -20%, rgba(255,176,32,0.32) 0%, rgba(0,0,0,0) 50%), radial-gradient(90% 60% at 100% 100%, rgba(255,122,26,0.22) 0%, rgba(0,0,0,0) 60%), #0a0704",
    card: "rgba(255,255,255,0.04)",
    line: "rgba(255,255,255,0.1)",
    a: "#FFB020",
    b: "#FF7A1A",
    grad: "linear-gradient(135deg,#FFD166 0%,#FFB020 50%,#FF7A1A 100%)",
    glow: "0 10px 32px rgba(255,176,32,0.28)",
    surface: "#14100A",
    on: "#000000",
    preview: "linear-gradient(135deg,#000 0%,#7a4a00 55%,#FFD166 100%)",
  },
  emerald: {
    name: "Изумрудный",
    bg: "radial-gradient(80% 55% at 0% 0%, rgba(46,213,115,0.35) 0%, rgba(0,0,0,0) 60%), radial-gradient(80% 55% at 100% 100%, rgba(23,195,178,0.35) 0%, rgba(0,0,0,0) 60%), #000000",
    card: "rgba(255,255,255,0.045)",
    line: "rgba(255,255,255,0.11)",
    a: "#2ED573",
    b: "#17C3B2",
    grad: "linear-gradient(135deg,#2ED573 0%,#17C3B2 100%)",
    glow: "0 10px 32px rgba(46,213,115,0.26)",
    surface: "#0C1210",
    on: "#000000",
    preview: "linear-gradient(135deg,#2ED573 0%,#000 50%,#17C3B2 100%)",
  },
  ocean: {
    name: "Океан",
    bg: "radial-gradient(130% 70% at 50% -20%, rgba(56,189,248,0.28) 0%, rgba(0,0,0,0) 48%), radial-gradient(90% 60% at 100% 100%, rgba(8,145,178,0.35) 0%, rgba(0,0,0,0) 60%), #020617",
    card: "rgba(255,255,255,0.04)",
    line: "rgba(255,255,255,0.1)",
    a: "#38BDF8",
    b: "#0891B2",
    grad: "linear-gradient(135deg,#38BDF8 0%,#0891B2 100%)",
    glow: "0 10px 32px rgba(56,189,248,0.26)",
    surface: "#0A1020",
    on: "#000000",
    preview: "linear-gradient(135deg,#020617 0%,#0891B2 55%,#38BDF8 100%)",
  },
  neon: {
    name: "Неон",
    bg: "radial-gradient(80% 55% at 0% 0%, rgba(176,38,255,0.38) 0%, rgba(0,0,0,0) 60%), radial-gradient(80% 55% at 100% 100%, rgba(57,255,136,0.28) 0%, rgba(0,0,0,0) 60%), #000000",
    card: "rgba(255,255,255,0.045)",
    line: "rgba(255,255,255,0.11)",
    a: "#B026FF",
    b: "#39FF88",
    grad: "linear-gradient(135deg,#B026FF 0%,#39FF88 100%)",
    glow: "0 10px 32px rgba(176,38,255,0.30)",
    surface: "#100C16",
    on: "#FFFFFF",
    preview: "linear-gradient(135deg,#B026FF 0%,#000 50%,#39FF88 100%)",
  },
};
// Тема «Свой цвет» — пользователь выбирает один акцентный цвет (стандартный input[type=color],
// значит буквально любой цвет из палитры браузера/ОС), а весь остальной набор полей темы
// (фон, второй акцент, свечение, контрастный цвет текста на кнопках) считается от него, тем же
// способом, которым вручную подобраны остальные темы выше, — чтобы «свой цвет» выглядел так же
// аккуратно, а не просто одной плоской заливкой.
function hexToRgbArr(hex) {
  const h = String(hex || "").replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const num = parseInt(v, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
const rgbToHex = ([r, g, b]) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}
// Из одного hex-цвета строит полноценный объект темы: нормализует сам акцент в приятный
// для интерфейса диапазон яркости/насыщенности, подбирает второй акцент поворотом тона
// (как в готовых двухцветных темах pulse/ocean/neon), и считает "on" (цвет текста на кнопках)
// по фактической яркости акцента, чтобы текст всегда читался.
function themeFromColor(hexIn) {
  const safe = /^#?[0-9a-f]{6}$/i.test(hexIn || "") ? (hexIn[0] === "#" ? hexIn : "#" + hexIn) : "#FF6B6B";
  const [h, s] = rgbToHsl(hexToRgbArr(safe));
  const aRgb = hslToRgb([h, Math.min(95, Math.max(55, s)), 56]);
  const bRgb = hslToRgb([(h + 140) % 360, Math.min(90, Math.max(55, s)), 54]);
  const aHex = rgbToHex(aRgb);
  const bHex = rgbToHex(bRgb);
  const [ar, ag, ab] = aRgb.map(Math.round);
  const [br, bgC, bb] = bRgb.map(Math.round);
  const luminance = (0.299 * ar + 0.587 * ag + 0.114 * ab) / 255;
  const on = luminance > 0.6 ? "#000000" : "#FFFFFF";
  return {
    name: "Свой цвет",
    bg: `radial-gradient(130% 70% at 50% -20%, rgba(${ar},${ag},${ab},0.3) 0%, rgba(0,0,0,0) 50%), radial-gradient(90% 60% at 100% 100%, rgba(${br},${bgC},${bb},0.25) 0%, rgba(0,0,0,0) 60%), #000000`,
    card: "rgba(255,255,255,0.045)",
    line: "rgba(255,255,255,0.11)",
    a: aHex,
    b: bHex,
    grad: `linear-gradient(135deg,${aHex} 0%,${bHex} 100%)`,
    glow: `0 10px 32px rgba(${ar},${ag},${ab},0.28)`,
    surface: "#101114",
    on,
    preview: `linear-gradient(135deg,${aHex} 0%,#000 50%,${bHex} 100%)`,
  };
}
// Единственное место, где раньше стоял прямой THEMES[st.theme] — теперь все экраны получают
// тему через эту функцию, чтобы "custom" работал везде одинаково без правок по всему файлу.
const getTheme = (st) => (st.theme === "custom" ? themeFromColor(st.customColor) : THEMES[st.theme] || THEMES.ritm);

const MUTED = "rgba(255,255,255,0.55)";
const DISPLAY = "'Geologica', 'Onest', system-ui, sans-serif";
const BODY = "'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif";

/* ============ Даты ============ */
const pad = (n) => String(n).padStart(2, "0");
// Время задачи: одно значение ("17:00") или диапазон ("17:00–18:00"), если задан конец
const taskTimeLabel = (t) => (t?.time ? `${t.time}${t.timeEnd ? `–${t.timeEnd}` : ""}` : "");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const wdOf = (d) => (d.getDay() + 6) % 7;
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const daysBack = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d; });
// Календарная неделя Пн–Вс, содержащая refDate (по умолчанию сегодня) — используется трекером
// привычек и «тренировок за неделю»; в календаре следует за выбранным днём, а не всегда за «сегодня»
const weekDays = (refDate = new Date()) => { const d = new Date(refDate); d.setDate(d.getDate() - wdOf(d)); return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; }); };
const streakOf = (has) => { let s = 0; const d = new Date(); if (!has(keyOf(d))) d.setDate(d.getDate() - 1); while (has(keyOf(d))) { s++; d.setDate(d.getDate() - 1); } return s; };
const fmt = (n) => String(n).replace(".", ",");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dateFromKey = (k) => new Date(`${k}T00:00:00`);
const taskOccursOn = (task, date) => {
  const r = task?.repeat || { type: "daily" };
  const k = keyOf(date);
  if (r.type === "once") return r.date === k;
  if (r.type === "daily") return true;
  if (r.type === "weekly") return Array.isArray(r.days) && r.days.includes(wdOf(date));
  if (r.type === "monthly") return date.getDate() === Number(r.day || date.getDate());
  if (r.type === "yearly") return date.getMonth() === Number(r.month ?? date.getMonth()) && date.getDate() === Number(r.day || date.getDate());
  if (r.type === "interval") {
    const start = dateFromKey(r.start || k);
    const diff = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
    return diff >= 0 && diff % Math.max(1, Number(r.every) || 1) === 0;
  }
  return false;
};
const recurrenceLabel = (r) => {
  const x = r || { type: "once" };
  if (x.type === "daily") return "Каждый день";
  if (x.type === "weekly") return Array.isArray(x.days) && x.days.length ? `По дням: ${x.days.map((d) => WD[d]).join(", ")}` : "По дням недели";
  if (x.type === "monthly") return `Каждый месяц, ${x.day}-го`;
  if (x.type === "yearly") return `Каждый год, ${x.day}.${String(Number(x.month || 0) + 1).padStart(2, "0")}`;
  if (x.type === "interval") return `Каждые ${x.every || 1} дн.`;
  return "Однократно";
};

/* ============ Планировщик задач: приоритет и списки ============ */
const PRIORITIES = [
  { v: 0, label: "Без приоритета", color: null },
  { v: 1, label: "Низкий", color: "#4F86F7" },
  { v: 2, label: "Средний", color: "#F2A93B" },
  { v: 3, label: "Высокий", color: "#FF5D5D" },
];
const LIST_COLORS = ["#8B8FA3", "#4F86F7", "#3FBF7F", "#F2A93B", "#FF5D5D", "#B478E8", "#3FC7D6"];
const priorityOf = (t) => Number(t?.priority) || 0;
const listIdOf = (t) => t?.listId || "inbox";
const priorityMeta = (p) => PRIORITIES.find((x) => x.v === p) || PRIORITIES[0];
const sortByPriorityTime = (a, b) => priorityOf(b) - priorityOf(a) || (a.time || "99:99").localeCompare(b.time || "99:99");

// Операции с задачами — независимы от конкретного экрана, чтобы ими могли пользоваться и календарь, и список
const addOnceTask = (up, date, data) => up((s) => ({ tasks: { ...s.tasks, [date]: [...(s.tasks[date] || []), { id: Date.now(), done: false, priority: 0, listId: "inbox", ...data }] } }));
const addDailyTask = (up, data) => up((s) => ({ dailyTasks: [...(s.dailyTasks || []), { id: "dl" + Date.now(), log: {}, priority: 0, listId: "inbox", ...data }] }));
const toggleOnceTask = (up, date, id) => up((s) => ({ tasks: { ...s.tasks, [date]: (s.tasks[date] || []).map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } }));
const deleteOnceTask = (up, date, id) => up((s) => ({ tasks: { ...s.tasks, [date]: (s.tasks[date] || []).filter((t) => t.id !== id) } }));
const moveOnceTask = (up, oldDate, newDate, id, patch) => up((s) => {
  const cur = (s.tasks[oldDate] || []).find((t) => t.id === id);
  if (!cur) return {};
  const rest = (s.tasks[oldDate] || []).filter((t) => t.id !== id);
  const updated = { ...cur, ...patch };
  if (oldDate === newDate) return { tasks: { ...s.tasks, [oldDate]: [...rest, updated] } };
  return { tasks: { ...s.tasks, [oldDate]: rest, [newDate]: [...(s.tasks[newDate] || []), updated] } };
});
const toggleDailyLog = (up, id, dateKey) => up((s) => ({ dailyTasks: s.dailyTasks.map((t) => (t.id === id ? { ...t, log: { ...t.log, [dateKey]: !t.log[dateKey] } } : t)) }));
const updateDailyTask = (up, id, patch) => up((s) => ({ dailyTasks: s.dailyTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
const deleteDailyTask = (up, id) => up((s) => ({ dailyTasks: s.dailyTasks.filter((t) => t.id !== id) }));
const addTaskList = (up, list) => up((s) => ({ taskLists: [...(s.taskLists || []), list] }));
const deleteTaskList = (up, id) => up((s) => ({ taskLists: (s.taskLists || []).filter((l) => l.id !== id) }));

function PriorityDot({ p, size = 8 }) {
  const m = priorityMeta(p);
  if (!m.color) return null;
  return <span style={{ width: size, height: size, borderRadius: size, background: m.color, display: "inline-block", flexShrink: 0 }} />;
}

function PriorityPicker({ T, value, onChange }) {
  return (
    <div className="flex gap-1">
      {PRIORITIES.map((p) => (
        <button key={p.v} onClick={() => onChange(p.v)} aria-label={p.label} aria-pressed={value === p.v}
          className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, background: value === p.v ? (p.color || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)", border: `1px solid ${value === p.v ? "transparent" : T.line}` }}>
          <Flag size={13} color={value === p.v && p.color ? "#fff" : (p.color || MUTED)} fill={value === p.v && p.color ? "#fff" : "none"} />
        </button>
      ))}
    </div>
  );
}

function ListChip({ T, list, onClick, active }) {
  if (!list) return null;
  return (
    <button onClick={onClick} className="rounded-full px-2.5 py-1 flex items-center gap-1.5" style={{ fontSize: 12, background: active ? `${list.color}26` : "rgba(255,255,255,0.05)", border: `1px solid ${active ? list.color : T.line}`, color: active ? list.color : MUTED }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: list.color, display: "inline-block" }} />
      {list.name}
    </button>
  );
}

function ListsManagerSheet({ T, lists, onClose, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(LIST_COLORS[1]);
  const add = () => {
    const n = name.trim();
    if (!n) return;
    onAdd({ id: "lst" + Date.now(), name: n, color });
    setName("");
  };
  return (
    <Sheet T={T} title="Списки задач" onClose={onClose}>
      <div className="flex flex-col gap-2 mb-4">
        {lists.map((l) => (
          <Card key={l.id} T={T} className="flex items-center gap-3" style={{ padding: "10px 14px" }}>
            <span style={{ width: 10, height: 10, borderRadius: 10, background: l.color, flexShrink: 0 }} />
            <span className="flex-1">{l.name}</span>
            {l.id !== "inbox" && <button onClick={() => onDelete(l.id)} aria-label={`Удалить список ${l.name}`} style={{ color: MUTED }}><Trash2 size={15} /></button>}
          </Card>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        {LIST_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} aria-label={`Цвет ${c}`} className="rounded-full flex-shrink-0" style={{ width: 26, height: 26, background: c, border: color === c ? "2px solid #fff" : "2px solid transparent" }} />
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Новый список" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={add} aria-label="Добавить список" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
      </div>
    </Sheet>
  );
}

// Единая карточка задачи: заголовок в первой строке, время/повтор/список — во второй, компактнее на узких экранах
function TaskRow({ T, item, list, onToggle, onEdit }) {
  const hasMeta = !!(item.time || item.kind === "daily" || list);
  return (
    <Card T={T} style={{ padding: "12px 16px" }}>
      <div className="flex items-center gap-3">
        <CheckBox T={T} on={item.done} onClick={onToggle} label={item.text} />
        <PriorityDot p={priorityOf(item)} />
        <span className="flex-1 min-w-0 truncate" style={{ opacity: item.done ? 0.5 : 1, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
        <button onClick={onEdit} aria-label="Изменить задачу" style={{ color: MUTED, flexShrink: 0 }}><PenLine size={15} /></button>
      </div>
      {hasMeta && (
        <div className="flex items-center gap-2 flex-wrap mt-2" style={{ paddingLeft: 38 }}>
          {item.time && <span style={{ fontSize: 12, color: T.a, fontWeight: 700, flexShrink: 0 }}>{taskTimeLabel(item)}</span>}
          {item.kind === "daily" && <Repeat size={13} color={MUTED} style={{ flexShrink: 0 }} />}
          {list && <ListChip T={T} list={list} active onClick={onEdit} />}
        </div>
      )}
    </Card>
  );
}

function TaskEditSheet({ T, task, lists, onClose, onSave, onDelete }) {
  const isDaily = task.kind === "daily";
  const [text, setText] = useState(task.text || "");
  const [time, setTime] = useState(task.time || "");
  const [timeEnd, setTimeEnd] = useState(task.timeEnd || "");
  const [priority, setPriority] = useState(priorityOf(task));
  const [listId, setListId] = useState(listIdOf(task));
  const [notes, setNotes] = useState(task.notes || "");
  const [date, setDate] = useState(task.date || keyOf(new Date()));
  const [repeat, setRepeat] = useState(task.repeat || { type: "daily" });

  const save = () => {
    const t = text.trim();
    if (!t) return;
    // Конец диапазона имеет смысл только вместе с началом и позже него — иначе просто отбрасываем его
    const cleanEnd = time && timeEnd && timeEnd > time ? timeEnd : null;
    onSave({ text: t, time: time || null, timeEnd: cleanEnd, priority, listId, notes: notes.trim(), date, repeat });
    onClose();
  };
  return (
    <Sheet T={T} title={isDaily ? "Повторяющаяся задача" : "Задача"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст задачи"
          className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <div className="flex gap-2">
          {!isDaily && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Дата"
            className="flex-1 rounded-xl px-3 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 14 }} />}
          <input type="time" value={time || ""} onChange={(e) => setTime(e.target.value)} aria-label="Время начала"
            className="rounded-xl px-3 py-3 bg-transparent outline-none" style={{ width: isDaily ? "50%" : 112, border: `1px solid ${T.line}`, color: "#fff", fontSize: 14 }} />
          {time && (
            <input type="time" value={timeEnd || ""} onChange={(e) => setTimeEnd(e.target.value)} aria-label="Время окончания"
              className="rounded-xl px-3 py-3 bg-transparent outline-none" style={{ width: isDaily ? "50%" : 112, border: `1px solid ${T.line}`, color: "#fff", fontSize: 14 }} />
          )}
        </div>
        {time && !timeEnd && <Muted size={11}>Необязательно: добавь время окончания, чтобы получить диапазон — например, «17:00–18:00»</Muted>}
        <div>
          <Muted size={12} className="mb-1">Приоритет</Muted>
          <PriorityPicker T={T} value={priority} onChange={setPriority} />
        </div>
        <div>
          <Muted size={12} className="mb-1">Список</Muted>
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => <ListChip key={l.id} T={T} list={l} active={listId === l.id} onClick={() => setListId(l.id)} />)}
          </div>
        </div>
        {isDaily && <RecurrenceEditor T={T} value={repeat} onChange={setRepeat} date={new Date()} />}
        <div className="flex items-start gap-2 rounded-xl px-3 py-1" style={{ border: `1px solid ${T.line}` }}>
          <AlignLeft size={16} color={MUTED} style={{ marginTop: 12, flexShrink: 0 }} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Заметка" rows={2}
            className="flex-1 bg-transparent outline-none py-2" style={{ color: "#fff", fontSize: 14, resize: "none" }} />
        </div>
        <Primary T={T} onClick={save}>Сохранить</Primary>
        <Ghost T={T} onClick={() => { onDelete(); onClose(); }}><Trash2 size={16} /> Удалить задачу</Ghost>
      </div>
    </Sheet>
  );
}

// TickTick-подобный список: просроченные, сегодня, завтра и дальше по дням, с фильтром по спискам
function PlannerList({ T, st, up, lists, openEditor, openListsManager }) {
  const today = new Date();
  const todayKey = keyOf(today);
  const [filter, setFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [text, setText] = useState("");
  const [addDate, setAddDate] = useState(todayKey);
  const [addPriority, setAddPriority] = useState(0);
  const [addListId, setAddListId] = useState("inbox");
  const [addDaily, setAddDaily] = useState(false);
  const [addRepeat, setAddRepeat] = useState({ type: "daily" });
  const allRecurring = st.dailyTasks || [];

  const addTask = () => {
    const t = text.trim();
    if (!t) return;
    if (addDaily) addDailyTask(up, { text: t, priority: addPriority, listId: addListId, repeat: addRepeat });
    else addOnceTask(up, addDate, { text: t, priority: addPriority, listId: addListId });
    setText("");
  };

  const groups = useMemo(() => {
    const res = [];
    const overdue = [];
    Object.entries(st.tasks || {}).forEach(([date, list]) => {
      if (date >= todayKey) return;
      (list || []).forEach((t) => { if (!t.done) overdue.push({ kind: "once", date, ...t }); });
    });
    if (overdue.length) res.push({ label: "Просрочено", key: "overdue", items: overdue.sort(sortByPriorityTime) });
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const k = keyOf(d);
      const once = (st.tasks[k] || []).map((t) => ({ kind: "once", date: k, ...t }));
      const daily = allRecurring.filter((t) => taskOccursOn(t, d)).map((t) => ({ kind: "daily", date: k, ...t, done: !!t.log[k] }));
      const items = [...once, ...daily].sort(sortByPriorityTime);
      if (!items.length) continue;
      const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : cap(d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" }));
      res.push({ label, key: k, items });
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.tasks, st.dailyTasks, todayKey]);

  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => (filter === "all" || listIdOf(it) === filter) && (showDone || !it.done)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Chip T={T} on={filter === "all"} onClick={() => setFilter("all")}>Все списки</Chip>
        {lists.map((l) => <ListChip key={l.id} T={T} list={l} active={filter === l.id} onClick={() => setFilter(filter === l.id ? "all" : l.id)} />)}
        <button onClick={openListsManager} className="rounded-full px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 12, color: MUTED, border: `1px dashed ${T.line}` }}><Plus size={12} /> список</button>
        <button onClick={() => setShowDone(!showDone)} className="rounded-full px-3 py-1.5 flex items-center gap-1 ml-auto" style={{ fontSize: 12, color: showDone ? "#fff" : MUTED, border: `1px solid ${T.line}` }}>
          <ListFilter size={12} /> Выполненные
        </button>
      </div>

      {visible.length === 0 && (
        <Card T={T}><Muted size={14}>Пока нет задач впереди. Добавь первую ниже — TickTick-стиль подсказывает: с датой и приоритетом её проще не забыть.</Muted></Card>
      )}

      <div className="flex flex-col gap-4">
        {visible.map((g) => (
          <div key={g.key}>
            <div style={{ fontSize: 13, fontWeight: 700, color: g.key === "overdue" ? "#FF5D5D" : MUTED, marginBottom: 6 }}>{g.label}</div>
            <div className="flex flex-col gap-2">
              {g.items.map((it) => {
                const list = lists.find((l) => l.id === listIdOf(it)) || lists[0];
                const onToggle = () => (it.kind === "daily" ? toggleDailyLog(up, it.id, it.date) : toggleOnceTask(up, it.date, it.id));
                return (
                  <TaskRow key={`${it.kind}-${it.id}-${it.date}`} T={T} item={it} list={list} onToggle={onToggle} onEdit={() => openEditor(it)} />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Новая задача" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        {!addDaily && <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} aria-label="Дата задачи"
          className="rounded-xl px-2 py-3 bg-transparent outline-none" style={{ width: 130, border: `1px solid ${T.line}`, color: "#fff", fontSize: 13 }} />}
        <button onClick={addTask} aria-label="Добавить задачу" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <PriorityPicker T={T} value={addPriority} onChange={setAddPriority} />
        <div className="flex flex-wrap gap-2">
          {lists.map((l) => <ListChip key={l.id} T={T} list={l} active={addListId === l.id} onClick={() => setAddListId(l.id)} />)}
        </div>
        <Chip T={T} on={addDaily} onClick={() => setAddDaily(!addDaily)}><Repeat size={13} /> Повторять</Chip>
      </div>
      {addDaily && <RecurrenceEditor T={T} value={addRepeat} onChange={setAddRepeat} date={today} />}
    </div>
  );
}

// Экран «Разделы»: перетаскивание пунктов через Pointer Events (без сторонних библиотек) +
// переключатель видимости. «Сегодня» закреплён первым и всегда виден.
function TabsManagerSheet({ T, st, up, onClose }) {
  const cfg = st.tabsConfig || DEFAULT_TABS_CONFIG;
  const order = (cfg.order?.length ? cfg.order : DEFAULT_TABS_CONFIG.order).filter((id) => id !== "today");
  const knownIds = new Set(order);
  const fullOrder = [...order, ...TABS_ALL.map((t) => t[0]).filter((id) => id !== "today" && !knownIds.has(id))];
  const hidden = new Set(cfg.hidden || []);
  const visibleCount = 1 + fullOrder.filter((id) => !hidden.has(id)).length; // +1 за «Сегодня»

  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const itemRefs = useRef([]);

  const saveOrder = (newOrder) => up((s) => ({ tabsConfig: { hidden: [...(s.tabsConfig?.hidden ?? DEFAULT_TABS_CONFIG.hidden)], order: ["today", ...newOrder] } }));
  const toggleHidden = (id) => {
    const isHidden = hidden.has(id);
    if (!isHidden && visibleCount <= MIN_VISIBLE_TABS) return; // не даём спрятать последний из минимума
    up((s) => {
      const h = new Set(s.tabsConfig?.hidden ?? DEFAULT_TABS_CONFIG.hidden);
      if (isHidden) h.delete(id); else h.add(id);
      return { tabsConfig: { order: completeTabsOrder(s.tabsConfig?.order), hidden: [...h] } };
    });
  };

  const onPointerDown = (i) => (e) => { setDragIndex(i); setOverIndex(i); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onPointerMove = (e) => {
    if (dragIndex === null) return;
    let next = overIndex;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) next = i;
    });
    if (next !== overIndex) setOverIndex(next);
  };
  const endDrag = () => {
    if (dragIndex !== null && overIndex !== null && overIndex !== dragIndex) {
      const next = [...fullOrder];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      saveOrder(next);
    }
    setDragIndex(null); setOverIndex(null);
  };

  return (
    <Sheet T={T} title="Разделы" onClose={onClose}>
      <Muted size={13} className="mb-3">Перетащи за ⠿, чтобы изменить порядок. Выключателем — спрячь то, чем не пользуешься. «Сегодня» всегда первый, минимум {MIN_VISIBLE_TABS} раздела должны остаться включены.</Muted>
      <div className="flex flex-col gap-2 mb-2">
        <Card T={T} className="flex items-center gap-3" style={{ padding: "10px 14px", opacity: 0.7 }}>
          <Home size={18} />
          <span className="flex-1">Сегодня</span>
          <span style={{ fontSize: 11, color: MUTED }}>закреплён</span>
        </Card>
      </div>
      <div className="flex flex-col gap-2" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {fullOrder.map((id, i) => {
          const t = TABS_ALL.find((x) => x[0] === id);
          if (!t) return null;
          const [, label, Icon] = t;
          const isHidden = hidden.has(id);
          const isDragging = dragIndex === i;
          return (
            <div key={id} ref={(el) => (itemRefs.current[i] = el)}>
              <Card T={T} className="flex items-center gap-3" style={{ padding: "10px 14px", opacity: isDragging ? 0.4 : 1 }}>
                <span onPointerDown={onPointerDown(i)} style={{ touchAction: "none", cursor: "grab", color: MUTED, flexShrink: 0 }} aria-label={`Переставить: ${label}`}>
                  <GripVertical size={18} />
                </span>
                <Icon size={18} color={isHidden ? MUTED : "#fff"} />
                <span className="flex-1" style={{ opacity: isHidden ? 0.5 : 1 }}>{label}</span>
                <Toggle T={T} on={!isHidden} onChange={() => toggleHidden(id)} label={label} />
              </Card>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function RecurrenceEditor({ T, value, onChange, date }) {
  const r = value || { type: "once", date: keyOf(date) };
  const types = [["once", "Однократно"], ["daily", "Каждый день"], ["weekly", "По дням недели"], ["monthly", "Каждый месяц"], ["yearly", "Каждый год"], ["interval", "Каждые N дней"]];
  const setType = (type) => {
    if (type === "weekly") onChange({ type, days: [wdOf(date)] });
    else if (type === "monthly") onChange({ type, day: date.getDate() });
    else if (type === "yearly") onChange({ type, month: date.getMonth(), day: date.getDate() });
    else if (type === "interval") onChange({ type, every: 2, start: keyOf(date) });
    else if (type === "once") onChange({ type, date: keyOf(date) });
    else onChange({ type });
  };
  return <div className="mt-2 rounded-2xl p-3" style={{ border: `1px solid ${T.line}`, background: T.card }}>
    <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Повторение</div>
    <div className="flex flex-wrap gap-2">
      {types.map(([id, label]) => <Chip key={id} T={T} on={r.type === id} onClick={() => setType(id)}>{label}</Chip>)}
    </div>
    {r.type === "weekly" && <div className="flex flex-wrap gap-2 mt-3">
      {WD.map((d, i) => <Chip key={i} T={T} on={(r.days || []).includes(i)} onClick={() => { const days = r.days || []; const next = days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort((a,b)=>a-b); onChange({ ...r, days: next.length ? next : [i] }); }}>{d}</Chip>)}
    </div>}
    {r.type === "interval" && <div className="flex items-center gap-2 mt-3">
      <span style={{ color: MUTED, fontSize: 13 }}>Каждые</span>
      <input type="number" min="1" max="365" step="1" value={r.every || 1} onChange={(e) => onChange({ ...r, every: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} className="rounded-xl px-3 py-2 bg-transparent outline-none" style={{ width: 80, border: `1px solid ${T.line}`, color: "#fff" }} />
      <span style={{ color: MUTED, fontSize: 13 }}>дней</span>
    </div>}
    <Muted size={12} className="mt-2">{recurrenceLabel(r)}</Muted>
  </div>;
}

/* ============ Анкета ============ */
const QUESTIONS = [
  { key: "goal", title: "Какая у тебя главная цель?", hint: "От цели зависят повторы, веса и отдых между подходами",
    options: [["mass", "Набрать мышцы"], ["fat", "Сбросить вес"], ["strength", "Стать сильнее"], ["endurance", "Выносливость и бег"]] },
  // Пол — на одном экране с параметрами тела: раньше это были два отдельных шага
  { key: "body", title: "Пол и параметры тела", hint: "Стартовые веса и норма калорий считаются от них", sex: [["m", "Мужской"], ["f", "Женский"]], numbers: [
    { k: "age", label: "Возраст", unit: "лет", min: 16, max: 80 },
    { k: "height", label: "Рост", unit: "см", min: 130, max: 230 },
    { k: "weight", label: "Вес", unit: "кг", min: 35, max: 200 },
  ] },
  { key: "rate", title: "Какой темп тебе подходит?", hint: (a) => rateHint(a.goal),
    condition: (a) => a.goal === "mass" || a.goal === "fat",
    options: (a) => rateOptions(a.goal, a.age) },
  { key: "level", title: "Какой у тебя опыт?", hint: "Новичкам даю лёгкий старт, чтобы поставить технику",
    options: [["beginner", "Новичок, до 6 месяцев"], ["intermediate", "Средний, от 6 месяцев до 2 лет"], ["advanced", "Опытный, больше 2 лет"]] },
  { key: "place", title: "Где и с чем будешь тренироваться?", hint: "От инвентаря зависит набор упражнений",
    options: [["bodyweight", "Свой вес, без инвентаря"], ["gym", "В зале"], ["homeWeight", "Дома с гантелями"], ["kettlebell", "Гири"]] },
  { key: "days", title: "Сколько силовых в неделю?", hint: "Беговые дни встанут в свободные дни",
    options: [[2, "2 тренировки"], [3, "3 тренировки"], [4, "4 тренировки"]] },
  { key: "run", title: "Сколько пробежишь без остановки?", hint: "По ответу подберу стартовый беговой план",
    options: [["0", "Меньше 1 км"], ["1", "1–3 км"], ["3", "3–5 км"], ["5", "Больше 5 км"]] },
  // Аллергии не спрашиваем на старте — они задаются в Настройках, а раздел «Питание» сам об этом напоминает.
  // «На сколько кг хочешь измениться» тоже убрали: на программу и норму не влияет, только на прогноз срока.
];
const LABELS = {
  goal: { mass: "набор мышц", fat: "снижение веса", strength: "сила", endurance: "выносливость" },
  level: { beginner: "новичок", intermediate: "средний уровень", advanced: "опытный" },
  place: { gym: "зал", bodyweight: "свой вес", homeWeight: "гантели дома", kettlebell: "гири" },
};

/* ============ Аллергены и норма питания ============ */
const ALLERGENS = {
  gluten: { label: "Глютен", re: /пшени|мук[аиуо]|хлеб|лаваш|тост|лепешк|макарон|спагетти|лапш|кускус|булгур|ячмен|ржан|овсян|овес|овса|панировк|сухар|соев(ый|ого|ым) соус|сейтан|манн(ая|ой|ую)|печенье|печенья|бисквит|паста из|пенне|фузилли|лазань|пицц|пельмен|вареник|блин|оладь|пирог|булк|круассан|гренк|крутон|бургер|шаурм/ },
  milk: { label: "Молоко", re: /молок|молоч|[^а-я]сыр(а|ом|у|ы|ов|н[а-я]*)?[^а-я]|творог|творож|кефир|йогурт|сливк|сливоч|сметан|ряженк|[^а-я]фет(а|ы|е|у|ой)[^а-я]|моцарел|пармезан|рикотт|сывороточн|казеин|[^а-я]гхи[^а-я]/ },
  eggs: { label: "Яйца", re: /яйц|яиц|яичн|желтк|майонез|омлет|пашот/ },
  nuts: { label: "Орехи", re: /орех|миндал|фундук|кешью|фисташ|пекан|макадами|песто|нутелл/ },
  peanut: { label: "Арахис", re: /арахис/ },
  fish: { label: "Рыба", re: /рыб|лосос|семг|форел|тунец|тунц|треск|минта|скумбри|сельд|анчоус|горбуш|судак|окун|дорадо|сибас/ },
  shellfish: { label: "Морепродукты", re: /кревет|краб|мидии|мидий|кальмар|осьмин|гребеш|устриц|лобстер|омар|морепродукт/ },
  soy: { label: "Соя", re: /[^а-я]со[яею][^а-я]|соев|тофу|эдамам|[^а-я]мисо[^а-я]|[^а-я]темпе[^а-я]/ },
  sesame: { label: "Кунжут", re: /кунжут|тахини|хумус/ },
};
const detectAllergens = (text) => {
  const t = " " + String(text).toLowerCase().replace(/ё/g, "е") + " ";
  return Object.keys(ALLERGENS).filter((key) => ALLERGENS[key].re.test(t));
};
const alLabels = (keys) => keys.map((a) => ALLERGENS[a].label.toLowerCase()).join(", ");

// Темп изменения веса, % от массы тела в неделю. Взрослым доступен более быстрый темп,
// несовершеннолетним — только бережные варианты (организм ещё растёт)
const KCAL_PER_KG = 7700; // энергетическая ценность килограмма жировой ткани, оценка
const isAdult = (age) => age >= 18;
function rateOptions(goal, age) {
  if (goal === "mass") {
    const opts = [[0.25, "Медленно, почти без жира"], [0.4, "Стандартный темп"]];
    if (isAdult(age)) opts.push([0.6, "Быстрее, приму больше жира"]);
    return opts;
  }
  if (goal === "fat") {
    const opts = [[0.3, "Медленно и бережно"], [0.6, "Стандартный темп"]];
    if (isAdult(age)) opts.push([1, "Быстрее, если очень надо"]);
    return opts;
  }
  return [];
}
const rateHint = (goal) => (goal === "mass"
  ? "Быстрее — значит больше жира вместе с мышцами, медленнее — суше и дольше"
  : "Быстрее — выше риск терять мышцы и срываться, медленнее — комфортнее и стабильнее");

// Умный расчёт питания: BMR → активность → цель → БЖУ.
const activityFactorOf = (p) => {
  const strength = Number(p.days) || 0;
  const runKm = Number(p.run) || 0;
  const base = { 2: 1.38, 3: 1.46, 4: 1.54 }[strength] || 1.36;
  const runBonus = runKm >= 5 ? 0.06 : runKm >= 3 ? 0.04 : runKm >= 1 ? 0.02 : 0;
  return Math.min(1.65, Math.round((base + runBonus) * 100) / 100);
};

const nutritionGoalOf = (p) => p.nutritionGoal || (
  p.goal === "mass" ? "muscle" : p.goal === "fat" ? "loss" : "tone"
);
const NUTRITION_GOALS = [
  ["muscle", "Набор мышц", "Небольшой профицит + достаточно белка и углеводов"],
  ["tone", "Тонус / поддержание", "Примерно поддерживающий уровень энергии"],
  ["loss", "Снижение веса", "Умеренное снижение для взрослых; для растущих — без жёсткого дефицита"],
  ["weight", "Набор массы", "Профицит энергии для постепенного увеличения массы"],
];
const MEAL_SPLITS = [0.25, 0.30, 0.30, 0.15];

function calcNutrition(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
  const activityFactor = activityFactorOf(p);
  const tdee = bmr * activityFactor;
  const ng = nutritionGoalOf(p);
  const adult = isAdult(p.age);
  const requestedDelta = (Number(p.rate) || 0) / 100 * p.weight * KCAL_PER_KG / 7;
  let goalAdjustment = 0;
  if (ng === "loss") goalAdjustment = adult ? -Math.min(750, Math.max(150, requestedDelta || tdee * 0.10)) : 0;
  if (ng === "muscle") goalAdjustment = adult ? Math.min(450, Math.max(150, requestedDelta || tdee * 0.07)) : Math.min(300, Math.max(100, requestedDelta || tdee * 0.04));
  if (ng === "weight") goalAdjustment = adult ? Math.min(500, Math.max(180, requestedDelta || tdee * 0.10)) : Math.min(300, Math.max(100, requestedDelta || tdee * 0.04));
  let kcal = Math.round((tdee + goalAdjustment) / 10) * 10;
  if (ng === "loss" && !adult) kcal = Math.round(tdee / 10) * 10;
  kcal = Math.max(1200, kcal);
  const refW = Math.min(p.weight, 25 * (p.height / 100) ** 2 * 1.15);
  const proteinPerKg = ng === "muscle" ? 1.8 : ng === "weight" ? 1.7 : ng === "loss" ? 1.6 : 1.4;
  const protein = Math.round(refW * proteinPerKg);
  const fat = Math.round(Math.max(refW * 0.8, (kcal * 0.27) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const waterBase = Math.round((p.weight * 33) / 10) * 10;
  const waterTrain = Math.round((waterBase + 500) / 10) * 10;
  const mealTargets = MEAL_SPLITS.map((share) => Math.round(kcal * share));
  return { kcal, protein, fat, carbs, waterBase, waterTrain, nutritionGoal: ng, bmr: Math.round(bmr), tdee: Math.round(tdee), activityFactor, goalAdjustment: Math.round(goalAdjustment), mealTargets };
}

/* ============ Упражнения ============ */
// group — какую из 6 мышечных групп упражнение закрывает; cat — «база» (многосуставные) или «изоляция»
const EX = {
  squat: { name: "Приседания со штангой", coef: 0.55, step: 2.5, group: "legs", cat: "base", tempo: "3-1-1", muscles: "Квадрицепсы, ягодицы, кор",
    steps: ["Штанга на верхней части трапеций, стопы чуть шире плеч", "Вдохни, напряги пресс и уведи таз назад и вниз", "Опустись до параллели бедра с полом и встань, толкая пол всей стопой"],
    mistakes: ["Колени заваливаются внутрь", "Округляется поясница"] },
  bench: { name: "Жим штанги лёжа", coef: 0.45, step: 2.5, group: "chest", cat: "base", tempo: "3-1-1", muscles: "Грудь, трицепс, передняя дельта",
    steps: ["Сведи лопатки, стопы упираются в пол", "Опусти гриф к нижней части груди, локти под углом 45°", "Выжми вверх по лёгкой дуге к плечам"],
    mistakes: ["Отбив штанги от груди", "Таз отрывается от скамьи"] },
  rdl: { name: "Румынская тяга", coef: 0.5, step: 2.5, group: "legs", cat: "base", tempo: "3-1-1", muscles: "Бицепс бедра, ягодицы, разгибатели спины",
    steps: ["Штанга у бёдер, колени слегка согнуты", "Отводи таз назад, гриф скользит вдоль ног", "Опустись до натяжения задней поверхности бедра и вернись"],
    mistakes: ["Спина круглится", "Гриф уходит далеко от ног"] },
  row: { name: "Тяга штанги в наклоне", coef: 0.38, step: 2.5, group: "back", cat: "base", tempo: "2-1-2", muscles: "Широчайшие, ромбовидные, бицепс",
    steps: ["Наклони корпус примерно на 45°, спина ровная", "Тяни гриф к низу живота, сводя лопатки", "Медленно опусти до полного выпрямления рук"],
    mistakes: ["Рывки корпусом", "Плечи поднимаются к ушам"] },
  ohp: { name: "Жим штанги стоя", coef: 0.28, step: 2.5, group: "shoulders", cat: "base", tempo: "2-1-2", muscles: "Дельты, трицепс, кор",
    steps: ["Гриф на уровне ключиц, ягодицы и пресс напряжены", "Выжми штангу вверх, убирая голову назад", "Зафиксируй над макушкой и опусти под контролем"],
    mistakes: ["Прогиб в пояснице", "Жим вперёд, а не вверх"] },
  pulldown: { name: "Тяга верхнего блока", coef: 0.42, step: 2.5, group: "back", cat: "base", tempo: "2-1-2", muscles: "Широчайшие, бицепс",
    steps: ["Хват чуть шире плеч, грудь вперёд", "Тяни рукоять к верху груди локтями вниз", "Плавно верни, полностью растягивая спину"],
    mistakes: ["Раскачка корпусом", "Тяга за голову"] },
  lunge: { name: "Выпады", coef: 0.12, step: 2.5, per: " на ногу", group: "legs", cat: "base", tempo: "2-1-1", muscles: "Квадрицепсы, ягодицы",
    steps: ["Сделай широкий шаг вперёд, корпус прямой", "Опустись, пока заднее колено почти не коснётся пола", "Оттолкнись передней ногой и вернись"],
    mistakes: ["Колено уходит далеко за носок", "Корпус заваливается вперёд"] },
  plank: { name: "Планка", time: true, group: "abs", cat: "iso", tempo: "0-1-0", muscles: "Пресс, кор",
    steps: ["Упор на предплечья, локти под плечами", "Тело прямое от макушки до пяток", "Дыши ровно, пресс и ягодицы напряжены"],
    mistakes: ["Провисает таз", "Задерживается дыхание"] },
  crunch: { name: "Скручивания", bw: true, group: "abs", cat: "iso", tempo: "2-1-1", muscles: "Прямая мышца живота",
    steps: ["Лёжа на спине, колени согнуты, руки за головой", "Скрути корпус, поднимая лопатки от пола", "Медленно опустись, не роняя голову рывком"],
    mistakes: ["Тянешь себя руками за шею", "Резкие рывки корпусом"] },
  pushup: { name: "Отжимания", group: "chest", cat: "base", tempo: "2-1-1", muscles: "Грудь, трицепс, кор",
    steps: ["Руки чуть шире плеч, тело прямое", "Опустись, пока грудь почти не коснётся пола", "Выжми себя вверх, не прогибаясь"],
    mistakes: ["Провисает таз", "Локти разведены в стороны на 90°"] },
  bwsquat: { name: "Приседания с весом тела", group: "legs", cat: "base", tempo: "2-1-1", muscles: "Квадрицепсы, ягодицы",
    steps: ["Стопы на ширине плеч, руки перед собой", "Уводи таз назад и вниз", "Встань, толкая пол пятками"],
    mistakes: ["Пятки отрываются", "Колени заваливаются внутрь"] },
  glute: { name: "Ягодичный мост", group: "legs", cat: "base", tempo: "2-1-1", muscles: "Ягодицы, бицепс бедра",
    steps: ["Лёжа на спине, стопы у таза", "Подними таз до прямой линии от колен до плеч", "Задержись и опусти под контролем"],
    mistakes: ["Прогиб в пояснице вместо работы ягодиц", "Слишком далеко поставлены стопы"] },
  pike: { name: "Отжимания уголком", group: "shoulders", cat: "iso", tempo: "2-1-1", muscles: "Дельты, трицепс",
    steps: ["Встань в упор, подними таз, тело буквой Λ", "Опусти голову к полу между рук", "Выжми себя обратно вверх"],
    mistakes: ["Таз опускается вниз", "Локти разъезжаются"] },
  superman: { name: "Супермен", group: "back", cat: "base", tempo: "2-1-1", muscles: "Разгибатели спины, ягодицы",
    steps: ["Лёжа на животе, руки вытянуты вперёд", "Одновременно подними руки, грудь и ноги", "Задержись на секунду и опустись"],
    mistakes: ["Рывок шеей", "Слишком высокий подъём с болью в пояснице"] },
  raise: { name: "Разведение гантелей в стороны", coef: 0.055, step: 1, group: "shoulders", cat: "iso", tempo: "2-1-2", muscles: "Средние дельты (плечи)",
    steps: ["Гантели у бёдер, локти чуть согнуты", "Разведи руки в стороны до уровня плеч", "Медленно опусти под контролем, не роняя вес"],
    mistakes: ["Раскачка корпусом вместо работы плеч", "Руки поднимаются выше уровня плеч"] },
  calfraise: { name: "Подъём на носки", bw: true, group: "calves", cat: "iso", tempo: "1-1-2", muscles: "Икроножные мышцы",
    steps: ["Встань прямо, стопы на ширине таза", "Поднимись на носки как можно выше", "Задержись на секунду и медленно опустись на пятки"],
    mistakes: ["Слишком быстрый темп без задержки вверху", "Перенос веса на внешний край стопы"] },
  // Гантели дома
  dbSquat: { name: "Присед с гантелью у груди", coef: 0.35, step: 2, group: "legs", cat: "base", tempo: "2-1-1", muscles: "Квадрицепсы, ягодицы",
    steps: ["Держи гантель вертикально у груди двумя руками", "Присядь, уводя таз назад и вниз", "Встань, толкая пол пятками"],
    mistakes: ["Пятки отрываются от пола", "Гантель уводит корпус вперёд"] },
  dbRdl: { name: "Румынская тяга с гантелями", coef: 0.3, step: 2, group: "legs", cat: "base", tempo: "3-1-1", muscles: "Бицепс бедра, ягодицы",
    steps: ["Гантели у бёдер, колени слегка согнуты", "Отводи таз назад, гантели скользят вдоль ног", "Опустись до натяжения задней поверхности бедра и вернись"],
    mistakes: ["Спина круглится", "Гантели уходят далеко от ног"] },
  dbRow: { name: "Тяга гантели в наклоне одной рукой", coef: 0.25, step: 2, group: "back", cat: "base", tempo: "2-1-2", muscles: "Широчайшие, бицепс",
    steps: ["Обопрись свободной рукой и коленом о скамью", "Тяни гантель к поясу, локоть вдоль корпуса", "Медленно опусти до полного выпрямления руки"],
    mistakes: ["Разворот корпуса за гантелью", "Рывок вместо тяги спиной"] },
  dbPress: { name: "Жим гантелей лёжа", coef: 0.22, step: 2, group: "chest", cat: "base", tempo: "2-1-1", muscles: "Грудь, трицепс, передняя дельта",
    steps: ["Лёжа, гантели над грудью на прямых руках", "Опусти гантели к груди, локти под углом 45°", "Выжми обратно вверх, не сводя гантели вместе"],
    mistakes: ["Гантели расходятся в стороны", "Слишком глубокая амплитуда с болью в плече"] },
  // Гири
  kbGoblet: { name: "Присед с гирей у груди", coef: 0.3, step: 4, group: "legs", cat: "base", tempo: "2-1-1", muscles: "Квадрицепсы, ягодицы",
    steps: ["Держи гирю за рога двумя руками у груди", "Присядь между колен, локти скользят по внутренней стороне бёдер", "Встань, толкая пол пятками"],
    mistakes: ["Колени заваливаются внутрь", "Наклон корпуса вперёд"] },
  kbSwing: { name: "Мах гирей", coef: 0.35, step: 4, group: "legs", cat: "base", tempo: "1-0-1", muscles: "Ягодицы, бицепс бедра, кор",
    steps: ["Гиря перед собой, наклонись, отводя таз назад", "Резко разгибай бёдра, гиря летит до уровня груди по инерции таза", "Дай гире свободно опуститься назад между ног и повтори"],
    mistakes: ["Подъём гири руками, а не тазом", "Округление поясницы в нижней точке"] },
  kbRow: { name: "Тяга гири в наклоне", coef: 0.22, step: 4, group: "back", cat: "base", tempo: "2-1-2", muscles: "Широчайшие, бицепс",
    steps: ["Наклони корпус примерно на 45°, спина ровная", "Тяни гирю к поясу, локоть вдоль корпуса", "Медленно опусти до полного выпрямления руки"],
    mistakes: ["Рывки корпусом", "Скругление спины"] },
  kbFloorPress: { name: "Жим гири лёжа с пола", coef: 0.18, step: 4, group: "chest", cat: "base", tempo: "2-1-1", muscles: "Грудь, трицепс, передняя дельта",
    steps: ["Лёжа на полу, гиря у плеча на согнутой руке", "Выжми гирю вверх на прямую руку", "Медленно опусти локтем к полу и повтори"],
    mistakes: ["Гиря заваливается набок", "Отрыв таза от пола"] },
  kbPress: { name: "Жим гири одной рукой стоя", coef: 0.14, step: 4, group: "shoulders", cat: "iso", tempo: "2-1-2", muscles: "Дельты, трицепс",
    steps: ["Гиря у плеча, локоть прижат к корпусу", "Выжми гирю вверх на прямую руку", "Медленно опусти под контролем"],
    mistakes: ["Прогиб в пояснице вместо жима", "Гиря уходит вперёд от линии тела"] },
  // Штанга и тренажёры — ещё варианты
  deadlift: { name: "Становая тяга", coef: 0.65, step: 2.5, group: "legs", cat: "base", tempo: "1-1-2", muscles: "Спина, ягодицы, бицепс бедра",
    steps: ["Штанга над серединой стопы, хват чуть шире плеч", "Спина прямая, тяни гриф вдоль голеней, толкаясь пятками", "Разогнись в бёдрах и пояснице одновременно, гриф скользит по ногам"],
    mistakes: ["Округление поясницы", "Гриф уходит далеко от голеней"] },
  frontSquat: { name: "Фронтальный присед", coef: 0.45, step: 2.5, group: "legs", cat: "base", tempo: "3-1-1", muscles: "Квадрицепсы, кор",
    steps: ["Штанга на передних дельтах, локти высоко вперёд", "Присядь, сохраняя корпус вертикальным", "Встань, не опуская локти"],
    mistakes: ["Локти падают вниз", "Пятки отрываются от пола"] },
  legPress: { name: "Жим ногами", coef: 1.1, step: 5, group: "legs", cat: "base", tempo: "2-1-1", muscles: "Квадрицепсы, ягодицы",
    steps: ["Стопы на платформе на ширине плеч", "Опусти платформу до угла 90° в коленях", "Выжми пятками, не разгибая колени до конца"],
    mistakes: ["Поясница отрывается от спинки", "Колени заваливаются внутрь"] },
  hipThrust: { name: "Ягодичный мост со штангой", coef: 0.75, step: 5, group: "legs", cat: "base", tempo: "2-1-1", muscles: "Ягодицы, бицепс бедра",
    steps: ["Спина на скамье, штанга на бёдрах через валик", "Толкай таз вверх до прямой линии колени-таз-плечи", "Задержись вверху и опусти под контролем"],
    mistakes: ["Прогиб только в пояснице", "Подбородок задран вверх"] },
  inclineBench: { name: "Жим штанги на наклонной скамье", coef: 0.38, step: 2.5, group: "chest", cat: "base", tempo: "3-1-1", muscles: "Верх груди, передние дельты",
    steps: ["Скамья под углом 30–45°, гриф над верхом груди", "Опусти к верхней части груди, локти под 45°", "Выжми вверх по дуге к плечам"],
    mistakes: ["Слишком крутой угол скамьи — работают только плечи", "Отбив от груди"] },
  closeGripBench: { name: "Жим штанги узким хватом", coef: 0.35, step: 2.5, group: "chest", cat: "base", tempo: "3-1-1", muscles: "Трицепс, грудь",
    steps: ["Хват чуть уже плеч, локти идут вдоль корпуса", "Опусти гриф к низу груди", "Выжми вверх, разгибая локти"],
    mistakes: ["Локти разъезжаются в стороны", "Слишком узкий хват — болят запястья"] },
  cableRow: { name: "Тяга блока сидя", coef: 0.35, step: 5, group: "back", cat: "base", tempo: "2-1-2", muscles: "Широчайшие, ромбовидные",
    steps: ["Сядь, чуть наклонись вперёд с прямой спиной", "Тяни рукоять к животу, сводя лопатки", "Медленно верни, растягивая спину вперёд"],
    mistakes: ["Раскачка корпусом", "Тяга руками без сведения лопаток"] },
  facePull: { name: "Тяга каната к лицу", coef: 0.12, step: 2.5, group: "back", cat: "iso", tempo: "2-1-2", muscles: "Задние дельты, средняя часть спины",
    steps: ["Канат на уровне лица, локти на уровне плеч", "Тяни концы каната к лицу, разводя локти в стороны", "Медленно верни под контролем"],
    mistakes: ["Локти опускаются ниже плеч", "Слишком тяжёлый вес — тянут руки, а не спина"] },
  barbellCurl: { name: "Подъём штанги на бицепс", coef: 0.18, step: 2.5, group: "back", cat: "iso", tempo: "2-1-2", muscles: "Бицепс",
    steps: ["Хват снизу на ширине плеч, локти прижаты к корпусу", "Согни руки, поднимая гриф к груди", "Медленно опусти, не раскачивая корпус"],
    mistakes: ["Раскачка корпусом и читинг", "Локти уходят вперёд"] },
  tricepPushdown: { name: "Разгибание рук на блоке", coef: 0.15, step: 2.5, group: "chest", cat: "iso", tempo: "2-1-2", muscles: "Трицепс",
    steps: ["Локти прижаты к корпусу, рукоять у груди", "Разогни руки вниз до конца", "Медленно верни, не разводя локти"],
    mistakes: ["Локти отходят от корпуса", "Работа весом корпуса вместо трицепса"] },
  barbellShrug: { name: "Шраги со штангой", coef: 0.5, step: 5, group: "back", cat: "iso", tempo: "1-1-2", muscles: "Трапеции",
    steps: ["Штанга в опущенных руках, хват чуть шире плеч", "Подними плечи прямо вверх, к ушам", "Задержись и медленно опусти"],
    mistakes: ["Вращение плечами по кругу", "Помощь руками — сгибание локтей"] },
  legExtension: { name: "Разгибание ног в тренажёре", coef: 0.35, step: 5, group: "legs", cat: "iso", tempo: "2-1-2", muscles: "Квадрицепсы",
    steps: ["Спина плотно к спинке, валик на голенях", "Разогни ноги до почти прямых колен", "Медленно опусти под контролем"],
    mistakes: ["Резкий рывок в верхней точке", "Отрыв таза от сиденья"] },
  legCurl: { name: "Сгибание ног в тренажёре", coef: 0.3, step: 5, group: "legs", cat: "iso", tempo: "2-1-2", muscles: "Бицепс бедра",
    steps: ["Лёжа, валик на голенях сзади", "Согни ноги, подводя пятки к ягодицам", "Медленно вернись в исходное положение"],
    mistakes: ["Таз отрывается от скамьи", "Слишком быстрый темп"] },
  hyperextension: { name: "Гиперэкстензия", bw: true, group: "back", cat: "iso", tempo: "2-1-1", muscles: "Разгибатели спины, ягодицы",
    steps: ["Бёдра на валике тренажёра, корпус опущен вниз", "Подними корпус до прямой линии с ногами", "Медленно опустись обратно"],
    mistakes: ["Переразгибание с прогибом выше прямой линии", "Рывок вместо плавного подъёма"] },
  cableCrunch: { name: "Скручивания на блоке", coef: 0.15, step: 2.5, group: "abs", cat: "iso", tempo: "2-1-1", muscles: "Прямая мышца живота",
    steps: ["Встань на колени перед блоком, канат за головой", "Скрути корпус вниз, округляя спину, локти к бёдрам", "Медленно вернись, не разгибая до конца"],
    mistakes: ["Работа руками, а не прессом", "Движение только в тазобедренных суставах"] },
  // Свой вес — дома
  diamondPushup: { name: "Алмазные отжимания", group: "chest", cat: "base", tempo: "2-1-1", muscles: "Трицепс, внутренняя часть груди",
    steps: ["Ладони вместе под грудью, пальцы образуют ромб", "Опустись до касания грудью рук", "Выжми себя вверх, локти вдоль корпуса"],
    mistakes: ["Локти широко в стороны", "Провисает таз"] },
  declinePushup: { name: "Отжимания ногами на возвышении", group: "chest", cat: "base", tempo: "2-1-1", muscles: "Верх груди, передние дельты",
    steps: ["Стопы на возвышении, руки на полу шире плеч", "Опустись грудью к полу", "Выжми себя вверх, тело прямое"],
    mistakes: ["Провисает поясница", "Слишком высокое возвышение для текущего уровня"] },
  splitSquatBW: { name: "Болгарские выпады", group: "legs", cat: "base", tempo: "2-1-1", per: " на ногу", muscles: "Квадрицепсы, ягодицы",
    steps: ["Заднюю ногу поставь на возвышение за собой", "Опустись, пока переднее бедро не станет параллельно полу", "Оттолкнись передней ногой и встань"],
    mistakes: ["Переднее колено уходит далеко за носок", "Основной вес на задней ноге"] },
  sidePlank: { name: "Боковая планка", time: true, group: "abs", cat: "iso", tempo: "0-1-0", muscles: "Косые мышцы живота",
    steps: ["Упор на предплечье, тело на одной линии", "Подними таз, вторая рука вверх или на поясе", "Держи корпус прямым, не проваливаясь в пояснице"],
    mistakes: ["Таз опускается вниз", "Плечо не над локтем"] },
  mountainClimbers: { name: "Скалолаз", group: "abs", cat: "iso", tempo: "1-0-1", muscles: "Пресс, кор",
    steps: ["Упор лёжа, тело прямое", "Подтяни колено к груди, затем смени ногу", "Держи таз стабильным, не поднимая высоко"],
    mistakes: ["Таз скачет вверх-вниз", "Слишком быстрый темп в ущерб технике"] },
  gluteBridgeSingle: { name: "Ягодичный мост на одной ноге", group: "legs", cat: "base", tempo: "2-1-1", per: " на ногу", muscles: "Ягодицы, бицепс бедра",
    steps: ["Лёжа на спине, одна стопа на полу, другая нога прямая вверх", "Подними таз, толкаясь одной пяткой", "Задержись вверху и опусти под контролем"],
    mistakes: ["Таз разворачивается в сторону", "Прогиб в пояснице вместо работы ягодиц"] },
  birdDog: { name: "Птица-собака", group: "back", cat: "iso", tempo: "0-1-0", per: " на сторону", muscles: "Разгибатели спины, кор",
    steps: ["Упор на ладони и колени, спина прямая", "Вытяни разноимённые руку и ногу параллельно полу", "Задержись, вернись и повтори на другую сторону"],
    mistakes: ["Прогиб или скругление поясницы", "Таз разворачивается в сторону"] },
  wallSit: { name: "Стульчик у стены", time: true, group: "legs", cat: "iso", tempo: "0-1-0", muscles: "Квадрицепсы",
    steps: ["Спина плотно к стене, присядь до угла 90° в коленях", "Держи бёдра параллельно полу", "Дыши ровно, не задерживая дыхание"],
    mistakes: ["Колени выходят далеко за носки", "Недостаточно глубокий присед"] },
  // Гири — ещё варианты
  kbDeadlift: { name: "Становая тяга с гирей", coef: 0.35, step: 4, group: "legs", cat: "base", tempo: "1-1-2", muscles: "Ягодицы, бицепс бедра, спина",
    steps: ["Гиря между стоп, спина прямая", "Тянись тазом назад, бери гирю на прямых руках", "Встань, разгибая бёдра, гиря скользит вдоль ног"],
    mistakes: ["Округление спины", "Подъём за счёт рук, а не ног"] },
  kbThruster: { name: "Присед с жимом гири", coef: 0.25, step: 4, group: "legs", cat: "base", tempo: "2-0-1", muscles: "Квадрицепсы, плечи, кор",
    steps: ["Гиря у груди, присядь до параллели бедра с полом", "Встань и сразу выжми гирю над головой", "Опусти гирю к груди и повтори"],
    mistakes: ["Жим начинается до полного вставания", "Прогиб в пояснице при жиме"] },
};

/* ============ Группы мышц — цвета и подписи для экрана «Силовые» ============ */
const MUSCLE_LABELS = { legs: "Ноги", chest: "Грудь", back: "Спина", shoulders: "Плечи", abs: "Пресс", calves: "Икры" };
const MUSCLE_COLORS = { legs: "#FF6B6B", chest: "#4ECDC4", back: "#A78BFA", shoulders: "#FFB020", abs: "#38BDF8", calves: "#34D399" };
const MUSCLE_ORDER = ["chest", "back", "shoulders", "legs", "abs", "calves"];
// Унифицированно достаём группу мышц из элемента тренировки — элементы программы хранят id,
// элементы своих тренировок — exId, а свои упражнения без привязки к EX группы не имеют.
const groupOf = (it) => (it?.exercise || EX[it?.id] || (it?.exId && EX[it.exId]) || {}).group;
const groupsOfItems = (items) => [...new Set((items || []).map(groupOf).filter(Boolean))];

// Реалистичная анатомическая карта тела «спереди / сзади»: силуэт и формы мышечных
// групп взяты из реальных контуров тела (адаптировано из открытых данных пакета
// react-native-body-highlighter, MIT) и перераспределены по шести группам, которые
// использует RITM (EX[...].group). Это не геометрические фигуры, а настоящие
// анатомические контуры — грудь, пресс/косые, дельты, трапеции/широчайшие, квадрицепсы
// и бицепс бедра/ягодичные, икры — с реалистичным силуэтом тела на фоне.
const BODY_OUTLINE = {"front":"M 309.48 168.91 Q 305.84 164.32 303.32 169.76 C 298.49 180.21 308.31 200.03 314.51 208.74 C 316.34 211.31 318.01 208.95 318.58 207.26 A 0.67 0.66 57.6 0 1 319.87 207.55 C 319.06 215.09 318.68 227.40 324.34 232.47 C 327.22 235.05 326.97 235.88 326.92 239.51 Q 326.68 255.16 323.97 266.82 Q 323.85 267.35 323.48 267.73 Q 308.61 282.73 290.26 293.23 C 278.34 300.05 267.53 299.26 253.00 298.03 Q 237.49 296.72 224.74 305.21 C 208.71 315.86 190.95 335.73 189.24 355.50 Q 186.95 381.81 190.53 412.66 C 190.79 414.92 190.69 417.49 191.02 419.92 Q 191.09 420.43 190.88 420.90 C 187.89 427.65 183.99 434.89 181.93 441.29 C 177.25 455.76 176.31 470.23 176.20 486.02 Q 176.20 486.51 175.90 486.90 C 159.84 507.69 147.56 529.29 141.49 554.95 Q 140.10 560.80 138.16 574.66 Q 131.28 623.74 118.11 671.52 C 115.99 679.21 112.98 690.29 104.08 693.63 Q 90.70 698.65 79.29 707.27 C 73.17 711.89 69.48 719.95 66.12 726.62 C 62.44 733.91 47.57 737.30 49.20 746.00 C 49.75 748.96 51.89 750.13 54.75 750.02 Q 67.27 749.50 74.18 740.00 C 76.03 737.45 77.93 736.62 80.54 735.24 Q 81.02 734.98 81.24 735.48 Q 84.59 743.00 80.47 750.73 Q 71.41 767.75 62.21 784.70 Q 60.53 787.81 59.49 791.20 C 57.52 797.69 65.78 800.84 69.45 795.20 C 76.80 783.92 82.72 773.30 92.55 762.52 Q 93.00 762.04 92.84 762.67 Q 87.89 783.24 79.07 802.44 C 77.36 806.17 75.64 812.30 79.19 815.18 C 89.50 823.53 107.08 773.44 109.24 767.88 A 0.37 0.36 -30.3 0 1 109.94 768.06 C 108.51 777.44 106.43 787.14 105.28 796.13 C 104.34 803.43 103.67 808.49 104.41 814.32 C 105.40 822.00 112.74 817.15 114.09 812.77 C 118.56 798.32 120.41 781.74 125.18 766.21 A 0.55 0.55 0.0 0 1 125.93 765.87 C 131.64 768.40 126.65 796.54 133.38 803.49 A 1.35 1.35 0.0 0 0 134.16 803.90 C 138.40 804.59 139.71 797.34 140.15 793.73 Q 141.74 780.80 142.58 767.76 Q 142.86 763.46 144.07 759.34 Q 150.39 737.64 154.77 715.46 Q 156.15 708.50 155.48 697.76 Q 154.48 681.63 161.99 665.46 Q 180.58 625.46 201.25 586.52 C 213.64 563.18 218.66 541.14 220.65 514.18 C 221.24 506.18 223.22 502.59 228.42 495.84 C 237.76 483.72 242.73 464.92 246.12 450.19 Q 246.24 449.64 246.75 449.42 L 250.30 447.82 A 0.49 0.49 0.0 0 1 250.99 448.23 Q 252.78 470.14 257.44 487.01 C 259.04 492.80 264.20 498.21 265.32 505.20 C 265.91 508.82 266.99 512.44 267.11 516.00 Q 267.57 529.33 266.95 540.50 C 265.58 565.32 263.85 592.20 259.98 619.13 C 258.39 630.19 253.14 640.55 250.52 651.43 Q 245.19 673.62 242.32 696.24 C 239.63 717.56 236.59 740.02 236.04 757.75 Q 234.98 791.48 237.98 842.55 Q 239.43 867.18 244.64 891.26 Q 247.76 905.70 255.88 917.90 Q 256.15 918.31 256.08 918.79 C 254.89 926.25 257.03 933.47 255.60 940.95 Q 252.28 958.32 251.77 975.98 C 251.55 983.43 252.85 991.28 253.67 998.93 Q 253.99 1001.95 253.29 1005.00 C 239.19 1067.03 246.93 1130.64 261.77 1190.07 C 266.01 1207.06 266.47 1222.37 264.71 1240.03 C 263.85 1248.62 262.10 1260.41 264.24 1268.75 C 266.05 1275.80 267.54 1287.46 261.78 1293.28 C 256.71 1298.39 242.40 1310.55 240.72 1316.98 C 239.19 1322.86 235.04 1332.26 242.29 1333.71 Q 242.69 1333.79 243.08 1333.66 L 244.23 1333.29 Q 245.05 1333.02 244.81 1333.85 C 242.95 1340.16 249.20 1340.52 253.77 1340.86 C 256.46 1341.06 257.37 1343.60 259.30 1344.71 Q 263.13 1346.91 267.14 1344.43 Q 267.59 1344.15 267.92 1344.56 Q 271.17 1348.61 276.21 1349.09 C 278.90 1349.35 281.27 1347.36 283.62 1346.09 Q 284.10 1345.82 284.44 1346.26 Q 288.33 1351.29 294.72 1351.38 C 295.77 1351.39 297.65 1351.62 298.54 1350.79 Q 301.20 1348.30 306.57 1341.58 C 312.04 1334.74 311.14 1328.85 310.29 1320.16 C 309.43 1311.33 311.17 1303.41 313.76 1295.20 C 315.84 1288.56 313.35 1280.06 314.07 1273.15 C 314.57 1268.39 315.80 1263.68 315.01 1259.02 C 314.06 1253.42 311.98 1247.60 311.31 1242.66 Q 309.57 1229.80 309.57 1219.75 Q 309.57 1192.29 313.54 1161.94 C 315.34 1148.21 319.24 1136.08 324.12 1123.46 Q 325.66 1119.48 326.10 1115.72 C 330.14 1081.34 326.20 1048.44 320.65 1013.26 C 319.84 1008.17 319.39 1002.54 321.72 997.72 C 328.03 984.68 329.28 969.38 329.07 954.15 C 329.01 949.50 327.95 944.55 327.58 939.63 C 327.13 933.64 329.28 925.78 330.82 919.80 C 334.72 904.69 337.76 888.96 341.43 874.30 Q 348.95 844.25 355.42 813.95 C 358.50 799.49 357.70 784.78 357.75 768.06 Q 357.78 756.80 356.36 748.81 Q 356.26 748.24 356.77 748.50 L 363.71 751.99 A 1.07 1.07 0.0 0 0 364.67 751.99 L 371.53 748.56 Q 372.07 748.29 371.98 748.89 C 369.47 765.94 370.28 783.04 371.30 800.17 Q 371.86 809.54 372.73 813.51 C 378.37 839.12 384.90 864.49 390.59 890.08 Q 394.83 909.20 399.51 928.22 C 400.58 932.58 401.13 937.66 400.58 941.57 C 398.11 958.92 398.53 982.22 407.11 998.54 C 408.41 1001.01 408.74 1005.35 408.31 1008.09 C 402.82 1043.75 398.07 1079.22 402.19 1115.33 Q 402.65 1119.34 404.21 1123.44 C 410.53 1140.06 413.55 1150.61 415.25 1164.75 C 418.31 1190.26 420.52 1218.43 416.79 1244.33 C 415.56 1252.86 411.78 1258.57 413.63 1267.80 Q 415.33 1276.21 414.16 1284.74 C 413.11 1292.39 415.65 1298.68 417.31 1305.89 C 419.02 1313.32 418.11 1320.99 417.47 1328.50 C 416.71 1337.55 423.74 1344.86 430.17 1350.90 A 1.48 1.46 -18.7 0 0 430.95 1351.28 Q 439.25 1352.41 444.03 1346.06 Q 444.40 1345.57 444.87 1345.96 Q 453.39 1352.89 460.49 1344.48 Q 460.81 1344.11 461.23 1344.37 C 469.09 1349.37 469.89 1340.80 474.98 1340.71 C 479.52 1340.64 485.21 1340.09 483.54 1333.77 Q 483.38 1333.17 483.97 1333.35 C 488.25 1334.67 490.66 1331.94 490.06 1327.75 C 489.09 1321.04 487.50 1314.41 483.44 1310.30 Q 474.77 1301.53 466.05 1292.83 C 461.19 1287.98 462.25 1276.40 463.74 1270.47 C 466.27 1260.35 464.49 1248.06 463.03 1236.25 C 461.04 1220.05 463.22 1204.28 467.41 1187.04 C 481.60 1128.60 488.89 1065.20 475.23 1006.07 C 473.92 1000.37 475.00 995.00 475.76 989.36 C 477.88 973.68 475.72 958.50 473.08 942.76 C 471.70 934.55 473.60 926.56 472.20 918.79 Q 472.11 918.30 472.39 917.89 C 483.07 902.63 486.53 880.99 488.49 863.25 C 492.12 830.38 492.47 797.34 492.26 764.31 C 492.11 741.56 488.80 719.07 486.12 696.53 C 484.30 681.19 480.76 664.32 477.47 649.99 C 474.89 638.73 469.69 628.87 468.04 617.25 C 465.37 598.45 464.19 580.92 462.40 556.31 Q 460.86 535.06 461.01 522.74 Q 461.13 512.05 463.22 504.00 C 464.54 498.90 468.30 493.91 469.91 489.46 C 474.50 476.74 476.10 461.71 477.56 448.28 Q 477.62 447.74 478.13 447.94 L 481.73 449.35 A 0.77 0.77 0.0 0 1 482.19 449.89 Q 486.03 466.84 492.52 482.96 C 494.16 487.04 496.63 491.75 500.12 495.79 C 505.75 502.32 507.17 507.95 508.00 517.24 C 509.72 536.47 512.15 552.06 518.89 569.24 Q 521.60 576.16 527.50 587.28 Q 543.57 617.60 558.56 648.47 C 566.04 663.89 571.90 675.54 572.85 690.59 Q 572.98 692.57 572.55 700.88 Q 572.12 709.31 573.99 718.25 Q 577.87 736.78 582.37 752.38 C 585.15 761.98 586.32 769.32 586.71 778.53 C 586.92 783.46 587.58 803.53 593.41 804.06 C 599.41 804.61 599.71 774.61 600.39 768.08 A 1.12 1.12 0.0 0 1 600.80 767.33 Q 601.30 766.93 601.62 766.30 A 1.39 1.00 59.0 0 1 603.70 767.19 C 607.27 782.50 609.43 797.55 614.25 812.25 C 615.52 816.12 618.33 820.08 622.81 817.38 A 1.18 1.17 -8.4 0 0 623.35 816.66 Q 624.98 810.32 624.13 803.72 Q 621.83 785.89 618.23 768.64 A 0.53 0.53 0.0 0 1 619.24 768.34 C 622.72 777.06 636.06 814.20 645.24 816.03 C 650.64 817.10 652.13 811.12 650.95 807.31 C 648.59 799.74 644.42 791.59 642.09 784.69 Q 638.29 773.46 635.22 761.98 A 0.15 0.14 -73.3 0 1 635.47 761.84 Q 640.35 767.61 644.90 773.66 C 649.45 779.70 653.60 787.18 658.03 793.93 Q 660.09 797.07 661.70 797.82 C 665.53 799.62 670.61 795.77 669.00 791.28 C 666.63 784.66 661.63 776.66 659.33 772.19 Q 654.22 762.29 648.82 752.53 C 645.43 746.40 644.71 741.93 646.89 735.59 Q 647.08 735.05 647.60 735.27 C 650.55 736.50 652.37 737.45 654.44 740.27 Q 661.27 749.61 673.53 749.92 C 681.25 750.12 680.47 740.89 676.20 738.28 C 671.33 735.31 664.61 731.14 661.97 725.94 C 657.98 718.11 654.62 711.26 649.21 707.28 Q 637.40 698.62 623.76 693.40 C 619.45 691.75 615.12 686.26 613.76 682.47 Q 608.42 667.65 602.70 641.81 Q 594.90 606.62 590.85 578.90 Q 588.46 562.58 587.74 559.15 C 582.02 531.75 569.74 509.81 552.98 487.61 C 551.81 486.06 551.91 485.12 551.97 483.26 Q 552.48 466.57 548.70 449.61 C 546.27 438.71 541.82 430.32 537.44 420.82 Q 537.22 420.36 537.28 419.85 C 539.40 398.94 540.83 377.68 539.05 356.70 C 537.31 336.13 521.34 317.28 504.86 306.23 C 494.75 299.45 485.77 296.97 473.93 298.16 Q 464.41 299.12 453.63 298.41 C 438.05 297.39 418.32 280.58 407.40 270.35 C 405.82 268.87 404.57 267.56 404.10 265.32 Q 401.24 251.68 401.26 237.76 Q 401.26 233.73 404.68 232.04 Q 405.14 231.82 405.39 231.38 C 409.76 223.86 408.77 215.16 408.75 206.85 A 0.38 0.38 0.0 0 1 409.48 206.69 C 410.36 208.62 412.01 211.62 414.22 208.45 C 421.05 198.67 427.45 183.93 425.97 172.00 C 425.49 168.15 422.83 165.91 418.91 167.68","back":"M 1028.14 166.45 Q 1021.22 166.96 1021.73 176.02 C 1022.38 187.38 1027.41 200.00 1034.70 209.56 A 0.95 0.95 0.0 0 0 1035.77 209.88 Q 1037.97 209.08 1038.42 206.75 Q 1038.48 206.41 1038.79 206.56 C 1039.50 206.91 1039.29 219.51 1039.32 221.19 C 1039.41 225.63 1041.33 230.61 1045.48 233.58 A 1.48 1.46 -79.2 0 1 1046.03 234.40 C 1047.33 239.56 1046.14 264.59 1042.52 268.26 Q 1027.38 283.59 1008.53 293.99 C 997.30 300.18 985.80 298.88 972.00 298.05 C 960.16 297.34 951.79 300.13 941.86 307.09 C 927.96 316.83 911.37 335.39 909.24 353.00 C 906.85 372.86 908.46 396.71 910.58 417.97 Q 910.78 420.04 909.97 421.91 C 907.17 428.36 903.51 435.29 901.56 441.28 Q 895.91 458.72 896.11 477.26 Q 896.15 480.50 895.88 486.15 Q 895.86 486.66 895.55 487.06 C 879.06 508.02 866.67 530.27 860.84 556.43 Q 859.72 561.44 857.62 576.15 C 853.15 607.45 846.97 639.64 837.96 670.48 C 835.37 679.35 832.82 690.15 824.31 693.38 Q 811.21 698.35 799.91 706.70 C 793.05 711.77 790.22 717.94 785.68 726.75 C 782.37 733.16 764.38 739.29 769.45 747.77 C 771.01 750.37 774.09 750.14 776.79 749.81 Q 787.25 748.51 793.13 740.83 C 795.42 737.84 797.13 736.50 800.36 735.31 A 0.63 0.63 0.0 0 1 801.16 735.68 C 803.48 741.92 802.81 745.80 799.51 751.90 Q 789.51 770.39 779.78 789.01 C 775.87 796.49 784.57 802.15 789.55 794.51 C 796.72 783.50 802.47 773.20 812.06 762.59 Q 812.62 761.98 812.43 762.79 Q 807.49 783.70 798.01 804.03 Q 795.79 808.79 797.53 813.47 C 798.35 815.65 800.88 816.85 802.95 815.95 C 807.95 813.78 812.74 805.60 815.08 800.58 Q 820.51 788.92 825.23 776.95 Q 827.37 771.52 829.06 768.26 A 0.34 0.34 0.0 0 1 829.69 768.47 C 828.65 774.94 819.92 813.84 825.80 817.66 C 829.47 820.04 832.91 815.52 833.80 812.51 Q 838.73 795.91 842.08 776.75 C 842.69 773.31 843.62 770.03 844.54 766.92 A 1.49 1.49 0.0 0 1 847.45 767.13 C 849.06 778.16 848.17 788.91 850.91 799.85 C 851.57 802.48 854.41 806.12 856.99 802.69 C 861.32 796.92 861.47 780.19 861.98 770.25 C 862.50 760.22 866.62 750.03 868.70 741.28 C 871.57 729.16 876.10 714.64 875.42 700.50 C 874.79 687.46 876.48 676.40 882.00 664.53 Q 899.81 626.31 920.51 587.27 C 928.60 572.01 933.68 558.17 937.01 542.00 Q 938.40 535.24 940.57 511.31 C 941.06 506.01 943.33 501.94 947.04 497.29 C 957.02 484.77 962.25 465.95 965.86 450.00 Q 965.97 449.54 966.40 449.37 L 969.87 447.93 Q 970.39 447.72 970.44 448.27 C 972.08 465.19 974.18 483.97 982.58 498.42 Q 985.25 503.01 985.69 509.45 C 985.76 510.51 986.43 511.70 986.49 512.50 C 986.89 517.68 987.09 525.23 986.82 531.50 Q 985.00 573.11 980.47 614.52 C 978.98 628.13 972.65 640.33 969.66 653.60 C 966.01 669.78 963.02 685.46 961.19 702.45 C 959.24 720.52 956.19 739.39 955.83 756.75 C 954.96 797.57 955.28 842.51 962.96 884.21 C 965.15 896.11 968.33 907.72 975.37 917.40 A 1.48 1.46 27.9 0 1 975.65 918.29 C 975.42 926.20 976.32 934.21 975.03 942.01 C 971.89 960.94 969.95 978.86 973.41 997.96 C 973.70 999.53 973.58 1001.87 973.23 1003.42 C 959.26 1065.20 965.77 1130.76 981.86 1191.82 C 985.51 1205.68 986.32 1220.46 984.96 1234.92 C 984.02 1244.98 982.27 1255.20 983.30 1265.30 C 984.08 1272.87 988.23 1284.18 983.14 1291.21 C 978.75 1297.25 969.45 1303.98 963.07 1312.35 C 960.11 1316.25 952.52 1335.31 964.02 1333.54 Q 964.55 1333.46 964.42 1333.98 C 962.73 1340.59 969.52 1340.54 974.36 1340.95 Q 974.88 1341.00 975.24 1341.37 C 978.64 1344.83 981.89 1347.54 986.66 1344.41 Q 987.11 1344.12 987.46 1344.52 C 992.32 1350.09 997.09 1350.27 1003.06 1346.11 Q 1003.50 1345.80 1003.93 1346.12 C 1005.34 1347.18 1006.20 1348.82 1007.59 1349.58 Q 1011.98 1351.98 1017.08 1351.27 A 1.56 1.56 0.0 0 0 1017.93 1350.86 Q 1024.28 1344.70 1027.72 1339.46 C 1032.14 1332.71 1030.13 1325.67 1029.71 1317.92 C 1029.27 1309.96 1031.28 1302.44 1033.52 1294.97 C 1034.58 1291.42 1034.05 1286.50 1033.60 1282.59 Q 1032.89 1276.40 1034.01 1270.28 C 1034.95 1265.11 1035.75 1261.39 1034.60 1257.67 Q 1029.90 1242.46 1029.51 1227.25 Q 1028.64 1193.94 1033.40 1159.73 C 1035.13 1147.30 1038.92 1136.76 1043.43 1124.47 Q 1045.16 1119.75 1045.73 1115.31 C 1050.32 1079.07 1044.60 1044.51 1039.86 1008.73 C 1038.66 999.61 1043.98 993.60 1045.54 987.51 C 1048.41 976.36 1049.80 959.10 1047.93 945.66 C 1046.88 938.09 1047.48 931.84 1049.21 924.99 C 1053.15 909.35 1056.75 892.75 1059.78 880.01 Q 1066.27 852.63 1072.60 825.22 Q 1075.98 810.55 1076.49 805.75 Q 1077.50 796.31 1077.72 775.82 Q 1077.85 764.16 1076.54 752.58 Q 1076.32 750.58 1075.99 749.61 Q 1075.45 748.03 1076.95 748.78 L 1083.35 752.00 A 1.10 1.08 44.4 0 0 1084.32 752.00 L 1091.50 748.31 A 0.24 0.24 0.0 0 1 1091.84 748.59 Q 1090.49 753.63 1090.36 758.75 C 1089.82 779.99 1089.54 802.24 1094.28 822.45 Q 1101.55 853.47 1108.92 884.46 C 1111.25 894.25 1114.60 910.13 1117.95 922.87 C 1119.13 927.36 1119.75 931.95 1120.50 936.49 C 1121.14 940.42 1119.45 945.92 1119.24 949.53 Q 1118.26 966.73 1121.38 983.68 C 1121.98 986.96 1123.21 991.52 1124.54 993.96 C 1128.10 1000.50 1128.52 1004.24 1127.36 1012.10 C 1122.34 1046.29 1118.51 1078.84 1121.48 1113.50 C 1121.72 1116.32 1122.66 1120.49 1123.91 1123.73 C 1131.43 1143.10 1134.58 1156.98 1136.42 1177.99 C 1138.35 1200.12 1139.52 1222.20 1136.35 1244.60 Q 1135.88 1247.88 1134.29 1252.69 C 1132.00 1259.62 1132.37 1264.14 1133.83 1271.98 C 1135.50 1280.93 1132.17 1288.45 1134.90 1297.66 C 1136.88 1304.36 1138.19 1310.69 1137.87 1317.88 C 1137.58 1324.48 1135.49 1332.56 1139.15 1338.36 Q 1142.72 1344.04 1149.63 1350.84 Q 1149.97 1351.18 1150.46 1351.25 Q 1158.71 1352.49 1163.67 1346.15 A 0.64 0.64 0.0 0 1 1164.58 1346.04 Q 1173.02 1352.85 1180.03 1344.60 Q 1180.37 1344.20 1180.83 1344.46 Q 1186.12 1347.40 1190.08 1343.66 Q 1192.28 1341.58 1193.29 1341.22 C 1197.87 1339.60 1204.81 1341.71 1203.29 1333.67 A 0.39 0.39 0.0 0 1 1203.82 1333.23 L 1204.86 1333.62 Q 1205.25 1333.77 1205.65 1333.71 C 1212.46 1332.65 1209.17 1324.33 1208.00 1319.87 C 1205.32 1309.62 1192.63 1299.79 1185.30 1292.30 C 1180.77 1287.68 1182.22 1274.71 1183.62 1269.06 C 1186.76 1256.35 1182.79 1239.97 1182.29 1230.50 C 1181.63 1217.80 1182.70 1204.60 1185.99 1191.35 C 1200.90 1131.35 1208.58 1067.26 1194.98 1006.22 C 1193.56 999.84 1194.88 994.32 1195.73 987.24 C 1197.46 972.87 1195.00 955.62 1192.39 940.62 C 1191.27 934.14 1192.32 927.30 1192.25 920.69 Q 1192.25 920.23 1192.09 919.80 L 1191.79 918.97 Q 1191.59 918.45 1191.92 918.00 C 1199.57 907.39 1203.42 893.36 1205.50 881.25 C 1212.13 842.49 1212.38 800.86 1211.97 761.04 C 1211.76 739.76 1208.12 718.12 1205.90 696.81 Q 1204.13 679.89 1197.85 652.94 C 1194.73 639.58 1188.50 627.37 1187.05 613.69 Q 1183.04 575.93 1181.17 542.06 Q 1180.56 530.97 1180.85 518.01 C 1180.96 512.91 1182.20 504.08 1184.51 499.52 C 1186.81 494.98 1189.81 490.71 1191.01 485.74 Q 1195.45 467.32 1197.09 448.35 A 0.55 0.55 0.0 0 1 1197.86 447.90 L 1201.25 449.41 Q 1201.74 449.63 1201.86 450.16 C 1205.49 466.08 1210.60 484.96 1221.09 497.82 C 1229.48 508.13 1227.82 523.50 1229.73 535.92 C 1232.46 553.65 1237.66 569.19 1246.25 585.54 Q 1262.47 616.39 1284.56 662.22 Q 1292.50 678.70 1292.52 695.41 Q 1292.52 695.47 1292.20 701.94 C 1291.63 713.32 1294.91 723.91 1297.35 734.87 C 1300.01 746.89 1305.13 759.34 1305.74 772.33 C 1305.98 777.24 1306.66 804.29 1313.58 804.01 A 1.29 1.29 0.0 0 0 1314.41 803.66 C 1321.43 797.06 1316.55 769.02 1321.52 766.22 A 1.20 1.19 -21.2 0 1 1323.27 766.99 C 1326.58 781.35 1329.25 795.81 1332.92 809.99 C 1334.01 814.20 1338.07 821.55 1342.84 816.86 Q 1343.20 816.50 1343.28 816.00 Q 1344.28 809.42 1343.76 805.00 Q 1341.60 786.63 1337.95 768.42 A 0.48 0.48 0.0 0 1 1338.86 768.15 C 1342.31 776.96 1355.85 815.37 1366.03 816.16 C 1370.51 816.50 1371.54 810.41 1370.44 807.06 C 1367.79 798.97 1363.64 790.62 1361.28 783.45 Q 1357.86 773.08 1355.02 762.60 A 0.28 0.28 0.0 0 1 1355.50 762.34 Q 1359.72 767.36 1363.75 772.57 C 1368.83 779.14 1373.25 787.32 1378.17 794.66 Q 1379.99 797.36 1381.66 797.98 C 1384.30 798.97 1389.15 796.58 1388.99 793.50 Q 1388.85 790.72 1386.66 786.58 Q 1378.13 770.40 1369.24 754.42 C 1365.36 747.45 1364.08 743.12 1366.68 735.63 Q 1366.81 735.24 1367.20 735.38 Q 1371.90 736.99 1372.91 738.60 Q 1379.67 749.28 1393.03 749.97 C 1401.07 750.38 1400.13 741.50 1395.34 738.12 C 1390.41 734.62 1384.54 731.36 1381.93 726.55 C 1378.04 719.37 1374.79 711.78 1368.18 706.82 Q 1357.23 698.60 1343.50 693.43 C 1335.51 690.42 1332.54 680.64 1330.25 672.50 C 1321.70 642.22 1315.13 611.45 1310.75 580.29 Q 1308.97 567.62 1308.28 563.74 C 1302.89 533.66 1289.99 510.94 1272.05 486.75 Q 1271.76 486.36 1271.76 485.88 C 1271.89 470.59 1270.82 455.36 1265.92 440.80 C 1263.95 434.94 1260.59 428.46 1257.79 422.38 Q 1256.94 420.52 1257.10 418.48 C 1258.73 398.21 1260.25 378.73 1258.88 358.36 C 1257.39 336.36 1241.06 316.98 1223.33 305.40 C 1213.33 298.87 1205.11 297.32 1193.06 298.08 C 1179.40 298.94 1169.27 299.86 1157.52 293.24 Q 1139.58 283.12 1124.50 267.54 Q 1124.15 267.19 1124.04 266.70 Q 1121.33 254.82 1121.08 242.66 C 1120.97 237.52 1120.38 234.21 1124.51 231.78 Q 1124.95 231.52 1125.21 231.07 C 1128.92 224.63 1129.03 215.40 1128.17 207.76 Q 1128.08 207.01 1128.59 206.65 Q 1128.95 206.40 1129.15 206.78 L 1130.41 209.10 A 1.80 1.79 -42.1 0 0 1133.47 209.25 C 1138.33 202.11 1153.60 172.22 1141.68 166.80 Q 1141.16 166.57 1140.69 166.88 L 1138.38 168.39"};
const BODY_MUSCLE_PATHS = {"shoulders":["M274.06 311.69q3.94 2.77 4.33 8.14.04.48-.38.73c-9.98 5.88-24.35 7.45-28.82 19.75-2.31 6.36-.97 17.35-1.43 23.68q-.55 7.51-5.73 14.07-10.37 13.11-13.81 16.67c-3.41 3.53-6.81 1.76-10.69-.47-15.42-8.87-24.95-25.45-22.52-43.22 2.05-14.92 12.71-25.79 24.06-35.02 16.99-13.82 35.58-17.99 54.99-4.33z","M450.39 320.75q-.95-.52-.7-1.58c1.57-6.61 5.8-9.1 12.14-11.9 24.99-11.03 43.76 3.33 60.17 20.74 20.73 21.99 11.81 56.44-14.82 68.19-4.41 1.94-6.79-1.03-9.81-4.51-5.81-6.7-13.46-14.12-15.99-22.8-3.93-13.43 4.32-27.54-9.64-37.62q-8.22-5.93-17.99-9.08-1.84-.59-3.36-1.44z","M980.66 319.58c.19.14.55.19.65.32a.8.8 0 01-.16 1.15c-6.78 4.75-15.26 9.77-20.03 15.58-6.41 7.78-8.76 16.96-9.44 27.04-.39 5.92-1.68 9.5-5.59 13.43-10.02 10.08-19.04 16.47-31.14 20.41q-.75.25-.75-.55.19-18.4-.09-36.3-.14-9.4 1.07-14.22c4.04-16.07 22.8-33.85 39.68-35.64 9.99-1.06 17.34 2.46 25.8 8.78z","M1227.3 316.44c14.62 9.44 25.48 21.03 25.46 39.51q-.02 20.56-.01 41.37a.37.37 0 01-.51.35c-5.08-2.06-10.41-3.98-14.9-6.97-7.84-5.24-21.14-14.95-21.77-24.95-.69-10.75-2.81-20.85-9.76-29.25-4.68-5.65-12.96-10.58-19.6-15.26q-1.23-.87.01-1.71c4.6-3.13 9.91-6.78 15.25-7.98q13.58-3.03 25.83 4.89z"],"chest":["M272.91 422.84c-18.95-17.19-22-57-12.64-78.79 5.57-12.99 26.54-24.37 39.97-25.87q20.36-2.26 37.02.75c9.74 1.76 16.13 15.64 18.41 25.04 3.99 16.48 3.23 31.38 1.67 48.06q-1.35 14.35-2.05 16.89c-6.52 23.5-38.08 29.23-58.28 24.53-9.12-2.12-17.24-4.38-24.1-10.61z","M416.04 435c-15.12.11-34.46-6.78-41.37-21.48q-1.88-3.99-2.84-12.18c-2.89-24.41-5.9-53.65 8.44-74.79 4.26-6.26 10.49-7.93 18.36-8.56q11.66-.92 23.32-.35c10.58.53 18.02 2.74 26.62 7.87 12.81 7.65 19.73 14.52 22.67 29.75 4.94 25.57.24 64.14-28.21 74.97q-12.26 4.67-26.99 4.77z"],"abs":["M311.02 531.71a.23.23 0 01-.19-.21q-.39-10.47 1.9-20.76c1.26-5.69 7.66-9.9 13.1-12.9 9.09-5.01 18.93-11.15 28.56-14.92a1.24 1.21-42.6 01.94.03c3.28 1.52 4.78 3.87 4.82 7.68q.13 13.16-.15 26.31c-.08 3.85.78 8.39-.87 13.1q-.17.46-.59.72-2.65 1.65-4.29 1.82-21.06 2.22-43.23-.87z","M321 577.76c-5.17-.33-8.71-.44-10-6.26q-3.2-14.44-.59-27.83.11-.53.64-.63c7.58-1.44 13.62-2.45 22.45-4.56q11.5-2.76 23.94-1.88c3.67.26 3.3 3.46 3.4 6.21q.46 12.55-.33 26.94-.25 4.41-1.81 8.08-.21.49-.73.6-1.39.28-3.22.29-16.89.14-33.75-.96z","M347.73 429.25c7.46-3.61 10.5 6.27 10.99 11.52.48 5.06 3.46 30.61-2.78 32.93q-4.17 1.55-6.89 3.33-17.56 11.54-35.88 21.46a1.6 1.59-21.9 01-2.3-.98c-2.87-10.41-10.59-43.96 1.66-50.95 11.3-6.45 23.96-11.86 35.2-17.31z","M350.35 712.81c-29.15-9.93-37.98-100.69-39.47-126.61a.99.99 0 01.33-.8c3.58-3.26 27.61-1.47 34.62-.93 4.41.34 15.27 1.31 15.26 7.53-.05 40.77.64 82.05-1.96 122.72a1.29 1.29 0 01-1.86 1.08c-2.3-1.14-4.12-2.04-6.92-2.99z","M371.94 473.31c-5.46-2.59-2.97-24.26-2.77-29.56.25-6.8 2.41-18.63 12.64-13.8q16.26 7.67 32.34 15.72 6.18 3.1 7.13 10.05c.58 4.26 1.35 8.49 1.07 12.72q-.84 12.55-4.33 26.56-.54 2.16-1.1 3.44-.25.58-.81.31c-15.78-7.29-30.79-19.08-44.17-25.44z","M382.57 533.27c-4.17-.18-9.56-.3-13.15-2.69q-.17-.11-.24-.31c-1.82-5.55-.86-11.17-.96-15.66-.18-8.4-.78-17.36.06-25.71.29-2.85 1.88-4.42 4.15-5.79q.42-.26.91-.19 1.71.25 3.21 1.03 12.48 6.44 24.75 13.26c4.96 2.75 12.21 7.02 13.72 12.41q2.93 10.56 2.39 21.49a.77.76-1.8 01-.67.71q-16.89 2.18-34.17 1.45z","M373.75 578.69c-2.47 0-4.31.22-5-2.7-1.8-7.7-3.05-34.29-.19-38.81q.27-.43.77-.47 13.14-1.24 25.77 1.83c8.41 2.04 14.51 3.01 21.85 4.36a1.29 1.28.6 011.05 1.07q2.16 14.12-.73 28.07c-1.08 5.24-5.22 5.26-10.36 5.63q-14.26 1.04-33.16 1.02z","M416.32 584.73q1.14.41 1.07 1.62c-1.62 26.44-9.96 116.68-40.43 126.74-2.27.75-4.15 2.12-6.35 2.73q-1.18.33-1.3-.89-.86-9.2-1.06-17.75c-.83-35.67-.91-71.2-1.01-106.88q0-.5.31-.89c4.95-6.46 41.69-7.25 48.77-4.68z","M438.7 444.36c-2.09-4.03-.13-6.83 3.63-8.81 10.22-5.36 16.79-11 24.23-18.07a1.71 1.71 0 012.89 1.12c.33 4.74-.81 14.39-5.53 17.22-4.68 2.82-18.74 10.02-24.39 9.14q-.57-.09-.83-.6z","M457.39 466.73c-3.72-1.02-13.2-10.29-16.5-14.49a.52.52 0 01.24-.81q10.94-3.75 21.31-9c3.96-2.01 6.3-5.98 8.57-9.58q.38-.59.55.09c.82 3.33 1.54 6.17.38 9.58-2.55 7.44-7.62 18.79-13.66 24.01a.96.96 0 01-.89.2z","M428.43 487.22c-1.01-1.79-.82-4.55-.71-6.72q.78-15.08.48-30.27-.01-.59.55-.4 1.72.59 3.02 1.64 11.58 9.37 18.82 16.95c3.86 4.05-16.2 17.42-19.56 19.48a1.87 1.86 59.6 01-2.6-.68z","M470.76 456.28a.25.25 0 01.44.13q2.03 19.67-9.8 35.22-.37.48-.6-.08c-1.37-3.29-5.86-16.13-3.51-18.91q6.3-7.47 13.47-16.36z","M452.27 478.5c1.13.49 4.28 12.47 4.78 14.38q.14.5-.23.88-1.29 1.35-2.65 2.41-10.44 8.12-21.76 14.97-1.49.9-2.91 1.33a.81.81 0 01-1.05-.71q-.73-8.62.67-17.15.08-.47.44-.8c1.74-1.6 21.96-15.73 22.34-15.51a.58.03 31 00.37.2z","M428.22 519.14q.11-.36.43-.56 15.3-9.66 28.83-21.69a.43.42-22.6 01.71.29c.51 8.26 2.25 18.67-4.46 25.4q-11.8 11.84-25.03 22.09-.43.34-.49-.2c-.75-6.82-1.97-18.92.01-25.33z","M456.54 524.55a.04.04 0 01.07.02q1.52 13.67.41 27.4-.04.47-.28.88c-4.97 8.3-18.23 19.62-27.88 22.63q-.57.17-.58-.43-.05-10.31-.27-20.53-.1-4.8 2.63-7.09c8.54-7.13 18.56-14.62 25.9-22.88z","M418.89 657.11q-1.12-1.67-.43-3.63 3.27-9.38 4.04-18.23 1.97-22.81 3.58-45.65c.16-2.32.72-6.41 2.84-7.71q14.97-9.23 27.16-21.93.41-.42.71.08 1.29 2.15 1.53 4.2 3.23 27.74 3.13 56.8a1.3 1.28-24.5 01-.33.86q-12.74 13.93-25.55 27.75c-4.8 5.17-9.09 7.87-15.73 7.96q-.61.01-.95-.5z","M264.21 435.53c-4.88-3.13-5.75-12.11-5.39-17.36q.03-.53.51-.75 1.8-.84 3.43.85 10.05 10.45 22.57 16.9c3.64 1.89 5.54 3.62 4.79 7.8q-.42 2.35-2.82 1.87-12.45-2.49-23.09-9.31z","M287.33 452.44c-4.05 4.46-10.38 11.38-16.28 14.3a.84.83 51.1 01-.9-.1c-6.29-5.17-12.54-18.97-14.21-25.09q-.91-3.34.85-8.81.12-.39.35-.05c2.41 3.65 4.59 7.74 8.67 9.76q10.18 5.05 21.27 9.01a.61.61 0 01.25.98z","M297.3 487.82c-7.36-4.23-16.68-11.37-20.55-17.57q-.32-.5.09-.92 8.72-9.04 19.84-17.87 1.46-1.17 2.81-1.67a.44.44 0 01.59.43c-.28 10.08-.4 20.42.65 30.43q.34 3.26-.68 6.15a1.9 1.9 0 01-2.75 1.02z","M257.35 456.18l13.68 16.63a1.86 1.82 22.9 01.4.95c.59 5.4-2.02 12.71-3.8 17.56q-.3.84-.84.13-11.85-15.55-9.77-35.17.04-.45.33-.1z","M271.69 494.07a1.53 1.52-61.8 01-.49-1.64l4.2-13.58a.98.98 0 011.51-.5c3.2 2.32 21.89 14.05 22.26 16.7q1.15 8.32.66 16.79a.9.9 0 01-1.34.73q-14.24-8.05-26.8-18.5z","M299.35 544.62c-7.52-6.03-16.15-13.43-24.23-21.24-6.93-6.7-6-17.19-4.88-26.06a.44.44 0 01.72-.28q13.31 11.88 28.41 21.38.43.27.6.75c2.33 6.49.95 18.37-.07 25.23q-.09.59-.55.22z","M299.09 575.53c-7.98-3.65-27.57-15.86-28.06-26.2q-.57-11.91.46-24.3a.36.36 0 01.67-.15q.84 1.36 2.17 2.54 10.59 9.45 21.68 18.31c4.37 3.49 4.34 6.46 4.16 11.74q-.3 8.82-.42 17.64-.01.72-.66.42z","M308.17 657.58c-7.39-.13-12.41-4.13-17.14-9.39q-11.86-13.22-23.92-26.37-.33-.36-.33-.85.09-23.18 1.81-46.22.53-7.13 2.49-14.41a.71.71 0 011.2-.3q11.54 12.06 25.82 21.1 3.36 2.12 3.62 5.17 2.06 23.67 3.86 47.36c.58 7.62 2.31 13.36 4.43 20.82q.47 1.66-.96 2.79-.39.31-.88.3z"],"back":["M285.01 307.01a.89.89 0 01-.11-1.64q19.44-9.61 35.65-24.8 1.68-1.57 3.31-.31.4.32.45.82 1.25 12.61-1.57 25.41c-.74 3.32-2.55 4.23-5.9 4.48q-16.02 1.24-31.83-3.96z","M414 311.19c-5.24-.12-7.81-.64-8.9-6.27q-2.33-12.09-1.17-23.94.06-.61.61-.89 1.66-.85 3.65.99 16.12 14.87 33.97 23.63 3.65 1.79-.27 2.89-13.88 3.91-27.89 3.59z","M1071.06 308.94c5.6 4.92 6.96 17.83 7.43 24.88q1.5 22.3.93 44.68-1.2 46.76-5.66 94a.57.56 3.7 01-.59.51q-.68-.03-.94-1.01-4.29-15.9-9.79-25.19c-10.24-17.31-18.8-31.84-25.59-49.4-10.19-26.38-15.6-54.28-26.46-80.58q-3.07-7.43-7.61-14.07-.3-.43.2-.6 12.47-4.28 25.48-4.85c5.54-.25 12.15.86 18.32 1.41 9.7.87 16.77 3.6 24.28 10.22z","M1163.98 302.12a.43.43 0 01.22.65q-7.08 10.77-11.41 23.37c-10.53 30.61-17.8 62.94-31.3 91.07-5.11 10.64-15.17 25.22-20.12 36.26q-4.08 9.08-6.59 18.83a.77.77 0 01-1.51-.12q-4.27-45.15-5.52-90.99c-.56-20.28-.74-39.92 2.75-60.43 1.04-6.13 2.77-9.98 7.85-13.85 9.8-7.48 18.02-7.73 30.1-9.11 12.02-1.39 23.92.4 35.53 4.32z","M987.06 381.44c-8.48-5.06-14.14-13.28-18.82-22.92q-5.3-10.92-6.46-14.04c-1.49-4.01 35.14-19.22 39.61-20.97q2.75-1.08 4.33-.72c4.33.96 6.61 9.96 7.46 13.7q5.43 23.89 14.65 55.74.78 2.7-.88 4.39c-5.37 5.5-34.69-12.08-39.89-15.18z","M1017.44 583.31q-9.11-9.57-16.97-22.03-2.28-3.62-2.91-7.25c-3.28-18.82-5.77-38.04-10.52-56.55-3.53-13.73-4.74-25.19-6.61-41.43-.85-7.35-5.67-13.34-8.22-18.75q-4.93-10.47-6.44-22.88-.33-2.72 1.89-1.11c7.25 5.27 16.36 6.16 26.91 7.56 8.86 1.19 23.41-3.18 28.94-10.76 3.34-4.58 4.7-6.5 8.86-8.77a.67.66-26.4 01.92.3q10.02 21.8 19.93 43.78c2.56 5.69 12.11 15.88 10.77 21.83-3.65 16.09-9.88 31.96-16.24 47.13-9.72 23.21-18.61 46.72-27.2 70.36q-.24.67-.88.35-1.03-.52-2.23-1.78z","M1017.71 404.73c-23.86 13.25-54.31 7.11-60.45-22.75-1.2-5.81-2.5-15.84.64-20.55 3.63-5.44 7.17 4.18 8.17 6.14 7.71 15.14 31.62 29.16 48.2 31.13q1.84.21 5.26 2.06.4.21.26.64-.86 2.65-2.08 3.33z","M1141.45 397.63a2.17 2.14-3.6 01-1.88-1.64q-.71-2.97.18-5.95 8.74-29.19 11.75-43.29c1.73-8.11 3.07-16.77 6.94-22.08 1.92-2.62 4.28-2.27 7.19-1.15q20.52 7.9 39.09 18.77a1.37 1.36 25.9 01.58 1.67c-6.05 15.46-12.98 30.84-28.43 39.45-9.45 5.26-25.83 15.17-35.42 14.22z","M1149.69 404.8q-2.04-1.15-2.45-3.5-.09-.53.41-.75c4.64-2.04 9.78-2.51 14.63-3.87 11.01-3.1 22.03-10.83 30.34-18.57q6.33-5.89 7.58-8.93c1.02-2.49 3.79-9.5 7-9.46q.52.01.87.39 2.71 3.01 2.81 7.2c.33 13.77-2.24 26.93-13.26 35.95-13.88 11.36-33.12 9.94-47.93 1.54z","M1161.19 419.98c6.1 1.57 11.6.99 17.75.06 8.36-1.27 14.83-2.76 21.34-7.27a.54.53 74.1 01.84.47q-.64 11.88-5.76 22.85c-2.42 5.2-6.64 10.84-8.04 16.67q-1.02 4.24-1.43 8.92-1.64 18.72-6.34 37.47c-4.73 18.91-7.13 38.67-10.8 57.85q-.24 1.24-2.2 4.3c-4.57 7.14-12.22 19.43-19.34 23.88a.44.43-25.6 01-.64-.22c-8.26-22.57-16.6-45.11-25.91-67.23-6.67-15.85-13.27-32.14-17.27-48.42q-1.58-6.41 2.91-12.01 5.21-6.51 8.57-14.14 9.25-21 19.01-41.64a.47.47 0 01.65-.21q6.17 3.37 9.51 9.64c2.45 4.6 12.22 7.75 17.15 9.03z","M986.76 627.1c-3.13-13.13-7.31-49.77 7.27-58.07 2.4-1.37 4.8-.82 6.7 1.29 6.15 6.8 16.22 18.56 18.77 28.15a1.35 1.3 52.6 01-.11.98c-2.51 4.53-9.96 8.09-15.83 11.36q-5.47 3.06-11.33 10.52c-1.23 1.56-2.6 4.3-4.5 6.06a.59.58-28.2 01-.97-.29z","M1023.15 607.96a2.06 2.04-74.3 01-.94-1.69c-.17-10.98 5.04-24.58 8.79-34.9q15.61-42.83 36-83.59a1.11 1.1-62.5 011.51-.48c1.25.66 3.21 12.98 3.46 15.08q6.94 59.25 2.82 116.88-.62 8.66-3.1 19.37-.13.53-.59.24l-47.95-30.91z","M1090.76 581.75q.62-5.16 0-10.27.22-29.79 3.05-59.5 1.1-11.58 3.91-22.88.31-1.27.44-1.43 1.08-1.43 1.88.17 23.38 46.97 40.14 96.18c1.8 5.28 5.84 16.69 4.38 22.96a1.64 1.64 0 01-.71 1.01l-47.63 30.72q-1.12.72-1.34-.6-4.54-28-4.12-56.36z","M1151.19 603.31q-5.39-3.38-2.19-9.05 8.03-14.22 17.88-24.62c3.49-3.69 9.04.89 10.97 3.99q2.92 4.66 3.8 10.14 3.5 21.77-1.21 43.02a.96.96 0 01-1.77.28c-6.92-11.85-16.03-16.56-27.48-23.76z"],"legs":["M292.42 935.6q-.95-.52-1.57-1.4-4.1-5.79-7-13.53-7.8-20.79-13.3-42.33c-9.06-35.53-19.33-71.36-25.03-107.59-5.33-33.86 4-74.19 20.7-103.37q.35-.62.53.07c14.44 55.57 39.03 107.94 41.45 165.34 1.11 26.34.66 52.96-3.6 79.03-.63 3.83-4.73 27.81-12.18 23.78z","M275.11 942.93q-2.42-2.18-3.57-5.24c-3.98-10.61-7.68-21.02-12.81-31.32-7.85-15.76-10.77-34.56-13.2-51.46-2.11-14.63-2.31-31.47-3.93-47.18-.22-2.16-1.04-12.78.46-13.79q1.36-.92 2.08.55c1.5 3.08 3.12 6.12 3.66 9.58q8.21 52.38 26.36 102.15c2.87 7.87 9.98 30.5 1.85 36.74a.71.7-42.5 01-.9-.03z","M322.69 945.72c-3.73 6.14-10.77-2.43-12.6-5.6-3.16-5.47-2.62-14.93-1.78-20.81 4.03-28.09 5.6-52.81 3.48-80.78q-.06-.79.28-.08 15.77 32.83 14.26 68.9c-.4 9.54-2.94 22.48-2.91 34.13q.01 3.02-.73 4.24z","M437.82 933.52c-8.9 14.18-15.15-26.74-15.46-29.25q-5.26-43.04-1.19-86.08c4.9-51.8 26.91-99.32 40.38-150.92q.18-.66.5-.06c17.25 31.67 25.39 68.28 20.54 104.36q-2.29 17.02-8.71 42.76-7.56 30.25-15.2 60.47-6.13 24.25-15.06 47.61-1.83 4.79-5.8 11.11z","M451.79 942.6c-9.95-10.01 4.97-42.91 8.94-55.41q12.55-39.53 19.27-80.47c.49-2.97 2.64-12.34 5.41-13.28a.83.83 0 011.09.64q.74 4 .45 7.92c-1.99 26.52-3.37 58.99-11.01 87.73q-2.53 9.5-7.46 18.8c-4.38 8.24-6.97 16.72-10.08 25.27q-1.66 4.54-4.55 8.63a1.35 1.35 0 01-2.06.17z","M406.69 946.81c-3.24-2.77-1.48-10.64-2.01-14.71q-2.23-17.18-2.57-22.16c-1.75-25.07 3.61-49.11 13.98-71.92q.23-.51.2.05c-1.2 19.15-1.28 38.18.83 57.38q1.68 15.4 3.39 30.8c.43 3.92-.31 9.71-2.09 13.33-1.62 3.28-7.58 10.77-11.73 7.23z","M280.26 647.4c11.65 10.74 22.18 21.04 31.02 34.3 15.82 23.72 27.55 49.72 34.01 77.58 1.34 5.79-6.14 20.34-12.62 20.22q-.52-.01-.72-.49-.67-1.59-1.21-3.13c-14.68-41.71-27.96-79.71-46.87-117.01-1.9-3.74-3.05-7.33-4.06-11.2a.27.27 0 01.45-.27z","M331.64 898.32q-.17.57-.23-.02c-2.23-25.01-8.47-50.09-14.25-74.53q-19.4-82.1-42.46-163.69-.58-2.08.33-.13c19.88 42.53 38.94 86.51 51.64 132.07 9.49 34.06 15.59 71.67 4.97 106.3z","M334.46 789.17c1.56-2.63 14.39-20.38 16.2-20.37a1.71 1.7-89.2 011.7 1.76q-1.12 34.88-7.4 68.95c-.38 2.06-1.41 4.27-2.16 6.23q-.24.62-.34-.04-3.68-25.45-8.44-50.7c-.34-1.79-.63-4 .44-5.83z","M395.47 779.4c-5.7 1.33-11.34-11.87-12.46-15.86q-.61-2.18-.02-4.65 10.17-42.64 35.06-78.81c9.47-13.77 18.83-22.36 29.85-32.56q.55-.5.4.22-1.12 5.7-3.73 10.83c-19.44 38.38-33.3 79.2-47.77 119.65a1.84 1.83-86.4 01-1.33 1.18z","M453.65 658.99q.67-1.43.23.09-26.73 93.75-48.63 189.74c-1.98 8.7-3.66 17.9-5.44 26.84q-2.19 11.05-2.78 22.43a.15.15 0 01-.3.04c-8.18-24.48-6.74-51.98-1.87-76.86 11.07-56.49 34.44-110.42 58.79-162.28z","M377.91 768.67c1.49.84 1.76 1.49 2.66 2.66q6.16 8.04 12.23 16.13c1.88 2.52 1.97 4.18 1.38 7.45q-4.57 25.23-8.43 50.57-.11.71-.4.05-1.89-4.29-2.54-8.09-5.57-32.28-6.98-65.01-.09-2 .81-3.44a.95.94 30.8 011.27-.32z","M1045.06 626.19q1.42.61 4.11 4.4.27.39-.19.52c-14.47 4.12-26.13 7.4-38.13 15.77q-15.37 10.71-30.53 21.6a.55.54 74.9 01-.86-.5c1.19-13.13 10.35-35.23 20.46-45.06 9.14-8.88 34.99-1.11 45.14 3.27z","M1007.94 762.81c-16.94-16.64-29.37-37.66-31.47-61-2.06-22.84 15.63-34.95 32.18-45.71 8.2-5.33 46.51-27.32 54.37-17.65 5.92 7.29 13.38 15.84 15.44 25.21q3.01 13.63 2.44 27.6-.94 22.59-6.27 44.49c-2.43 9.96-2.9 17.16-2.59 26.75.47 14.83-18.52 17.18-29.12 14.07-6.38-1.87-13.79-4.83-21.35-6.25q-7.39-1.38-13.63-7.51z","M1117.94 631.04q-.13-.03-.27-.06-.12-.02-.06-.13 2.58-4.2 7.05-5.92 12.71-4.87 26.13-5.81c12.93-.91 17.1 3.08 23.28 13.06 5.71 9.22 13.32 24.7 13.44 36.06q.01.76-.61.32-16.65-11.74-33.2-23.51c-10.03-7.14-23.72-10.58-35.76-14.01z","M1124.12 776.61c-9.28 2.74-26.75 1.29-28.86-10.88-1.05-6.03.27-14.88-1.3-23.27q-.54-2.94-2.15-9.35c-3.2-12.81-4.02-23.33-5.08-35.27-1.07-12.03-.57-22 1.64-33.17q1.1-5.6 4.19-10.41 8.74-13.58 11.87-16.59c4.96-4.77 15.84.18 21.19 2.11q19.7 7.12 40.17 21.43c9.59 6.7 19.29 14.31 22.93 25.17 4.81 14.37-.65 33.88-7.42 46.87q-7.79 14.97-21.39 28.9-6.74 6.9-15.26 8.36c-7.07 1.21-13.68 4.08-20.53 6.1z","M963.27 741.53a.71.7 31.7 011.19-.28q1.51 1.62 2.47 3.99c4.6 11.41 8.93 22.66 11.07 34.72 3.38 19.14 4.84 38.23 3.12 57.74q-1.68 19.06-2.99 38.15c-.51 7.55-.88 15.71.07 23.18q1.08 8.54 1.39 17.57a.52.52 0 01-.98.25q-1.03-2.07-1.8-4.62-5.13-16.92-7.25-34.49-5.01-41.45-6.86-83.17-1.09-24.75-.07-49.51.06-1.59.64-3.53z","M1030.2 791.53q.17-.36.38-.03c5.26 8.11 9.94 16.15 12.47 25.64 3.12 11.72 5.87 24.36 4.31 36.24q-.5 3.8-3.57 14.02c-10.75 35.81-12.83 74.2-18.5 111.1q-.82 5.4-2.55 10.55-.23.68-.59.07c-4.72-8.07-5.18-25.09-5.34-34.81-.7-43.69 1.92-87.82 6.38-131.28 1.41-13.74 1.99-21.15 7.01-31.5z","M998.81 761.94q14.07 14.17 20.1 33.62c.98 3.15-.78 9.61-.93 12.91q-1.3 27.63-2.3 55.27c-.55 15.31-1.54 30.27-5.12 45.26q-8.62 36.18-22.76 68.73-3.65 8.41-10.15 17.19-.45.61-.41-.14c.11-1.93.82-4.15.99-5.71q2.45-22.72 6.08-45.26c2.83-17.66 4.18-35.95 4.33-52.37.33-36.43-.75-73.34 1.47-109.68.33-5.32 1.07-16.16 4.7-20.25q.33-.36.81-.45 1.95-.37 3.19.88z","M1052.52 855.62a.04.04 0 01.08.01q1.07 9.9 2.17 19.87.33 3.04-2.37 14.18c-3.83 15.8-8.15 31.11-8.9 47.47-.99 21.61-3.11 45.66-9.92 66.3q-1.49 4.52-.87-.2 3.38-25.36 3.7-51.99c.05-3.74-.4-10.32.2-15.58 2.19-19.2 7.39-38.25 11.75-57.05 1.78-7.64 2.93-15.21 4.16-23.01z","M1183.25 947.53c2.57 14.85 4.32 31.11 6.22 46.14q.35 2.74-1.11.39c-14.67-23.67-23.34-52.15-30.55-79.32q-5.08-19.14-5.97-39.05-1.36-30.37-2.44-60.74c-.22-6.09-2.56-15.63-.55-21.57q5.87-17.35 18.96-31.07c10.77-11.28 10.17 46.55 10.16 48.97-.13 41.09-.45 74.18 1.91 110.07.57 8.75 1.88 17.53 3.37 26.18z","M1136.43 791.52q.27-.42.49.03c3.12 6.46 4.84 12.26 5.68 19.83 5.07 45.8 8.05 94.61 7.56 140.76-.13 11.8-.46 26.22-5.13 37.08a.44.44 0 01-.83-.06q-2.51-9.14-3.69-18.41-3.54-27.64-7.36-55.24c-2.49-18-5.47-35.67-11.09-52.26q-4.35-12.82-2.08-26.75c1.76-10.77 3.58-21.61 8.46-31.16q3.58-6.99 7.99-13.82z","M1115.03 856.73c2.03 18.72 7.11 37.44 11.47 55.77 2.25 9.46 3.94 19.51 3.95 30.11q.02 31.7 4.08 63.16.16 1.26-.29.07-2.7-7.15-4.19-14.6c-4.44-22.21-5.71-40.52-6.87-61.23-.24-4.24-1.19-9.64-2.23-13.92q-3.94-16.25-7.7-32.55c-2.09-9.04.08-18.69 1.6-27.66q.07-.38.32-.09.16.19.01.4-.19.24-.15.54z","M1202.61 741.08a.44.44 0 01.72.03c.52.82.9 1.86.95 2.91q.73 15.98.37 31.97-1.16 52.95-7.85 105.49-1.88 14.74-5.97 29.04-1 3.52-1.92 4.95-1.57 2.47-1.39-.37c.58-9.44 1.83-19.17 1.71-28.16-.32-24.52-4.94-49.11-3.95-72.75.69-16.54 2.5-33.51 7.54-49.38q2.99-9.4 6.61-18.6.74-1.88 3.18-5.13z","M1070.06 785.19c2.95 1.36 1.8 10.43 1.49 13.04q-3.98 33.27-14.66 64.61a.39.39 0 01-.76-.17c.9-7.05 2.31-14.29 2.16-20.92q-.68-30.14-18.71-54.52-.29-.39.18-.49c7.42-1.52 23.53-4.69 30.3-1.55z","M1127.24 787.66c-15.99 21.49-22.3 48.51-16.08 74.83a.47.46-63.2 01-.88.29q-1.99-4.69-3.65-10.24-8.29-27.75-11.6-56.54c-.65-5.71-1.1-11.77 6.87-11.9q13-.19 25.68 2.83a.31.24 41.2 01.1.53q-.12.01-.27.07-.1.04-.17.13z"],"calves":["M252.09 1032.57c.24-3.71 2.14-22.17 4.63-24.18a1.03 1.02-17.9 011.67.85c-.45 7.89-1.27 16-1.49 23.45q-.57 18.93-.66 37.88-.02 3.63.34 6.85c2.08 18.76 5.56 37.32 9.3 55.8 3.82 18.84 9.13 37.64 13.11 56.63q2.44 11.68 2.08 17.95c-.32 5.7-3.08 20.49-8.51 23.92a.62.62 0 01-.84-.16q-1.2-1.65-.95-3.55c.92-7.26 1.45-14.15-.3-21.52q-8.25-34.74-13.62-59.06c-1.86-8.44-3.17-17.18-3.93-26.3q-3.69-44.24-.83-88.56z","M315.01 1025.17a.16.16 0 01.32.02c4.06 25.75 8.98 52.72 8.71 77.81q-.13 12.06-5.74 26.31c-7.2 18.3-8.93 38.57-15.95 56.93q-.18.48-.21-.03c-1.87-34.47-5.67-65.91-8.56-103.28q-.97-12.49 4.44-23.14 7.47-14.69 15.14-29.29c.81-1.55 1.35-3.62 1.85-5.33z","M455.5 1231.67c-7.13-5.81-9.23-24.34-8.2-31.86 1.41-10.32 4.63-23.14 7.98-36.33q9.54-37.46 15.15-75.74c2.86-19.5 1.53-40.15.75-59.8-.22-5.67-.98-12.51-1.23-18.75a.97.97 0 011.87-.4c.35.86.92 1.76 1.12 2.68q2.96 14.31 3.31 20.53 2.37 43.28-.49 84.75-1.21 17.42-5.43 35.77-6.33 27.51-12.84 54.98-2.01 8.49-.11 18.36c.36 1.9.11 3.95-.68 5.55a.79.79 0 01-1.2.26z","M412.77 1025.44a.14.14 0 01.27-.04c4.88 11.62 10.93 22.01 17.28 34.78 4.07 8.19 4.71 14.41 4.1 24.25-2.13 34.3-6.27 68.85-8.45 101.59q-.05.69-.31.05-1.48-3.67-2.28-6.75c-4.34-16.75-8.78-38.38-16.39-57.57q-1.4-3.55-2.2-10.11c-1.78-14.73-.2-31.24 2.04-45.88q3.06-20.02 5.94-40.32z","M982.69 1149.31c-3.07-2.23-3.98-6.24-5.24-11.03-7.19-27.14-7.88-53.18-6.67-82.78q1.03-25.29 9.23-47.45c4.77-12.89 15.33-24.77 23.79-36q.82-1.09.74.27c-1.37 22.86-2.72 45.67-3.11 68.49-.52 30.56-1.51 61.11-.42 91.68.24 6.83-2.77 16.29-10.08 18.37q-4.39 1.25-8.24-1.55z","M983.99 1163.56c7.15-5.59 16.16-.63 17 8.23q4.31 45.02 5.22 90.26c.16 8.25-.8 15.79-2.19 23.65q-.45 2.52-1.43 3.66-.95 1.11-1.22-.33c-5.03-26.7-8.28-53.49-11.87-80.36q-1.68-12.52-3.24-18.71-2.04-8.12-5.53-18.24c-1.03-3 .8-6.25 3.26-8.16z","M1013.69 1150.31c-4.8-2.61-4.66-16.17-4.36-20.75 2.34-36.49 3.44-73.94 1.04-110.45-1.03-15.55.02-31.49.62-47.06q.03-.66.25-.03c2.28 6.45 4.52 12.88 7.39 19.11 5.12 11.14 11.5 22.91 14.83 33.92q2.34 7.74 3.97 16.46 5.3 28.43 5.62 56.09c.2 18.32-7.9 40-22.63 51.79q-3.42 2.73-6.73.92z","M1014.14 1164.37c7-1.83 14.1 2.2 14.11 9.95q.06 29.04-5.62 57.41c-3.87 19.28-6.24 38.23-8.43 57.48a.37.37 0 01-.74-.01q-3.12-43.48-3.58-86.64-.15-14.16.76-28.3c.18-2.83.02-8.98 3.5-9.89z","M1172.94 1149.31c-6.06-4.56-6.94-11.4-6.8-19.4.96-52.67-.49-105.31-3.54-157.9q-.04-.72.41-.16 7.96 10.07 15.43 20.44c9.11 12.64 13.61 28.98 15.78 44.21 4.96 34.71 3.75 72.94-5.97 106.5-1.97 6.82-9.18 10.93-15.31 6.31z","M1144.41 1147.33q-17.19-17.37-20.08-40.86-.89-7.22-.13-19.97 1.18-20.06 4.69-41.33c2.33-14.1 5.8-25.22 12.41-38.61q8.19-16.59 14.35-34.15a.14.13-37.7 01.26.03q1.01 15.71 1.26 31.44c.18 11.61-1.34 24.91-1.58 36.43-.72 34.7 1.22 62.05 2.06 93.19.17 6.32-1.1 26.1-13.24 13.83z","M1173.74 1161.73c6.88-2 14.34 3.23 11.98 10.91-2.24 7.3-4.78 14.44-5.99 21.96-5.07 31.52-8.04 63.18-14.13 94.6a.72.71-61.9 01-1.21.37c-.14-.14-.35-.39-.4-.59q-3.53-13.58-3.19-28.23 1.04-44.67 5.06-87.04c.58-6.1 1.93-10.25 7.88-11.98z","M1154.32 1165a1.58 1.57-84.6 01.97 1.18c.79 4.42 1.42 8.78 1.57 13.4.96 29.17-.47 62.66-2.04 90.23q-.78 13.79-1.39 19.52a.23.23 0 01-.45 0c-2.79-21.25-5.41-41.99-9.64-63.03-3.44-17.08-4.29-34.91-4.68-52.3-.19-8.37 8.99-11.61 15.66-9z"]};

function MuscleMap({ groups }) {
  const active = new Set(groups);
  const fill = (g) => (active.has(g) ? MUSCLE_COLORS[g] : "rgba(255,255,255,0.10)");
  const line = (g) => (active.has(g) ? MUSCLE_COLORS[g] : "rgba(255,255,255,0.26)");
  const glow = (g) => (active.has(g) ? `drop-shadow(0 0 7px ${MUSCLE_COLORS[g]}bb)` : "none");
  const zoneStyle = (g) => ({ transition: "fill .25s ease, stroke .25s ease, filter .25s ease", filter: glow(g) });
  return (
    <div>
      <div className="flex justify-around px-2">
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 0.3 }}>спереди</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 0.3 }}>сзади</span>
      </div>
      <svg width="100%" viewBox="30 95 1390 1280" style={{ display: "block", maxWidth: 360, margin: "0 auto" }} role="img" aria-label="Силуэты тела спереди и сзади с детализированными группами мышц">
        <path d={BODY_OUTLINE.front} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.24)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <path d={BODY_OUTLINE.back} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.24)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        {MUSCLE_ORDER.map((g) => (
          <g key={g} style={zoneStyle(g)}>
            {BODY_MUSCLE_PATHS[g].map((d, i) => (
              <path key={i} d={d} fill={fill(g)} stroke={line(g)} strokeWidth="1.1" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-2">
        {MUSCLE_ORDER.map((g) => {
          const on = active.has(g);
          return (
            <div key={g} className="flex items-center gap-1.5">
              <span className="rounded-full flex-shrink-0" style={{ width: 9, height: 9, background: on ? MUSCLE_COLORS[g] : "rgba(255,255,255,0.14)", boxShadow: on ? `0 0 6px ${MUSCLE_COLORS[g]}99` : "none", transition: "all .25s ease" }} />
              <span style={{ fontSize: 12, color: on ? "#fff" : MUTED, fontWeight: on ? 700 : 400, transition: "color .25s ease" }}>{MUSCLE_LABELS[g]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Маленькая цветная точка группы мышц — для карточек своих тренировок
function MuscleDots({ groups }) {
  if (!groups.length) return null;
  return (
    <div className="flex items-center gap-1">
      {groups.slice(0, 4).map((g) => (
        <span key={g} className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: MUSCLE_COLORS[g], boxShadow: `0 0 6px ${MUSCLE_COLORS[g]}99` }} />
      ))}
    </div>
  );
}

// Один «стаканчик» на 250 мл: SVG-силуэт стакана с заливкой, которая плавно
// поднимается/опускается при наполнении, плюс лёгкий пружинный подскок (waterPop)
// в момент тапа.
function WaterCup({ T, filled, bump, onClick, label }) {
  const rid = useId();
  const w = 30, h = 40, pad = 4;
  const topW = w, botW = w * 0.7, sidePad = (topW - botW) / 2;
  const pts = `${1},${pad} ${w - 1},${pad} ${w - sidePad},${h} ${sidePad},${h}`;
  return (
    <button onClick={onClick} aria-pressed={filled} aria-label={label} className="relative flex-shrink-0"
      style={{ width: w, height: h, animation: bump ? "waterPop .4s cubic-bezier(.34,1.56,.64,1)" : "none" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <clipPath id={`cupclip-${rid}`}><polygon points={pts} /></clipPath>
          <linearGradient id={`cupgrad-${rid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.b} />
            <stop offset="100%" stopColor={T.a} />
          </linearGradient>
        </defs>
        <g clipPath={`url(#cupclip-${rid})`}>
          <rect x="0" y="0" width={w} height={h} fill="rgba(255,255,255,0.05)" />
          <rect x="0" y="0" width={w} height={h} fill={`url(#cupgrad-${rid})`}
            style={{ transform: filled ? "translateY(0px)" : `translateY(${h}px)`, transition: "transform .5s cubic-bezier(.34,1.56,.64,1)" }} />
          {filled && <ellipse cx={w / 2} cy={pad + 2} rx={botW / 2} ry="2" fill={T.b} opacity="0.6" />}
        </g>
        <polygon points={pts} fill="none" stroke={filled ? T.a : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinejoin="round" style={{ transition: "stroke .3s ease" }} />
      </svg>
    </button>
  );
}

// Ряд стаканчиков воды по 250 мл: показывает норму на день и текущее наполнение,
// тап по стаканчику наливает воду до него (или, если он уже полон, опустошает всё
// начиная с него — удобно поправить лишний тап).
function WaterCups({ T, water, target, onSet }) {
  const cupsTarget = Math.max(1, Math.round(target / 250));
  const cupsFilled = Math.round(water / 250);
  const totalCups = Math.max(cupsTarget, cupsFilled + 1);
  const [bumpIndex, setBumpIndex] = useState(null);
  const tap = (i) => {
    onSet(i < cupsFilled ? i * 250 : (i + 1) * 250);
    setBumpIndex(i);
    setTimeout(() => setBumpIndex(null), 400);
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Array.from({ length: totalCups }, (_, i) => (
        <WaterCup key={i} T={T} filled={i < cupsFilled} bump={bumpIndex === i}
          onClick={() => tap(i)} label={i < cupsFilled ? `Убрать стаканы воды с ${i + 1}-го` : `Налить стакан воды №${i + 1}`} />
      ))}
    </div>
  );
}

/* ============ Алгоритм тренировок ============
   1. Цель и уровень заданы анкетой.
   2. Расписание недели — p.days тренировок.
   3. Формат — фулбади: каждая тренировка закрывает все 6 групп мышц.
   4. Нагрузка: подход выполняется до технического отказа в диапазоне повторов [lo, hi],
      отдых между подходами — restLabel.
   5. Упражнения по дням: «база» (ноги, спина, грудь) и «изоляция» (пресс, икры, плечи).
   6. Недельный объём — WEEKLY_SETS подходов на группу мышц в неделю, поделенный на число тренировок.
   7. Прогрессия — двойная: подход стартует у lo, как только все подходы дошли до hi —
      вес растёт, счётчик повторов падает обратно к lo (см. progressFor).
   8. Дневник — st.exLog (текущий вес/счётчик) и st.trainHistory (дата, подходы, заметки). */
const LEVEL_K = { beginner: 1, intermediate: 1.5, advanced: 2 };
const STRENGTH_DAYS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4] };
const round25 = (x) => Math.max(2.5, Math.round(x / 2.5) * 2.5);
const roundStep = (x, step = 2.5) => Math.max(step, Math.round(x / step) * step);
const setsWord = (n) => (n >= 5 ? "подходов" : "подхода");
const weeksWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "недель"; const l = n % 10; return l === 1 ? "неделю" : l >= 2 && l <= 4 ? "недели" : "недель"; };
const daysWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "дней"; const l = n % 10; return l === 1 ? "день" : l >= 2 && l <= 4 ? "дня" : "дней"; };

const GROUP_LABEL = { legs: "Ноги", back: "Спина", chest: "Грудь", abs: "Пресс", calves: "Икры", shoulders: "Плечи" };
const BASE_GROUPS = ["legs", "back", "chest"];
const ISO_GROUPS = ["abs", "calves", "shoulders"];
// Начинающим — единый диапазон на технику и отказ; дальше диапазон подстраивается под цель
const REP_RANGE_BY_GOAL = {
  mass: { lo: 8, hi: 12, rest: 90, restLabel: "1,5 минуты" },
  strength: { lo: 4, hi: 6, rest: 180, restLabel: "3 минуты" },
  fat: { lo: 12, hi: 15, rest: 60, restLabel: "60 секунд" },
  endurance: { lo: 15, hi: 20, rest: 45, restLabel: "45 секунд" },
};
const BEGINNER_RANGE = { lo: 12, hi: 15, rest: 150, restLabel: "2–3 минуты" };
const WEEKLY_SETS = { beginner: 4, intermediate: 8, advanced: 12 };

// фулбади-шаблон: A и B закрывают одни и те же 6 групп разными упражнениями для разнообразия
const GYM_TEMPLATE = {
  A: { legs: "squat", back: "row", chest: "bench", abs: "plank", calves: "calfraise", shoulders: "raise" },
  B: { legs: "rdl", back: "pulldown", chest: "bench", abs: "crunch", calves: "calfraise", shoulders: "raise" },
};
const BODYWEIGHT_TEMPLATE = {
  A: { legs: "bwsquat", back: "superman", chest: "pushup", abs: "plank", calves: "calfraise", shoulders: "pike" },
  B: { legs: "lunge", back: "superman", chest: "pushup", abs: "crunch", calves: "calfraise", shoulders: "pike" },
};
const HOME_WEIGHT_TEMPLATE = {
  A: { legs: "dbSquat", back: "dbRow", chest: "dbPress", abs: "plank", calves: "calfraise", shoulders: "raise" },
  B: { legs: "dbRdl", back: "dbRow", chest: "dbPress", abs: "crunch", calves: "calfraise", shoulders: "raise" },
};
const KETTLEBELL_TEMPLATE = {
  A: { legs: "kbGoblet", back: "kbRow", chest: "kbFloorPress", abs: "plank", calves: "calfraise", shoulders: "kbPress" },
  B: { legs: "kbSwing", back: "kbRow", chest: "kbFloorPress", abs: "crunch", calves: "calfraise", shoulders: "kbPress" },
};
const TEMPLATES = { gym: GYM_TEMPLATE, bodyweight: BODYWEIGHT_TEMPLATE, homeWeight: HOME_WEIGHT_TEMPLATE, kettlebell: KETTLEBELL_TEMPLATE };
const SESSION_MIN = { gym: 50, bodyweight: 35, homeWeight: 45, kettlebell: 40 };

function repRangeFor(p) {
  return p.level === "beginner" ? BEGINNER_RANGE : REP_RANGE_BY_GOAL[p.goal];
}

function seedWeight(p, e) {
  if (!e.coef) return null;
  const sexK = p.sex === "f" ? 0.7 : 1;
  return roundStep(p.weight * e.coef * LEVEL_K[p.level] * sexK, e.step || 2.5);
}

// Двойная прогрессия: если в прошлый раз худший подход дошёл до верхней границы — вес растёт,
// счётчик повторов падает к нижней границе; иначе цель этой тренировки — повторить или превзойти прошлый минимум
function progressFor(exLog, id, e, range, seed) {
  const rec = exLog?.[id];
  if (!rec) return { target: range.lo, weight: seed, leveledUp: false, first: true };
  const raw = Number(rec.lastMin);
  const last = Number.isFinite(raw) && raw > 0 ? raw : range.lo;
  // Без веса расти можно только повторами: цель — не меньше, чем получилось в прошлый раз
  if (seed == null) return { target: Math.max(range.lo, last), weight: null, leveledUp: false, first: false, last };
  const weight = rec.weight ?? seed;
  if (last >= range.hi) {
    return { target: range.lo, weight: roundStep(weight + (e.step || 2.5), e.step || 2.5), leveledUp: true, prevWeight: weight, last };
  }
  return { target: Math.min(range.hi, Math.max(range.lo, last)), weight, leveledUp: false, first: false, last };
}

// Подпись диапазона повторов: «12–15», «30» или «10+» (для своих упражнений без верхней границы)
const rangeText = (r) => (r.hi - r.lo > 1000 ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}–${r.hi}`);

// Своё расписание: { [деньНедели 0–6]: { strength: null | "A" | "B" | "w:<id своей тренировки>", run: null | ключ пробежки } }.
// null в st.schedule — автоматическое расписание из анкеты.
function strengthPlan(p, schedule, workouts) {
  const auto = {};
  const custom = {};
  if (!schedule) {
    STRENGTH_DAYS[p.days].forEach((d, i) => (auto[d] = i % 2));
    return { auto, custom };
  }
  for (let d = 0; d < 7; d++) {
    const v = schedule[d]?.strength;
    if (v === "A") auto[d] = 0;
    else if (v === "B") auto[d] = 1;
    else if (typeof v === "string" && v.startsWith("w:") && (workouts || []).some((w) => w.id === v.slice(2))) custom[d] = v.slice(2);
  }
  return { auto, custom };
}

function buildProgram(p, exLog, schedule = null, workouts = []) {
  const range = repRangeFor(p);
  const template = TEMPLATES[p.place] || BODYWEIGHT_TEMPLATE;
  const plan = strengthPlan(p, schedule, workouts);
  const autoCount = Object.keys(plan.auto).length;
  const perWeek = autoCount || p.days;
  const setsPerSession = Math.max(2, Math.round(WEEKLY_SETS[p.level] / perWeek));

  const makeDay = (letter) => {
    const groups = template[letter];
    const list = [...BASE_GROUPS, ...ISO_GROUPS].map((group) => {
      const id = groups[group];
      const e = EX[id];
      const seed = seedWeight(p, e);
      const prog = progressFor(exLog, id, e, range, seed);
      return {
        id, group, cat: e.cat,
        sets: setsPerSession, target: prog.target, weight: prog.weight,
        weightLabel: prog.weight != null ? `${fmt(prog.weight)} кг${e.per || ""}` : "свой вес",
        leveledUp: prog.leveledUp, prevWeight: prog.prevWeight, first: prog.first, lastMin: prog.last,
      };
    });
    return { title: `Тренировка ${letter}`, list };
  };

  const days = [makeDay("A"), makeDay("B")];
  const durationMin = SESSION_MIN[p.place] || 40;
  return {
    range, days, place: p.place, durationMin, setsPerSession,
    schedule: plan.auto,       // день → 0 (A) или 1 (B)
    customDays: plan.custom,   // день → id своей тренировки
    isCustom: !!schedule,
    weeklySets: setsPerSession * autoCount,
  };
}

const exWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "упражнений"; const l = n % 10; return l === 1 ? "упражнение" : l >= 2 && l <= 4 ? "упражнения" : "упражнений"; };

/* ============ Свои тренировки ============
   Приводит элемент своей тренировки (встроенное упражнение или придуманное) к тому же виду,
   что и элементы автопрограммы — чтобы ExerciseRow/ExerciseSheet работали одинаково с обоими.
   Встроенные используют общий st.exLog, поэтому прогресс переносится между автопрограммой
   и своими тренировками. У придуманных верхняя граница диапазона намеренно недостижима —
   автоматического роста веса для них нет, только память «в прошлый раз было столько-то»,
   а вес человек подстраивает сам через поле веса на подход. */
// Личный рекорд: для упражнений с весом — самый тяжёлый вес в подходе за всё время,
// для упражнений с собственным весом — больше всего повторов в одном подходе.
// weighted берём прямо из entry.weight (null у бодивейта) — так это уже определяют
// и ExerciseSheet, и гид по тренировке, отдельно вычислять заново не нужно.
function checkPR(records, entry) {
  const weighted = entry.weight != null;
  const sets = entry.sets || [];
  if (!sets.length) return { hit: false };
  const prev = records?.[entry.exId];
  if (weighted) {
    const best = Math.max(...sets.map((s) => Number(s.weight) || 0));
    if (best <= 0) return { hit: false };
    if (prev?.weight != null && best <= prev.weight) return { hit: false };
    return { hit: true, exId: entry.exId, weight: best, prevWeight: prev?.weight ?? null };
  }
  const best = Math.max(...sets.map((s) => Number(s.reps) || 0));
  if (best <= 0) return { hit: false };
  if (prev?.reps != null && best <= prev.reps) return { hit: false };
  return { hit: true, exId: entry.exId, reps: best, prevReps: prev?.reps ?? null };
}

function resolveWorkoutItem(item, profile, exLog) {
  if (!item.custom) {
    const e = EX[item.exId];
    // В своей тренировке цель повторов задаёт сам пользователь; вес растёт, когда все подходы дошли до неё.
    // Журнал упражнения общий с автопрограммой, поэтому вес и рекорды не расходятся.
    const base = repRangeFor(profile);
    const planned = Math.max(1, Math.round(Number(item.target) || base.lo));
    const range = { ...base, lo: planned, hi: planned };
    const seed = seedWeight(profile, e);
    const prog = progressFor(exLog, item.exId, e, range, seed);
    return {
      id: item.exId, sets: item.sets, target: prog.target, weight: prog.weight,
      weightLabel: prog.weight != null ? `${fmt(prog.weight)} кг${e.per || ""}` : "свой вес",
      leveledUp: prog.leveledUp, prevWeight: prog.prevWeight, first: prog.first, lastMin: prog.last,
      exercise: e, range,
    };
  }
  const e = { name: item.customName, tempo: "2-1-2", muscles: "", steps: [], mistakes: [], cat: null, group: null };
  const range = { lo: Math.max(1, item.target), hi: Math.max(1, item.target) + 9999, rest: 90, restLabel: "по ощущениям" };
  const weighted = !!item.weighted;
  const seed = weighted ? (item.startWeight || 0) : null;
  const prog = progressFor(exLog, item.id, { step: 2.5 }, range, seed);
  return {
    id: item.id, sets: item.sets, target: prog.target, weight: prog.weight,
    weightLabel: prog.weight != null ? `${fmt(prog.weight)} кг` : "свой вес",
    leveledUp: false, first: prog.first, lastMin: prog.last,
    exercise: e, range,
  };
}

/* ============ Алгоритм бега ============
   3–4 пробежки в неделю, чередуя типы. В основе недели — 80% спокойного объёма
   (длительная, кросс-поход, восстановительный кросс) и 20% быстрой работы
   (ускорения или фартлек, чередуются по неделям). Для тех, кто ещё не бегает
   без остановки, — прогрессия бег/шаг по вариантам из методики (6/4 → 7/3 → 8/2). */
// Названия вариантов пробежек для редактора расписания
const RUN_OPTION_LABEL = {
  recovery: "Восстановительный кросс",
  hard: "Ускорения / фартлек (чередуются)",
  intervals: "Ускорения",
  fartlek: "Фартлек",
  walkrun: "Кросс-поход",
  long: "Длительная",
  longwalk: "Длинный бег/шаг",
};
const HARD_RUNS = ["hard", "intervals", "fartlek"];
const LONG_RUNS = ["long", "longwalk"];
const runLevel = (p) => ({ "0": 0, "1": 1, "3": 2, "5": 3 }[p.run] ?? 1);
const runKeysFor = (p) => (runLevel(p) === 0 ? ["walkrun", "recovery", "longwalk"] : ["recovery", "hard", "intervals", "fartlek", "walkrun", "long"]);

// Автоматическое расписание бега: дни и типы пробежек (как было раньше)
function defaultRunPlan(p) {
  const strengthDays = STRENGTH_DAYS[p.days];
  const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !strengthDays.includes(d));
  const runDays = Math.min(free.length, p.days <= 3 ? 4 : 3);
  const order = runLevel(p) === 0
    ? (runDays >= 4 ? ["walkrun", "recovery", "walkrun", "longwalk"] : ["walkrun", "recovery", "longwalk"])
    : (runDays >= 4 ? ["recovery", "hard", "walkrun", "long"] : ["recovery", "hard", "long"]);
  // тяжёлый день — не впритык к длительной
  const chosen = free.length <= runDays ? free : (() => {
    const withLong = free.includes(6) ? 6 : free[free.length - 1];
    const rest = free.filter((d) => d !== withLong);
    const step = Math.max(1, Math.floor(rest.length / (runDays - 1 || 1)));
    const picked = [];
    for (let i = 0; i < rest.length && picked.length < runDays - 1; i += step) picked.push(rest[i]);
    return [...picked, withLong].sort((a, b) => a - b);
  })();
  const plan = {};
  chosen.slice(0, runDays).forEach((d, i) => (plan[d] = order[i]));
  return plan;
}

// Автоматическое расписание целиком в формате своего расписания — стартовая точка для редактора
function defaultSchedule(p) {
  const out = {};
  const auto = strengthPlan(p, null, []).auto;
  const runs = defaultRunPlan(p);
  for (let d = 0; d < 7; d++) {
    out[d] = { strength: auto[d] === undefined ? null : (auto[d] === 0 ? "A" : "B"), run: runs[d] || null };
  }
  return out;
}

function buildRun(p, schedule = null) {
  const L = runLevel(p);
  const hrmax = 220 - p.age;
  const steadyCeil = Math.round(hrmax * 0.82); // 3 зона — длительная, кросс-поход
  const recoveryCeil = Math.round(hrmax * 0.76); // восстановительный кросс
  const zone = [Math.round(hrmax * 0.6), Math.round(hrmax * 0.7)]; // для сводки на карточке анкеты

  // Каталог пробежек на каждую из 4 недель: ключ → тренировка
  let weeks;
  if (L === 0) {
    // ещё не бегает без остановки — прогрессия бег/шаг по методике, без пульсовых интервалов и ускорений
    const ratios = [[6, 4], [7, 3], [8, 2], [8, 2]];
    weeks = [0, 1, 2, 3].map((w) => {
      const [run, walk] = ratios[w];
      const mainMin = 30 + w * 5;
      const mainReps = Math.max(3, Math.round(mainMin / (run + walk)));
      return {
        walkrun: { id: "walkrun", title: "Бег/шаг", hrCeil: steadyCeil,
          summary: `${mainReps} × (${run} мин бег / ${walk} мин быстрый шаг)`,
          lines: [`${mainReps} повторов: ${run} мин бега, ${walk} мин быстрым шагом`, `Держи пульс до ${steadyCeil} уд/мин`] },
        recovery: { id: "recovery", title: "Восстановительный кросс", hrCeil: recoveryCeil,
          summary: `${20 + w * 5} мин легко, можно с переходом на шаг`,
          lines: [`${20 + w * 5} минут в очень лёгком темпе`, `Переходи на шаг, если пульс выше ${recoveryCeil} уд/мин`] },
        longwalk: { id: "longwalk", title: "Длинный бег/шаг", hrCeil: steadyCeil,
          summary: `${Math.round(mainReps * 1.4)} × (${run} мин бег / ${walk} мин быстрый шаг)`,
          lines: [`${Math.round(mainReps * 1.4)} повторов: ${run} мин бега, ${walk} мин быстрым шагом`, `Держи пульс до ${steadyCeil} уд/мин`] },
      };
    });
  } else {
    const long = { id: "long", title: "Длительная", hrCeil: steadyCeil,
      summary: `${L >= 2 ? 12 : 10} км, ровный темп`,
      lines: [`${L >= 2 ? 12 : 10} км в ровном спокойном темпе, для объёма`, `Держи пульс в 3 зоне, до ${steadyCeil} уд/мин`] };
    const recovery = { id: "recovery", title: "Восстановительный кросс", hrCeil: recoveryCeil,
      summary: "5–6 км, совсем легко",
      lines: ["5–6 км в очень лёгком темпе", `Держи пульс до ${recoveryCeil} уд/мин — должно ощущаться легко`] };
    const walkrun = { id: "walkrun", title: "Кросс-поход", hrCeil: steadyCeil,
      summary: "60–120 мин, бег/шаг 7/3",
      lines: ["7 мин бег / 3 мин быстрый шаг — весь кросс-поход", "Варианты: 6 мин / 4 мин, или 8 мин / 2 мин", `Держи пульс до ${steadyCeil} уд/мин`, "Продолжительность 60–120 минут"] };
    const intervals = { id: "intervals", title: "Ускорения", hrCeil: null,
      summary: "10 × 100 м быстро",
      lines: ["Разминка 2 км", "10 повторов: 100 м за 24–27 с в быстром темпе, затем 100 м лёгкого бега", "Держи этот темп на каждом повторе", "Заминка 1 км"] };
    const fartlek = { id: "fartlek", title: "Фартлек", hrCeil: null,
      summary: "4–5 × 500/500 м",
      lines: ["Разминка 10 минут", "4–5 повторов: 500 м в темпе 5:30 мин/км, затем 500 м в темпе 6:30 мин/км", "Заминка 1 км"] };
    weeks = [0, 1, 2, 3].map((w) => ({
      recovery, long, walkrun, intervals, fartlek,
      hard: w % 2 === 0 ? intervals : fartlek, // ускорения и фартлек чередуются по неделям
    }));
  }

  // Расписание: день → ключ пробежки. Неизвестные ключи (например, после смены уровня) пропускаем
  const planned = schedule ? Object.fromEntries(Object.entries(schedule).map(([d, v]) => [d, v?.run])) : defaultRunPlan(p);
  const runSchedule = {};
  for (let d = 0; d < 7; d++) {
    const key = planned[d];
    if (key && weeks[0][key]) runSchedule[d] = key;
  }
  return { zone, weeks, schedule: runSchedule, runDays: Object.keys(runSchedule).length, steadyCeil, recoveryCeil };
}

/* ============ Рецепты ============ */
const RECIPES = [
  { id: "r1", name: "Курица с гречкой и овощами", time: 25, kcal: 490, p: 46, f: 10, c: 51, allergens: [],
    ingredients: ["Куриное филе 150 г", "Гречка 70 г сухой", "Брокколи или стручковая фасоль 150 г", "Оливковое масло 5 г", "Соль, перец, паприка"],
    steps: ["Отвари гречку 15 минут", "Нарежь филе, посыпь специями и обжарь на масле 6–8 минут", "Приготовь овощи на пару 5 минут", "Выложи всё в тарелку"] },
  { id: "r2", name: "Индейка с запечённым бататом", time: 35, kcal: 405, p: 40, f: 7, c: 44, allergens: [],
    ingredients: ["Филе индейки 150 г", "Батат 200 г", "Оливковое масло 5 г", "Листья салата 100 г", "Розмарин, соль"],
    steps: ["Разогрей духовку до 200 °C", "Нарежь батат кубиками, сбрызни маслом и запекай 25 минут", "Индейку посоли и запекай рядом последние 15–18 минут", "Подавай с салатом"] },
  { id: "r3", name: "Чечевичный суп", time: 30, kcal: 300, p: 17, f: 6, c: 44, allergens: [],
    ingredients: ["Красная чечевица 60 г", "Морковь, лук и томат 150 г", "Оливковое масло 5 г", "Кумин, куркума, соль", "Вода 400 мл"],
    steps: ["Обжарь лук и морковь на масле 3 минуты", "Добавь чечевицу, томат, специи и воду", "Вари 20 минут до мягкости", "Пробей блендером, если хочется крем-суп"] },
  { id: "r4", name: "Творог с ягодами и мёдом", time: 5, kcal: 320, p: 35, f: 10, c: 24, allergens: ["milk"],
    ingredients: ["Творог 5% 200 г", "Ягоды 100 г, можно замороженные", "Мёд 10 г"],
    steps: ["Выложи творог в миску", "Добавь ягоды и полей мёдом"] },
  { id: "r5", name: "Омлет со шпинатом и сыром", time: 10, kcal: 270, p: 23, f: 18, c: 3, allergens: ["eggs", "milk"],
    ingredients: ["Яйца 2 шт. и 1 белок", "Шпинат 50 г", "Сыр 20 г", "Масло 3 г", "Соль, перец"],
    steps: ["Взбей яйца с солью и перцем", "Обжарь шпинат на масле 1 минуту", "Влей яйца, посыпь сыром и готовь под крышкой 4 минуты"] },
  { id: "r6", name: "Лосось с рисом и брокколи", time: 25, kcal: 610, p: 39, f: 21, c: 65, allergens: ["fish"],
    ingredients: ["Филе лосося 150 г", "Рис 70 г сухого", "Брокколи 150 г", "Лимон, соль, перец"],
    steps: ["Отвари рис", "Посоли лосось и запекай 12–15 минут при 200 °C", "Приготовь брокколи на пару 5 минут", "Сбрызни рыбу лимонным соком"] },
  { id: "r7", name: "Креветки с киноа и овощами", time: 20, kcal: 450, p: 40, f: 11, c: 47, allergens: ["shellfish"],
    ingredients: ["Очищенные креветки 150 г", "Киноа 60 г", "Перец и кабачок 150 г", "Оливковое масло 5 г", "Чеснок, соль"],
    steps: ["Промой киноа и вари 15 минут", "Обжарь овощи с чесноком 4 минуты", "Добавь креветки и готовь 3 минуты", "Смешай с киноа"] },
  { id: "r8", name: "Греческий салат с курицей", time: 15, kcal: 395, p: 36, f: 23, c: 11, allergens: ["milk"],
    ingredients: ["Куриное филе 120 г", "Огурец, томаты, перец 200 г", "Фета 40 г", "Оливки 20 г", "Оливковое масло 10 г"],
    steps: ["Обжарь или запеки филе и нарежь", "Нарежь овощи крупно", "Добавь фету, оливки и курицу", "Заправь маслом"] },
  { id: "r9", name: "Паста с индейкой и томатами", time: 20, kcal: 540, p: 36, f: 15, c: 65, allergens: ["gluten"],
    ingredients: ["Паста из твёрдых сортов 80 г", "Фарш индейки 120 г", "Томаты в собственном соку 150 г", "Оливковое масло 5 г", "Базилик, чеснок"],
    steps: ["Отвари пасту", "Обжарь фарш с чесноком 6 минут", "Добавь томаты и туши 7 минут", "Смешай с пастой и базиликом"] },
  { id: "r10", name: "Тофу с овощами и рисом", time: 20, kcal: 545, p: 33, f: 18, c: 63, allergens: ["soy", "gluten"],
    ingredients: ["Твёрдый тофу 150 г", "Рис 60 г сухого", "Овощная смесь 200 г", "Растительное масло 5 г", "Соевый соус 15 мл"],
    steps: ["Отвари рис", "Нарежь тофу кубиками и обжарь до корочки", "Добавь овощи и готовь 5 минут", "Влей соевый соус и подавай с рисом"] },
  { id: "r11", name: "Овсянка с бананом и арахисовой пастой", time: 10, kcal: 410, p: 13, f: 12, c: 64, allergens: ["gluten", "peanut"],
    ingredients: ["Овсяные хлопья 60 г", "Банан 100 г", "Арахисовая паста 15 г", "Вода 200 мл, корица"],
    steps: ["Залей хлопья водой и вари 5 минут", "Нарежь банан", "Добавь банан, пасту и корицу"] },
  { id: "r12", name: "Смузи с бананом, овсом и кефиром", time: 5, kcal: 320, p: 13, f: 5, c: 55, allergens: ["milk", "gluten"],
    ingredients: ["Кефир 1% 250 мл", "Банан 120 г", "Овсяные хлопья 30 г"],
    steps: ["Сложи всё в блендер", "Взбивай 40 секунд до однородности"] },
  { id: "r13", name: "Яйца пашот на тосте с авокадо", time: 15, kcal: 345, p: 18, f: 20, c: 23, allergens: ["eggs", "gluten"],
    ingredients: ["Яйца 2 шт.", "Цельнозерновой хлеб 40 г", "Авокадо 60 г", "Соль, перец, лимон"],
    steps: ["Подсуши хлеб", "Разомни авокадо с лимоном и солью", "Свари яйца пашот 3 минуты в слабо кипящей воде", "Выложи авокадо и яйца на тост"] },
  { id: "r14", name: "Хумус с овощами и лепёшкой", time: 10, kcal: 370, p: 15, f: 12, c: 51, allergens: ["sesame", "gluten"],
    ingredients: ["Хумус 100 г", "Цельнозерновая лепёшка 60 г", "Морковь, огурец, перец 150 г"],
    steps: ["Нарежь овощи брусками", "Подогрей лепёшку", "Подавай с хумусом"] },
];

function rankRecipes(list, goal, leftKcal, leftP) {
  const score = (r) => {
    const density = (r.p * 4) / r.kcal;
    let s = density * 100;
    if (goal === "mass") s += r.kcal / 20;
    if (goal === "fat") s -= r.kcal / 20;
    if (leftP > 40) s += density * 60;
    if (leftKcal > 0 && r.kcal > leftKcal + 100) s -= 40;
    return s;
  };
  return [...list].sort((a, b) => score(b) - score(a));
}
const recipeTag = (r) => ((r.p * 4) / r.kcal >= 0.3 ? "Много белка" : r.kcal < 350 ? "Лёгкое" : null);

/* ============ Список покупок ============
   Список собирается из ингредиентов выбранных рецептов (храним снимок ингредиентов у рецепта,
   а не просто id — так работает и с рецептами от ИИ, которых нет в базе RECIPES) плюс свои пункты. */
function shoppingIngredients(st) {
  const sl = st.shoppingList || {};
  const seen = new Set();
  const items = [];
  for (const r of sl.recipes || []) {
    for (const ing of r.ingredients || []) {
      const key = "r:" + ing;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ key, text: ing, custom: false });
    }
  }
  for (const c of sl.custom || []) items.push({ key: "c:" + c.id, text: c.text, custom: true, id: c.id });
  return items;
}
function addRecipeToShoppingList(up, recipe) {
  up((s) => {
    const sl = s.shoppingList || { recipes: [], checked: {}, custom: [] };
    if ((sl.recipes || []).some((r) => r.id === recipe.id)) return {};
    return { shoppingList: { ...sl, recipes: [...(sl.recipes || []), { id: recipe.id, name: recipe.name, ingredients: recipe.ingredients || [] }] } };
  });
}

/* ============ Дневник питания и ИИ ============ */
// Бесплатные лимиты — сознательно не сделаны символическими: цель не «почти всё бесплатно
// с маленьким исключением», а дать реально попробовать каждую функцию и упереться в границу,
// когда Pro становится понятной следующей ступенью, а не мелочью, на которую лень смотреть.
// Бесплатные лимиты (FREE_SCANS и т.д.) и цены лежат в src/plans.js — их же показывает лендинг сайта
const MEALS = ["Завтрак", "Обед", "Ужин", "Перекус"];
const defaultMeal = () => { const h = new Date().getHours(); return h < 11 ? 0 : h < 16 ? 1 : h < 21 ? 2 : 3; };
const sumFood = (list) => list.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, f: a.f + e.f, c: a.c + e.c }), { kcal: 0, p: 0, f: 0, c: 0 });
const num = (v) => Math.max(0, Math.round(Number(v) || 0));

// Локальная база для текстового ввода. Она нужна как надёжный fallback: текст еды
// не должен ломаться из-за отсутствия ANTHROPIC_API_KEY. Значения ориентировочные,
// для упакованных продуктов точнее использовать штрихкод/этикетку.
const LOCAL_FOOD_DB = [
  ["куриная грудка",165,31,3.6,0],["курица",165,31,3.6,0],["индейка",135,29,1.6,0],
  ["говядина",187,26,8,0],["свинина",242,27,14,0],["мясо",200,25,11,0],
  ["рыба",140,24,5,0],["лосось",208,20,13,0],
  ["тунец",132,29,1,0],["треска",82,18,0.7,0],["креветки",99,24,0.3,0],
  ["яйцо",157,12.6,10.6,1.1],["яйца",157,12.6,10.6,1.1],
  ["творог",121,17,5,2],["кефир",41,3,1,4],["молоко",52,3,3.2,4.7],
  ["йогурт",60,4,3,5],["сыр",350,25,27,1],["греческий йогурт",73,10,2,3.6],
  ["гречка",110,4,1.1,21.3],["рис",130,2.7,0.3,28],["овсянка",68,2.4,1.4,12],
  ["макароны",158,5.8,0.9,30.9],["паста",158,5.8,0.9,30.9],["картофель",77,2,0.1,17],
  ["батат",86,1.6,0.1,20],["чечевица",116,9,0.4,20],["нут",164,8.9,2.6,27.4],
  ["хлеб",250,8.5,3.5,49],["лаваш",275,9,1.2,56],["булка",280,9,5,50],
  ["банан",89,1.1,0.3,22.8],["яблоко",52,0.3,0.2,14],["апельсин",47,0.9,0.1,11.8],
  ["груша",57,0.4,0.1,15],["авокадо",160,2,15,9],["ягоды",50,1,0.4,12],
  ["огурец",15,0.7,0.1,3.6],["помидор",18,0.9,0.2,3.9],["томат",18,0.9,0.2,3.9],
  ["морковь",41,0.9,0.2,9.6],["брокколи",34,2.8,0.4,6.6],["капуста",25,1.3,0.1,5.8],
  ["перец",31,1,0.3,6],["салат",15,1.4,0.2,2.9],
  ["орехи",607,20,54,21],["миндаль",579,21,50,22],["арахис",567,26,49,16],
  ["арахисовая паста",588,25,50,20],["оливковое масло",884,0,100,0],["масло",884,0,100,0],
  ["майонез",680,1,75,3],["мед",304,0.3,0,82.4],["сахар",387,0,0,100],
  ["шоколад",539,7.8,30,59.5],["протеин",400,75,7,10],
].map(([name,kcal,p,f,c]) => ({name, per100:{kcal,p,f,c}}));

const LOCAL_FOOD_ALIASES = {
  "гречневая каша":"гречка", "гречневая крупа":"гречка", "гречку":"гречка", "гречки":"гречка",
  "куриную грудку":"куриная грудка", "куриная грудка":"куриная грудка", "курицу":"курица",
  "курицы":"курица", "рисовую кашу":"рис", "рисом":"рис", "банан":"банан", "банана":"банан",
  "яблоко":"яблоко", "яйца":"яйца", "яйцо":"яйцо", "творог":"творог", "творога":"творог",
  "картошка":"картофель", "картошку":"картофель", "картофеля":"картофель", "огурцы":"огурец",
  "огурца":"огурец", "помидоры":"помидор", "помидора":"помидор", "сыром":"сыр", "хлеба":"хлеб",
  "мяса":"мясо", "мясом":"мясо", "масла":"масло", "молока":"молоко", "сахара":"сахар", "сыра":"сыр",
  "меда":"мед", "мёда":"мед", "творогом":"творог",
};
const localFoodFind = (name) => {
  const n = name.toLowerCase().replace(/ё/g,"е").trim();
  const canonical = LOCAL_FOOD_ALIASES[n] || n;
  return LOCAL_FOOD_DB.find(x => x.name === canonical) || LOCAL_FOOD_DB.find(x => n.includes(x.name) || x.name.includes(n));
};
const localFoodDish = (items) => items.length === 1 ? items[0].name : "Приём пищи";

// В JS \b и \w по умолчанию не понимают кириллицу (её нет в классе \w) — значит ни один из
// регулярных выражений ниже раньше НЕ срабатывал на кириллических единицах измерения в принципе
// (ни "150 г", ни тем более "150 грамм"), и вес всегда уходил в грубый запасной расчёт
// ("количество × 100 г"), отсюда и "фигня" вроде 15000 г риса из "150 грамм". Чиним: вместо \b —
// отрицательный lookahead на кириллическую букву (NOT_CYR), вместо \w* для окончаний слов —
// явный класс CYR.
const CYR = "[а-яё]*";
const NOT_CYR = "(?![а-яё])";
const UNIT_RE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(килограмм${CYR}|кг|миллилитр${CYR}|мл|грамм${CYR}|гр|г|литр${CYR}|л)${NOT_CYR}`, "i");
const UNIT_RE_G = new RegExp(UNIT_RE.source, "gi");
const unitToGrams = (v, unit) => (/^(кг|килограмм)/i.test(unit) || /^(л|литр)/i.test(unit) ? v * 1000 : v);
// Яйца — особый случай: «5 яиц» не повторяет название продукта отдельным словом, счётное слово
// и есть название, поэтому его нельзя вычищать из текста перед поиском продукта как «шт» —
// наоборот, по нему продукт определяется напрямую.
const EGGS_RE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:яиц${CYR}|яйц${CYR})${NOT_CYR}`, "i");
const SHT_RE_G = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*шт${CYR}${NOT_CYR}`, "gi");
const TSP_RE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:ч\\.?\\s*л\\.?|чайн${CYR}\\s*лож${CYR})${NOT_CYR}`, "i");
const TBSP_RE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:ст\\.?\\s*л\\.?|стол${CYR}\\s*лож${CYR}|лож${CYR})${NOT_CYR}`, "i");

function parseLocalFoodText(text) {
  const src = String(text).toLowerCase().replace(/ё/g,"е");
  // Разбиваем по запятым, точкам с запятой, переносам строк (список «столбиком», как люди часто
  // и пишут), «+» и «и» перед известным продуктом; срезаем маркеры списка (-, •, *) в начале строки.
  const chunks = src.replace(/\s+и\s+(?=[а-я])/g, ",")
    .split(/[,;\n+]+/)
    .map((x) => x.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const out = [];
  for (const chunk of chunks) {
    // Два и больше числа с единицей измерения в одном куске без разделителя между ними
    // ("рис 150г мясо 200г") — явный признак двух разных продуктов, слепленных без запятой.
    // Разбор одного куска всегда даёт ровно один продукт, так что весу тут некуда корректно
    // деться — честнее пропустить кусок (и уйти в ИИ-разбор уровнем выше), чем правдоподобно
    // приписать вес не тому продукту.
    if ((chunk.match(UNIT_RE_G) || []).length > 1) continue;
    let grams = null;
    let confidence = "medium";
    let productOverride = null;
    const weight = chunk.match(UNIT_RE);
    if (weight) { grams = unitToGrams(Number(weight[1].replace(",", ".")), weight[2]); confidence = "high"; }
    if (!grams) {
      const eggs = chunk.match(EGGS_RE);
      if (eggs) { grams = Number(eggs[1].replace(",", ".")) * 55; confidence = "high"; productOverride = "яйца"; }
    }
    if (!grams) {
      const tsp = chunk.match(TSP_RE);
      if (tsp) { grams = Number(tsp[1].replace(",", ".")) * 5; confidence = "high"; }
    }
    if (!grams) {
      const tbsp = chunk.match(TBSP_RE);
      if (tbsp) { grams = Number(tbsp[1].replace(",", ".")) * 15; confidence = "high"; }
    }
    // «шт» вычищаем смело — это никогда не название продукта («хлеб 1 шт» → «хлеб»), в отличие
    // от «яйца» выше, которое само и есть название.
    const cleaned = chunk.replace(UNIT_RE_G, " ").replace(TSP_RE, " ").replace(TBSP_RE, " ").replace(SHT_RE_G, " ").trim();
    const quantity = chunk.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s+(?=[а-я])/i);
    const product = productOverride ? localFoodFind(productOverride) : localFoodFind(cleaned || chunk);
    if (!product) continue;
    if (!grams && quantity) {
      const q = Number(quantity[1].replace(",", "."));
      const pieceWeights = {"банан":120,"яблоко":180,"апельсин":180,"груша":170,"хлеб":30,"яйцо":55,"яйца":55};
      grams = pieceWeights[product.name] ? q * pieceWeights[product.name] : q * 100;
    }
    if (!grams) {
      const defaults = {"яйцо":55,"яйца":55,"банан":120,"яблоко":180,"апельсин":180,"груша":170,"хлеб":30};
      grams = defaults[product.name] || 100;
      confidence = "medium";
    }
    out.push({name: product.name, grams: Math.round(grams), per100: product.per100, confidence});
  }
  if (!out.length) return null;
  return {
    is_food: true, dish: localFoodDish(out), items: out,
    // Покрыл ли локальный разбор ВСЁ, что было в тексте — если нет (незнакомое слово, странная
    // запись, несколько продуктов без разделителя), FoodScanSheet отправит тот же текст в ИИ,
    // а не покажет пользователю неполный или тихо урезанный результат.
    allMatched: out.length === chunks.length,
    allergens: detectAllergens(out.map(x=>x.name).join(" ")),
    note: "Расчёт выполнен по встроенной базе. Для упакованных продуктов точнее использовать штрихкод или данные с этикетки.",
  };
}

// Запрос идёт на наш сервер (/api/claude), ключ API хранится только там.
// Ошибки прокидываются с кодом причины (auth/upstream/network/badjson), чтобы экран
// распознавания мог показать не одно и то же «не получилось», а что именно сломалось.
async function fetchClaudeText(content) {
  let response;
  try {
    // Подпись Telegram (Mini App), токен сессии (сайт) или секрет сборки (iOS/Windows) — см. authHeaders
    const headers = authHeaders({ "Content-Type": "application/json" });
    response = await fetch(apiUrl("/api/claude"), { method: "POST", headers, body: JSON.stringify({ content }) });
  } catch (e) {
    throw new Error("network");
  }
  const type = (response.headers && response.headers.get && response.headers.get("content-type")) || "";
  if (!type.includes("json")) throw new Error(response.ok ? "noformat" : "noserver");
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Сервер присылает код причины: telegram_bad_signature, ai_credit и т. д.
    const err = new Error(String(data?.error || `upstream:${response.status}`));
    err.detail = data?.detail || "";
    throw err;
  }
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!text.trim()) throw new Error("empty");
  return text;
}

async function askClaude(content) {
  const text = await fetchClaudeText(content);
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("noformat");
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch (e) {
    throw new Error("badjson");
  }
}

// Голосовой и текстовый помощник — тот же сервер и ключ, что и распознавание еды, но ответ обычным текстом, без JSON
async function askAssistantText(question, context) {
  const prompt = `Ты — голосовой помощник в приложении для тренировок RITM. Отвечай по-русски, кратко (2–5 предложений), простым разговорным языком — ответ могут озвучить вслух. Если не хватает данных, честно скажи, что не знаешь. Не выдумывай факты о конкретном человеке сверх того, что дано в контексте.
Контекст о пользователе сейчас: ${context}
Вопрос пользователя: ${question}`;
  const text = await fetchClaudeText([{ type: "text", text: prompt }]);
  return text.trim();
}

// Еженедельный персональный инсайт для «Прогресса» — тот же сервер, но с недельной сводкой вместо вопроса.
// Результат кешируется в st.aiInsight по ключу недели, чтобы не дёргать сервер при каждом открытии экрана.
async function fetchWeeklyInsight(context) {
  const prompt = `Ты — тренер и нутрициолог приложения RITM. По сводке за последнюю неделю дай короткий персональный разбор по-русски: 3–4 предложения, конкретно и по делу, без общих фраз и воды. Сначала отметь, что идёт хорошо, потом — что стоит поправить на следующей неделе. Не придумывай факты сверх того, что дано в сводке.
Сводка за неделю: ${context}`;
  const text = await fetchClaudeText([{ type: "text", text: prompt }]);
  return text.trim();
}

// Код ошибки → что именно чинить. Адрес /api/health показывает состояние настроек сервера.
const AI_ERRORS = {
  telegram_no_init_data: "Приложение открыто не из Telegram. Открой его через кнопку в боте.",
  auth_required: "Распознавание, помощник и оплата работают после входа. Войди через Telegram: Настройки → «Войти через Telegram» — это бесплатно и занимает полминуты.",
  session_invalid: "Вход устарел. Выйди и войди через Telegram заново в Настройках.",
  telegram_token_missing: "На Netlify не задана переменная BOT_TOKEN, или у неё не включена область Functions. Добавь её и сделай повторный деплой.",
  telegram_token_format: "BOT_TOKEN на Netlify записан неверно. Скопируй токен целиком из @BotFather (вида 1234567890:AAH…) и сделай повторный деплой.",
  telegram_bad_signature: "BOT_TOKEN на Netlify не от этого бота. Скопируй в @BotFather токен именно того бота, из которого открыто приложение, и сделай повторный деплой.",
  telegram_expired: "Сессия устарела. Закрой приложение и открой его заново из бота.",
  ai_key_missing: "На Netlify не задан ключ ИИ-провайдера — какой именно, зависит от AI_PROVIDER (ANTHROPIC_API_KEY / GIGACHAT_AUTH_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY). Добавь ключ и сделай повторный деплой.",
  ai_auth: "Сервис распознавания не принял ANTHROPIC_API_KEY: ключ неверный или удалён. Создай новый ключ в консоли Anthropic и замени его на Netlify.",
  ai_permission: "У ключа ANTHROPIC_API_KEY нет доступа. Возможно, аккаунт недоступен в этой стране или ключ ограничен.",
  ai_model: "Модель из переменной CLAUDE_MODEL не найдена. Удали CLAUDE_MODEL на Netlify или укажи правильное название.",
  ai_credit: "На балансе аккаунта Anthropic закончились средства. Пополни баланс в консоли Anthropic.",
  ai_rate: "Слишком много запросов подряд. Подожди минуту и попробуй снова.",
  ai_overloaded: "Сервис распознавания сейчас перегружен. Попробуй через пару минут.",
  ai_bad_request: "Сервис распознавания отклонил запрос. Попробуй другое фото или описание.",
  ai_network: "Сервер не смог связаться с сервисом распознавания. Попробуй позже.",
  ai_upstream: "Сервис распознавания ответил ошибкой. Попробуй позже.",
  gigachat_cert: "Сервер не смог загрузить сертификат Минцифры для GigaChat. Попробуй ещё раз через минуту — если повторится, проверь настройки хостинга.",
  gigachat_auth: "GigaChat не принял ключ авторизации. Проверь GIGACHAT_AUTH_KEY на Netlify — его нужно скопировать из личного кабинета Sber Studio целиком, и сделать повторный деплой.",
  gemini_auth: "Gemini не принял ключ. Проверь GEMINI_API_KEY на Netlify и сделай повторный деплой.",
  openrouter_auth: "OpenRouter не принял ключ. Проверь OPENROUTER_API_KEY на Netlify и сделай повторный деплой.",
  bad_request: "Запрос не прошёл проверку: фото слишком большое или описание слишком длинное.",
  noserver: "На сайте нет функции распознавания. Загрузи файл netlify/functions/claude.mjs и папку netlify/lib из архива и сделай деплой.",
  network: "Нет связи с сервером. Проверь интернет и попробуй ещё раз.",
};
const SETUP_ERRORS = ["telegram_token_missing", "telegram_token_format", "telegram_bad_signature", "ai_key_missing", "ai_auth", "ai_permission", "ai_model", "ai_credit", "noserver", "gigachat_cert", "gigachat_auth", "gemini_auth", "openrouter_auth"];

function explainAiError(e) {
  const code = String(e?.message || "");
  let text = AI_ERRORS[code];
  if (!text) {
    if (code === "empty" || code === "noformat" || code === "badjson") return "Не получилось разобрать ответ сервера. Попробуй ещё раз через минуту.";
    if (code.startsWith("upstream:")) return `Сервер ответил ошибкой ${code.slice(9)}. Попробуй позже.`;
    return "";
  }
  if (SETUP_ERRORS.includes(code) && typeof window !== "undefined") {
    text += ` Проверка настроек: ${window.location.origin}/api/health`;
  }
  return text;
}

// max/quality подняты (было 1024/0.85) — на тарелке с несколькими продуктами мелкие детали
// (соус, зелень, вид крупы) на сжатом фото сливаются, и модель их either теряет, либо гадает.
// Запас по размеру большой: сервер пропускает base64 до ~2.2 МБ (claude.mjs), а даже сложное
// фото тарелки на 1280px и качестве 0.9 обычно укладывается в 0.5–1 МБ.
function fileToJpeg(file, max = 1280, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image"));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", quality);
        resolve({ url, base64: url.split(",")[1] });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Якорь для модели: те же цифры, что уже использует встроенная локальная база (LOCAL_FOOD_DB) —
// по ней считается текстовый ввод без фото. Передавая их же в промпт для фото, не даём модели
// "придумывать" значение для того же гречки или куриной грудки каждый раз заново: оценка по фото
// и оценка по тексту для одного и того же продукта совпадают, а точность самой базы (сверена по
// таблицам Скурихина/USDA) переносится и на распознавание по фото. Строится один раз при загрузке
// модуля, а не на каждый запрос.
const FOOD_REFERENCE_TABLE = LOCAL_FOOD_DB
  .filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i)
  .map((x) => `${x.name} ${x.per100.kcal}/Б${x.per100.p}/Ж${x.per100.f}/У${x.per100.c}`)
  .join(", ");

const FOOD_PROMPT = `Ты — модуль распознавания еды в дневнике питания, как в Yazio. Действуй как опытный диетолог, который заполняет дневник.
Порядок работы:
1. Раздели приём пищи на отдельные продукты — всё, что можно взвесить отдельно: гарнир, мясо или рыбу, овощи, соус, масло, хлеб, напиток.
2. Оцени вес каждого продукта в граммах (для напитков — в мл) по размеру тарелки (обычно 24–27 см), ложек, стакана, руки или упаковки. Опорные меры объёма и веса: столовая ложка ≈ 15 г (сыпучих — 18–20 г), чайная ложка ≈ 5 г, стакан ≈ 200 мл, кружка ≈ 250 мл, стандартный кусок сливочного масла с ножа ≈ 10 г, горсть (ладонь) ≈ 30 г орехов/сухофруктов или 150–200 г овощей. Для штучных продуктов: яйцо около 55 г, ломтик хлеба около 30 г, банан без кожуры около 120 г, яблоко около 180 г.
3. Учитывай способ приготовления: крупы, макароны и мясо считай в готовом виде; при жарке добавь масло отдельной строкой (обычно 5–10 г на порцию), даже если его не видно.
4. Не пропускай скрытые калории: масло, майонез, соусы, сыр, заправки, сахар в чае и кофе.
5. Пищевую ценность давай НА 100 Г готового продукта по стандартным таблицам состава (USDA, таблицы Скурихина), а не на всю порцию. Если продукт на фото совпадает (или близок) с одним из списка ниже — используй именно эти значения на 100 г как базовые, а не прикидывай заново; отступай от них только при явном визуальном признаке другого (жирный сорт мяса, другой соус, явно нежирный творог и т.п.):
${FOOD_REFERENCE_TABLE}
6. Проверь каждое значение: калории на 100 г ≈ 4 × белки + 4 × углеводы + 9 × жиры.
7. Если видна упаковка с таблицей пищевой ценности — бери значения с неё.
8. Не больше 7 позиций в items — объединяй похожие мелкие продукты в одну строку (например, «овощной салат», а не каждый овощ отдельно), чтобы не тратить место на детали, которые не меняют картину по калориям.
9. Если не уверен в продукте или его весе — всё равно включи его в items с confidence "low", а не пропускай: лучше грубая оценка каждого продукта на тарелке, чем точный расчёт по половине блюда.
10. Если на фото несколько похожих порций разного размера — не усредняй между ними: оценивай вес по той порции, что явно больше/основная, а соседние учитывай отдельной строкой со своим весом.
11. Способ готовки сильнее влияет на вес и жирность, чем кажется на вид: тушёное, варёное и приготовленное на пару теряет в весе меньше, чем жареное или во фритюре. При видимой хрустящей корочке, глубокой обжарке или фритюре увеличивай оценку добавленного масла до 10–15 г на порцию и учитывай возможную потерю веса продукта на 10–20% от сырого.
Если пользователь указал вес или количество в тексте, используй именно их.
Если в контексте ниже дана подсказка от самого пользователя про это же блюдо из его предыдущих правок — доверяй ей больше, чем своей оценке по фото и больше, чем таблице выше, и используй указанные в ней продукты и граммовки как основу, при необходимости лишь слегка скорректировав их по факту того, что видно на этом конкретном фото.
Перед тем как собрать JSON, мысленно пройди по каждому продукту на фото ещё раз и проверь: не забыт ли скрытый жир/соус/сахар, похожа ли оценка веса на реальный размер порции взрослого человека (обычная порция гарнира 150–250 г, не 50 и не 500), совпадает ли калорийность каждого продукта с его известной плотностью калорий (жирные и жареные продукты — 250–600 ккал/100г, крупы и макароны варёные — 100–160, овощи и фрукты — 15–90, мясо и рыба — 100–250). Если какое-то значение выбивается из этого диапазона без явной причины на фото — пересчитай его. Эту проверку в ответ не включай, пиши сразу итоговый JSON.
Ответь строго одним JSON-объектом — без markdown, без вступления, без пояснений до или после JSON, даже если не уверен в результате:
{"is_food": true, "dish": "короткое название приёма пищи по-русски", "items": [{"name": "продукт", "grams": число, "per100": {"kcal": число, "protein": число, "fat": число, "carbs": число}, "confidence": "high, medium или low"}], "allergens": ["ключи из списка gluten, milk, eggs, nuts, peanut, fish, shellfish, soy, sesame, которые вероятно есть в блюде"], "note": "одно короткое предложение о том, что может быть неточно"}
Если это не еда, верни {"is_food": false}.`;

// Текстовый ввод без фото: сначала пробуем встроенную локальную базу (parseLocalFoodText) —
// она бесплатная, мгновенная и работает офлайн, но это регулярки по словарю из полусотни слов,
// так что на непривычной формулировке, незнакомом слове или просто списке без запятых она
// честно сдаётся (возвращает allMatched: false — см. parseLocalFoodText). Этот промпт — то, что
// уходит в ИИ именно в таком случае, вместо жёсткой ошибки «не удалось найти продукт»: тот же
// получатель (FOOD_PROMPT), но без инструкций про визуальную оценку по фото/тарелке, которых
// тут просто нет, и с явным акцентом на то, что формат записи может быть любым — через запятую,
// столбиком, с «и», без знаков препинания вовсе.
const FOOD_TEXT_PROMPT = `Ты — модуль распознавания еды в дневнике питания, как в Yazio. Пользователь описал съеденное текстом (не фото) — в свободной форме: через запятую, списком «в столбик» по одному продукту на строке, через «и», с сокращениями единиц измерения или словами целиком. Разбери запись и посчитай КБЖУ.
Порядок работы:
1. Найди в тексте каждый отдельный продукт, который упомянул пользователь, — не пропускай ни один пункт списка, даже если они на разных строках или без запятых между ними.
2. Если вес или количество указаны явно (граммы, миллилитры, ложки, штуки, кг, л — любым написанием, сокращённым или полным) — используй именно их, не прикидывай заново. 1 ст. ложка ≈ 15 г, 1 ч. ложка ≈ 5 г, 1 стакан ≈ 200 мл. Для штучных продуктов без указанного веса: яйцо ≈ 55 г, ломтик хлеба ≈ 30 г, банан без кожуры ≈ 120 г, яблоко ≈ 180 г.
3. Если вес вообще не указан — возьми обычную порцию взрослого человека для этого продукта (гарнир 150–250 г, мясо/рыба 100–200 г, овощ 80–150 г и т.п.), не 0 и не абсурдно много.
4. Пищевую ценность давай НА 100 Г готового продукта по стандартным таблицам состава (USDA, таблицы Скурихина). Если продукт совпадает (или близок) с одним из списка ниже — используй именно эти значения на 100 г как базовые, а не прикидывай заново:
${FOOD_REFERENCE_TABLE}
5. Проверь каждое значение: калории на 100 г ≈ 4 × белки + 4 × углеводы + 9 × жиры.
6. Не больше 7 позиций в items — объединяй совсем мелкие уточнения в одну строку.
7. Если какое-то слово явно не еда (например, просто цифра без продукта или случайный набор символов) — просто не включай его в items, не придумывай продукт.
Если в контексте ниже дана подсказка от самого пользователя про это же блюдо из его предыдущих правок — доверяй её продуктам и граммовкам больше, чем общей оценке.
Ответь строго одним JSON-объектом — без markdown, без вступления, без пояснений до или после JSON:
{"is_food": true, "dish": "короткое название приёма пищи по-русски", "items": [{"name": "продукт", "grams": число, "per100": {"kcal": число, "protein": число, "fat": число, "carbs": число}, "confidence": "high, medium или low"}], "allergens": ["ключи из списка gluten, milk, eggs, nuts, peanut, fish, shellfish, soy, sesame, которые вероятно есть в блюде"], "note": "одно короткое предложение о том, что может быть неточно"}
Если в тексте вообще нет ничего похожего на еду, верни {"is_food": false}.`;

// Ключ для «памяти блюд» — нормализуем название, чтобы «Гречка с курицей» и «гречка с курицей!»
// попадали в одну запись.
const normalizeDishKey = (s) => String(s || "").toLowerCase().trim().replace(/[^a-zа-яё0-9 ]/gi, "").replace(/\s+/g, " ");

// Память блюд: превращает сохранённые пользователем правки в текстовую подсказку для промпта.
// Берём только последние несколько записей, чтобы не раздувать запрос.
function memoryHintText(memory) {
  const list = Object.values(memory || {});
  if (!list.length) return "";
  const recent = [...list].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 8);
  const lines = recent.map((m) => `«${m.dish}»: ${m.items.map((it) => `${it.name} ${Math.round(it.grams)} г`).join(", ")}`);
  return "\n\nРанее пользователь уже уточнял граммовки для похожих блюд (используй, если на фото то же самое):\n" + lines.join("\n");
}

function recipePrompt(p, left, strict) {
  const al = (p.allergies || []).map((a) => ALLERGENS[a].label.toLowerCase());
  const target = left.kcal > 250 ? Math.min(750, Math.round(left.kcal * 0.6)) : 250;
  return `Ты спортивный нутрициолог. Придумай один простой домашний рецепт на одну порцию из продуктов, которые легко купить в России. Выбери неочевидное блюдо.
Цель человека: ${LABELS.goal[p.goal]}. Калорийность порции около ${target} ккал. За день осталось добрать ${Math.max(0, Math.round(left.p))} г белка, сделай блюдо богатым белком, но реалистичным.
${al.length ? `У человека аллергия: ${al.join(", ")}. Полностью исключи эти аллергены, включая скрытые источники: соевый соус содержит сою и глютен, песто содержит орехи и сыр, майонез содержит яйца, хумус содержит кунжут.` : "Аллергий нет."}
${strict ? "Предыдущий вариант содержал запрещённый аллерген. Проверь каждый ингредиент." : ""}
Ответь только JSON без markdown и пояснений:
{"name": "название", "time": минуты, "kcal": число, "protein": число, "fat": число, "carbs": число, "ingredients": ["продукт и граммовка"], "steps": ["шаг"], "allergens": ["ключи из списка gluten, milk, eggs, nuts, peanut, fish, shellfish, soy, sesame, которые есть в рецепте"]}`;
}

const normalizeRecipe = (r) => ({
  id: "ai" + Date.now(),
  name: String(r.name || "Рецепт"),
  time: num(r.time) || 20,
  kcal: num(r.kcal), p: num(r.protein), f: num(r.fat), c: num(r.carbs),
  ingredients: (r.ingredients || []).map(String).slice(0, 15),
  steps: (r.steps || []).map(String).slice(0, 10),
  allergens: (r.allergens || []).filter((a) => ALLERGENS[a]),
});

/* ============ Данные по умолчанию ============ */

/* ============ Напоминания ============
   Работают локально, пока Mini App открыт. В Telegram/браузере пробуем системное
   уведомление, а внутри Telegram дополнительно показываем popup. Настройки хранятся
   вместе с профилем и синхронизируются через CloudStorage. */
const DEFAULT_REMINDERS = {
  enabled: true,
  plan: true,
  training: true,
  tasks: true,
  planTime: "08:00",
  trainingTime: "18:00",
  sent: {},
};

function reminderTimeReached(time, now = new Date()) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return false;
  const [h, m] = time.split(":").map(Number);
  return now.getHours() === h && now.getMinutes() === m;
}

// Регистрация напоминаний на сервере (включая выключение!) раньше уходила через
// fetch(...).catch(() => {}) — ошибка сети ИЛИ любой не-200 ответ (например, протухший
// initData) молча проглатывались, и сервер мог продолжать слать сообщения даже после
// того, как человек выключил напоминания в настройках. Теперь проверяем r.ok и пробуем
// ещё раз несколько раз с паузой — обычная сетевая просадка уже не оставляет сервер
// с устаревшими настройками.
async function registerReminders(payload, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      // В Mini App подпись Telegram едет в теле (payload.initData), на сайте — токен сессии в заголовке
      const r = await fetch(apiUrl("/api/reminder-register"), { method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
      if (r.ok) return true;
    } catch (e) { /* сеть недоступна — попробуем ещё раз */ }
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return false;
}

function sendRitmReminder(title, message) {
  try {
    const tg = tgApp();
    if (tg?.showPopup) {
      tg.showPopup({ title, message, buttons: [{ type: "ok" }] });
      return;
    }
  } catch {}
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body: message });
    }
  } catch {}
}

// Только для iOS-приложения (Capacitor): напоминания шлёт не бот, а сама операционная система,
// заранее планируем локальные уведомления на нужное время, а не пытаемся «достучаться» до
// закрытого приложения, как это делает checkReminders для открытого. Планируем заново при
// каждом заметном изменении состояния (тот же дебаунс, что и для Telegram-регистрации).
// В Electron (Windows) это не нужно: приложение живёт в трее и checkReminders работает как обычно,
// системное уведомление шлёт стандартный Notification API из sendRitmReminder.
let nativeReminderAsked = false;
async function scheduleNativeReminders(cfg, trainingByDay, tasks) {
  if (!isCapacitorNative()) return;
  try {
    if (!nativeReminderAsked) {
      nativeReminderAsked = true;
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") await LocalNotifications.requestPermissions();
    }
    const pending = await LocalNotifications.getPending();
    if (pending.notifications?.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!cfg.enabled) return;
    const timeParts = (t) => { const [h, m] = String(t || "09:00").split(":").map(Number); return { hour: h || 9, minute: m || 0 }; };
    const notifications = [];
    if (cfg.plan) {
      notifications.push({ id: 1001, title: "RITM · План на день", body: "Открой RITM и посмотри, что сегодня по плану.", schedule: { on: timeParts(cfg.planTime), repeats: true, allowWhileIdle: true } });
    }
    if (cfg.training && Object.keys(trainingByDay || {}).length) {
      notifications.push({ id: 1002, title: "RITM · Время тренировки", body: "Загляни в приложение — сегодня тренировочный день.", schedule: { on: timeParts(cfg.trainingTime), repeats: true, allowWhileIdle: true } });
    }
    if (cfg.tasks) {
      (tasks || []).filter((t) => t.time && !t.done).slice(0, 60).forEach((t, i) => {
        const { hour, minute } = timeParts(t.time);
        const id = 2000 + i;
        if (t.repeat && t.repeat.type !== "once") {
          notifications.push({ id, title: "RITM · Задача", body: String(t.text || "").slice(0, 120), schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true } });
        } else {
          const dateStr = t.repeat?.date || String(t.id).split(":")[0];
          const dt = new Date(`${dateStr}T00:00:00`);
          dt.setHours(hour, minute, 0, 0);
          if (dt.getTime() > Date.now()) notifications.push({ id, title: "RITM · Задача", body: String(t.text || "").slice(0, 120), schedule: { at: dt, allowWhileIdle: true } });
        }
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch {}
}

const DEFAULT = {
  profile: null, theme: "ritm", customColor: "#FF6B6B", pro: false, tasks: {}, dailyTasks: [], done: {}, runDone: {},
  notify: true, reminders: DEFAULT_REMINDERS, food: {}, scans: {}, exLog: {}, trainHistory: [], water: {},
  steps: {}, sleep: {}, wellbeing: {}, assistantUses: {}, weight: {}, normNudgeAt: 0, records: {},
  workouts: [],
  taskLists: [{ id: "inbox", name: "Входящие", color: LIST_COLORS[0] }],
  books: [],
  challenges: [],
  journal: [],
  breathLog: {},
  breathStats: { totalSessions: 0, totalMinutes: 0 },
  shoppingList: { recipes: [], checked: {}, custom: [] },
  healthKit: { connected: false, lastSyncAt: 0 },
  faith: { tradition: null, customPractices: [], log: {} },
  tabsConfig: null,
  // Намеренно не задаём tourSeen здесь: его отсутствие в сохранённых данных — это то,
  // по чему migrateState отличает «никогда не сохранялся» (значит новый человек, нужен тур)
  // от «уже был профиль до этого обновления» (тур показывать не нужно).
  schedule: null, products: {}, foodMemory: {}, todayLayout: null,
  // Что из своего прогресса показывать друзьям (см. раздел «Друзья») — каждый пункт включает
  // свою категорию статистики в карточку, которую видят только подтверждённые друзья. Вес —
  // единственное, что по умолчанию выключено: это более личные данные, чем серия тренировок.
  friendsPrivacy: { streak: true, workouts: true, achievements: true, habits: true, weight: false, weekStatus: true },
  devThemes: [
    { id: "d1", name: "Книги", tasks: [{ id: "dt1", text: "Дочитать текущую книгу", done: false }] },
    { id: "d2", name: "Английский язык", tasks: [{ id: "dt2", text: "20 минут практики", done: false }] },
  ],
  // Воду убрали из общих привычек: она теперь личный расчёт в «Питании», от веса и тренировочных дней
  habits: [{ id: "h1", name: "Растяжка 10 минут", log: {} }, { id: "h2", name: "10 минут чтения", log: {} }],
};

/* ============ Базовые элементы ============ */
function GlobalStyle() {
  return (
    <style>{`
      @keyframes breathe { 0%,100% { opacity:.45; transform:scale(1);} 50% { opacity:.9; transform:scale(1.06);} }
      @keyframes rise { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none;} }
      @keyframes fade { from { opacity:0 } to { opacity:1 } }
      @keyframes sheetUp { from { opacity:0; transform:translateY(28px);} to { opacity:1; transform:none;} }
      @keyframes ritmSpin { to { transform: rotate(360deg) } }
      @keyframes ritmBar { 0%,100% { transform: scaleY(.45) } 50% { transform: scaleY(1) } }
      @keyframes ritmPop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.18); opacity: 1 } 100% { transform: scale(1) } }
      @keyframes ritmIn { from { opacity: 0; transform: translateY(12px) scale(.985); filter: blur(6px) } to { opacity: 1; transform: none; filter: none } }
      @keyframes ritmDraw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
      @keyframes ritmGrow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
      @keyframes ritmTick { from { opacity: 0; transform: translateY(40%); filter: blur(3px) } to { opacity: 1; transform: none; filter: none } }
      @keyframes ritmGlow { 0%,100% { box-shadow: 0 0 0 0 var(--ritm-accent-a, rgba(255,255,255,.25)) } 50% { box-shadow: 0 0 0 10px rgba(0,0,0,0) } }
      @keyframes ritmFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
      @keyframes ritmConfetti {
        0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg) }
        100% { opacity: 0; transform: translate3d(var(--drift), 105vh, 0) rotate(calc(var(--rot) + 540deg)) }
      }
      .ritm-spin { animation: ritmSpin .9s linear infinite }
      .ritm-pop { animation: ritmPop .38s cubic-bezier(.34,1.56,.64,1) both }
      .ritm-float { animation: ritmFloat 3.2s ease-in-out infinite }
      /* Элементы экрана появляются по очереди, лесенкой — при каждом переходе между разделами */
      .ritm-stagger > * > * { animation: ritmIn .42s cubic-bezier(.2,.8,.2,1) both }
      ${Array.from({ length: 14 }, (_, i) => `.ritm-stagger > * > *:nth-child(${i + 1}) { animation-delay: ${i * 35}ms }`).join("\n      ")}
      .ritm-stagger > * > *:nth-child(n+15) { animation-delay: 490ms }
      /* Карточки ниже первого экрана проявляются из размытия, когда до них доходит прокрутка (src/motion.jsx) */
      .ritm-rv { opacity: 0; transform: translateY(18px) scale(.985); filter: blur(6px) }
      .ritm-rv.ritm-rv-in { opacity: 1; transform: none; filter: none; transition: opacity .55s ease, transform .65s cubic-bezier(.2,.8,.2,1), filter .55s ease }
      /* Линии графиков прорисовываются слева направо, столбики растут снизу, точки появляются следом */
      .ritm-draw { stroke-dasharray: 1; animation: ritmDraw 1.3s cubic-bezier(.45,.05,.2,1) both }
      .ritm-grow { transform-box: fill-box; transform-origin: bottom; animation: ritmGrow .7s cubic-bezier(.2,.8,.2,1) both }
      .ritm-dot { animation: ritmPop .4s cubic-bezier(.34,1.56,.64,1) both }
      .ritm-tick { display: inline-block; animation: ritmTick .28s cubic-bezier(.2,.8,.2,1) both }
      .no-scrollbar::-webkit-scrollbar { display:none }
      .no-scrollbar { scrollbar-width: none }
      input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0 }
      input::placeholder, textarea::placeholder { color: rgba(255,255,255,.32) }
      input, textarea, select, button { font-family: inherit }
      input[type="time"]::-webkit-calendar-picker-indicator, input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: .45 }
      button, a, label { -webkit-tap-highlight-color: transparent }
      button:focus-visible, input:focus-visible, a:focus-visible, textarea:focus-visible { outline:2px solid var(--ritm-accent, #fff); outline-offset:2px }
      ::selection { background: var(--ritm-accent, #fff); color: #000 }
      /* Пружинка нажатия для кнопок задана в index.css (button:active) — здесь та же кривая плюс плавная смена фона */
      .ritm-press { transition: transform .15s cubic-bezier(.34,1.56,.64,1), background-color .2s ease, border-color .2s ease, opacity .15s ease, box-shadow .2s ease }
      a.ritm-press:active { transform: scale(.96) }
      @media (hover: hover) {
        .ritm-hover:hover { background-color: rgba(255,255,255,0.07) !important }
        .ritm-lift:hover { border-color: rgba(255,255,255,0.18) !important; transform: translateY(-2px); box-shadow: 0 14px 34px rgba(0,0,0,.35) !important }
      }
      @media (min-width: 1024px) {
        ::-webkit-scrollbar { width: 10px; height: 10px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.09); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box }
        ::-webkit-scrollbar-track { background: transparent }
      }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important } .ritm-rv { opacity: 1; transform: none; filter: none } .ritm-draw { stroke-dasharray: none } }
    `}</style>
  );
}

const H1 = ({ children }) => (
  <h1 style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.12 }}>{children}</h1>
);
const Muted = ({ children, className = "", size = 14, style }) => (
  <p className={className} style={{ color: MUTED, fontSize: size, lineHeight: 1.5, ...style }}>{children}</p>
);
const H2 = ({ children, right }) => (
  <div className="flex items-center justify-between mt-8 mb-3">
    <h2 style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>{children}</h2>
    {right}
  </div>
);

// Знак RITM: четыре столбика разной высоты — «ритм», как эквалайзер. animated — мягкая пульсация (заставка).
function RitmMark({ T, size = 22, animated = false }) {
  const bars = [0.55, 1, 0.72, 0.38];
  return (
    <span className="inline-flex items-end flex-shrink-0" aria-hidden="true" style={{ height: size, gap: size * 0.12 }}>
      {bars.map((h, i) => (
        <span key={i} style={{
          width: size * 0.17, height: size * h, borderRadius: size, background: T.grad, transformOrigin: "bottom",
          animation: animated ? `ritmBar 1.1s ${i * 0.14}s ease-in-out infinite` : "none",
        }} />
      ))}
    </span>
  );
}
function Wordmark({ T, size = 20 }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.5 }}>
      <RitmMark T={T} size={size} />
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "0.16em", lineHeight: 1 }}>RITM</span>
    </span>
  );
}

function Card({ T, children, className = "", style, onClick }) {
  const Tag = onClick ? "button" : "div";
  const ref = useRef(null);
  useLayoutEffect(() => observeReveal(ref.current), []);
  return (
    <Tag ref={ref} onClick={onClick} className={`w-full text-left rounded-[22px] p-4 ${onClick ? "ritm-press ritm-lift" : ""} ${className}`}
      style={{ background: T.card, border: `1px solid ${T.line}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)", color: "#fff", ...style }}>
      {children}
    </Tag>
  );
}

function Primary({ T, children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full rounded-2xl py-3.5 px-4 font-semibold flex items-center justify-center gap-2 ritm-press"
      style={{ background: T.grad, color: T.on, boxShadow: disabled ? "none" : T.glow, opacity: disabled ? 0.35 : 1, fontSize: 15, letterSpacing: "-0.01em" }}>
      {children}
    </button>
  );
}
// Та же кнопка, но ссылкой — для переходов, которые браузер не должен блокировать как всплывающее окно
function PrimaryLink({ T, children, href, onClick }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
      className="w-full rounded-2xl py-3.5 px-4 font-semibold flex items-center justify-center gap-2 ritm-press"
      style={{ background: T.grad, color: T.on, boxShadow: T.glow, fontSize: 15, letterSpacing: "-0.01em", textDecoration: "none" }}>
      {children}
    </a>
  );
}

function Ghost({ T, children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-2xl py-3 px-4 font-medium flex items-center justify-center gap-2 ritm-press ritm-hover"
      style={{ border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.035)", color: "#fff", opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

function Toggle({ T, on, onChange, label }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} aria-label={label} className="relative rounded-full flex-shrink-0"
      style={{ width: 48, height: 28, background: on ? T.grad : "rgba(255,255,255,0.12)", transition: "background .2s" }}>
      <span className="absolute rounded-full" style={{ width: 22, height: 22, top: 3, left: on ? 23 : 3, background: on ? T.on : "#fff", boxShadow: "0 2px 6px rgba(0,0,0,.35)", transition: "left .22s cubic-bezier(.3,.7,.3,1)" }} />
    </button>
  );
}

function CheckBox({ T, on, onClick, size = 26, label }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label} className="rounded-full flex items-center justify-center flex-shrink-0 ritm-press"
      style={{ width: size, height: size, border: on ? "none" : "1.5px solid rgba(255,255,255,0.28)", background: on ? T.grad : "rgba(255,255,255,0.02)", boxShadow: on ? T.glow : "none", color: T.on, transition: "all .2s" }}>
      {on && <Check size={size * 0.55} strokeWidth={3} className="ritm-pop" />}
    </button>
  );
}

function Segmented({ T, items, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl my-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.line}` }}>
      {items.map((it, i) => (
        <button key={i} onClick={() => onChange(i)} className="flex-1 rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1 ritm-press"
          style={{ background: value === i ? T.grad : "transparent", color: value === i ? T.on : "rgba(255,255,255,0.8)", transition: "background .2s, color .2s" }}>
          {it}
        </button>
      ))}
    </div>
  );
}

// Шторка снизу на телефоне и окно по центру на компьютере. Закрывается по фону и по Esc,
// пока открыта — страница под ней не прокручивается.
function Sheet({ T, title, sub, onClose, children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-8"
      style={{ background: "rgba(2,3,5,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animation: "fade .2s ease-out" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title || undefined}
        className="w-full max-w-md md:max-w-lg overflow-y-auto no-scrollbar rounded-t-[30px] md:rounded-[30px]"
        style={{ maxHeight: "92vh", background: T.surface || "#0F1013", border: `1px solid ${T.line}`, boxShadow: `0 -24px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,0.05)`, padding: "10px 20px calc(30px + env(safe-area-inset-bottom))", animation: "sheetUp .3s cubic-bezier(.2,.8,.2,1)" }}>
        <div className="mx-auto mb-3 rounded-full md:hidden" style={{ width: 38, height: 4, background: "rgba(255,255,255,0.16)" }} />
        <div className="flex items-start justify-between gap-3 mb-1 md:pt-3">
          <h2 style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{title}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-2 flex-shrink-0 ritm-press ritm-hover" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
            <X size={18} />
          </button>
        </div>
        {sub && <Muted size={13} className="mb-3">{sub}</Muted>}
        {children}
      </div>
    </div>
  );
}

// Полноэкранный режим (тренировка, зарядка, дыхание). Телефон — на весь экран. Планшет и компьютер —
// окно по центру шириной с телефон, чтобы фото техники, счётчики и кнопки не растягивались на всю
// ширину монитора (раньше на широком экране фото превращалось в узкую полоску, а «+/−» разъезжались
// по краям). center — содержимое по центру (экраны «Готово», «Новый рекорд», дыхание).
function FullScreen({ T, children, center = false, label }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center md:p-6" role="dialog" aria-modal="true" aria-label={label}
      style={{ background: "rgba(2,3,5,0.84)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", animation: "fade .2s ease-out" }}>
      <div className={`relative w-full md:max-w-lg h-full md:h-[min(880px,94vh)] md:rounded-[32px] md:border overflow-hidden flex flex-col ${center ? "items-center justify-center px-6 text-center" : ""}`}
        style={{ background: T.bg, borderColor: T.line, boxShadow: "0 40px 120px rgba(0,0,0,.6)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", animation: "sheetUp .34s cubic-bezier(.2,.8,.2,1)" }}>
        {children}
      </div>
    </div>
  );
}

// Конфетти для моментов успеха (рекорд, оплата, завершённая зарядка). Чистый CSS, без библиотек;
// при «уменьшить движение» в системе не показывается вообще (глобальное правило в GlobalStyle).
function Confetti({ T, count = 34 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.35,
    dur: 1.6 + Math.random() * 1.2,
    size: 6 + Math.random() * 6,
    rot: Math.random() * 360,
    drift: (Math.random() - 0.5) * 140,
    color: [T.a, T.b, "#FFFFFF", T.a, T.b][i % 5],
    round: i % 3 === 0,
  })), [count, T.a, T.b]);
  return (
    <div aria-hidden="true" className="pointer-events-none" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: "absolute", top: -20, left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.45,
          borderRadius: p.round ? "50%" : 2, background: p.color, opacity: 0, "--drift": `${p.drift}px`, "--rot": `${p.rot}deg`,
          animation: `ritmConfetti ${p.dur}s ${p.delay}s cubic-bezier(.25,.6,.35,1) forwards`,
        }} />
      ))}
    </div>
  );
}

// Плавный «набег» числа от прежнего значения к новому (проценты дня, калории и т.п.)
// initial — с какого значения начать при первом показе (например, 0 — кольцо «заполняется» при открытии)
function useCountUp(target, duration = 700, initial) {
  const [value, setValue] = useState(initial ?? target);
  const fromRef = useRef(initial ?? target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target || typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target; setValue(target); return undefined;
    }
    let raf; const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick); else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); fromRef.current = target; };
  }, [target, duration]);
  return value;
}

// Кольцо дня: прогресс + «метроном» из делений по кругу — закрашенные деления показывают, сколько уже сделано.
function Orb({ T, value: target }) {
  const r = 78, c = 2 * Math.PI * r;
  const ticks = 48;
  // При открытии кольцо «набегает» с нуля, при отметке задачи/привычки — плавно доезжает до нового значения
  const value = useCountUp(target, 900, 0);
  const lit = Math.round(value * ticks);
  return (
    <div className="relative mx-auto my-5" style={{ width: 216, height: 216 }}>
      <div className="absolute rounded-full" style={{ inset: 44, background: T.grad, filter: "blur(46px)", opacity: 0.5, animation: "breathe 6s ease-in-out infinite" }} />
      <svg width="216" height="216" viewBox="0 0 216 216" className="relative">
        <defs>
          <linearGradient id="orbGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={T.a} />
            <stop offset="100%" stopColor={T.b} />
          </linearGradient>
        </defs>
        {Array.from({ length: ticks }, (_, i) => {
          const ang = (i / ticks) * Math.PI * 2 - Math.PI / 2;
          const r1 = 98, r2 = i % 4 === 0 ? 105 : 102;
          return (
            <line key={i} x1={108 + r1 * Math.cos(ang)} y1={108 + r1 * Math.sin(ang)} x2={108 + r2 * Math.cos(ang)} y2={108 + r2 * Math.sin(ang)}
              stroke={i < lit ? T.a : "rgba(255,255,255,0.14)"} strokeWidth={i % 4 === 0 ? 2.2 : 1.5} strokeLinecap="round"
              style={{ transition: "stroke .25s ease" }} />
          );
        })}
        <circle cx="108" cy="108" r={r} stroke="rgba(255,255,255,0.07)" strokeWidth="12" fill="none" />
        <circle cx="108" cy="108" r={r} stroke="url(#orbGrad)" strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 108 108)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div style={{ fontFamily: DISPLAY, fontSize: 50, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(value * 100)}<span style={{ fontSize: 20, color: MUTED, marginLeft: 2 }}>%</span>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>дня выполнено</div>
      </div>
    </div>
  );
}

/* ============ Общие UI-элементы (чипы, загрузка) ============ */
function Chip({ T, on, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="rounded-full px-3.5 py-2 flex items-center gap-1 font-medium ritm-press"
      style={{ fontSize: 14, border: `1px solid ${on ? "transparent" : T.line}`, background: on ? T.grad : "rgba(255,255,255,0.04)", color: on ? T.on : "#fff", transition: "all .2s" }}>
      {on && <Check size={13} strokeWidth={3} className="ritm-pop" />}
      {children}
    </button>
  );
}

function Loader({ T, text }) {
  return (
    <div className="flex flex-col items-center py-10 gap-5">
      <RitmMark T={T} size={40} animated />
      <Muted className="text-center">{text}</Muted>
    </div>
  );
}

// Пропускаем вопросы, чьё condition(a) не выполняется (сейчас это только «темп» для mass/fat)
const applicable = (a) => QUESTIONS.filter((q) => !q.condition || q.condition(a));
const stepAfter = (i, a, dir) => {
  let n = i + dir;
  while (n >= 0 && n < QUESTIONS.length && QUESTIONS[n].condition && !QUESTIONS[n].condition(a)) n += dir;
  return n;
};
const resolve = (q, a, field) => (typeof q[field] === "function" ? q[field](a) : q[field]);

/* ============ Хранение и синхронизация ============
   Копия данных лежит на устройстве (быстрый запуск, работа без сети), а основная — в облаке Telegram
   (CloudStorage): она привязана к аккаунту и видна на телефоне и компьютере.
   Ограничения Telegram: до 1024 ключей, до 4096 символов в ключе. Поэтому состояние делится на разделы,
   питание и отметки — по месяцам, а каждый раздел режется на части. При изменении отправляются только
   изменённые разделы. Какая версия новее, решает время изменения; при первом подключении устройства
   и при одновременных правках данные объединяются, а не затираются. */
const LOCAL_KEY = "ritm-state-local";
const LEGACY_LOCAL_KEY = "forma-state";
const SYNC_META_KEY = "ritm-sync-meta";
const OLD_CLOUD_PREFIX = "ritm-state-v2"; // формат предыдущей версии — переносим автоматически
const CLOUD_MANIFEST = "ritm3_m";
const CLOUD_CHUNK = 3500;
const CLOUD_MAX_KEYS = 1000;
const DAY_MAPS = ["food", "tasks", "water", "scans", "done", "runDone", "steps", "sleep", "wellbeing", "assistantUses", "weight"];

const localStore = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } },
};

/* ============ Журнал ошибок ============
   Раньше при любой необработанной ошибке React без предупреждения размонтировал всё
   приложение — человек видел просто чёрный/белый экран и считал это «вылетом бота»,
   не имея возможности рассказать, что именно произошло. Теперь любая ошибка (и в рендере
   через ErrorBoundary, и вне React через window.onerror/unhandledrejection) попадает в
   локальный журнал — последние 20 штук с местом и временем — его можно скопировать в
   Настройках → Поддержка и прислать разработчику, вместо «оно просто вылетело». */
const ERROR_LOG_KEY = "ritm-error-log";
function pushErrorLog(source, err) {
  try {
    const entry = {
      at: new Date().toISOString(),
      source,
      message: String(err?.message || err || "неизвестная ошибка").slice(0, 300),
      stack: String(err?.stack || "").split("\n").slice(0, 4).join(" | ").slice(0, 500),
      tab: typeof window !== "undefined" ? window.__ritmCurrentTab || "" : "",
    };
    const log = readErrorLog();
    log.unshift(entry);
    localStore.set(ERROR_LOG_KEY, JSON.stringify(log.slice(0, 20)));
  } catch (e) { /* журнал — для диагностики, не критично, если не записался */ }
}
function readErrorLog() {
  try { return JSON.parse(localStore.get(ERROR_LOG_KEY) || "[]"); } catch (e) { return []; }
}
function clearErrorLog() { localStore.set(ERROR_LOG_KEY, "[]"); }
function errorLogText() {
  const log = readErrorLog();
  if (!log.length) return "Ошибок не записано.";
  return log.map((e) => `[${e.at}] ${e.source}${e.tab ? ` (${e.tab})` : ""}: ${e.message}\n${e.stack}`).join("\n\n");
}
// Устанавливается один раз при старте приложения (main.jsx) — ловит то, что мимо ErrorBoundary:
// необработанные исключения вне рендера и отклонённые промисы (например, сетевой запрос без catch).
export function installGlobalErrorLogging() {
  if (typeof window === "undefined" || window.__ritmErrorLoggingInstalled) return;
  window.__ritmErrorLoggingInstalled = true;
  window.addEventListener("error", (e) => pushErrorLog("window.onerror", e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => pushErrorLog("unhandledrejection", e.reason));
}

// Перехватывает ошибки рендера где угодно в дереве — без этого одна необработанная ошибка
// в любом экране размонтировала всё приложение целиком (чёрный экран без возможности продолжить).
// Вместо этого показываем короткий экран с кнопкой «Перезагрузить» — данные не теряются,
// они уже сохранены в CloudStorage/localStorage на каждое изменение, а не только при выходе.
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { pushErrorLog("render", Object.assign(error, { stack: error?.stack || info?.componentStack })); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: "#08090B", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: BODY }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Что-то пошло не так</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24, maxWidth: 320 }}>
          Данные не потеряны — они сохраняются на каждое изменение. Перезапусти приложение; если это повторится, в Настройках → Поддержка можно скопировать журнал ошибок и прислать разработчику.
        </div>
        <button onClick={() => window.location.reload()} style={{ background: THEMES.ritm.grad, color: THEMES.ritm.on, border: "none", borderRadius: 16, padding: "13px 28px", fontSize: 15, fontWeight: 600 }}>
          Перезагрузить
        </button>
      </div>
    );
  }
}
// Локальная копия хранится отдельно для каждого аккаунта (Telegram ID — и в Mini App, и на сайте после входа)
const userScope = () => {
  const id = typeof window !== "undefined" ? currentUser()?.id : null;
  return id ? `-${id}` : "";
};
function readLocalState() {
  for (const key of [LOCAL_KEY + userScope(), LOCAL_KEY, LEGACY_LOCAL_KEY]) {
    const raw = localStore.get(key);
    if (!raw) continue;
    try { return JSON.parse(raw); } catch (e) { /* испорченная копия — пробуем следующую */ }
  }
  return null;
}
const writeLocalState = (st) => localStore.set(LOCAL_KEY + userScope(), JSON.stringify(st));
// kind — какое хранилище: "" — облако Telegram (как раньше), "-srv" — сервер сайта (/api/state)
function readSyncMeta(kind = "") {
  try { return { lastSynced: 0, everSynced: false, ...JSON.parse(localStore.get(SYNC_META_KEY + kind + userScope()) || "{}") }; }
  catch (e) { return { lastSynced: 0, everSynced: false }; }
}
const writeSyncMeta = (meta, kind = "") => localStore.set(SYNC_META_KEY + kind + userScope(), JSON.stringify({ lastSynced: meta.lastSynced, everSynced: meta.everSynced }));

// Обёртка над Telegram.WebApp.CloudStorage с промисами, пачками по 20 ключей и таймаутом
function cloudApi(cs = typeof window !== "undefined" ? tgApp()?.CloudStorage : null) {
  const tg = typeof window !== "undefined" ? tgApp() : null;
  if (!cs || typeof cs.setItem !== "function" || typeof cs.getItems !== "function") return null;
  if (tg?.isVersionAtLeast && !tg.isVersionAtLeast("6.9")) return null;
  const call = (method, ...args) => new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error("cloud_timeout")); } }, 15000);
    try {
      cs[method](...args, (err, res) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(new Error(String(err))); else resolve(res);
      });
    } catch (e) { done = true; clearTimeout(timer); reject(e); }
  });
  return {
    async get(keys) {
      const out = {};
      for (let i = 0; i < keys.length; i += 20) {
        const part = keys.slice(i, i + 20);
        const res = await call("getItems", part);
        part.forEach((k, j) => { out[k] = (Array.isArray(res) ? res[j] : res?.[k]) || ""; });
      }
      return out;
    },
    set: (key, value) => call("setItem", key, value),
    async remove(keys) {
      for (let i = 0; i < keys.length; i += 20) await call("removeItems", keys.slice(i, i + 20));
    },
  };
}

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthsBack = (now, n) => monthKey(new Date(now.getFullYear(), now.getMonth() - n, 1));
const sectionKey = (name, i) => `ritm3_${name.replace(/[^A-Za-z0-9_-]/g, "_")}_${i}`;
const chunkCount = (json) => Math.max(1, Math.ceil(json.length / CLOUD_CHUNK));

// Делит состояние на разделы. В облако уходят последние `months` месяцев дневников (отметки о распознаваниях — 1 месяц);
// более старая история остаётся на устройстве
function stateSections(st, now, months) {
  const since = {};
  for (const k of DAY_MAPS) since[k] = monthsBack(now, k === "scans" ? 0 : months - 1);
  const sections = {};
  for (const [k, v] of Object.entries(st)) {
    if (k === "updatedAt" || v === undefined) continue;
    if (DAY_MAPS.includes(k) && v && typeof v === "object" && !Array.isArray(v)) {
      const byMonth = {};
      for (const [day, val] of Object.entries(v)) {
        const m = day.slice(0, 7);
        if (m < since[k]) continue;
        if (!byMonth[m]) byMonth[m] = {};
        byMonth[m][day] = val;
      }
      for (const [m, part] of Object.entries(byMonth)) sections[`${k}~${m}`] = JSON.stringify(part);
    } else {
      sections[k] = JSON.stringify(v);
    }
  }
  return { sections, since };
}

function fitSections(st, now = new Date()) {
  let source = st;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (let months = 6; months >= 1; months--) {
      const res = stateSections(source, now, months);
      const keys = 1 + Object.values(res.sections).reduce((n, j) => n + chunkCount(j), 0);
      const manifestSize = Object.keys(res.sections).reduce((n, name) => n + name.length + 20, 200);
      if (keys <= CLOUD_MAX_KEYS && manifestSize < 3800) return res;
    }
    // крайний случай: оставляем в облаке только последние 300 записей истории тренировок
    source = { ...st, trainHistory: (st.trainHistory || []).slice(0, 300) };
  }
  return stateSections(source, now, 1);
}

const byId = (older = [], newer = []) => {
  const map = new Map();
  for (const x of older || []) map.set(x.id, x);
  for (const x of newer || []) map.set(x.id, x);
  return [...map.values()];
};
const mergeLogs = (a = {}, b = {}) => {
  const out = { ...a };
  for (const [d, v] of Object.entries(b || {})) out[d] = !!(v || out[d]);
  return out;
};
const mergeLogged = (older = [], newer = []) => byId(older, newer).map((x) => {
  const o = (older || []).find((y) => y.id === x.id);
  return o ? { ...x, log: mergeLogs(o.log, x.log) } : x;
});
const hasUserData = (st) => !!st && (!!st.profile || DAY_MAPS.some((k) => Object.keys(st[k] || {}).length > 0) || (st.workouts || []).length > 0);

// Объединение двух версий: настройки — из более новой, дневники и списки — вместе
function mergeStates(a, b) {
  const [older, newer] = (a.updatedAt || 0) <= (b.updatedAt || 0) ? [a, b] : [b, a];
  const out = { ...older, ...newer };
  for (const k of ["food", "tasks"]) {
    const days = new Set([...Object.keys(older[k] || {}), ...Object.keys(newer[k] || {})]);
    out[k] = {};
    for (const d of days) out[k][d] = byId(older[k]?.[d], newer[k]?.[d]);
  }
  // scans/assistantUses — чистые счётчики использования (антиабуз), они не должны откатываться назад,
  // поэтому берём максимум. water и steps человек может скорректировать вручную и вниз (опечатка,
  // исправление шагов) — max() тогда навсегда «залипал» бы на завышенном значении, поэтому они
  // объединяются как sleep/wellbeing/weight — значение с более нового устройства побеждает.
  for (const k of ["scans", "assistantUses"]) {
    out[k] = { ...(older[k] || {}) };
    for (const [d, v] of Object.entries(newer[k] || {})) out[k][d] = Math.max(Number(v) || 0, Number(out[k][d]) || 0);
  }
  for (const k of ["sleep", "wellbeing", "weight", "water", "steps"]) out[k] = { ...(older[k] || {}), ...(newer[k] || {}) };
  for (const k of ["done", "runDone", "breathLog"]) out[k] = mergeLogs(older[k], newer[k]);
  out.habits = mergeLogged(older.habits, newer.habits);
  out.dailyTasks = mergeLogged(older.dailyTasks, newer.dailyTasks);
  out.workouts = byId(older.workouts, newer.workouts);
  out.taskLists = byId(older.taskLists, newer.taskLists).length ? byId(older.taskLists, newer.taskLists) : DEFAULT.taskLists;
  out.books = byId(older.books, newer.books);
  out.challenges = byId(older.challenges, newer.challenges);
  out.journal = byId(older.journal, newer.journal);
  // Статистику дыхательных практик не даём «откатиться» назад из-за более позднего, но менее полного устройства
  out.breathStats = {
    totalSessions: Math.max(older.breathStats?.totalSessions || 0, newer.breathStats?.totalSessions || 0),
    totalMinutes: Math.max(older.breathStats?.totalMinutes || 0, newer.breathStats?.totalMinutes || 0),
  };
  out.devThemes = byId(older.devThemes, newer.devThemes).map((th) => {
    const o = (older.devThemes || []).find((y) => y.id === th.id);
    return o ? { ...th, tasks: byId(o.tasks, th.tasks) } : th;
  });
  out.trainHistory = byId(older.trainHistory, newer.trainHistory).sort((x, y) => (Number(y.id) || 0) - (Number(x.id) || 0));
  out.products = { ...(older.products || {}), ...(newer.products || {}) };
  // exLog двигает автопрогрессию рабочего веса — если взять его «новое устройство побеждает целиком»,
  // более продвинутый вес с одного устройства может затереться более старым значением с другого только
  // потому что у того устройства в целом более новый updatedAt. Сравниваем по каждому упражнению отдельно
  // и оставляем более продвинутую запись (тот же принцип, что и у records ниже).
  out.exLog = {};
  for (const id of new Set([...Object.keys(older.exLog || {}), ...Object.keys(newer.exLog || {})])) {
    const a = older.exLog?.[id], b = newer.exLog?.[id];
    if (!a) { out.exLog[id] = b; continue; }
    if (!b) { out.exLog[id] = a; continue; }
    const aw = Number(a.weight) || 0, bw = Number(b.weight) || 0;
    if (aw !== bw) out.exLog[id] = aw > bw ? a : b;
    else out.exLog[id] = (Number(a.lastMin) || 0) >= (Number(b.lastMin) || 0) ? a : b;
  }
  // Рекорд не должен «откатиться» назад только из-за того, что другое устройство синхронизировалось позже —
  // берём максимум по каждому полю, а не просто значение более нового устройства
  out.records = {};
  for (const id of new Set([...Object.keys(older.records || {}), ...Object.keys(newer.records || {})])) {
    const a = older.records?.[id], b = newer.records?.[id];
    const weight = Math.max(a?.weight ?? -Infinity, b?.weight ?? -Infinity);
    const reps = Math.max(a?.reps ?? -Infinity, b?.reps ?? -Infinity);
    out.records[id] = { weight: weight === -Infinity ? null : weight, reps: reps === -Infinity ? null : reps, at: Math.max(a?.at || 0, b?.at || 0) };
  }
  out.profile = newer.profile || older.profile;
  out.pro = !!(older.pro || newer.pro);
  out.tourSeen = !!(older.tourSeen || newer.tourSeen);
  return out;
}

// Облачная версия заменяет локальную, но история старше облачного окна сохраняется
function applyCloud(local, cloud, since = {}) {
  const out = { ...cloud };
  for (const k of DAY_MAPS) {
    const limit = since[k];
    if (!limit || !local?.[k]) continue;
    const older = Object.fromEntries(Object.entries(local[k]).filter(([day]) => day.slice(0, 7) < limit));
    out[k] = { ...older, ...(cloud[k] || {}) };
  }
  out.trainHistory = byId(local?.trainHistory, cloud.trainHistory).sort((x, y) => (Number(y.id) || 0) - (Number(x.id) || 0));
  return out;
}

async function cloudPull(api, knownUpdatedAt = null) {
  const head = await api.get([CLOUD_MANIFEST, `${OLD_CLOUD_PREFIX}-meta`]);
  if (!head[CLOUD_MANIFEST]) {
    // облака нового формата нет — возможно, данные остались от прошлой версии приложения
    if (!head[`${OLD_CLOUD_PREFIX}-meta`]) return null;
    const old = JSON.parse(head[`${OLD_CLOUD_PREFIX}-meta`]);
    const count = Math.max(0, Number(old.count) || 0);
    const keys = Array.from({ length: count }, (_, i) => `${OLD_CLOUD_PREFIX}-${i}`);
    const values = await api.get(keys);
    const state = JSON.parse(keys.map((k) => values[k]).join(""));
    state.updatedAt = Number(state.updatedAt) || Number(old.updatedAt) || 0;
    return { state, manifest: { updatedAt: state.updatedAt, since: {}, sections: {} }, sections: {}, legacyCount: count };
  }
  const manifest = JSON.parse(head[CLOUD_MANIFEST]);
  if (knownUpdatedAt !== null && manifest.updatedAt === knownUpdatedAt) return { unchanged: true, manifest };
  const names = Object.keys(manifest.sections || {});
  const keys = names.flatMap((n) => Array.from({ length: manifest.sections[n][0] }, (_, i) => sectionKey(n, i)));
  const values = await api.get(keys);
  const sections = {};
  const state = {};
  for (const n of names) {
    const [count, length] = manifest.sections[n];
    const json = Array.from({ length: count }, (_, i) => values[sectionKey(n, i)]).join("");
    // длина не сошлась — другое устройство как раз записывает данные; попробуем позже
    if (json.length !== length) throw new Error("cloud_inconsistent");
    sections[n] = json;
    const value = JSON.parse(json);
    const [k, m] = n.split("~");
    if (m !== undefined) state[k] = { ...(state[k] || {}), ...value };
    else state[k] = value;
  }
  state.updatedAt = manifest.updatedAt || 0;
  return { state, manifest, sections };
}

async function cloudPush(api, st, cache = {}, now = new Date()) {
  const { sections, since } = fitSections(st, now);
  const prev = cache.sections || {};
  const prevMeta = cache.manifest?.sections || {};
  const meta = {};
  for (const [name, json] of Object.entries(sections)) {
    const n = chunkCount(json);
    meta[name] = [n, json.length];
    if (prev[name] === json) continue;
    for (let i = 0; i < n; i++) await api.set(sectionKey(name, i), json.slice(i * CLOUD_CHUNK, (i + 1) * CLOUD_CHUNK));
  }
  const stale = [];
  for (const [name, v] of Object.entries(prevMeta)) {
    const oldN = Array.isArray(v) ? v[0] : 0;
    const newN = meta[name] ? meta[name][0] : 0;
    for (let i = newN; i < oldN; i++) stale.push(sectionKey(name, i));
  }
  const manifest = { v: 3, updatedAt: st.updatedAt || Date.now(), since, sections: meta };
  // оглавление пишем последним: другое устройство не увидит наполовину записанные данные
  await api.set(CLOUD_MANIFEST, JSON.stringify(manifest));
  if (stale.length) await api.remove(stale);
  if (cache.legacyCount) {
    await api.remove([`${OLD_CLOUD_PREFIX}-meta`, ...Array.from({ length: cache.legacyCount }, (_, i) => `${OLD_CLOUD_PREFIX}-${i}`)]);
  }
  return { manifest, sections };
}

// Откуда и куда синхронизировать. Оба варианта отдают данные в одном формате, поэтому
// решение «что новее / что объединить» принимает один и тот же createSync.
// Облако Telegram (только в Mini App): данные кусками по 3500 символов, как и раньше.
const telegramTransport = (api) => ({
  pull: (known) => cloudPull(api, known),
  push: (st, cache) => cloudPush(api, st, cache),
});
// Сервер сайта (/api/state): весь снимок одним запросом. Работает и на сайте (вход через бота),
// и в Mini App — так данные из Telegram видны на сайте и в установленном приложении, и наоборот.
// base — версия сервера, которую видели последней: если её успело обновить другое устройство,
// сервер ответит 409, и createSync сразу повторит цикл — заберёт свежее и объединит.
const serverTransport = () => ({
  async pull(known) {
    const r = await fetch(apiUrl(`/api/state${known ? `?known=${known}` : ""}`), { headers: authHeaders(), cache: "no-store" });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) throw new Error(d?.error || `state_${r.status}`);
    if (d.empty) return null;
    if (d.unchanged) return { unchanged: true, manifest: { updatedAt: d.updatedAt } };
    return { state: { ...d.state, updatedAt: d.updatedAt }, manifest: { updatedAt: d.updatedAt, since: {} }, sections: {} };
  },
  async push(st, cache = {}) {
    const r = await fetch(apiUrl("/api/state"), {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ state: st, base: cache.manifest?.updatedAt ?? null }),
    });
    const d = await r.json().catch(() => null);
    if (r.status === 409) throw new Error("conflict");
    if (!r.ok || !d) throw new Error(d?.error || `state_${r.status}`);
    return { manifest: { updatedAt: d.updatedAt, since: {} }, sections: {} };
  },
});

// Один цикл синхронизации: забрать облако → решить, что новее → при необходимости объединить → отправить
function createSync({ transport, meta, getState, applyState, onStatus }) {
  let busy = false;
  let again = false;
  let cache = {};
  const run = async () => {
    if (!transport) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const local = getState();
      const lu = local.updatedAt || 0;
      const pulled = await transport.pull(meta.everSynced && cache.manifest ? meta.lastSynced : null);
      let next = null;
      let push = false;
      if (!pulled) {
        push = hasUserData(local);
      } else if (pulled.unchanged) {
        push = lu > meta.lastSynced;
      } else {
        cache = { manifest: pulled.manifest, sections: pulled.sections, legacyCount: pulled.legacyCount || 0 };
        const cloud = pulled.state;
        const cu = cloud.updatedAt || 0;
        if (!meta.everSynced) {
          if (!hasUserData(local)) next = applyCloud(local, cloud, pulled.manifest.since);
          else { next = { ...mergeStates(local, cloud), updatedAt: Math.max(Date.now(), lu + 1, cu + 1) }; push = true; }
        } else if (cu !== lu) {
          const localDirty = lu > meta.lastSynced;
          const cloudChanged = cu !== meta.lastSynced;
          if (!localDirty) next = applyCloud(local, cloud, pulled.manifest.since);
          else if (!cloudChanged) push = true;
          else { next = { ...mergeStates(local, cloud), updatedAt: Math.max(Date.now(), lu + 1, cu + 1) }; push = true; }
        }
        if (pulled.legacyCount) push = true;
        if (!push) meta.lastSynced = (next || local).updatedAt || cu;
      }
      if (next) applyState(next);
      if (push) {
        cache = await transport.push(next || local, cache);
        meta.lastSynced = cache.manifest.updatedAt;
      }
      meta.everSynced = true;
      onStatus({ ok: true, at: Date.now() });
    } catch (e) {
      // Другое устройство успело записать раньше — сразу ещё один цикл: заберём и объединим
      if (e?.message === "conflict") again = true;
      else onStatus({ ok: false, error: String(e?.message || e) });
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(run, 300); }
    }
  };
  return { run, isDirty: (st) => (st.updatedAt || 0) > meta.lastSynced };
}

function SyncCard({ T, sync, onSyncNow }) {
  if (sync.mode !== "cloud" && sync.mode !== "server") {
    return (
      <Card T={T}>
        <div className="font-semibold mb-1">Синхронизация недоступна</div>
        <Muted size={12}>{isWeb() ? "Войди через Telegram — тогда данные будут одинаковыми на сайте, в приложении на телефоне и в Mini App." : "Открой RITM из Telegram (нужна свежая версия приложения). Сейчас данные хранятся только на этом устройстве."}</Muted>
      </Card>
    );
  }
  const time = sync.at ? new Date(sync.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <Card T={T}>
      <div className="flex items-center gap-2 font-semibold mb-1"><Cloud size={16} color={T.a} /> Все устройства</div>
      <Muted size={12}>{sync.mode === "server"
        ? "Данные привязаны к твоему Telegram-аккаунту: одинаковые на сайте, в приложении на телефоне и в Mini App."
        : "Данные хранятся в облаке Telegram и на сервере RITM — одинаковые в Mini App, на сайте и в приложении на телефоне."}</Muted>
      <Muted size={12} className="mt-2" style={sync.ok === false ? { color: T.a } : undefined}>
        {sync.busy ? "Синхронизирую…" : sync.ok === false ? "Не удалось синхронизировать. Повторю автоматически." : time ? `Синхронизировано в ${time}` : "Ещё не синхронизировано"}
      </Muted>
      <div className="mt-3"><Ghost T={T} onClick={onSyncNow}><Repeat size={16} /> Синхронизировать сейчас</Ghost></div>
    </Card>
  );
}

function Onboarding({ T, onDone }) {
  const [i, setI] = useState(0);
  const [a, setA] = useState({ age: 25, height: 175, weight: 70, allergies: [], targetKg: 0 });
  useEffect(() => { goal("onboarding_start"); }, []);
  const [summary, setSummary] = useState(false);
  const q = QUESTIONS[i];
  const pos = applicable(a).indexOf(q);

  const goNext = () => { const n = stepAfter(i, a, 1); n >= QUESTIONS.length ? setSummary(true) : setI(n); };
  const goBack = () => { const n = stepAfter(i, a, -1); if (n >= 0) setI(n); };
  const pick = (val) => { setA({ ...a, [q.key]: val }); setTimeout(goNext, 180); };
  const nextNumbers = () => {
    const na = { ...a };
    q.numbers.forEach((f) => { na[f.k] = Math.min(f.max, Math.max(f.min, Number(na[f.k]) || f.min)); });
    setA(na);
    const savedA = na; // condition() ниже должно видеть свежие значения
    const n = stepAfter(i, savedA, 1);
    n >= QUESTIONS.length ? setSummary(true) : setI(n);
  };

  if (summary) {
    const bmi = a.weight / (a.height / 100) ** 2;
    const bmiText = bmi < 18.5 ? "ниже нормы" : bmi < 25 ? "в норме" : bmi < 30 ? "выше нормы" : "заметно выше нормы";
    const hr = 220 - a.age;
    const range = repRangeFor(a);
    const n = calcNutrition(a);
    const hasRate = a.goal === "mass" || a.goal === "fat";
    const kgWeek = hasRate ? (a.rate || 0) / 100 * a.weight : 0;
    const etaWeeks = hasRate && kgWeek > 0 ? Math.round((a.targetKg || 0) / kgWeek) : 0;
    return (
      <div className="max-w-md mx-auto px-5 pt-8 pb-10 min-h-screen flex flex-col" style={{ animation: "rise .4s ease-out" }}>
        <H1>Анкета готова</H1>
        <Muted className="mt-2 mb-6">Вот что я учёл, когда собирал твою программу</Muted>
        <div className="flex flex-col gap-3">
          <Card T={T}>
            <Muted size={13}>Индекс массы тела</Muted>
            <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 600 }}>{fmt(bmi.toFixed(1))}</div>
            <Muted size={13}>Это {bmiText}</Muted>
          </Card>
          <Card T={T}>
            <Muted size={13}>Пульс для лёгкого бега</Muted>
            <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 600 }}>{Math.round(hr * 0.6)}–{Math.round(hr * 0.7)}</div>
            <Muted size={13}>ударов в минуту</Muted>
          </Card>
          <Card T={T}>
            <Muted size={13}>Схема силовых</Muted>
            <div className="font-semibold mt-1">Фулбади, {range.lo}–{range.hi} повторов до отказа</div>
            <Muted size={13}>Отдых {range.restLabel}, {a.days} силовые и 3 беговые тренировки в неделю, место: {LABELS.place[a.place]}</Muted>
          </Card>
          <Card T={T}>
            <Muted size={13}>Норма питания в день</Muted>
            <div className="flex items-baseline gap-2">
              <span style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 600 }}>{n.kcal.toLocaleString("ru-RU")}</span>
              <span style={{ color: MUTED, fontSize: 13 }}>ккал</span>
            </div>
            <Muted size={13}>Белки {n.protein} г, жиры {n.fat} г, углеводы {n.carbs} г</Muted>
            {hasRate && <Muted size={13}>Темп: {a.goal === "mass" ? "+" : "−"}{fmt(kgWeek.toFixed(2))} кг в неделю, это ориентир, а не точная математика</Muted>}
            {hasRate && a.targetKg > 0 && <Muted size={13}>Цель {a.targetKg} кг — примерно {etaWeeks} {weeksWord(etaWeeks)} при этом темпе</Muted>}
            {a.allergies.length > 0 && <Muted size={13}>Исключаю: {alLabels(a.allergies)}</Muted>}
          </Card>
        </div>
        <Muted size={12} className="mt-4">Если есть травмы или хронические заболевания, покажи программу врачу перед стартом.</Muted>
        {a.age < 18 && (
          <Muted size={12} className="mt-2">Тебе меньше 18 — калораж я держу мягким. Большие изменения в питании обсуди с родителем и врачом.</Muted>
        )}
        <div className="mt-auto pt-8 flex flex-col gap-3">
          <Primary T={T} onClick={() => { goal("onboarding_done", { goal: a.goal, place: a.place }); onDone({ ...a, created: Date.now() }); }}>Получить программу</Primary>
          <Ghost T={T} onClick={() => { setSummary(false); setI(0); }}>Изменить ответы</Ghost>
        </div>
      </div>
    );
  }

  const options = q.numbers ? null : resolve(q, a, "options");
  const hint = resolve(q, a, "hint");

  return (
    <div className="max-w-md mx-auto px-5 pt-6 pb-10 min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6" style={{ height: 36 }}>
        {i > 0 ? (
          <button onClick={goBack} aria-label="Назад" className="rounded-full p-2" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
            <ChevronLeft size={18} />
          </button>
        ) : <span style={{ fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "0.2em", fontSize: 14 }}>RITM</span>}
        {/* Пока цель не выбрана, считаем и вопрос о темпе — иначе счётчик прыгал «1 из 6» → «2 из 7».
            Если цель без темпа, шагов просто станет меньше — это приятный сюрприз, а не разочарование. */}
        <span style={{ color: MUTED, fontSize: 13 }}>{pos + 1} из {(a.goal ? applicable(a) : QUESTIONS).length}</span>
      </div>
      <div className="flex gap-1 mb-8">
        {(a.goal ? applicable(a) : QUESTIONS).map((qq, idx) => (
          <div key={idx} className="flex-1 rounded-full" style={{ height: 3, background: idx <= pos ? T.grad : "rgba(255,255,255,0.1)", boxShadow: idx === pos ? T.glow : "none" }} />
        ))}
      </div>

      <div key={i} style={{ animation: "rise .3s ease-out" }}>
        <H1>{q.title}</H1>
        {hint && <Muted className="mt-2 mb-6">{hint}</Muted>}
        {pos === 0 && (
          // Согласие на обработку данных даётся при первом ответе анкеты — так написано в самом согласии (/consent)
          <p className="mb-5" style={{ fontSize: 12, lineHeight: 1.5, color: MUTED }}>
            Отвечая, ты принимаешь{" "}
            <button type="button" onClick={() => openExternal(LEGAL.termsUrl)} className="underline" style={{ color: "inherit" }}>пользовательское соглашение</button>{" "}
            и даёшь{" "}
            <button type="button" onClick={() => openExternal(LEGAL.consentUrl)} className="underline" style={{ color: "inherit" }}>согласие на обработку данных</button>{" "}
            по{" "}
            <button type="button" onClick={() => openExternal(LEGAL.privacyUrl)} className="underline" style={{ color: "inherit" }}>политике конфиденциальности</button>.
          </p>
        )}

        {q.multi ? (
          <>
            <div className="flex flex-wrap gap-2 mb-8">
              {Object.entries(ALLERGENS).map(([id, al]) => {
                const on = a.allergies.includes(id);
                return (
                  <Chip key={id} T={T} on={on}
                    onClick={() => setA({ ...a, allergies: on ? a.allergies.filter((x) => x !== id) : [...a.allergies, id] })}>
                    {al.label}
                  </Chip>
                );
              })}
            </div>
            <Primary T={T} onClick={goNext}>{a.allergies.length ? "Готово" : "Аллергии нет"}</Primary>
          </>
        ) : q.numbers ? (
          <>
            {q.sex && (
              <div className="flex gap-2 mb-4">
                {q.sex.map(([v, label]) => {
                  const on = a.sex === v;
                  return (
                    <button key={v} onClick={() => setA({ ...a, sex: v })} aria-pressed={on} className="flex-1 rounded-2xl px-4 py-3.5 font-medium flex items-center justify-center gap-2 ritm-press"
                      style={{ border: `1px solid ${on ? T.a : T.line}`, background: on ? "rgba(255,255,255,0.08)" : T.card, color: "#fff", boxShadow: on ? T.glow : "none", transition: "all .2s" }}>
                      {label}{on && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
            )}
            {q.numbers.map((f) => (
              <label key={f.k} className="flex items-center justify-between rounded-2xl px-4 py-3 mb-3" style={{ border: `1px solid ${T.line}`, background: T.card }}>
                <span style={{ color: MUTED }}>{f.label}</span>
                <span className="flex items-baseline gap-2">
                  <input type="number" inputMode="numeric" value={a[f.k]} min={f.min} max={f.max}
                    onChange={(e) => setA({ ...a, [f.k]: e.target.value })}
                    className="bg-transparent text-right outline-none" style={{ width: 84, fontFamily: DISPLAY, fontSize: 24, color: "#fff" }} />
                  <span style={{ color: MUTED, fontSize: 13, width: 24 }}>{f.unit}</span>
                </span>
              </label>
            ))}
            <div className="mt-4"><Primary T={T} onClick={nextNumbers} disabled={!!q.sex && !a.sex}>{q.sex && !a.sex ? "Выбери пол" : "Дальше"}</Primary></div>
          </>
        ) : (
          options.map(([v, label]) => {
            const on = a[q.key] === v;
            return (
              <button key={v} onClick={() => pick(v)} className="w-full text-left rounded-2xl px-4 py-4 mb-3 flex items-center justify-between"
                style={{ border: `1px solid ${on ? T.a : T.line}`, background: on ? "rgba(255,255,255,0.08)" : T.card, color: "#fff", boxShadow: on ? T.glow : "none", transition: "all .2s" }}>
                <span className="font-medium">{label}</span>
                {on && <Check size={18} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============ Обучалка при первом заходе ============ */
// Подробное описание каждого раздела для пошагового тура — один экран на раздел,
// плюс завершающий экран выбора режимов.
const TAB_DETAILS = {
  today: {
    desc: "Главный экран дня — всё, что нужно сделать сегодня, одним взглядом.",
    points: [
      "Кольцо прогресса дня показывает, сколько пунктов уже закрыто",
      "Карточки тренировки и пробежки — отмечай выполнение прямо здесь",
      "Быстрое добавление разовых и повторяющихся задач, привычки тут же с галочкой",
    ],
  },
  train: {
    desc: "Силовые тренировки — по готовой программе или полностью свои.",
    points: [
      "Автопрограмма подбирает упражнения по дням недели, цели и уровню",
      "Можно собрать свою тренировку из базы 50 упражнений",
      "Библиотека готовых программ — фулбоди, верх/низ, push/pull/legs и варианты без зала — создаёт тренировки и расставляет их по дням одной кнопкой",
      "Пошаговый гид: разминка с таймером → подход → отдых с подсказкой по дыханию → заминка",
      "Личные рекорды по весу и числу повторов запоминаются сами",
    ],
  },
  run: {
    desc: "Беговые тренировки с планом по неделям.",
    points: [
      "План пробежек подстраивается под уровень и график тренировок",
      "Отмечай пробежки прямо на «Сегодня» или на этой вкладке",
    ],
  },
  food: {
    desc: "Дневник питания и норма калорий.",
    points: [
      "Считает норму калорий и БЖУ по данным из анкеты",
      "Распознаёт еду по фото или штрихкоду через ИИ",
      "Показывает, сколько ещё можно съесть за день",
      "Список покупок собирает ингредиенты выбранных рецептов на неделю в один список с отметками",
    ],
  },
  health: {
    desc: "Шаги, сон, самочувствие, вес тела и замеры.",
    points: [
      "Шаги и сон вводятся вручную, самочувствие после тренировки — энергия, настроение, мышечная боль",
      "Вес тела с графиком тренда, шаг 0,2 кг",
      "Замеры тела — талия, грудь, бёдра, бицепс, бедро и шея, у каждой мерки свой график",
      "Если вес заметно разошёлся с анкетой, приложение само предложит пересчитать норму",
    ],
  },
  dev: {
    desc: "Личное развитие — свои привычки и темы.",
    points: [
      "Свои привычки с ежедневными отметками и сериями дней подряд",
      "Темы вроде языков или чтения — со своими задачами внутри каждой",
    ],
  },
  cal: {
    desc: "Календарь и планировщик задач, как в TickTick.",
    points: [
      "Вид «Месяц» — сетка с тренировками, пробежками, задачами и привычками",
      "Вид «Список» — задачи по дням: просроченные, сегодня, завтра и дальше",
      "У каждой задачи — приоритет, список-тег, заметка и правило повтора",
      "Время можно задать диапазоном — например, «17:00–18:00», а не только временем начала",
    ],
  },
  progress: {
    desc: "Сводный дашборд по всем накопленным данным.",
    points: [
      "Общее число тренировок, пробежек, личных рекордов и лучшая серия привычки",
      "График веса, график калорий за 14 дней с нормой и столбчатые графики тренировок и пробежек — период настраивается (4–16 недель)",
      "В Pro — ИИ-разбор недели: короткий персональный итог по тренировкам, питанию и весу",
      "Кнопка «Поделиться прогрессом» — картинка с итогами недели для сторис или друзей",
      "Ничего вводить не нужно — всё считается из того, что уже есть в приложении",
    ],
  },
  achievements: {
    desc: "Награды за результаты.",
    points: [
      "17 бейджей — от первой тренировки до долгих серий и личных рекордов",
      "Открываются сами по мере тренировок, привычек и выполненных задач",
      "У каждого открытого бейджа — значок «Поделиться», картинкой в сторис или друзьям",
    ],
  },
  books: {
    desc: "Личный список чтения.",
    points: [
      "Три статуса: читаю, в планах, прочитано",
      "Прогресс по страницам с шагом ±10 и оценка звёздами для прочитанного",
    ],
  },
  challenges: {
    desc: "Временные испытания и отказ от вредных привычек.",
    points: [
      "Испытание с целью — например «30 дней растяжки», с прогресс-баром по дням",
      "Счётчик дней подряд без привычки, с кнопкой «Сорвался — начать заново»",
    ],
  },
  journal: {
    desc: "Личные текстовые заметки.",
    points: [
      "Что запомнилось, о чём подумал, как прошёл день",
      "Необязательное настроение — один из 5 эмодзи",
      "Записи сами группируются по дате: сегодня, вчера и дальше",
    ],
  },
  breathe: {
    desc: "Дыхательные техники для расслабления и концентрации.",
    points: [
      "3 готовые техники: квадратное дыхание, 4-7-8 и спокойное дыхание",
      "Полноэкранный таймер с плавным кругом на вдохе и выдохе, выбор числа раундов",
      "Считает серию дней подряд и общее время практики",
    ],
  },
  faith: {
    desc: "Вера и духовная практика — раздел настраивается под тебя.",
    points: [
      "Выбери направление (или собери свой набор практик) — список подстраивается сам",
      "Ежедневный чек-лист практик с отметкой на сегодня",
      "Считает серию дней подряд, направление всегда можно сменить в настройках раздела",
    ],
  },
  charge: {
    desc: "Короткая зарядка — комплексы движений и растяжки без инвентаря.",
    points: [
      "Готовые комплексы от 3 до 6 минут — утренняя, растяжка, разминка перед тренировкой и другие",
      "Каждое движение показывается под таймер, одно за другим, без лишних настроек",
    ],
  },
  friends: {
    desc: "Друзья — общий чат, совместные тренировки и цели с теми, кого добавишь.",
    points: [
      "Добавляй по Telegram-имени — профиль виден только после обмена заявками",
      "Сам выбираешь, что из прогресса видно другим, в настройках приватности",
      "Свой чат внутри приложения, общий календарь тренировок и общие цели с прогрессом каждого",
    ],
  },
};

function AppTour({ T, st, onDone, onSkip, canSkip }) {
  const sections = TABS_ALL;
  // Первый вход — сразу один экран выбора разделов (раньше перед ним было 17 экранов обзора).
  // Из Настроек («Показать обзор») тур по-прежнему начинается с подробного обзора.
  const [step, setStep] = useState(canSkip ? 0 : TABS_ALL.length);
  const totalSteps = sections.length + 1; // + финальный экран выбора режимов
  const isDetail = step < sections.length;
  // При первом заходе по умолчанию включены все разделы — человек сам решает, что спрятать.
  // При повторном показе (из Настроек) стартуем с текущего набора, чтобы не сбрасывать его выбор.
  const initialHidden = canSkip ? new Set((st.tabsConfig || DEFAULT_TABS_CONFIG).hidden || []) : new Set();
  const [hidden, setHidden] = useState(initialHidden);
  const toggle = (id) => {
    setHidden((prev) => {
      const willHide = !prev.has(id);
      const currentlyVisible = 1 + TABS_ALL.filter((t) => t[0] !== "today" && !prev.has(t[0])).length;
      if (willHide && currentlyVisible <= MIN_VISIBLE_TABS) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const finish = () => { goal("tour_done", { visible: TABS_ALL.length - hidden.size }); onDone([...hidden]); };

  return (
    <div className="max-w-md mx-auto px-5 pt-6 pb-10 min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4" style={{ height: 36 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "0.2em", fontSize: 14 }}>RITM</span>
        {canSkip ? (
          <button onClick={onSkip} aria-label="Закрыть" className="rounded-full p-2" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
            <X size={18} />
          </button>
        ) : isDetail ? (
          <span style={{ color: MUTED, fontSize: 13 }}>{step + 1} из {totalSteps}</span>
        ) : null}
      </div>
      <div className="rounded-full mb-8" style={{ height: 3, background: "rgba(255,255,255,0.1)" }}>
        <div style={{ height: 3, borderRadius: 999, width: `${((step + 1) / totalSteps) * 100}%`, background: T.grad, boxShadow: T.glow, transition: "width .25s ease-out" }} />
      </div>

      {isDetail ? (() => {
        const [id, label, Icon] = sections[step];
        const detail = TAB_DETAILS[id];
        return (
          <div key={`tour-${step}`} style={{ animation: "rise .25s ease-out" }} className="flex flex-col flex-1">
            <div className="flex items-center gap-3 mb-5">
              <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52, background: "rgba(255,255,255,0.06)", border: `1px solid ${T.line}` }}>
                <Icon size={24} color={T.a} />
              </span>
              <H1>{label}</H1>
            </div>
            <Muted className="mb-5">{detail.desc}</Muted>
            <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "40vh" }}>
              {detail.points.map((p, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, marginTop: 7, background: T.a, boxShadow: T.glow }} />
                  <Muted size={13} style={{ lineHeight: 1.5 }}>{p}</Muted>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-6 flex flex-col gap-3">
              <Primary T={T} onClick={() => setStep(step + 1)}>Дальше</Primary>
              <div className="flex gap-3">
                {step > 0 && <Ghost T={T} className="flex-1" onClick={() => setStep(step - 1)}>Назад</Ghost>}
                <button onClick={() => setStep(sections.length)} className="flex-1 rounded-2xl py-3 text-center"
                  style={{ color: MUTED, fontSize: 14 }}>
                  Пропустить обзор
                </button>
              </div>
            </div>
          </div>
        );
      })() : (
        <div key="tour-pick" style={{ animation: "rise .25s ease-out" }} className="flex flex-col flex-1">
          <H1>Выбери разделы</H1>
          <Muted className="mt-2 mb-6">По умолчанию включены все — выключи то, чем точно не будешь пользоваться. Минимум {MIN_VISIBLE_TABS} раздела должны остаться включены, поменять можно в любой момент в Настройках.</Muted>
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "50vh" }}>
            <Card T={T} className="flex items-center gap-3" style={{ padding: "10px 14px", opacity: 0.7 }}>
              <Home size={18} />
              <span className="flex-1">Сегодня</span>
              <span style={{ fontSize: 11, color: MUTED }}>закреплён</span>
            </Card>
            {TABS_ALL.filter((t) => t[0] !== "today").map(([id, label, Icon]) => {
              const isHidden = hidden.has(id);
              return (
                <Card key={id} T={T} className="flex items-center gap-3" style={{ padding: "10px 14px" }}>
                  <Icon size={18} color={isHidden ? MUTED : "#fff"} className="flex-shrink-0" />
                  <span className="flex-1 min-w-0" style={{ opacity: isHidden ? 0.5 : 1 }}>
                    <span className="block">{label}</span>
                    {TAB_DETAILS[id]?.desc && <span className="block" style={{ fontSize: 12, color: MUTED, lineHeight: 1.35 }}>{TAB_DETAILS[id].desc}</span>}
                  </span>
                  <Toggle T={T} on={!isHidden} onChange={() => toggle(id)} label={label} />
                </Card>
              );
            })}
          </div>
          <div className="mt-auto pt-6 flex flex-col gap-3">
            <Primary T={T} onClick={finish}>{canSkip ? "Сохранить" : "Начать"}</Primary>
            {canSkip
              ? <Ghost T={T} onClick={() => setStep(sections.length - 1)}>Назад</Ghost>
              : <Ghost T={T} onClick={() => setStep(0)}>Подробнее о каждом разделе</Ghost>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Сегодня ============ */
// Карточка «Первая тренировка» — для тех, кто ещё ни разу не тренировался. Раньше после анкеты новичок
// попадал на «Сегодня», где в день отдыха было написано «Силовой нет», а кнопка «Начать тренировку»
// появлялась только в день по расписанию — пик мотивации проходил впустую. Теперь первую тренировку
// можно начать сразу, в одно нажатие: сегодняшнюю по плану или первую тренировку программы.
function FirstWorkoutCard({ T, program, dayIdx, go, openSession }) {
  const day = program.days[dayIdx ?? 0];
  if (!day || !openSession) return null;
  const restDay = dayIdx === undefined;
  return (
    <div className="relative overflow-hidden rounded-[24px] p-5 mb-4" style={{ background: `linear-gradient(135deg, ${T.a}24, ${T.b}14)`, border: `1px solid ${T.a}55`, animation: "rise .45s ease-out" }}>
      <div className="flex items-center gap-2 mb-2" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.a }}>
        <Sparkles size={14} /> Программа готова
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>Первая тренировка — {day.title}</div>
      <Muted size={13} className="mt-1 mb-4">
        {day.list.length} {exWord(day.list.length)} · около {program.durationMin} мин. Гид проведёт по каждому подходу: разминка, вес и повторы, таймер отдыха, фото техники.
        {restDay ? " По расписанию сегодня отдых, но первую можно сделать прямо сейчас." : ""}
      </Muted>
      <Primary T={T} onClick={() => { goal("first_workout_start", { from: "today", restDay }); openSession(day.title, day.list, program.range); }}>
        <PlayCircle size={18} /> Начать первую тренировку
      </Primary>
      <button onClick={() => go("train")} className="w-full mt-2 py-2 text-center" style={{ color: MUTED, fontSize: 13 }}>Сначала посмотреть программу</button>
    </div>
  );
}

function Today({ T, st, up, program, run, week, go, name, streak, norm, onPhoto, openSession }) {
  const now = new Date();
  const k = keyOf(now);
  const w = wdOf(now);
  const dayIdx = program.schedule[w];
  const ownWorkout = (st.workouts || []).find((x) => x.id === program.customDays[w]);
  const hasStrength = dayIdx !== undefined || !!ownWorkout;
  const runIdx = run.schedule[w];
  const tasks = st.tasks[k] || [];
  const allRecurring = st.dailyTasks || [];
  const daily = allRecurring.filter((t) => taskOccursOn(t, now));
  const checks = [...tasks.map((t) => t.done), ...daily.map((t) => !!t.log[k]), ...st.habits.map((h) => !!h.log[k])];
  if (hasStrength) checks.push(!!st.done[k]);
  if (runIdx !== undefined) checks.push(!!st.runDone[k]);
  const value = checks.length ? checks.filter(Boolean).length / checks.length : 0;
  const runLocked = !st.pro && week > 0;
  const eaten = sumFood(st.food[k] || []);

  const toggleHabit = (id) => up((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, log: { ...h.log, [k]: !h.log[k] } } : h)) }));
  const toggleTask = (id) => up((s) => ({ tasks: { ...s.tasks, [k]: s.tasks[k].map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } }));
  const toggleDaily = (id) => up((s) => ({ dailyTasks: s.dailyTasks.map((t) => (t.id === id ? { ...t, log: { ...t.log, [k]: !t.log[k] } } : t)) }));
  const [newText, setNewText] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newDaily, setNewDaily] = useState(false);
  const [newRepeat, setNewRepeat] = useState({ type: "once", date: k });
  const addTask = () => {
    const t = newText.trim();
    if (!t) return;
    if (newDaily) up((s) => ({ dailyTasks: [...(s.dailyTasks || []), { id: "dl" + Date.now(), text: t, time: newTime || null, log: {}, repeat: newRepeat }] }));
    else up((s) => ({ tasks: { ...s.tasks, [k]: [...(s.tasks[k] || []), { id: Date.now(), text: t, time: newTime || null, done: false }] } }));
    setNewText("");
    setNewTime("");
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <Muted size={13}>{cap(now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }))}</Muted>
          <H1>Привет, {name}</H1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ border: `1px solid ${T.line}`, background: T.card }}>
            <Flame size={15} color={T.a} />
            <span className="font-semibold" style={{ fontSize: 14 }}>{streak}</span>
          </div>
          <button onClick={() => go("settings")} aria-label="Настройки" className="rounded-full p-2"
            style={{ border: `1px solid ${T.line}`, background: T.card, color: "#fff" }}>
            <SettingsIcon size={17} />
          </button>
        </div>
      </div>

      <Orb T={T} value={value} />

      {!ownWorkout && !Object.keys(st.done || {}).length && !(st.trainHistory || []).length && (
        <FirstWorkoutCard T={T} program={program} dayIdx={dayIdx} go={go} openSession={openSession} />
      )}

      {(() => {
        const layout = effectiveTodayLayout(st);
        const blocks = {
          train: (
            <div className="grid grid-cols-2 gap-3">
              <Card T={T} onClick={() => go("train")} style={{ borderRadius: 22 }}>
                <div className="flex items-center justify-between mb-3">
                  <Dumbbell size={20} />
                  {hasStrength && st.done[k] && <Check size={16} color={T.a} />}
                </div>
                {ownWorkout ? (
                  <>
                    <div className="font-semibold">{ownWorkout.name}</div>
                    <Muted size={12}>Своя тренировка, {ownWorkout.items.length} {exWord(ownWorkout.items.length)}</Muted>
                  </>
                ) : dayIdx !== undefined ? (
                  <>
                    <div className="font-semibold">{program.days[dayIdx].title}</div>
                    <Muted size={12}>{program.days[dayIdx].list.length} упражнений, около {program.durationMin} мин</Muted>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">Силовой нет</div>
                    <Muted size={12}>День восстановления</Muted>
                  </>
                )}
              </Card>
              <Card T={T} onClick={() => go("run")} style={{ borderRadius: 22 }}>
                <div className="flex items-center justify-between mb-3">
                  <Footprints size={20} />
                  {runIdx !== undefined && (runLocked ? <Lock size={14} color={MUTED} /> : st.runDone[k] && <Check size={16} color={T.a} />)}
                </div>
                {runIdx !== undefined ? (
                  runLocked ? (
                    <>
                      <div className="font-semibold">{run.weeks[week][runIdx].title}</div>
                      <Muted size={12}>Неделя {week + 1} доступна в Pro</Muted>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">{run.weeks[week][runIdx].title}</div>
                      <Muted size={12}>{run.weeks[week][runIdx].summary}</Muted>
                    </>
                  )
                ) : (
                  <>
                    <div className="font-semibold">Бега нет</div>
                    <Muted size={12}>Можно просто погулять</Muted>
                  </>
                )}
              </Card>
            </div>
          ),
          food: (
            <Card T={T} style={{ borderRadius: 22 }}>
              <div className="flex items-center gap-3">
                <button onClick={() => go("food")} className="flex items-center gap-3 flex-1 min-w-0 text-left" style={{ color: "#fff" }}>
                  <Apple size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">Питание</div>
                    <Muted size={12}>{Math.round(eaten.kcal)} из {norm.kcal} ккал, белок {Math.round(eaten.p)} из {norm.protein} г</Muted>
                  </div>
                </button>
                {/* Фото еды прямо с «Сегодня» — не нужно сначала открывать вкладку «Питание» */}
                <label aria-label="Сфотографировать еду" className="rounded-xl p-2 cursor-pointer flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Camera size={18} color={MUTED} />
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto?.(f, defaultMeal()); }} />
                </label>
              </div>
              <button onClick={() => go("food")} className="w-full" style={{ background: "transparent" }} aria-label="Открыть питание">
                <div className="rounded-full mt-3 overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ width: `${Math.min(100, (eaten.kcal / norm.kcal) * 100)}%`, height: "100%", background: T.grad, transition: "width .6s ease" }} />
                </div>
              </button>
            </Card>
          ),
          habits: (
            <>
              <H2>Привычки</H2>
              <div className="flex flex-col gap-2">
                {st.habits.map((h) => (
                  <Card key={h.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
                    <CheckBox T={T} on={!!h.log[k]} onClick={() => toggleHabit(h.id)} label={h.name} />
                    <span className="flex-1" style={{ opacity: h.log[k] ? 0.55 : 1 }}>{h.name}</span>
                    <span className="flex items-center gap-1" style={{ color: MUTED, fontSize: 13 }}>
                      <Flame size={13} />{streakOf((x) => !!h.log[x])}
                    </span>
                  </Card>
                ))}
              </div>
            </>
          ),
          tasks: (
            <>
              <H2 right={<button onClick={() => go("cal")} style={{ color: MUTED, fontSize: 13 }}>Календарь</button>}>Задачи на сегодня</H2>
              {daily.length === 0 && tasks.length === 0 ? (
                <Muted size={13} className="mb-2">Пока пусто. Добавь задачу ниже — разовую на сегодня или ежедневную.</Muted>
              ) : (
                <div className="flex flex-col gap-2 mb-2">
                  {daily.map((t) => (
                    <Card key={t.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
                      <CheckBox T={T} on={!!t.log[k]} onClick={() => toggleDaily(t.id)} label={t.text} />
                      <span className="flex-1" style={{ opacity: t.log[k] ? 0.55 : 1 }}>{t.text}</span>
                      {t.time && <span style={{ fontSize: 12, color: T.a, fontWeight: 700 }}>{taskTimeLabel(t)}</span>}
                      <Repeat size={13} color={MUTED} />
                    </Card>
                  ))}
                  {tasks.map((t) => (
                    <Card key={t.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
                      <CheckBox T={T} on={t.done} onClick={() => toggleTask(t.id)} label={t.text} />
                      <span className="flex-1" style={{ opacity: t.done ? 0.5 : 1, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                      {t.time && <span style={{ fontSize: 12, color: T.a, fontWeight: 700 }}>{taskTimeLabel(t)}</span>}
                    </Card>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mb-2">
                <input value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="Новая задача" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
                  style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="Время задачи"
                  className="rounded-xl px-3 py-3 bg-transparent outline-none"
                  style={{ width: 112, border: `1px solid ${T.line}`, color: "#fff", fontSize: 14 }} />
                <button onClick={addTask} aria-label="Добавить задачу" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
              </div>
              <Chip T={T} on={newDaily} onClick={() => { setNewDaily(!newDaily); if (!newDaily) setNewRepeat({ type: "daily" }); }}><Repeat size={13} /> Повторять</Chip>
              {newDaily && <RecurrenceEditor T={T} value={newRepeat} onChange={setNewRepeat} date={now} />}
            </>
          ),
        };
        const visible = layout.order.filter((id) => !layout.hidden.has(id) && blocks[id]);
        return visible.map((id) => <div key={id} className="mt-4">{blocks[id]}</div>);
      })()}
    </div>
  );
}

/* ============ Силовые ============ */
function ExerciseRow({ T, it, idx, onClick }) {
  const e = it.exercise || EX[it.id];
  const c = MUSCLE_COLORS[e.group] || T.a;
  return (
    <Card T={T} onClick={onClick} className="flex items-center gap-3">
      <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: c, boxShadow: `0 0 8px ${c}99` }} />
      <span style={{ fontFamily: DISPLAY, fontSize: 13, color: MUTED, width: 16 }}>{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{e.name}</div>
        <Muted size={13}>
          {MUSCLE_LABELS[e.group] && <span style={{ color: c, fontWeight: 600 }}>{MUSCLE_LABELS[e.group]} · </span>}
          {it.sets} {setsWord(it.sets)} по {it.target}{it.first ? "" : "+"} повторов
        </Muted>
      </div>
      <div className="text-right">
        <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600 }}>{it.weightLabel}</div>
        {it.leveledUp && <div style={{ fontSize: 11, color: T.a }}>вес вырос</div>}
      </div>
      <ChevronRight size={16} color={MUTED} />
    </Card>
  );
}

// Кнопка расписания — одна и та же на экранах «Силовые», «Бег» и «Календарь»
function ScheduleButton({ T, isCustom, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 rounded-full px-3 py-1.5 flex-shrink-0"
      style={{ border: `1px solid ${isCustom ? T.a : T.line}`, background: T.card, color: "#fff", fontSize: 13, fontWeight: 600 }}>
      <CalendarDays size={14} /> {isCustom ? "Моё расписание" : "Расписание"}
    </button>
  );
}

// Отметка «тренировка завершена» — общая для программы и своих тренировок
// Анимированная схема темпа движения — честная бесплатная замена видео с ИИ-техникой:
// не реальное видео (это платная генерация, доллары за ролик), а анимация по вниз-пауза-вверх
function TempoBar({ T, e, height = 132, width = 58 }) {
  const anim = `tempo_${e.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, "")}`;
  if (e.time) {
    return <div className="relative rounded-2xl overflow-hidden flex-shrink-0" style={{ width, height, border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)" }}>
      <div className="absolute left-0 right-0 bottom-0" style={{ height: "100%", background: T.grad, opacity: 0.85, animation: "breathe 3s ease-in-out infinite" }} />
    </div>;
  }
  const [down, hold, upT] = (e.tempo || "2-1-2").split("-").map(Number);
  const total = Math.max(1, down + hold + upT);
  const p1 = (down / total) * 100;
  const p2 = ((down + hold) / total) * 100;
  return (
    <div className="relative rounded-2xl overflow-hidden flex-shrink-0" style={{ width, height, border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)" }}>
      <style>{`@keyframes ${anim}{0%{transform:scaleY(1)}${p1}%{transform:scaleY(.2)}${p2}%{transform:scaleY(.2)}100%{transform:scaleY(1)}}`}</style>
      <div className="absolute left-0 right-0 bottom-0" style={{ height: "100%", background: T.grad, transformOrigin: "bottom", animation: `${anim} ${total}s ease-in-out infinite`, boxShadow: T.glow }} />
    </div>
  );
}

/* ============ Анимация человечка во время подхода ============
   Заменяет TempoBar (вертикальную «шкалу») на экране подхода: стилизованная
   фигурка в позе конкретного движения (жим лёжа, присед, тяга, жим стоя,
   скручивания, подъём на носки), где работающая группа мышц закрашена цветом
   MUSCLE_COLORS и подсвечена, а снаряд/корпус реально двигается в ритме темпа
   упражнения (вниз–пауза–вверх из e.tempo, та же тайминг-математика, что в
   TempoBar). У `EX` нет паспорта движения на каждое из 50+ упражнений — только
   группа мышц, поэтому поза одна на группу (6 штук) и переиспользуется для всех
   упражнений этой группы. Для статики (e.time, например планка) снаряд/корпус
   не двигается — только мягкая пульсация подсветки, как раньше у TempoBar. */
function tempoTiming(e) {
  if (e.time) return { isTime: true };
  const [down, hold, upT] = (e.tempo || "2-1-2").split("-").map(Number);
  const total = Math.max(1, down + hold + upT);
  return { isTime: false, total, p1: (down / total) * 100, p2: ((down + hold) / total) * 100 };
}
const POSE_NEUTRAL_FILL = "rgba(255,255,255,0.14)";
const POSE_NEUTRAL_LINE = "rgba(255,255,255,0.32)";
const POSE_BOX = { position: "relative", width: "100%", height: 140, borderRadius: 16, overflow: "hidden", border: "1px solid transparent", background: "rgba(255,255,255,0.03)" };

// Жим штанги лёжа — для группы «грудь»: фигура на скамье, штанга идёт вниз к груди и обратно вверх
function PoseBenchPress({ T, color, timing, anim }) {
  const glow = { filter: `drop-shadow(0 0 6px ${color}aa)` };
  return (
    <div style={{ ...POSE_BOX, borderColor: T.line }}>
      {!timing.isTime && <style>{`@keyframes ${anim}{0%{transform:translateY(0)}${timing.p1}%{transform:translateY(26px)}${timing.p2}%{transform:translateY(26px)}100%{transform:translateY(0)}}`}</style>}
      <svg viewBox="0 0 200 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="10" y="88" width="150" height="7" rx="3" fill="rgba(255,255,255,0.15)" />
        <line x1="20" y1="95" x2="20" y2="108" stroke={POSE_NEUTRAL_LINE} strokeWidth="4" strokeLinecap="round" />
        <line x1="150" y1="95" x2="150" y2="108" stroke={POSE_NEUTRAL_LINE} strokeWidth="4" strokeLinecap="round" />
        <line x1="128" y1="76" x2="156" y2="92" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
        <line x1="156" y1="92" x2="149" y2="112" stroke={POSE_NEUTRAL_LINE} strokeWidth="9" strokeLinecap="round" />
        <circle cx="32" cy="74" r="12" fill={POSE_NEUTRAL_FILL} stroke={POSE_NEUTRAL_LINE} strokeWidth="2" />
        <line x1="45" y1="74" x2="128" y2="74" stroke={color} strokeWidth="18" strokeLinecap="round" style={glow} />
        <g style={{ transformBox: "view-box", transformOrigin: "86px 52px", animation: timing.isTime ? "breathe 3s ease-in-out infinite" : `${anim} ${timing.total}s ease-in-out infinite` }}>
          <line x1="60" y1="26" x2="112" y2="26" stroke="rgba(255,255,255,0.55)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="60" cy="26" r="10" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
          <circle cx="112" cy="26" r="10" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

// Жим штанги стоя — для группы «плечи»: штанга идёт от плеч вверх над головой и обратно
function PoseOverheadPress({ T, color, timing, anim }) {
  const glow = { filter: `drop-shadow(0 0 6px ${color}aa)` };
  return (
    <div style={{ ...POSE_BOX, borderColor: T.line }}>
      {!timing.isTime && <style>{`@keyframes ${anim}{0%{transform:translateY(0)}${timing.p1}%{transform:translateY(-38px)}${timing.p2}%{transform:translateY(-38px)}100%{transform:translateY(0)}}`}</style>}
      <svg viewBox="0 0 120 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="20" y1="172" x2="100" y2="172" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <line x1="60" y1="120" x2="48" y2="170" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
        <line x1="60" y1="120" x2="72" y2="170" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
        <line x1="60" y1="88" x2="60" y2="120" stroke={POSE_NEUTRAL_LINE} strokeWidth="18" strokeLinecap="round" />
        <line x1="60" y1="68" x2="60" y2="90" stroke={color} strokeWidth="22" strokeLinecap="round" style={glow} />
        <circle cx="60" cy="55" r="12" fill={POSE_NEUTRAL_FILL} stroke={POSE_NEUTRAL_LINE} strokeWidth="2" />
        <g style={{ transformBox: "view-box", transformOrigin: "60px 66px", animation: timing.isTime ? "breathe 3s ease-in-out infinite" : `${anim} ${timing.total}s ease-in-out infinite` }}>
          <line x1="35" y1="66" x2="85" y2="66" stroke="rgba(255,255,255,0.55)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="35" cy="66" r="9" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
          <circle cx="85" cy="66" r="9" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

// Присед со штангой — для группы «ноги»: вся фигура «сжимается» от щиколоток (приседает) и обратно
function PoseSquat({ T, color, timing, anim }) {
  const glow = { filter: `drop-shadow(0 0 6px ${color}aa)` };
  return (
    <div style={{ ...POSE_BOX, borderColor: T.line }}>
      {!timing.isTime && <style>{`@keyframes ${anim}{0%{transform:scaleY(1)}${timing.p1}%{transform:scaleY(.8)}${timing.p2}%{transform:scaleY(.8)}100%{transform:scaleY(1)}}`}</style>}
      <svg viewBox="0 0 120 190" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="20" y1="182" x2="100" y2="182" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <g style={{ transformBox: "view-box", transformOrigin: "60px 182px", animation: timing.isTime ? "breathe 3s ease-in-out infinite" : `${anim} ${timing.total}s ease-in-out infinite` }}>
          <line x1="60" y1="118" x2="46" y2="182" stroke={color} strokeWidth="13" strokeLinecap="round" style={glow} />
          <line x1="60" y1="118" x2="74" y2="182" stroke={color} strokeWidth="13" strokeLinecap="round" style={glow} />
          <line x1="60" y1="68" x2="60" y2="118" stroke={POSE_NEUTRAL_LINE} strokeWidth="18" strokeLinecap="round" />
          <line x1="35" y1="62" x2="85" y2="62" stroke="rgba(255,255,255,0.5)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="35" cy="62" r="8" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
          <circle cx="85" cy="62" r="8" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
          <circle cx="60" cy="55" r="12" fill={POSE_NEUTRAL_FILL} stroke={POSE_NEUTRAL_LINE} strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

// Тяга штанги в наклоне — для группы «спина»: корпус покачивается вокруг тазобедренного сустава
function PoseRow({ T, color, timing, anim }) {
  const glow = { filter: `drop-shadow(0 0 6px ${color}aa)` };
  return (
    <div style={{ ...POSE_BOX, borderColor: T.line }}>
      {!timing.isTime && <style>{`@keyframes ${anim}{0%{transform:rotate(-6deg)}${timing.p1}%{transform:rotate(9deg)}${timing.p2}%{transform:rotate(9deg)}100%{transform:rotate(-6deg)}}`}</style>}
      <svg viewBox="0 0 190 130" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="60" y1="130" x2="190" y2="130" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <line x1="90" y1="100" x2="75" y2="125" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
        <line x1="90" y1="100" x2="105" y2="125" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
        <g style={{ transformBox: "view-box", transformOrigin: "90px 100px", animation: timing.isTime ? "breathe 3s ease-in-out infinite" : `${anim} ${timing.total}s ease-in-out infinite` }}>
          <line x1="90" y1="100" x2="52" y2="62" stroke={color} strokeWidth="17" strokeLinecap="round" style={glow} />
          <circle cx="45" cy="55" r="11" fill={POSE_NEUTRAL_FILL} stroke={POSE_NEUTRAL_LINE} strokeWidth="2" />
          <line x1="55" y1="68" x2="38" y2="90" stroke={POSE_NEUTRAL_LINE} strokeWidth="8" strokeLinecap="round" />
          <circle cx="36" cy="92" r="6" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

// Скручивания — для группы «пресс»: корпус поднимается от пола и опускается обратно
function PoseCrunch({ T, color, timing, anim }) {
  const glow = { filter: `drop-shadow(0 0 6px ${color}aa)` };
  return (
    <div style={{ ...POSE_BOX, borderColor: T.line }}>
      {!timing.isTime && <style>{`@keyframes ${anim}{0%{transform:rotate(0deg)}${timing.p1}%{transform:rotate(-22deg)}${timing.p2}%{transform:rotate(-22deg)}100%{transform:rotate(0deg)}}`}</style>}
      <svg viewBox="0 0 190 110" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="10" y1="95" x2="170" y2="95" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <line x1="120" y1="80" x2="150" y2="55" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
        <line x1="150" y1="55" x2="130" y2="95" stroke={POSE_NEUTRAL_LINE} strokeWidth="9" strokeLinecap="round" />
        <g style={{ transformBox: "view-box", transformOrigin: "120px 80px", animation: timing.isTime ? "breathe 3s ease-in-out infinite" : `${anim} ${timing.total}s ease-in-out infinite` }}>
          <line x1="120" y1="80" x2="60" y2="80" stroke={color} strokeWidth="16" strokeLinecap="round" style={glow} />
          <circle cx="48" cy="80" r="11" fill={POSE_NEUTRAL_FILL} stroke={POSE_NEUTRAL_LINE} strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

// Подъём на носки — для группы «икры»: вся фигура чуть приподнимается на носки и опускается
function PoseCalfRaise({ T, color, timing, anim }) {
  const glow = { filter: `drop-shadow(0 0 6px ${color}aa)` };
  return (
    <div style={{ ...POSE_BOX, borderColor: T.line }}>
      {!timing.isTime && <style>{`@keyframes ${anim}{0%{transform:translateY(0)}${timing.p1}%{transform:translateY(-9px)}${timing.p2}%{transform:translateY(-9px)}100%{transform:translateY(0)}}`}</style>}
      <svg viewBox="0 0 100 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="20" y1="174" x2="80" y2="174" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <g style={{ transformBox: "view-box", transformOrigin: "50px 174px", animation: timing.isTime ? "breathe 3s ease-in-out infinite" : `${anim} ${timing.total}s ease-in-out infinite` }}>
          <line x1="40" y1="150" x2="37" y2="172" stroke={color} strokeWidth="9" strokeLinecap="round" style={glow} />
          <line x1="60" y1="150" x2="63" y2="172" stroke={color} strokeWidth="9" strokeLinecap="round" style={glow} />
          <line x1="50" y1="120" x2="40" y2="150" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
          <line x1="50" y1="120" x2="60" y2="150" stroke={POSE_NEUTRAL_LINE} strokeWidth="11" strokeLinecap="round" />
          <line x1="50" y1="68" x2="50" y2="120" stroke={POSE_NEUTRAL_LINE} strokeWidth="16" strokeLinecap="round" />
          <circle cx="50" cy="55" r="11" fill={POSE_NEUTRAL_FILL} stroke={POSE_NEUTRAL_LINE} strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

const EXERCISE_POSE_BY_GROUP = { chest: PoseBenchPress, shoulders: PoseOverheadPress, legs: PoseSquat, back: PoseRow, abs: PoseCrunch, calves: PoseCalfRaise };

// Анимация человечка в позе текущего упражнения вместо TempoBar: подбирает позу по
// group упражнения (так работает для всех упражнений — у каждого ровно одна из 6 групп)
function ExercisePose({ T, e }) {
  const Pose = EXERCISE_POSE_BY_GROUP[e.group];
  if (!Pose) return <TempoBar T={T} e={e} height={140} width="100%" />;
  const color = MUSCLE_COLORS[e.group] || T.a;
  const timing = tempoTiming(e);
  const anim = `pose_${e.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, "")}`;
  return <Pose T={T} color={color} timing={timing} anim={anim} />;
}

/* ============ Фото с правильной техникой вместо рисованной позы ============
   Для части упражнений рисованная поза (выше) заменяется парой реальных фото
   (старт/финал движения), которые зацикленно перетекают друг в друга в ритме
   темпа — получается «гифка» живого человека с правильной техникой, а не
   геометрическая фигурка. Источник фото — открытый датасет free-exercise-db
   (лицензия Unlicense, общественное достояние, атрибуция не обязательна, но
   она указана в README). Датасет содержит не видео, а две статичные фотографии
   на упражнение — крайние точки движения; анимация строится тем же способом,
   что и TempoBar/ExercisePose: 0%→p1% первая фотография растворяется во вторую
   (фаза «вниз»), p1%→p2% пауза на второй (фаза «удержание»), p2%→100% снова
   первая (фаза «вверх») — те же проценты, что в tempoTiming(e). Фото лежат в
   public/exercises/<id>/{0,1}.jpg, где <id> — ключ EX; подобрано вручную только
   для упражнений, где в датасете нашлась точная или очень близкая по технике
   пара (через сопоставление названий и основных мышц) — для остальных (например
   «отжимания уголком», «птица-собака», «стульчик у стены», «алмазные отжимания»)
   подходящей реальной пары не нашлось, и экран автоматически падает обратно на
   рисованную ExercisePose, чтобы не показывать мышцу без реального движения. */
const EX_PHOTO_IDS = new Set([
  "squat", "bench", "rdl", "row", "ohp", "pulldown", "lunge", "plank", "crunch", "pushup",
  "bwsquat", "glute", "superman", "raise", "calfraise", "dbSquat", "dbRdl", "dbRow", "dbPress",
  "kbGoblet", "kbSwing", "kbRow", "kbFloorPress", "kbPress", "deadlift", "frontSquat", "legPress",
  "hipThrust", "inclineBench", "closeGripBench", "cableRow", "facePull", "barbellCurl",
  "tricepPushdown", "barbellShrug", "legExtension", "legCurl", "hyperextension", "cableCrunch",
  "declinePushup", "splitSquatBW", "sidePlank", "mountainClimbers", "gluteBridgeSingle",
  "kbDeadlift", "kbThruster",
]);

function ExercisePhoto({ T, e, exId, color }) {
  const timing = tempoTiming(e);
  const anim = `exphoto_${exId}`;
  const base = `/exercises/${exId}`;
  return (
    // Пропорции кадра 3:2 (как у самих фото) вместо фиксированной высоты: раньше на широком экране
    // блок растягивался в ширину, а высота оставалась 180 px — человек превращался в узкую полоску.
    <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 2", maxHeight: "min(46vh, 380px)", borderRadius: 18, overflow: "hidden", border: `1px solid ${T.line}`, background: "#000", animation: "fade .35s ease-out" }}>
      {!timing.isTime && (
        <style>{`
          @keyframes ${anim}_a { 0%{opacity:1} ${timing.p1}%{opacity:0} ${timing.p2}%{opacity:0} 100%{opacity:1} }
          @keyframes ${anim}_b { 0%{opacity:0} ${timing.p1}%{opacity:1} ${timing.p2}%{opacity:1} 100%{opacity:0} }
        `}</style>
      )}
      <img
        src={`${base}/0.jpg`}
        alt={e.name}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%",
          opacity: timing.isTime ? 1 : undefined,
          animation: timing.isTime ? "none" : `${anim}_a ${timing.total}s ease-in-out infinite`,
        }}
      />
      <img
        src={`${base}/1.jpg`}
        alt=""
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%",
          opacity: timing.isTime ? 0 : undefined,
          animation: timing.isTime ? "none" : `${anim}_b ${timing.total}s ease-in-out infinite`,
        }}
      />
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: 16, pointerEvents: "none",
          boxShadow: `inset 0 0 0 2px ${color}bb, inset 0 -40px 30px -20px rgba(0,0,0,.55)`,
          animation: timing.isTime ? "breathe 3s ease-in-out infinite" : "none",
        }}
      />
    </div>
  );
}

// Развилка «фото с реальной техникой» / «рисованная поза»: если для конкретного
// упражнения (exId — ключ EX) есть проверенная пара фото, показываем её, иначе —
// старую позу по группе мышц (ExercisePose), чтобы покрыть все 50+ упражнений.
function ExerciseMedia({ T, e, exId }) {
  const color = MUSCLE_COLORS[e.group] || T.a;
  if (exId && EX_PHOTO_IDS.has(exId)) return <ExercisePhoto T={T} e={e} exId={exId} color={color} />;
  return <ExercisePose T={T} e={e} />;
}

// Подсказка по дыханию на отдыхе: короткий отдых — просто восстановить пульс,
// длинный — глубже и медленнее, чтобы выйти на следующий тяжёлый подход свежим
function breathText(seconds) {
  if (seconds <= 50) return { cycle: 6, note: "Дыши ровно через нос, восстанови пульс перед следующим подходом." };
  if (seconds <= 100) return { cycle: 8, note: "Вдох на 4 счёта носом, выдох на 4 счёта ртом. Расслабь плечи и кисти." };
  return { cycle: 10, note: "Медленный глубокий вдох животом, долгий выдох. Пауза помогает выйти на следующий подход сильнее." };
}

function BreathCircle({ T, seconds }) {
  const { cycle } = breathText(seconds);
  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: T.grad, opacity: 0.35, animation: `breathe ${cycle}s ease-in-out infinite` }} />
        <div style={{ position: "absolute", inset: 18, borderRadius: "50%", border: `1px solid ${T.line}` }} />
        <Wind size={30} color={T.a} />
      </div>
    </div>
  );
}

// Кольцевой таймер отдыха (тот же принцип, что на карточке «Сегодня»)
function RestRing({ T, left, total }) {
  const r = 54, c = 2 * Math.PI * r;
  const p = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <svg width="128" height="128" className="mx-auto">
      <circle cx="64" cy="64" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
      <circle cx="64" cy="64" r={r} stroke={T.a} strokeWidth="6" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 64 64)" style={{ transition: "stroke-dashoffset 1s linear" }} />
      <text x="64" y="72" textAnchor="middle" fontFamily={DISPLAY} fontSize="30" fontWeight="600" fill="#fff">{pad(Math.floor(left / 60))}:{pad(left % 60)}</text>
    </svg>
  );
}

function Stepper({ T, value, onChange, unit, min = 0, step = 1 }) {
  const round = (v) => Math.round(v / step) * step; // защита от накопления ошибок с плавающей точкой (0.1+0.2)
  const label = step < 1 ? String(step) : "1";
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, round(value - step)))} aria-label={`Меньше на ${label} ${unit}`}
        className="rounded-full flex items-center justify-center" style={{ width: 34, height: 34, border: `1px solid ${T.line}`, color: "#fff" }}><Minus size={15} /></button>
      <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, minWidth: 44, textAlign: "center", overflow: "hidden" }}><span key={value} className="ritm-tick">{value}</span></span>
      <button onClick={() => onChange(round(value + step))} aria-label={`Больше на ${label} ${unit}`}
        className="rounded-full flex items-center justify-center" style={{ width: 34, height: 34, border: `1px solid ${T.line}`, color: "#fff" }}><Plus size={15} /></button>
      <span style={{ fontSize: 12, color: MUTED }}>{unit}</span>
    </div>
  );
}

// Разминка перед тренировкой и заминка после — короткий список с таймером на каждое движение,
// с возможностью пропустить как одно движение, так и весь блок целиком
const WARMUP_MOVES = [
  { name: "Круги руками", sec: 30, note: "Вперёд и назад, руки прямые" },
  { name: "Наклоны корпуса", sec: 30, note: "В стороны и вперёд-назад, плавно" },
  { name: "Круговые движения тазом", sec: 20, note: "В обе стороны по очереди" },
  { name: "Приседания без веса", sec: 30, note: "Медленно, в полную амплитуду" },
  { name: "Бег на месте", sec: 30, note: "Разогнать пульс перед рабочими весами" },
];
const COOLDOWN_MOVES = [
  { name: "Растяжка квадрицепса", sec: 30, note: "По 15 секунд на каждую ногу" },
  { name: "Растяжка задней поверхности бедра", sec: 30, note: "Наклон к прямым ногам, без рывков" },
  { name: "Растяжка плеч и груди", sec: 20, note: "Заведи руку за спину, слегка потяни" },
  { name: "Глубокое дыхание", sec: 30, note: "Успокой пульс перед выходом" },
];

function TimedChecklist({ T, title, moves, onDone, onSkip, skipLabel }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(moves[0].sec);
  const m = moves[i];

  useEffect(() => { setLeft(moves[i].sec); }, [i]);
  useEffect(() => {
    if (left <= 0) { next(); return undefined; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const next = () => { if (i + 1 >= moves.length) onDone(); else setI(i + 1); };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col">
      <Muted size={13} className="mt-4 mb-1">{title} · {i + 1} из {moves.length}</Muted>
      <div className="flex gap-1 mb-6">
        {moves.map((_, idx) => <span key={idx} className="flex-1 rounded-full" style={{ height: 3, background: idx < i ? T.a : idx === i ? T.grad : "rgba(255,255,255,0.12)" }} />)}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600 }} className="mb-2">{m.name}</div>
        <Muted size={13} className="mb-8">{m.note}</Muted>
        <div style={{ fontFamily: DISPLAY, fontSize: 56, fontWeight: 600, textShadow: `0 0 24px ${T.a}66` }}>{left}</div>
        <Muted size={12}>секунд</Muted>
      </div>
      <div className="flex flex-col gap-2">
        <Primary T={T} onClick={next}>{i + 1 >= moves.length ? "Готово" : "Дальше"}</Primary>
        <Ghost T={T} onClick={onSkip}>Пропустить {skipLabel || (title === "Разминка" ? "разминку" : "заминку")}</Ghost>
      </div>
    </div>
  );
}

/* ============ Зарядка ============
   Короткие комплексы на базе того же TimedChecklist, что и разминка/заминка перед силовой,
   но как отдельный раздел — без привязки к тренировке. Без статистики и стрика: просто таймер,
   который ведёт по движениям одно за другим. Утренняя — бодрящая, разминка в течение дня —
   для тех, кто много сидит (школа, учёба, работа), вечерняя — спокойная растяжка перед сном,
   плюс два прицельных комплекса под конкретный тип тренировки (по просьбе пользователя):
   «тяжёлая» — перед силовой с базовыми многосуставными движениями (присед/тяга/жим), больше
   суставной разминки и включения мышц; «аэробная» — перед бегом/кардио, только динамика
   (махи, высокое поднимание колен), без статичной растяжки — перед кардио она не нужна. */
const MORNING_CHARGE_MOVES = [
  { name: "Потягивание стоя", sec: 20, note: "Руки вверх, тянись макушкой к потолку" },
  { name: "Круги руками", sec: 30, note: "Вперёд и назад, руки прямые" },
  { name: "Наклоны корпуса", sec: 30, note: "В стороны и вперёд-назад, плавно, без рывков" },
  { name: "Круговые движения тазом", sec: 20, note: "В обе стороны по очереди" },
  { name: "Приседания без веса", sec: 30, note: "Медленно, в полную амплитуду — разогнать кровь" },
  { name: "Бег на месте", sec: 30, note: "Колени повыше — разогнать пульс" },
  { name: "Растяжка в наклоне", sec: 30, note: "Тянись к полу, колени чуть согнуты" },
  { name: "Глубокое дыхание", sec: 20, note: "3–4 цикла — настройся на день" },
];
const MIDDAY_BREAK_MOVES = [
  { name: "Вращения шеей", sec: 20, note: "Медленно, без резких движений" },
  { name: "Круги плечами назад", sec: 20, note: "Расправляет осанку после сидения" },
  { name: "Растяжка запястий", sec: 20, note: "Потяни пальцы на себя, затем от себя" },
  { name: "Наклон к ногам", sec: 20, note: "Сидя или стоя — снимает напряжение со спины" },
  { name: "Повороты корпуса", sec: 20, note: "Руки на поясе, разворот в обе стороны" },
  { name: "Сведение лопаток", sec: 20, note: "Или растяжка груди в дверном проёме, если есть" },
];
const EVENING_STRETCH_MOVES = [
  { name: "Растяжка шеи", sec: 30, note: "По 15 секунд на каждую сторону, без рывков" },
  { name: "Растяжка плеч и груди", sec: 30, note: "Заведи руку за спину, слегка потяни" },
  { name: "Кошка-корова", sec: 30, note: "На четвереньках, плавно прогибай и округляй спину" },
  { name: "Растяжка квадрицепса", sec: 30, note: "По 15 секунд на каждую ногу, держись за опору" },
  { name: "Растяжка задней поверхности бедра", sec: 40, note: "Наклон к прямым ногам, тянись без рывков" },
  { name: "Поза ребёнка", sec: 40, note: "Колени врозь, руки вперёд, расслабь спину" },
  { name: "Глубокое дыхание лёжа", sec: 30, note: "Успокой пульс перед сном" },
];
const HEAVY_WARMUP_MOVES = [
  { name: "Круговые движения плечами", sec: 30, note: "Крупные круги вперёд и назад — прогреть плечевые суставы перед жимом" },
  { name: "Круговые движения тазом", sec: 30, note: "В обе стороны по очереди — подготовить тазобедренные суставы" },
  { name: "Махи ногой вперёд-назад", sec: 30, note: "По 15 секунд на каждую ногу, держись за опору" },
  { name: "Выпады с поворотом корпуса", sec: 30, note: "Шаг вперёд, разворот корпуса к передней ноге" },
  { name: "Приседания без веса в глубину", sec: 40, note: "Медленно, в полную амплитуду — включить ноги и спину перед рабочими весами" },
  { name: "Бег на месте с высоким подниманием колен", sec: 30, note: "Разогнать пульс перед тяжёлыми подходами" },
];
const AEROBIC_WARMUP_MOVES = [
  { name: "Быстрая ходьба на месте", sec: 30, note: "Постепенно наращивай темп — разогнать пульс" },
  { name: "Захлёст голени", sec: 20, note: "Пятками к ягодицам, лёгкий темп" },
  { name: "Высокое поднимание колен", sec: 20, note: "Колени к груди, руки работают как при беге" },
  { name: "Махи ногой вперёд-назад", sec: 20, note: "По 10 секунд на каждую ногу — размять тазобедренный сустав" },
  { name: "Махи ногой в сторону", sec: 20, note: "По 10 секунд на каждую ногу — включить боковые мышцы бедра" },
  { name: "Круговые движения голеностопом", sec: 20, note: "В обе стороны по очереди — подготовить стопы и голени" },
  { name: "Лёгкий бег на месте с ускорением", sec: 30, note: "Последние секунды — почти в темпе начала пробежки" },
];
const CHARGE_MODES = [
  { id: "morning", title: "Утренняя зарядка", desc: "Разогнать кровь и проснуться — бодрый короткий комплекс.", moves: MORNING_CHARGE_MOVES, icon: Sunrise },
  { id: "midday", title: "Разминка в течение дня", desc: "Пара минут, чтобы размять шею, плечи и спину после сидения.", moves: MIDDAY_BREAK_MOVES, icon: Coffee },
  { id: "evening", title: "Вечерняя растяжка", desc: "Спокойная растяжка перед сном — снять напряжение за день.", moves: EVENING_STRETCH_MOVES, icon: Moon },
  { id: "heavy", title: "Перед тяжёлой тренировкой", desc: "Прогреть суставы и включить мышцы перед тяжёлыми весами — присед, тяга, жим.", moves: HEAVY_WARMUP_MOVES, icon: Dumbbell },
  { id: "aerobic", title: "Перед бегом и кардио", desc: "Разогнать пульс и размять ноги перед пробежкой — только динамика, без статичной растяжки.", moves: AEROBIC_WARMUP_MOVES, icon: Footprints },
];
const chargeMinutes = (moves) => Math.max(1, Math.round(moves.reduce((s, m) => s + m.sec, 0) / 60));

function ChargeSession({ T, mode, onClose }) {
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <FullScreen T={T} center label="Зарядка завершена">
        <Confetti T={T} />
        <div className="relative w-full max-w-sm">
          <span className="rounded-full flex items-center justify-center mb-4 mx-auto ritm-pop" style={{ width: 76, height: 76, background: T.grad, boxShadow: T.glow }}><Check size={34} color={T.on} /></span>
          <H1>Готово</H1>
          <Muted className="mt-2 mb-6">{mode.title} позади. Хорошая работа.</Muted>
          <Primary T={T} onClick={onClose}>Закрыть</Primary>
        </div>
      </FullScreen>
    );
  }
  return (
    <FullScreen T={T} label={mode.title}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="font-semibold" style={{ fontSize: 18 }}>{mode.title}</div>
        <button onClick={onClose} aria-label="Закрыть зарядку" className="rounded-full p-2 ritm-hover" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={18} /></button>
      </div>
      <TimedChecklist T={T} title={mode.title} moves={mode.moves} skipLabel={mode.title.toLowerCase()} onDone={() => setDone(true)} onSkip={onClose} />
    </FullScreen>
  );
}

function ChargeScreen({ T }) {
  const [active, setActive] = useState(null);
  const mode = CHARGE_MODES.find((m) => m.id === active);
  return (
    <div>
      <H1>Зарядка</H1>
      <Muted className="mt-1 mb-4">Короткие комплексы движений и растяжки — без инвентаря, под таймер, от 3 до 6 минут.</Muted>
      <div className="flex flex-col gap-3">
        {CHARGE_MODES.map((m) => (
          <Card key={m.id} T={T} onClick={() => setActive(m.id)} className="flex items-center gap-3">
            <span className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, background: T.grad, boxShadow: T.glow }}>
              <m.icon size={22} color={T.on} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{m.title}</div>
              <Muted size={13}>{m.desc}</Muted>
            </div>
            <div className="text-right flex-shrink-0">
              <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600 }}>~{chargeMinutes(m.moves)} мин</div>
              <Muted size={11}>{m.moves.length} движений</Muted>
            </div>
          </Card>
        ))}
      </div>
      {mode && <ChargeSession T={T} mode={mode} onClose={() => setActive(null)} />}
    </div>
  );
}

// техника видна, пока делаешь подход. Сохраняет каждое упражнение тем же способом, что и ручная карточка,
// поэтому прогресс и вес считаются одинаково в обоих режимах.
function SessionRunner({ T, dayTitle, items, range, onSaveExercise, onFinish, onClose }) {
  const [ei, setEi] = useState(0);
  const [si, setSi] = useState(0);
  const [phase, setPhase] = useState("warmup"); // warmup | ready | active | resting | cooldown | records
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState([]); // подходы текущего упражнения
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [prs, setPrs] = useState([]); // рекорды, случившиеся за эту тренировку

  const item = items[ei];
  const e = item?.exercise || EX[item?.id];
  const r = item?.range || range || { rest: 60 };
  const totalSets = Number(item?.sets) || 1;
  const weighted = item?.weight != null;

  useEffect(() => {
    if (phase === "warmup" || phase === "cooldown" || phase === "records") return;
    setReps(Number(item?.target) || 0);
    setWeight(Number(item?.weight) || 0);
    setDone([]);
    setSi(0);
    setPhase("ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ei]);

  useEffect(() => {
    if (phase !== "resting" || left <= 0) return undefined;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, left]);
  useEffect(() => { if (phase === "resting" && left === 0) skipRest(); }, [phase, left]); // eslint-disable-line

  // После разминки подставляем цель первого упражнения: эффект выше срабатывает только при смене
  // упражнения, и раньше первое упражнение начиналось с «0 повт. / 0 кг» вместо цели и рабочего веса.
  const leaveWarmup = () => {
    setReps(Number(item?.target) || 0);
    setWeight(Number(item?.weight) || 0);
    setPhase("ready");
  };
  const start = () => setPhase("active");
  const finishSet = () => {
    const cleaned = { reps: Math.max(0, Math.round(reps)), weight: weighted ? Math.max(0, Math.round(weight * 2) / 2) : null };
    const nextDone = [...done, cleaned];
    setDone(nextDone);
    if (si + 1 >= totalSets) {
      saveExercise(nextDone);
    } else {
      setSi(si + 1);
      setLeft(r.rest || 60);
      setPhase("resting");
    }
  };
  const skipRest = () => { setPhase("ready"); setLeft(0); };
  const saveExercise = (sets) => {
    const minReps = Math.min(...sets.map((s) => s.reps));
    const lastWeight = weighted ? sets[sets.length - 1].weight : null;
    const pr = onSaveExercise({ id: Date.now(), exId: item.id, date: keyOf(new Date()), sets, note: "", minReps, weight: lastWeight });
    if (pr?.hit) setPrs((p) => [...p, { name: e.name, ...pr }]);
    if (ei + 1 >= items.length) setPhase("cooldown");
    else setEi(ei + 1);
  };
  const finishSession = () => { if (prs.length) setPhase("records"); else onFinish(); };

  if (phase === "warmup") {
    return (
      <FullScreen T={T} label="Разминка">
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="font-semibold" style={{ fontSize: 18 }}>Разминка</div>
          <button onClick={onClose} aria-label="Закрыть тренировку" className="rounded-full p-2 ritm-hover" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={18} /></button>
        </div>
        <TimedChecklist T={T} title="Разминка" moves={WARMUP_MOVES} onDone={leaveWarmup} onSkip={leaveWarmup} />
      </FullScreen>
    );
  }
  if (phase === "cooldown") {
    return (
      <FullScreen T={T} label="Заминка">
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="font-semibold" style={{ fontSize: 18 }}>Заминка</div>
          <button onClick={onClose} aria-label="Закрыть тренировку" className="rounded-full p-2 ritm-hover" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={18} /></button>
        </div>
        <TimedChecklist T={T} title="Заминка" moves={COOLDOWN_MOVES} onDone={finishSession} onSkip={finishSession} />
      </FullScreen>
    );
  }
  if (phase === "records") {
    return (
      <FullScreen T={T} center label="Новый рекорд">
        <Confetti T={T} count={44} />
        <div style={{ animation: "rise .3s ease-out" }} className="relative text-center w-full max-w-sm overflow-y-auto no-scrollbar py-6">
          <div className="mx-auto rounded-full flex items-center justify-center mb-5 ritm-pop" style={{ width: 88, height: 88, background: T.grad, boxShadow: T.glow, color: T.on }}>
            <Trophy size={38} />
          </div>
          <H1>Новый рекорд!</H1>
          <Muted className="mt-2 mb-6">{prs.length === 1 ? "Ты побил свой прежний максимум." : `Ты побил прежний максимум ${prs.length} раза за эту тренировку.`}</Muted>
          <div className="flex flex-col gap-2 mb-8">
            {prs.map((p, i) => (
              <Card key={i} T={T} className="flex items-center justify-between" style={{ padding: "14px 18px" }}>
                <span className="font-medium">{p.name}</span>
                <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: T.a }}>
                  {p.weight != null ? `${fmt(p.weight)} кг` : `${p.reps} повт.`}
                  {(p.prevWeight != null || p.prevReps != null) && <span style={{ fontSize: 12, color: MUTED, fontFamily: BODY, fontWeight: 500 }}> (было {p.prevWeight != null ? `${fmt(p.prevWeight)} кг` : `${p.prevReps} повт.`})</span>}
                </span>
              </Card>
            ))}
          </div>
          <Primary T={T} onClick={onFinish}>Отлично!</Primary>
        </div>
      </FullScreen>
    );
  }

  if (!item) return null;
  const breath = breathText(r.rest || 60);

  return (
    <FullScreen T={T} label="Тренировка">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <Muted size={12}>{dayTitle} · упражнение {ei + 1} из {items.length}</Muted>
          <div key={ei} className="font-semibold truncate" style={{ fontSize: 18, animation: "rise .3s ease-out" }}>{e.name}</div>
        </div>
        <button onClick={onClose} aria-label="Закрыть тренировку" className="rounded-full p-2 flex-shrink-0 ritm-hover" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex gap-1 my-4">
          {items.map((_, i) => <span key={i} className="flex-1 rounded-full" style={{ height: 4, background: i < ei ? T.a : i === ei ? T.grad : "rgba(255,255,255,0.12)", transition: "background .4s ease" }} />)}
        </div>

        {phase === "resting" ? (
          <div key="rest" style={{ animation: "rise .25s ease-out" }}>
            <RestRing T={T} left={left} total={r.rest || 60} />
            <Muted size={13} className="text-center mt-1">Отдых перед подходом {si + 1} из {totalSets}</Muted>
            <BreathCircle T={T} seconds={r.rest || 60} />
            <Muted size={13} className="text-center">{breath.note}</Muted>
            <Ghost T={T} onClick={skipRest}>Пропустить отдых</Ghost>
          </div>
        ) : (
          <div key={`set-${ei}-${si}`} style={{ animation: "rise .25s ease-out" }}>
            <div className="text-center mt-2 mb-5">
              <Muted size={13}>Подход {si + 1} из {totalSets}</Muted>
              <div className="ritm-pop" style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, textShadow: `0 0 24px ${T.a}66` }}>
                <CountUp value={item.weightLabel} duration={700} scramble={false} />
              </div>
              <Muted size={13}>цель {item.target}{item.first ? "" : "+"} повторов до отказа</Muted>
            </div>

            {phase === "active" && (
              <Card T={T} className="mb-4">
                <div className="mb-3">
                  <ExerciseMedia T={T} e={e} exId={item?.id} />
                  <Muted size={12} className="mt-2 text-center">{e.time ? "Держи положение ровно" : `Темп: вниз ${e.tempo?.split("-")[0] || 2} с, пауза, вверх ${e.tempo?.split("-")[2] || 2} с`}</Muted>
                </div>
                <Muted size={12} className="mb-2">Сколько получилось</Muted>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <Stepper T={T} value={reps} onChange={setReps} unit="повт." min={0} />
                  {weighted && <Stepper T={T} value={weight} onChange={setWeight} unit="кг" min={0} />}
                </div>
              </Card>
            )}

            {e.steps?.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }} className="mb-2">Техника</div>
                <div className="flex flex-col gap-2 mb-4">
                  {e.steps.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, border: `1px solid ${T.line}`, fontSize: 11, fontFamily: DISPLAY }}>{i + 1}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.4 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {e.mistakes?.length > 0 && phase === "ready" && (
              <div className="flex flex-col gap-1 mb-2">
                {e.mistakes.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center"><X size={13} color={T.a} className="flex-shrink-0" /><span style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>{m}</span></div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {phase !== "resting" && (
        <div className="px-5 pb-6 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
          <Primary T={T} onClick={phase === "ready" ? start : finishSet}>
            {phase === "ready" ? "Делаю" : "Готово"}
          </Primary>
        </div>
      )}
    </FullScreen>
  );
}

function FinishWorkout({ T, st, up, k }) {
  if (st.done[k]) {
    return (
      <Card T={T} className="flex items-center gap-3" style={{ boxShadow: T.glow }}>
        <Check size={20} color={T.a} />
        <div>
          <div className="font-semibold">Тренировка завершена</div>
          <Muted size={13}>Отметка сохранена в календаре и серии дней</Muted>
        </div>
      </Card>
    );
  }
  return <Primary T={T} onClick={() => up((s) => ({ done: { ...s.done, [k]: true } }))}>Завершить тренировку</Primary>;
}

const daysOf = (map, pred) => Object.keys(map).filter((d) => pred(map[d])).map(Number).sort((a, b) => a - b).map((d) => WD[d]).join(", ");

function Train({ T, st, up, program, openEx, openNewWorkout, openWorkout, openSchedule, openSession, openTemplates }) {
  const now = new Date();
  const k = keyOf(now);
  const wd = wdOf(now);
  const todayIdx = program.schedule[wd];
  const todayOwn = program.customDays[wd];
  const [mode, setMode] = useState(todayOwn ? 1 : 0); // 0 = автопрограмма, 1 = свои тренировки
  const [sel, setSel] = useState(todayIdx ?? 0);
  const day = program.days[sel];
  const { range } = program;
  const onDays = daysOf(program.schedule, (v) => v === sel);
  const base = day.list.filter((it) => it.cat === "base");
  const iso = day.list.filter((it) => it.cat === "iso");
  const workouts = st.workouts || [];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <H1>Силовые</H1>
        <ScheduleButton T={T} isCustom={program.isCustom} onClick={openSchedule} />
      </div>
      <Segmented T={T} items={["Программа", "Свои"]} value={mode} onChange={setMode} />

      {mode === 0 ? (
        <>
          <Muted className="mt-1">
            Формат — фулбади: вся база и изоляция каждую тренировку. {range.lo}–{range.hi} повторов до технического отказа, отдых {range.restLabel}.
          </Muted>
          {program.weeklySets > 0 && (
            <Muted size={13} className="mt-1">Объём: {program.setsPerSession} {setsWord(program.setsPerSession)} на группу мышц за тренировку, {program.weeklySets} в неделю.</Muted>
          )}
          <Segmented T={T} items={program.days.map((d) => d.title)} value={sel} onChange={setSel} />
          <Muted size={13} className="mb-3">{onDays ? `По дням: ${onDays}` : "Не стоит в расписании — можно добавить через кнопку «Расписание»"}</Muted>

          <Card T={T} className="mb-4" style={{ borderRadius: 20 }}><MuscleMap groups={groupsOfItems(day.list)} /></Card>

          {/* Начать можно любую тренировку программы, а не только запланированную на сегодня:
              раньше в «день отдыха» кнопки не было вовсе, и новичок после анкеты ждал своего дня */}
          {!st.done[k] && (
            <Primary T={T} onClick={() => openSession(day.title, day.list, program.range)}>
              <PlayCircle size={18} /> {todayIdx === sel ? "Начать тренировку" : "Сделать эту тренировку сегодня"}
            </Primary>
          )}

          <div className="inline-flex items-center rounded-full px-3 py-1 mb-2 mt-4" style={{ background: T.card, border: `1px solid ${T.line}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: 0.3 }}>БАЗА</span>
          </div>
          <div className="flex flex-col gap-2">
            {base.map((it) => <ExerciseRow key={it.id} T={T} it={it} idx={day.list.indexOf(it)} onClick={() => openEx(it)} />)}
          </div>

          <div className="inline-flex items-center rounded-full px-3 py-1 mt-4 mb-2" style={{ background: T.card, border: `1px solid ${T.line}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: 0.3 }}>ИЗОЛЯЦИЯ</span>
          </div>
          <div className="flex flex-col gap-2">
            {iso.map((it) => <ExerciseRow key={it.id} T={T} it={it} idx={day.list.indexOf(it)} onClick={() => openEx(it)} />)}
          </div>

          <div className="mt-6">
            {todayIdx === sel ? (
              <FinishWorkout T={T} st={st} up={up} k={k} />
            ) : (
              <Muted size={13} className="text-center">Эта тренировка не на сегодня. Открой упражнение, чтобы посмотреть технику.</Muted>
            )}
          </div>
        </>
      ) : (
        <>
          <Muted className="mt-1 mb-4">Собери тренировку из своих упражнений или из базы, а потом поставь её на нужные дни в расписании.</Muted>
          {workouts.length === 0 ? (
            <Card T={T}><Muted size={14}>Пока нет своих тренировок. Создай первую ниже.</Muted></Card>
          ) : (
            <div className="flex flex-col gap-2">
              {workouts.map((w) => {
                const days = daysOf(program.customDays, (v) => v === w.id);
                const isToday = todayOwn === w.id;
                return (
                  <Card key={w.id} T={T} onClick={() => openWorkout(w.id)} className="flex items-center gap-3"
                    style={isToday ? { border: `1px solid ${T.a}` } : undefined}>
                    <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}>
                      <ListPlus size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate">{w.name}</div>
                        <MuscleDots groups={groupsOfItems(w.items)} />
                      </div>
                      <Muted size={13}>
                        {w.items.length} {exWord(w.items.length)}{isToday ? ", сегодня" : days ? `, по дням: ${days}` : ", не в расписании"}
                      </Muted>
                    </div>
                    {w.items.length > 0 && (
                      <button onClick={(ev) => { ev.stopPropagation(); openSession(w.name, w.items.map((it) => resolveWorkoutItem(it, st.profile, st.exLog)), null); }}
                        aria-label={`Начать тренировку «${w.name}»`} className="rounded-full p-2" style={{ background: T.grad, color: T.on }}>
                        <PlayCircle size={18} />
                      </button>
                    )}
                    <ChevronRight size={16} color={MUTED} />
                  </Card>
                );
              })}
            </div>
          )}
          {todayOwn && <div className="mt-4"><FinishWorkout T={T} st={st} up={up} k={k} /></div>}
          <div className="flex flex-col gap-2 mt-4">
            <Ghost T={T} onClick={openNewWorkout}><Plus size={18} /> Создать тренировку{!st.pro && workouts.length >= FREE_WORKOUTS ? <><Lock size={14} /> Pro</> : null}</Ghost>
            <Ghost T={T} onClick={openTemplates}><LayoutGrid size={16} /> Библиотека программ{!st.pro ? <><Lock size={14} /> Pro</> : null}</Ghost>
          </div>
        </>
      )}
    </div>
  );
}

/* ============ Редактор расписания ============ */
const WD_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

// Мягкие подсказки по методике: ничего не запрещают, только предупреждают
function scheduleHints(draft) {
  const hints = [];
  const days = [0, 1, 2, 3, 4, 5, 6];
  const runs = days.filter((d) => draft[d].run);
  const hard = days.filter((d) => HARD_RUNS.includes(draft[d].run));
  const busy = days.filter((d) => draft[d].run || draft[d].strength);
  if (busy.length === 7) hints.push("Оставь хотя бы один день полного отдыха — мышцы и суставы восстанавливаются именно в эти дни.");
  if (runs.length > 0 && runs.length < 3) hints.push("По методике бегать лучше 3–4 раза в неделю.");
  if (runs.length > 4) hints.push("Больше 4 пробежек в неделю — повышенная нагрузка. Методика рекомендует 3–4.");
  if (hard.length > 1) hints.push("Быстрая работа — это около 20% недели, обычно одна тренировка. Остальные пробежки лучше сделать спокойными.");
  days.forEach((d) => {
    const next = (d + 1) % 7;
    if (HARD_RUNS.includes(draft[d].run) && LONG_RUNS.includes(draft[next].run)) {
      hints.push(`${WD_FULL[d]}: быструю пробежку лучше не ставить накануне длительной.`);
    }
    if (HARD_RUNS.includes(draft[d].run) && draft[d].strength) {
      hints.push(`${WD_FULL[d]}: быстрая пробежка и силовая в один день — тяжело. Если так удобнее, делай их с перерывом в несколько часов.`);
    }
  });
  return hints;
}

function sanitizeSchedule(src, profile, workouts) {
  const runKeys = runKeysFor(profile);
  const ids = (workouts || []).map((w) => "w:" + w.id);
  const out = {};
  for (let d = 0; d < 7; d++) {
    const v = src?.[d] || {};
    const strength = v.strength === "A" || v.strength === "B" || ids.includes(v.strength) ? v.strength : null;
    const run = runKeys.includes(v.run) ? v.run : null;
    out[d] = { strength, run };
  }
  return out;
}

/* ============ Библиотека готовых программ ============
   Готовые наборы тренировок для тех, кто не хочет собирать «Свои» с нуля: выбираешь программу —
   она создаёт нужные тренировки в «Свои» и сама расставляет их по дням недели (по тому же
   распределению дней, что и автопрограмма, STRENGTH_DAYS), не трогая пробежки в расписании. */
const PROGRAM_TEMPLATES = [
  {
    id: "fullbody3", place: "gym", name: "Фулбоди, 3 дня",
    desc: "Классика для начала и для тех, кто хочет тренировать всё тело за одну сессию. Три разных дня, акцент на базовых движениях.",
    workouts: [
      { name: "Фулбоди A", items: [{ exId: "squat", sets: 3, target: 8 }, { exId: "bench", sets: 3, target: 8 }, { exId: "cableRow", sets: 3, target: 10 }, { exId: "legCurl", sets: 3, target: 12 }, { exId: "facePull", sets: 3, target: 15 }] },
      { name: "Фулбоди B", items: [{ exId: "deadlift", sets: 3, target: 6 }, { exId: "ohp", sets: 3, target: 8 }, { exId: "pulldown", sets: 3, target: 10 }, { exId: "legExtension", sets: 3, target: 12 }, { exId: "barbellCurl", sets: 3, target: 12 }] },
      { name: "Фулбоди C", items: [{ exId: "frontSquat", sets: 3, target: 8 }, { exId: "inclineBench", sets: 3, target: 8 }, { exId: "row", sets: 3, target: 10 }, { exId: "hipThrust", sets: 3, target: 10 }, { exId: "tricepPushdown", sets: 3, target: 12 }] },
    ],
  },
  {
    id: "upperlower4", place: "gym", name: "Верх/низ, 4 дня",
    desc: "Два дня на верх тела и два на низ — больше объёма на каждую группу мышц, чем в фулбоди, при той же частоте тренировок.",
    workouts: [
      { name: "Верх A", items: [{ exId: "bench", sets: 4, target: 8 }, { exId: "row", sets: 4, target: 10 }, { exId: "ohp", sets: 3, target: 8 }, { exId: "pulldown", sets: 3, target: 10 }, { exId: "barbellCurl", sets: 2, target: 12 }] },
      { name: "Низ A", items: [{ exId: "squat", sets: 4, target: 8 }, { exId: "rdl", sets: 3, target: 10 }, { exId: "legPress", sets: 3, target: 12 }, { exId: "calfraise", sets: 3, target: 15 }] },
      { name: "Верх B", items: [{ exId: "inclineBench", sets: 4, target: 8 }, { exId: "cableRow", sets: 4, target: 10 }, { exId: "facePull", sets: 3, target: 15 }, { exId: "closeGripBench", sets: 3, target: 10 }, { exId: "tricepPushdown", sets: 2, target: 12 }] },
      { name: "Низ B", items: [{ exId: "deadlift", sets: 3, target: 6 }, { exId: "hipThrust", sets: 3, target: 10 }, { exId: "legExtension", sets: 3, target: 12 }, { exId: "legCurl", sets: 3, target: 12 }] },
    ],
  },
  {
    id: "ppl3", place: "gym", name: "Push/Pull/Legs, 3 дня",
    desc: "Жим, тяга и ноги в отдельные дни — удобно, если хочется группировать упражнения по движению, а не по всему телу сразу.",
    workouts: [
      { name: "Push", items: [{ exId: "bench", sets: 4, target: 8 }, { exId: "ohp", sets: 3, target: 8 }, { exId: "inclineBench", sets: 3, target: 10 }, { exId: "tricepPushdown", sets: 3, target: 12 }] },
      { name: "Pull", items: [{ exId: "row", sets: 4, target: 8 }, { exId: "pulldown", sets: 3, target: 10 }, { exId: "cableRow", sets: 3, target: 10 }, { exId: "barbellCurl", sets: 3, target: 12 }, { exId: "facePull", sets: 2, target: 15 }] },
      { name: "Legs", items: [{ exId: "squat", sets: 4, target: 8 }, { exId: "rdl", sets: 3, target: 10 }, { exId: "legPress", sets: 3, target: 12 }, { exId: "calfraise", sets: 3, target: 15 }] },
    ],
  },
  {
    id: "bwfullbody3", place: "bodyweight", name: "Фулбоди без веса, 3 дня",
    desc: "Только своё тело — подходит без зала и оборудования, дома или в поездке.",
    workouts: [
      { name: "Фулбоди A", items: [{ exId: "bwsquat", sets: 3, target: 15 }, { exId: "pushup", sets: 3, target: 12 }, { exId: "glute", sets: 3, target: 15 }, { exId: "superman", sets: 3, target: 12 }] },
      { name: "Фулбоди B", items: [{ exId: "splitSquatBW", sets: 3, target: 10 }, { exId: "diamondPushup", sets: 3, target: 10 }, { exId: "gluteBridgeSingle", sets: 3, target: 12 }, { exId: "mountainClimbers", sets: 3, target: 20 }] },
      { name: "Фулбоди C", items: [{ exId: "lunge", sets: 3, target: 12 }, { exId: "declinePushup", sets: 3, target: 10 }, { exId: "pike", sets: 3, target: 10 }, { exId: "crunch", sets: 3, target: 15 }] },
    ],
  },
  {
    id: "dbfullbody3", place: "homeWeight", name: "Фулбоди с гантелями, 3 дня",
    desc: "Дома с парой гантелей — база на всё тело плюс упражнения с собственным весом там, где гантели не нужны.",
    workouts: [
      { name: "Фулбоди A", items: [{ exId: "dbSquat", sets: 3, target: 12 }, { exId: "dbPress", sets: 3, target: 10 }, { exId: "dbRow", sets: 3, target: 10 }, { exId: "crunch", sets: 3, target: 15 }] },
      { name: "Фулбоди B", items: [{ exId: "dbRdl", sets: 3, target: 10 }, { exId: "pushup", sets: 3, target: 12 }, { exId: "dbRow", sets: 3, target: 10 }, { exId: "glute", sets: 3, target: 15 }] },
      { name: "Фулбоди C", items: [{ exId: "dbSquat", sets: 3, target: 12 }, { exId: "dbPress", sets: 3, target: 10 }, { exId: "superman", sets: 3, target: 12 }, { exId: "calfraise", sets: 3, target: 15 }] },
    ],
  },
  {
    id: "kbfullbody3", place: "kettlebell", name: "Фулбоди с гирей, 3 дня",
    desc: "Одна гиря — маховые и силовые движения на всё тело, компактно и без зала.",
    workouts: [
      { name: "Фулбоди A", items: [{ exId: "kbGoblet", sets: 3, target: 12 }, { exId: "kbFloorPress", sets: 3, target: 10 }, { exId: "kbRow", sets: 3, target: 10 }, { exId: "kbSwing", sets: 3, target: 15 }] },
      { name: "Фулбоди B", items: [{ exId: "kbSwing", sets: 4, target: 15 }, { exId: "kbPress", sets: 3, target: 8 }, { exId: "kbRow", sets: 3, target: 10 }, { exId: "glute", sets: 3, target: 15 }] },
      { name: "Фулбоди C", items: [{ exId: "kbGoblet", sets: 3, target: 12 }, { exId: "kbFloorPress", sets: 3, target: 10 }, { exId: "kbPress", sets: 3, target: 8 }, { exId: "crunch", sets: 3, target: 15 }] },
    ],
  },
];

// Создаёт тренировки программы в st.workouts и расставляет их по дням недели —
// как STRENGTH_DAYS распределяет дни для автопрограммы, только с этими тренировками вместо A/B.
// Бег в расписании не трогаем, силовые дни расставляем заново под выбранную программу.
function applyProgramTemplate(up, st, template) {
  const p = st.profile;
  const days = STRENGTH_DAYS[p.days] || STRENGTH_DAYS[3];
  const base = st.schedule || defaultSchedule(p);
  const stamp = Date.now();
  const newWorkouts = template.workouts.map((w, i) => ({ id: `tpl${stamp}_${i}`, name: w.name, items: w.items.map((it) => ({ ...it })) }));
  const schedule = {};
  for (let d = 0; d < 7; d++) {
    const idx = days.indexOf(d);
    schedule[d] = { run: base[d]?.run || null, strength: idx === -1 ? null : "w:" + newWorkouts[idx % newWorkouts.length].id };
  }
  up((s) => ({ workouts: [...(s.workouts || []), ...newWorkouts], schedule }));
}

function ProgramTemplatesSheet({ T, st, onApply, onClose }) {
  const place = st.profile?.place;
  const sorted = [...PROGRAM_TEMPLATES].sort((a, b) => (a.place === place ? -1 : b.place === place ? 1 : 0));
  return (
    <Sheet T={T} title="Библиотека программ" sub="Выбери готовую программу — она создаст тренировки в «Свои» и расставит их по дням недели вместо текущего расписания силовых." onClose={onClose}>
      <div className="flex flex-col gap-2">
        {sorted.map((tpl) => (
          <Card key={tpl.id} T={T} onClick={() => onApply(tpl)} style={tpl.place === place ? { border: `1px solid ${T.a}` } : undefined}>
            <div className="flex items-center gap-3">
              <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}>
                <LayoutGrid size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{tpl.name}</div>
                <Muted size={12} className="mt-0.5">{tpl.desc}</Muted>
                <Muted size={11} className="mt-1">{tpl.workouts.length} тренировки{tpl.place !== place ? " · для другого места тренировок" : ""}</Muted>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Sheet>
  );
}

function ScheduleSheet({ T, st, onSave, onClose }) {
  const profile = st.profile;
  const workouts = st.workouts || [];
  const [draft, setDraft] = useState(() => sanitizeSchedule(st.schedule || defaultSchedule(profile), profile, workouts));
  const setDay = (d, patch) => setDraft((x) => ({ ...x, [d]: { ...x[d], ...patch } }));
  const strengthOptions = [["", "Нет силовой"], ["A", "Тренировка A"], ["B", "Тренировка B"], ...workouts.map((w) => ["w:" + w.id, w.name])];
  const runOptions = [["", "Нет пробежки"], ...runKeysFor(profile).map((k) => [k, RUN_OPTION_LABEL[k]])];
  const hints = scheduleHints(draft);
  const strengthCount = Object.values(draft).filter((v) => v.strength).length;
  const runCount = Object.values(draft).filter((v) => v.run).length;
  const selectStyle = { border: `1px solid ${T.line}`, background: "#0b0b0d", color: "#fff", fontSize: 14, width: "100%" };

  return (
    <Sheet T={T} title="Расписание недели" onClose={onClose}>
      <Muted size={13} className="mb-4">
        Выбери, что делать в каждый день. Свои тренировки создаются во вкладке «Силовые» → «Свои».
      </Muted>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <Card key={d} T={T} style={{ padding: "10px 12px" }}>
            <div className="font-semibold mb-2" style={{ fontSize: 14 }}>{WD_FULL[d]}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: MUTED }}><Dumbbell size={11} /> Силовая</span>
                <select value={draft[d].strength || ""} onChange={(e) => setDay(d, { strength: e.target.value || null })}
                  className="rounded-lg px-2 py-2 outline-none" style={selectStyle} aria-label={`${WD_FULL[d]}: силовая`}>
                  {strengthOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: MUTED }}><Footprints size={11} /> Бег</span>
                <select value={draft[d].run || ""} onChange={(e) => setDay(d, { run: e.target.value || null })}
                  className="rounded-lg px-2 py-2 outline-none" style={selectStyle} aria-label={`${WD_FULL[d]}: бег`}>
                  {runOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
          </Card>
        ))}
      </div>

      <Muted size={13} className="mt-4">Силовых в неделю: {strengthCount}, пробежек: {runCount}</Muted>
      {hints.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {hints.map((h, i) => (
            <div key={i} className="flex gap-2 rounded-xl px-3 py-2" style={{ border: `1px solid ${T.a}55` }}>
              <AlertTriangle size={14} color={T.a} className="flex-shrink-0" style={{ marginTop: 2 }} />
              <span style={{ fontSize: 13, lineHeight: 1.4 }}>{h}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-5">
        <Primary T={T} onClick={() => onSave(draft)}>Сохранить расписание</Primary>
        {st.schedule && <Ghost T={T} onClick={() => onSave(null)}>Вернуть автоматическое</Ghost>}
      </div>
    </Sheet>
  );
}

function WorkoutItemRow({ T, it, onLog, onDelete, onUpdate }) {
  const label = it.custom ? it.customName : EX[it.exId].name;
  const [setsText, setSetsText] = useState(String(it.sets ?? 3));
  const [targetText, setTargetText] = useState(String(it.target ?? 10));
  useEffect(() => { setSetsText(String(it.sets ?? 3)); }, [it.sets]);
  useEffect(() => { setTargetText(String(it.target ?? 10)); }, [it.target]);
  const commitNumber = (text, key, min, max, fallback) => {
    const n = Math.max(min, Math.min(max, parseInt(text, 10) || fallback));
    onUpdate({ [key]: n });
    return String(n);
  };
  return (
    <Card T={T} style={{ padding: "12px 14px" }}>
      <div className="flex items-center gap-3">
        <button onClick={onLog} className="flex-1 min-w-0 text-left">
          <div className="font-medium truncate">{label}</div>
          {it.custom && it.weighted && <Muted size={12}>стартовый вес {it.startWeight || 0} кг</Muted>}
        </button>
        <button onClick={onDelete} aria-label={`Удалить ${label}`} style={{ color: MUTED }}><Trash2 size={15} /></button>
      </div>
      <div className="flex gap-2 mt-2">
        <label className="flex-1 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ border: `1px solid ${T.line}` }}>
          <span style={{ fontSize: 11, color: MUTED }}>подходов</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={setsText}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
              setSetsText(v);
              if (v !== "") onUpdate({ sets: Math.max(1, Math.min(10, parseInt(v, 10))) });
            }}
            onBlur={() => {
              const normalized = commitNumber(setsText, "sets", 1, 10, Number(it.sets) || 3);
              setSetsText(normalized);
            }}
            className="bg-transparent text-right outline-none" style={{ width: 42, fontFamily: DISPLAY, fontSize: 14, color: "#fff" }} />
        </label>
        <label className="flex-1 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ border: `1px solid ${T.line}` }}>
          <span style={{ fontSize: 11, color: MUTED }}>повторов</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={targetText}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
              setTargetText(v);
              if (v !== "") onUpdate({ target: Math.max(1, Math.min(50, parseInt(v, 10))) });
            }}
            onBlur={() => {
              const normalized = commitNumber(targetText, "target", 1, 50, Number(it.target) || 10);
              setTargetText(normalized);
            }}
            className="bg-transparent text-right outline-none" style={{ width: 42, fontFamily: DISPLAY, fontSize: 14, color: "#fff" }} />
        </label>
      </div>
    </Card>
  );
}

function WorkoutEditSheet({ T, workout, up, onOpenPicker, onLogItem, onClose }) {
  const [name, setName] = useState(workout.name);
  const patchWorkout = (patch) => up((s) => ({ workouts: s.workouts.map((w) => (w.id === workout.id ? { ...w, ...patch } : w)) }));
  const saveName = () => { const n = name.trim(); patchWorkout({ name: n || workout.name }); if (!n) setName(workout.name); };
  // Обновляем упражнение через актуальное состояние, чтобы быстрые изменения
  // подходов/повторов не перетирали друг друга из-за устаревшего объекта workout.
  const updateItem = (id, patch) => up((s) => ({
    workouts: s.workouts.map((w) => w.id === workout.id
      ? { ...w, items: (w.items || []).map((it) => it.id === id ? { ...it, ...patch } : it) }
      : w)
  }));
  // Как и updateItem выше — удаляем через актуальное состояние, а не через устаревший
  // объект workout, иначе быстрые последовательные удаления могут отменять друг друга.
  const delItem = (id) => up((s) => ({
    workouts: s.workouts.map((w) => w.id === workout.id
      ? { ...w, items: (w.items || []).filter((it) => it.id !== id) }
      : w)
  }));
  const delWorkout = () => { up((s) => ({ workouts: s.workouts.filter((w) => w.id !== workout.id) })); onClose(); };

  return (
    <Sheet T={T} title="" onClose={onClose}>
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} placeholder="Название тренировки"
        className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-4" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 18, fontFamily: DISPLAY }} />

      {workout.items.length === 0 ? (
        <Card T={T}><Muted size={14}>Добавь первое упражнение.</Muted></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {workout.items.map((it) => (
            <WorkoutItemRow key={it.id} T={T} it={it} onLog={() => onLogItem(it)} onDelete={() => delItem(it.id)} onUpdate={(p) => updateItem(it.id, p)} />
          ))}
        </div>
      )}

      <div className="mt-3"><Ghost T={T} onClick={onOpenPicker}><Plus size={16} /> Добавить упражнение</Ghost></div>
      <Muted size={12} className="mt-3">Нажми на упражнение в списке, чтобы записать подходы.</Muted>

      <div className="mt-6"><Ghost T={T} onClick={delWorkout}><Trash2 size={16} /> Удалить тренировку</Ghost></div>
    </Sheet>
  );
}

function ExercisePickerSheet({ T, profile, onPick, onClose }) {
  const [mode, setMode] = useState(0);
  const [q, setQ] = useState("");
  const range = repRangeFor(profile);
  const list = Object.entries(EX).filter(([, e]) => e.name.toLowerCase().includes(q.trim().toLowerCase()));

  const [cName, setCName] = useState("");
  const [cSets, setCSets] = useState(3);
  const [cTarget, setCTarget] = useState(10);
  const [cWeighted, setCWeighted] = useState(false);
  const [cStart, setCStart] = useState(0);

  const addBuiltin = (id) => onPick({ id: "wi" + Date.now(), custom: false, exId: id, sets: 3, target: range.lo });
  const addCustom = () => {
    const n = cName.trim();
    if (!n) return;
    onPick({
      id: "wi" + Date.now(), custom: true, customName: n,
      sets: Math.max(1, Number(cSets) || 1), target: Math.max(1, Number(cTarget) || 1),
      weighted: cWeighted, startWeight: cWeighted ? Math.max(0, Number(cStart) || 0) : 0,
    });
  };

  return (
    <Sheet T={T} title="Добавить упражнение" onClose={onClose}>
      <Segmented T={T} items={["Из базы", "Своё"]} value={mode} onChange={setMode} />
      {mode === 0 ? (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию"
            className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-3" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
          <div className="flex flex-col gap-2 no-scrollbar" style={{ maxHeight: 380, overflowY: "auto" }}>
            {list.map(([id, e]) => (
              <Card key={id} T={T} onClick={() => addBuiltin(id)} className="flex items-center gap-3" style={{ padding: "10px 14px" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.name}</div>
                  <Muted size={12}>{e.muscles}</Muted>
                </div>
                <Plus size={16} color={MUTED} />
              </Card>
            ))}
            {list.length === 0 && <Muted size={14} className="text-center py-6">Ничего не нашлось</Muted>}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Название упражнения"
            className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
          <div className="flex gap-3">
            <label className="flex-1 flex items-center justify-between rounded-xl px-4 py-3" style={{ border: `1px solid ${T.line}` }}>
              <span style={{ color: MUTED, fontSize: 13 }}>подходов</span>
              <input type="number" inputMode="numeric" value={cSets} onChange={(e) => setCSets(e.target.value)}
                className="bg-transparent text-right outline-none" style={{ width: 44, fontFamily: DISPLAY, fontSize: 17, color: "#fff" }} />
            </label>
            <label className="flex-1 flex items-center justify-between rounded-xl px-4 py-3" style={{ border: `1px solid ${T.line}` }}>
              <span style={{ color: MUTED, fontSize: 13 }}>повторов</span>
              <input type="number" inputMode="numeric" value={cTarget} onChange={(e) => setCTarget(e.target.value)}
                className="bg-transparent text-right outline-none" style={{ width: 44, fontFamily: DISPLAY, fontSize: 17, color: "#fff" }} />
            </label>
          </div>
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ border: `1px solid ${T.line}` }}>
            <span className="flex-1" style={{ fontSize: 15 }}>С весом</span>
            <Toggle T={T} on={cWeighted} onChange={setCWeighted} label="С весом" />
          </div>
          {cWeighted && (
            <label className="flex items-center justify-between rounded-xl px-4 py-3" style={{ border: `1px solid ${T.line}` }}>
              <span style={{ color: MUTED, fontSize: 13 }}>стартовый вес, кг</span>
              <input type="number" inputMode="decimal" value={cStart} onChange={(e) => setCStart(e.target.value)}
                className="bg-transparent text-right outline-none" style={{ width: 60, fontFamily: DISPLAY, fontSize: 17, color: "#fff" }} />
            </label>
          )}
          <Primary T={T} onClick={addCustom} disabled={!cName.trim()}>Добавить в тренировку</Primary>
        </div>
      )}
    </Sheet>
  );
}

function ExerciseSheet({ T, item, range, history, pro, onClose, onSave }) {
  const e = item.exercise || EX[item.id];
  const last = history && history.length ? history[0] : null;
  const weighted = item.weight != null || last?.weight != null;
  // При повторном открытии показываем последний сохранённый результат, а не
  // исходные target/weight упражнения. Это важно для своей тренировки:
  // пользователь должен видеть свои последние подходы, повторы и вес.
  const initialSets = () => {
    if (last?.sets?.length) {
      return last.sets.map((s) => ({
        reps: String(s.reps ?? item.target),
        weight: weighted ? String(s.weight ?? last.weight ?? item.weight ?? "") : ""
      }));
    }
    return Array.from({ length: Number(item.sets) || 1 }, () => ({
      reps: String(item.target ?? range.lo),
      weight: weighted ? String(item.weight ?? "") : ""
    }));
  };
  const [sets, setSets] = useState(initialSets);
  const [note, setNote] = useState("");
  const [left, setLeft] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const [down, hold, upT] = e.tempo.split("-").map(Number);

  const updateSet = (i, patch) => setSets(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const finishSet = (i) => { if (i < item.sets - 1) setLeft(range.rest); };

  const save = () => {
    const cleaned = sets.map((s) => ({ reps: Math.max(0, Math.round(Number(s.reps) || 0)), weight: weighted ? Math.max(0, Number(s.weight) || 0) : null }));
    const minReps = Math.min(...cleaned.map((s) => s.reps));
    const lastWeight = weighted ? cleaned[cleaned.length - 1].weight : null;
    onSave({ id: Date.now(), exId: item.id, date: keyOf(new Date()), sets: cleaned, note: note.trim(), minReps, weight: lastWeight });
    setSaved(true);
  };

  const shown = pro ? history : history.slice(0, FREE_HISTORY);

  if (saved) {
    const leveledUp = Math.min(...sets.map((s) => Number(s.reps) || 0)) >= range.hi;
    return (
      <Sheet T={T} title="Записано в дневник" onClose={onClose}>
        <div className="text-center py-4" style={{ animation: "rise .3s ease-out" }}>
          <div className="mx-auto rounded-full flex items-center justify-center mb-5" style={{ width: 72, height: 72, background: T.grad, boxShadow: T.glow, color: T.on }}>
            <Check size={30} strokeWidth={3} />
          </div>
          {leveledUp && weighted ? (
            <>
              <div className="font-semibold mb-1">Отказ на {range.hi}+ повторах во всех подходах</div>
              <Muted className="mb-6">В следующий раз вес вырастет, а счётчик повторов снова начнётся с {range.lo}.</Muted>
            </>
          ) : leveledUp ? (
            <>
              <div className="font-semibold mb-1">Диапазон выполнен полностью</div>
              <Muted className="mb-6">Без веса это упражнение сложно наращивать дальше — попробуй более медленный темп или сложный вариант.</Muted>
            </>
          ) : (
            <>
              <div className="font-semibold mb-1">Записал технику и результат</div>
              <Muted className="mb-6">В следующий раз старайся хотя бы повторить сегодняшний минимум по подходам.</Muted>
            </>
          )}
          <Primary T={T} onClick={onClose}>Готово</Primary>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet T={T} title={e.name} onClose={onClose}>
      <div className="flex items-center gap-2">
        <Muted size={13}>{e.muscles || "Своё упражнение"}</Muted>
        {e.cat && <span className="rounded-full px-2" style={{ fontSize: 11, border: `1px solid ${T.line}`, color: MUTED }}>{e.cat === "base" ? "База" : "Изоляция"} · {GROUP_LABEL[e.group]}</span>}
      </div>

      <div className="flex gap-5 items-stretch mt-5">
        <TempoBar T={T} e={e} />
        <div className="flex flex-col justify-between">
          <div>
            <Muted size={12}>{e.time ? "Статика" : `Темп ${e.tempo}`}</Muted>
            <div style={{ fontSize: 14 }}>{e.time ? "Держи ровное положение и дыши" : `Вниз ${down} с, пауза ${hold} с, вверх ${upT} с`}</div>
          </div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, textShadow: `0 0 20px ${T.a}66` }}>{item.weightLabel}</div>
            <Muted size={13}>{item.sets} {setsWord(item.sets)} до отказа, цель {item.target}{item.first ? "" : "+"} повторов</Muted>
          </div>
        </div>
      </div>

      <Muted size={12} className="mt-4">
        {item.first
          ? (range.lo === range.hi
            ? `Первый раз — цель ${range.lo} повторов в каждом подходе. Когда получится во всех подходах, вес вырастет.`
            : `Первый раз — выполняй до технического отказа, цель ${rangeText(range)} повторов. Отказ — это когда следующий чистый повтор уже не сделать.`)
          : item.leveledUp && weighted
          ? `В прошлый раз ты сделал ${item.lastMin}+ повторов на каждом подходе — вес вырос, цель ${range.lo} с новым весом.`
          : `В прошлый раз худший подход — ${item.lastMin ?? item.target} повторов. Цель сегодня — ${item.target}${weighted ? "" : " или больше"}.`}
      </Muted>

      <H2 right={left > 0 && (
        <button onClick={() => setLeft(0)} className="flex items-center gap-1 rounded-full px-3 py-1" style={{ background: T.grad, color: T.on, fontSize: 13, fontWeight: 600 }}>
          <Timer size={13} /> {pad(Math.floor(left / 60))}:{pad(left % 60)}
        </button>
      )}>Подходы, до отказа</H2>
      <div className="flex flex-col gap-2">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, border: `1px solid ${T.line}`, fontSize: 12, fontFamily: DISPLAY }}>{i + 1}</span>
            <label className="flex-1 flex items-center justify-between rounded-xl px-3 py-2" style={{ border: `1px solid ${T.line}`, background: T.card }}>
              <span style={{ fontSize: 12, color: MUTED }}>повторы</span>
              <input type="number" inputMode="numeric" value={s.reps} onChange={(e2) => updateSet(i, { reps: e2.target.value })} onBlur={() => finishSet(i)}
                className="bg-transparent text-right outline-none" style={{ width: 44, fontFamily: DISPLAY, fontSize: 17, color: "#fff" }} />
            </label>
            {weighted && (
              <label className="flex-1 flex items-center justify-between rounded-xl px-3 py-2" style={{ border: `1px solid ${T.line}`, background: T.card }}>
                <span style={{ fontSize: 12, color: MUTED }}>кг</span>
                <input type="number" inputMode="decimal" value={s.weight} onChange={(e2) => updateSet(i, { weight: e2.target.value })}
                  className="bg-transparent text-right outline-none" style={{ width: 52, fontFamily: DISPLAY, fontSize: 17, color: "#fff" }} />
              </label>
            )}
          </div>
        ))}
      </div>
      {left > 0 && <Muted size={12} className="mt-2">Идёт отдых {range.restLabel}. Нажми на таймер, чтобы пропустить.</Muted>}

      <H2>Заметка по технике</H2>
      <textarea value={note} onChange={(e2) => setNote(e2.target.value)} rows={2} placeholder="Например: колени заваливались на последнем подходе"
        className="w-full rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 14, resize: "none", fontFamily: BODY }} />

      <div className="mt-4"><Primary T={T} onClick={save}>Сохранить тренировку</Primary></div>

      {e.steps.length > 0 && (
        <>
          <H2>Техника</H2>
          <div className="flex flex-col gap-3">
            {e.steps.map((s, i) => (
              <div key={i} className="flex gap-3">
                <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, border: `1px solid ${T.line}`, fontSize: 12, fontFamily: DISPLAY }}>{i + 1}</span>
                <span style={{ fontSize: 15, lineHeight: 1.45 }}>{s}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {e.mistakes.length > 0 && (
        <>
          <H2>Частые ошибки</H2>
          <div className="flex flex-col gap-2">
            {e.mistakes.map((m, i) => (
              <div key={i} className="flex gap-3 items-center">
                <X size={16} color={T.a} className="flex-shrink-0" />
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.8)" }}>{m}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <H2>Дневник</H2>
          <div className="flex flex-col gap-2">
            {shown.map((h) => (
              <div key={h.id} className="rounded-xl px-3 py-2" style={{ border: `1px solid ${T.line}` }}>
                <div className="flex justify-between" style={{ fontSize: 13 }}>
                  <span style={{ color: MUTED }}>{h.date}</span>
                  <span>{h.sets.map((s) => s.weight != null ? `${s.reps}×${fmt(s.weight)}` : s.reps).join(", ")}</span>
                </div>
                {h.note && <Muted size={12} className="mt-1">{h.note}</Muted>}
              </div>
            ))}
          </div>
          {!pro && history.length > FREE_HISTORY && <Muted size={12} className="mt-2">Ещё {history.length - FREE_HISTORY} записей — полная история в Pro.</Muted>}
        </>
      )}
    </Sheet>
  );
}

/* ============ Бег ============ */
function RunCard({ T, s, dayLabel, isToday, done, onToggleDone }) {
  const [open, setOpen] = useState(isToday);
  return (
    <Card T={T} style={isToday ? { border: `1px solid ${T.a}` } : undefined}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <Muted size={12}>{dayLabel}{isToday ? ", сегодня" : ""}</Muted>
          <div className="font-semibold">{s.title}</div>
          <Muted size={13}>{s.summary}</Muted>
        </div>
        {isToday ? (
          <span onClick={(e) => { e.stopPropagation(); onToggleDone(); }}>
            <CheckBox T={T} on={done} label="Пробежка выполнена" onClick={onToggleDone} />
          </span>
        ) : (
          <ChevronRight size={16} color={MUTED} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
        )}
      </button>
      {open && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
          <div className="flex flex-col gap-2">
            {s.lines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: T.a, marginTop: 7 }} />
                <span style={{ fontSize: 14, lineHeight: 1.4 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const runsWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "пробежек"; const l = n % 10; return l === 1 ? "пробежка" : l >= 2 && l <= 4 ? "пробежки" : "пробежек"; };

function Run({ T, st, up, run, week, openPay, openSchedule, isCustom }) {
  const [sel, setSel] = useState(week);
  const [warmup, setWarmup] = useState(false);
  const now = new Date();
  const k = keyOf(now);
  const todayWd = wdOf(now);
  const locked = (w) => !st.pro && w > 0;
  const runDays = Object.keys(run.schedule).map(Number).sort((a, b) => a - b);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <H1>Бег</H1>
        <ScheduleButton T={T} isCustom={isCustom} onClick={openSchedule} />
      </div>
      <Muted className="mt-1">
        {run.runDays > 0 ? `${run.runDays} ${runsWord(run.runDays)} в неделю. ` : ""}Методика: 3–4 пробежки, 80% объёма — спокойный бег, 20% — быстрая работа.
      </Muted>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Card T={T} style={{ borderRadius: 20 }}>
          <Muted size={13}>Зона 3 (объём)</Muted>
          <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600 }}>до {run.steadyCeil}</div>
          <Muted size={13}>уд/мин</Muted>
        </Card>
        <Card T={T} style={{ borderRadius: 20 }}>
          <Muted size={13}>Восстановление</Muted>
          <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600 }}>до {run.recoveryCeil}</div>
          <Muted size={13}>уд/мин</Muted>
        </Card>
      </div>

      <Segmented T={T} value={sel} onChange={setSel}
        items={[0, 1, 2, 3].map((w) => (<span key={w} className="flex items-center gap-1">{locked(w) && <Lock size={11} />}Нед. {w + 1}</span>))} />

      {locked(sel) ? (
        <Card T={T} className="text-center" style={{ padding: 24 }}>
          <Lock size={22} className="mx-auto mb-2" style={{ display: "block" }} />
          <div className="font-semibold mb-1">Недели 2–4 открываются в Pro</div>
          <Muted size={13} className="mb-4">Объём растёт постепенно, чтобы суставы успевали адаптироваться</Muted>
          <Primary T={T} onClick={() => openPay("run_plan")}>Открыть Pro</Primary>
        </Card>
      ) : runDays.length === 0 ? (
        <Card T={T}>
          <Muted size={14} className="mb-3">В расписании пока нет пробежек.</Muted>
          <Ghost T={T} onClick={openSchedule}><CalendarDays size={16} /> Добавить пробежки в расписание</Ghost>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {runDays.map((d) => {
            const isToday = sel === week && d === todayWd;
            return (
              <RunCard key={`${sel}-${d}`} T={T} s={run.weeks[sel][run.schedule[d]]} dayLabel={WD[d]} isToday={isToday}
                done={!!st.runDone[k]} onToggleDone={() => up((x) => ({ runDone: { ...x.runDone, [k]: !x.runDone[k] } }))} />
            );
          })}
        </div>
      )}
      <Muted size={12} className="mt-4 mb-2">Перед бегом разминайся 5–10 минут, после заканчивай спокойным шагом. Ускорения и фартлек чередуются по неделям.</Muted>
      <Ghost T={T} onClick={() => setWarmup(true)}><Footprints size={16} /> Открыть разминку перед бегом</Ghost>
      {warmup && <ChargeSession T={T} mode={CHARGE_MODES.find((m) => m.id === "aerobic")} onClose={() => setWarmup(false)} />}
    </div>
  );
}

/* ============ Календарь и привычки ============ */
function CalendarScreen({ T, st, up, program, run, week, openPay, openSchedule }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(keyOf(today));
  const [text, setText] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [dailyMode, setDailyMode] = useState(false);
  const [taskRepeat, setTaskRepeat] = useState({ type: "once", date: keyOf(today) });
  const [taskPriority, setTaskPriority] = useState(0);
  const [taskListId, setTaskListId] = useState("inbox");
  const [habitName, setHabitName] = useState("");
  const [view, setView] = useState(0);
  const [editing, setEditing] = useState(null);
  const [managingLists, setManagingLists] = useState(false);
  const lists = st.taskLists?.length ? st.taskLists : DEFAULT.taskLists;

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = wdOf(new Date(y, m, 1));
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => new Date(y, m, i + 1))];
  const selDate = new Date(sel + "T00:00:00");
  const habitWeek = weekDays(selDate);
  const weekLabel = `${habitWeek[0].getDate()} ${MONTHS[habitWeek[0].getMonth()].slice(0, 3).toLowerCase()} – ${habitWeek[6].getDate()} ${MONTHS[habitWeek[6].getMonth()].slice(0, 3).toLowerCase()}`;
  const selW = wdOf(selDate);
  const tasks = [...(st.tasks[sel] || [])].sort(sortByPriorityTime);
  const allRecurring = st.dailyTasks || [];
  const daily = allRecurring.filter((t) => taskOccursOn(t, selDate)).sort(sortByPriorityTime);
  const canAddHabit = st.pro || st.habits.length < FREE_HABITS;
  const selOwn = (st.workouts || []).find((x) => x.id === program.customDays[selW]);

  const addTask = () => {
    const t = text.trim();
    if (!t) return;
    if (dailyMode) addDailyTask(up, { text: t, time: taskTime || null, repeat: taskRepeat, priority: taskPriority, listId: taskListId });
    else addOnceTask(up, sel, { text: t, time: taskTime || null, priority: taskPriority, listId: taskListId });
    setText("");
    setTaskTime("");
  };
  const toggleTask = (id) => toggleOnceTask(up, sel, id);
  const delTask = (id) => deleteOnceTask(up, sel, id);
  const toggleDaily = (id) => toggleDailyLog(up, id, sel);
  const delDaily = (id) => deleteDailyTask(up, id);
  const saveEdit = (patch) => {
    if (!editing) return;
    if (editing.kind === "daily") updateDailyTask(up, editing.id, { text: patch.text, time: patch.time, timeEnd: patch.timeEnd, priority: patch.priority, listId: patch.listId, notes: patch.notes, repeat: patch.repeat });
    else moveOnceTask(up, editing.date, patch.date, editing.id, { text: patch.text, time: patch.time, timeEnd: patch.timeEnd, priority: patch.priority, listId: patch.listId, notes: patch.notes });
  };
  const deleteEdit = () => {
    if (!editing) return;
    if (editing.kind === "daily") deleteDailyTask(up, editing.id);
    else deleteOnceTask(up, editing.date, editing.id);
  };
  const addHabit = () => {
    const n = habitName.trim();
    if (!n) return;
    if (!canAddHabit) return openPay("habits");
    up((s) => ({ habits: [...s.habits, { id: "h" + Date.now(), name: n, log: {} }] }));
    setHabitName("");
  };
  const toggleHabitDay = (id, key) => up((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, log: { ...h.log, [key]: !h.log[key] } } : h)) }));
  const delHabit = (id) => up((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  const Dot = ({ c }) => <span style={{ width: 4, height: 4, borderRadius: 4, background: c, display: "inline-block" }} />;

  return (
    <div>
      <H1>Календарь</H1>
      <Segmented T={T} items={["Месяц", "Список"]} value={view} onChange={setView} />

      {view === 1 ? (
        <PlannerList T={T} st={st} up={up} lists={lists} openEditor={setEditing} openListsManager={() => setManagingLists(true)} />
      ) : (
      <>
      <div className="flex items-center justify-between">
        <H2>{MONTHS[m]}</H2>
        <div className="flex gap-2 items-center">
          <button aria-label="Предыдущий месяц" onClick={() => setCursor(new Date(y, m - 1, 1))} className="rounded-full p-2" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}><ChevronLeft size={18} /></button>
          <button aria-label="Следующий месяц" onClick={() => setCursor(new Date(y, m + 1, 1))} className="rounded-full p-2" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}><ChevronRight size={18} /></button>
        </div>
      </div>

      <Card T={T} className="mt-4" style={{ padding: 10, borderRadius: 24 }}>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WD.map((d) => <div key={d} className="py-1" style={{ fontSize: 11, color: MUTED }}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = keyOf(d);
            const w = wdOf(d);
            const isSel = k === sel;
            const isToday = k === keyOf(today);
            const doneAny = st.done[k] || st.runDone[k];
            return (
              <button key={i} onClick={() => setSel(k)} className="rounded-xl flex flex-col items-center justify-center gap-1"
                style={{ height: 44, background: isSel ? T.grad : doneAny ? "rgba(255,255,255,0.09)" : "transparent", color: isSel ? T.on : "#fff", border: isToday && !isSel ? `1px solid ${T.a}` : "1px solid transparent", boxShadow: isSel ? T.glow : "none" }}>
                <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, lineHeight: 1 }}>{d.getDate()}</span>
                <span className="flex gap-1" style={{ height: 4 }}>
                  {(program.schedule[w] !== undefined || program.customDays[w]) && <Dot c={isSel ? T.on : T.a} />}
                  {run.schedule[w] !== undefined && <Dot c={isSel ? T.on : T.b} />}
                  {((st.tasks[k] || []).length > 0 || allRecurring.some((t) => taskOccursOn(t, d))) && <Dot c={isSel ? T.on : "rgba(255,255,255,0.6)"} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 justify-center mt-2 pb-1" style={{ fontSize: 11, color: MUTED }}>
          <span className="flex items-center gap-1"><Dot c={T.a} /> силовая</span>
          <span className="flex items-center gap-1"><Dot c={T.b} /> бег</span>
          <span className="flex items-center gap-1"><Dot c="rgba(255,255,255,0.6)" /> задачи</span>
        </div>
      </Card>

      <div className="mt-4"><ScheduleButton T={T} isCustom={program.isCustom} onClick={openSchedule} /></div>

      <H2>{cap(selDate.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }))}</H2>
      <div className="flex flex-col gap-2">
        {selOwn && (
          <Card T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <Dumbbell size={18} />
            <span className="flex-1">{selOwn.name}</span>
            {st.done[sel] && <Check size={16} color={T.a} />}
          </Card>
        )}
        {program.schedule[selW] !== undefined && program.days[program.schedule[selW]] && (
          <Card T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <Dumbbell size={18} />
            <span className="flex-1">{program.days[program.schedule[selW]].title}</span>
            {st.done[sel] && <Check size={16} color={T.a} />}
          </Card>
        )}
        {run.schedule[selW] !== undefined && run.weeks[week]?.[run.schedule[selW]] && (
          <Card T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <Footprints size={18} />
            <span className="flex-1">Бег: {run.weeks[week][run.schedule[selW]].title.toLowerCase()}</span>
            {!st.pro && week > 0 ? <Lock size={14} color={MUTED} /> : st.runDone[sel] && <Check size={16} color={T.a} />}
          </Card>
        )}
        {daily.map((t) => {
          const list = lists.find((l) => l.id === listIdOf(t)) || lists[0];
          const item = { ...t, kind: "daily", done: !!t.log[sel] };
          return <TaskRow key={t.id} T={T} item={item} list={list} onToggle={() => toggleDaily(t.id)} onEdit={() => setEditing({ kind: "daily", ...t })} />;
        })}
        {tasks.map((t) => {
          const list = lists.find((l) => l.id === listIdOf(t)) || lists[0];
          const item = { ...t, kind: "once" };
          return <TaskRow key={t.id} T={T} item={item} list={list} onToggle={() => toggleTask(t.id)} onEdit={() => setEditing({ kind: "once", date: sel, ...t })} />;
        })}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Новая задача" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
            style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
          <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} aria-label="Время задачи"
            className="rounded-xl px-3 py-3 bg-transparent outline-none"
            style={{ width: 112, border: `1px solid ${T.line}`, color: "#fff", fontSize: 14 }} />
          <button onClick={addTask} aria-label="Добавить задачу" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
        </div>
        <Muted size={11}>Можно указать время, например <b style={{ color: "#fff" }}>06:00</b> — «Утренняя рутина». Задачи отображаются по времени.</Muted>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityPicker T={T} value={taskPriority} onChange={setTaskPriority} />
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => <ListChip key={l.id} T={T} list={l} active={taskListId === l.id} onClick={() => setTaskListId(l.id)} />)}
            <button onClick={() => setManagingLists(true)} className="rounded-full px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 12, color: MUTED, border: `1px dashed ${T.line}` }}><Plus size={12} /> список</button>
          </div>
        </div>
        <Chip T={T} on={dailyMode} onClick={() => { setDailyMode(!dailyMode); if (!dailyMode) setTaskRepeat({ type: "daily" }); }}><Repeat size={13} /> Повторять</Chip>
        {dailyMode && <RecurrenceEditor T={T} value={taskRepeat} onChange={setTaskRepeat} date={selDate} />}
      </div>
      </>
      )}

      {editing && (
        <TaskEditSheet T={T} task={editing} lists={lists} onClose={() => setEditing(null)} onSave={saveEdit} onDelete={deleteEdit} />
      )}
      {managingLists && (
        <ListsManagerSheet T={T} lists={lists} onClose={() => setManagingLists(false)} onAdd={(l) => addTaskList(up, l)} onDelete={(id) => deleteTaskList(up, id)} />
      )}

      <H2 right={!st.pro && <span style={{ color: MUTED, fontSize: 13 }}>{st.habits.length} из {FREE_HABITS}</span>}>Трекер привычек</H2>
      <Muted size={12} className="mb-2">Неделя {weekLabel} — открывается по выбранному дню в календаре выше</Muted>
      <div className="flex flex-col gap-2">
        {st.habits.map((h) => (
          <Card key={h.id} T={T}>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex-1 font-semibold">{h.name}</span>
              <span className="flex items-center gap-1" style={{ fontSize: 13, color: MUTED }}><Flame size={13} color={T.a} />{streakOf((x) => !!h.log[x])} дн.</span>
              <button onClick={() => delHabit(h.id)} aria-label="Удалить привычку" style={{ color: MUTED }}><Trash2 size={15} /></button>
            </div>
            <div className="flex justify-between">
              {habitWeek.map((d) => {
                const key = keyOf(d);
                const on = !!h.log[key];
                return (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span style={{ fontSize: 10, color: MUTED }}>{WD[wdOf(d)]}</span>
                    <CheckBox T={T} on={on} size={32} onClick={() => toggleHabitDay(h.id, key)} label={`${h.name}, ${d.getDate()}`} />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
        <div className="flex gap-2">
          <input value={habitName} onChange={(e) => setHabitName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()}
            placeholder={canAddHabit ? "Новая привычка" : `Больше ${FREE_HABITS} привычек в Pro`} className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
            style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
          <button onClick={canAddHabit ? addHabit : () => openPay("habits")} aria-label="Добавить привычку" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}>
            {canAddHabit ? <Plus size={20} /> : <Lock size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Прогресс: сводный дашборд ============ */
function weekBuckets(n) {
  const today = new Date();
  const mondayThis = weekDays(today)[0];
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(mondayThis);
    start.setDate(start.getDate() - i * 7);
    out.push(weekDays(start).map(keyOf));
  }
  return out;
}

function MiniBarChart({ values, color }) {
  const max = Math.max(1, ...values);
  const w = 26, gap = 8, h = 64;
  const totalW = values.length * (w + gap) - gap;
  return (
    <svg viewBox={`0 0 ${totalW} ${h + 4}`} width="100%" height={h + 4} preserveAspectRatio="none" role="img" aria-label="График по неделям">
      {values.map((v, i) => {
        const bh = v ? Math.max(4, (v / max) * h) : 2;
        return <rect key={i} className="ritm-grow" style={{ animationDelay: `${i * 45}ms` }} x={i * (w + gap)} y={h - bh} width={w} height={bh} rx={5} fill={color} opacity={v ? 1 : 0.18} />;
      })}
    </svg>
  );
}

function StatTile({ T, label, value }) {
  return (
    <Card T={T}>
      <Muted size={12}>{label}</Muted>
      <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, marginTop: 2 }}><CountUp value={value} duration={1100} /></div>
    </Card>
  );
}

// Ккал/белок за последние n дней (включая пустые дни — чтобы был виден пропуск)
function foodTrend(st, days) {
  const out = [];
  const d = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(d); day.setDate(d.getDate() - i);
    const k = keyOf(day);
    const sum = sumFood(st.food?.[k] || []);
    out.push({ k, kcal: Math.round(sum.kcal), p: Math.round(sum.p), label: `${day.getDate()}.${pad(day.getMonth() + 1)}` });
  }
  return out;
}

function NutritionTrendChart({ T, entries, target }) {
  if (!entries.some((e) => e.kcal > 0)) {
    return <Muted size={13} className="text-center py-6">Данных о питании пока нет — начни вести дневник еды на вкладке «Питание».</Muted>;
  }
  const W = 320, H = 110, pad = 10;
  const max = Math.max(target || 0, ...entries.map((e) => e.kcal), 1);
  const x = (i) => pad + (i / Math.max(1, entries.length - 1)) * (W - pad * 2);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const points = entries.map((e, i) => `${x(i)},${y(e.kcal)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Калории за последние дни">
      {target > 0 && <line x1={pad} x2={W - pad} y1={y(target)} y2={y(target)} stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4 4" />}
      <polyline points={points} pathLength="1" className="ritm-draw" fill="none" stroke={T.a} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {entries.map((e, i) => <circle key={e.k} className="ritm-dot" style={{ animationDelay: `${300 + (i / entries.length) * 1000}ms`, transformBox: "fill-box", transformOrigin: "center" }} cx={x(i)} cy={y(e.kcal)} r={i === entries.length - 1 ? 4 : 2.5} fill={i === entries.length - 1 ? T.a : "rgba(255,255,255,0.5)"} />)}
    </svg>
  );
}

/* ============ Шеринг результатов картинкой ============
   Рисуем карточку на <canvas> (без сторонних библиотек — вес бандла не растёт) и отдаём
   через Web Share API с файлом, если он поддерживается (мобильный Telegram, современные браузеры),
   иначе просто скачиваем PNG — работать будет везде. */
function shareOrDownloadCanvas(canvas, filename) {
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "RITM" });
        return;
      }
    } catch (e) { /* пользователь закрыл системное окно шеринга — просто выходим, скачивать не нужно */ return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy + lineHeight;
}

// Карточка «итоги недели» — общие цифры прогресса, без личных данных вроде веса в кг
function drawProgressShareCard(T, { trainStreak, runStreak, totalTrainings, totalRuns, prCount }) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#151519"); bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.05, 0, W * 0.5, H * 0.05, W * 0.9);
  glow.addColorStop(0, `${T.a}33`); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 34px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("R I T M", 72, 130);

  ctx.fillStyle = "#fff";
  ctx.font = "700 58px sans-serif";
  ctx.fillText("Итоги недели", 72, 230);

  const rows = [
    [`${trainStreak}`, `${daysWord(trainStreak)} подряд с тренировкой`],
    [`${totalTrainings}`, "тренировок всего"],
    [`${totalRuns}`, "пробежек всего"],
    [`${prCount}`, "личных рекордов"],
  ];
  let y = 400;
  rows.forEach(([num, label], i) => {
    const color = i % 2 === 0 ? T.a : T.b;
    ctx.fillStyle = color;
    ctx.font = "700 96px sans-serif";
    ctx.fillText(num, 72, y);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "500 34px sans-serif";
    ctx.fillText(label, 72, y + 52);
    y += 190;
  });

  if (runStreak > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "500 30px sans-serif";
    ctx.fillText(`Плюс серия пробежек: ${runStreak} дн. подряд`, 72, y + 10);
  }

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "500 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Сделано в RITM", W / 2, H - 70);

  return canvas;
}

// Карточка одного достижения — для шеринга конкретного бейджа
function drawAchievementShareCard(T, { title, desc }) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#17171b"); bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.6);
  glow.addColorStop(0, `${T.a}44`); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("R I T M · Достижение открыто", W / 2, 150);

  ctx.beginPath();
  ctx.arc(W / 2, H * 0.38, 130, 0, Math.PI * 2);
  const badgeGrad = ctx.createLinearGradient(W / 2 - 130, H * 0.38 - 130, W / 2 + 130, H * 0.38 + 130);
  badgeGrad.addColorStop(0, T.a); badgeGrad.addColorStop(1, T.b);
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "700 60px sans-serif";
  ctx.textAlign = "center";
  wrapCanvasText(ctx, title, W / 2, H * 0.38 + 260, W - 160, 74);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "500 36px sans-serif";
  ctx.textAlign = "center";
  wrapCanvasText(ctx, desc, W / 2, H * 0.38 + 420, W - 220, 48);

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "500 28px sans-serif";
  ctx.fillText("Сделано в RITM", W / 2, H - 70);

  return canvas;
}

const PROGRESS_PERIODS = [4, 8, 12, 16];

function ProgressScreen({ T, st, up, norm }) {
  const [periodIdx, setPeriodIdx] = useState(1); // индекс в PROGRESS_PERIODS — по умолчанию 8 недель, как раньше
  const weeksN = PROGRESS_PERIODS[periodIdx];
  const weeks = useMemo(() => weekBuckets(weeksN), [weeksN]);
  const trainCounts = weeks.map((days) => days.filter((d) => st.done[d]).length);
  const runCounts = weeks.map((days) => days.filter((d) => st.runDone[d]).length);
  const weekLabels = weeks.map((days) => { const d = new Date(days[0] + "T00:00:00"); return `${d.getDate()}.${pad(d.getMonth() + 1)}`; });
  const weightEntries = Object.entries(st.weight || {}).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-30).map(([dk, v]) => ({ k: dk, v: Number(v) }));
  const foodEntries = useMemo(() => foodTrend(st, 14), [st.food]);
  const totalTrainings = Object.values(st.done || {}).filter(Boolean).length;
  const totalRuns = Object.values(st.runDone || {}).filter(Boolean).length;
  const prCount = Object.keys(st.records || {}).length;
  const trainStreak = streakOf((k) => !!st.done[k]);
  const runStreak = streakOf((k) => !!st.runDone[k]);
  const habitStreak = (st.habits || []).reduce((m, h) => Math.max(m, streakOf((k) => !!h.log[k])), 0);

  return (
    <div>
      <H1>Прогресс</H1>
      <Muted className="mt-1 mb-4">Сводка по тренировкам, бегу, питанию и весу в одном месте.</Muted>

      {st.pro && <AIWeeklyInsight T={T} st={st} up={up} norm={norm} />}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatTile T={T} label="Тренировок всего" value={totalTrainings} />
        <StatTile T={T} label="Пробежек всего" value={totalRuns} />
        <StatTile T={T} label="Личных рекордов" value={prCount} />
        <StatTile T={T} label="Лучшая серия привычки" value={`${habitStreak} дн.`} />
      </div>

      {weightEntries.length >= 2 && (
        <>
          <H2>Вес тела</H2>
          <Card T={T}><WeightChart T={T} entries={weightEntries} /></Card>
        </>
      )}

      <H2>Калории за 14 дней</H2>
      <Card T={T}>
        <NutritionTrendChart T={T} entries={foodEntries} target={norm?.kcal || 0} />
      </Card>
      {norm?.kcal ? <Muted size={12} className="mt-2">Пунктир — дневная норма {norm.kcal} ккал</Muted> : null}

      <H2>Силовые и бег по неделям</H2>
      <Muted size={12} className="mb-1">Период для обоих графиков ниже</Muted>
      <Segmented T={T} items={PROGRESS_PERIODS.map((n) => `${n} нед.`)} value={periodIdx} onChange={setPeriodIdx} />

      <H2>Силовые тренировки</H2>
      <Card T={T}>
        <MiniBarChart values={trainCounts} color={T.a} />
        <div className="flex justify-between mt-1">{weekLabels.map((l, i) => <span key={i} style={{ fontSize: 9, color: MUTED }}>{l}</span>)}</div>
      </Card>
      <Muted size={12} className="mt-2">Серия сейчас: {trainStreak} дн. подряд</Muted>

      <H2>Бег</H2>
      <Card T={T}>
        <MiniBarChart values={runCounts} color={T.b} />
        <div className="flex justify-between mt-1">{weekLabels.map((l, i) => <span key={i} style={{ fontSize: 9, color: MUTED }}>{l}</span>)}</div>
      </Card>
      <Muted size={12} className="mt-2">Серия сейчас: {runStreak} дн. подряд</Muted>

      <div className="mt-6">
        <Ghost T={T} onClick={() => {
          const canvas = drawProgressShareCard(T, { trainStreak, runStreak, totalTrainings, totalRuns, prCount });
          shareOrDownloadCanvas(canvas, "ritm-progress.png");
        }}>
          <Share2 size={16} /> Поделиться прогрессом
        </Ghost>
      </div>
    </div>
  );
}

/* ============ Достижения ============ */
const ACHIEVEMENTS = [
  { id: "first_workout", title: "Первая тренировка", desc: "Заверши первую силовую тренировку", icon: Dumbbell, check: (st) => Object.values(st.done || {}).some(Boolean) },
  { id: "workouts50", title: "50 тренировок", desc: "Заверши 50 силовых тренировок", icon: Dumbbell, check: (st) => Object.values(st.done || {}).filter(Boolean).length >= 50 },
  { id: "first_run", title: "Первая пробежка", desc: "Отметь первую пробежку выполненной", icon: Footprints, check: (st) => Object.values(st.runDone || {}).some(Boolean) },
  { id: "runs20", title: "20 пробежек", desc: "Отметь 20 пробежек всего", icon: Footprints, check: (st) => Object.values(st.runDone || {}).filter(Boolean).length >= 20 },
  { id: "streak7", title: "Неделя подряд", desc: "7 дней подряд с тренировкой или пробежкой", icon: Flame, check: (st) => streakOf((k) => !!st.done[k] || !!st.runDone[k]) >= 7 },
  { id: "streak30", title: "Месяц подряд", desc: "30 дней подряд с тренировкой или пробежкой", icon: Flame, check: (st) => streakOf((k) => !!st.done[k] || !!st.runDone[k]) >= 30 },
  { id: "pr5", title: "5 личных рекордов", desc: "Побей личный рекорд в 5 упражнениях", icon: Trophy, check: (st) => Object.keys(st.records || {}).length >= 5 },
  { id: "pr15", title: "15 личных рекордов", desc: "Побей личный рекорд в 15 упражнениях", icon: Trophy, check: (st) => Object.keys(st.records || {}).length >= 15 },
  { id: "habit30", title: "Привычка на месяц", desc: "Веди любую привычку 30 дней подряд", icon: Repeat, check: (st) => (st.habits || []).some((h) => streakOf((k) => !!h.log[k]) >= 30) },
  { id: "tasks100", title: "100 закрытых задач", desc: "Отметь выполненными 100 разовых задач", icon: Check, check: (st) => Object.values(st.tasks || {}).reduce((n, list) => n + (list || []).filter((t) => t.done).length, 0) >= 100 },
  { id: "reader5", title: "5 книг прочитано", desc: "Отметь 5 книг как прочитанные", icon: BookOpen, check: (st) => (st.books || []).filter((b) => b.status === "done").length >= 5 },
  { id: "weightlog", title: "Веду вес регулярно", desc: "10 записей веса тела", icon: Scale, check: (st) => Object.keys(st.weight || {}).length >= 10 },
  { id: "challenge_done", title: "Первый челлендж пройден", desc: "Заверши челлендж с целью полностью", icon: Trophy, check: (st) => (st.challenges || []).some((c) => c.kind === "goal" && Object.values(c.log || {}).filter(Boolean).length >= c.days) },
  { id: "quit_30", title: "Месяц без привычки", desc: "30 дней подряд без срыва в отказе от привычки", icon: Ban, check: (st) => (st.challenges || []).some((c) => c.kind === "quit" && (Math.max(0, Math.floor((Date.now() - c.startedAt) / 86400000)) >= 30 || (c.bestStreakDays || 0) >= 30)) },
  { id: "journal_first", title: "Первая запись в дневнике", desc: "Напиши первую запись в дневнике", icon: NotebookPen, check: (st) => (st.journal || []).length > 0 },
  { id: "breath_week", title: "Неделя дыхательных практик", desc: "7 дней подряд практикуй дыхательные техники", icon: Wind, check: (st) => streakOf((k) => !!st.breathLog?.[k]) >= 7 },
  { id: "faith_week", title: "Неделя духовной практики", desc: "7 дней подряд отмечай хотя бы одну практику в разделе «Вера»", icon: Feather, check: (st) => streakOf((k) => { const l = st.faith?.log?.[k]; return !!l && Object.values(l).some(Boolean); }) >= 7 },
];

function AchievementsScreen({ T, st }) {
  // check() у части бейджей проходит streakOf (обратный обход дней) — считаем каждый ровно
  // один раз за рендер вместо отдельного прохода для счётчика и отдельного для каждой карточки.
  const withStatus = useMemo(() => ACHIEVEMENTS.map((a) => ({ ...a, on: a.check(st) })), [st]);
  const unlocked = withStatus.filter((a) => a.on);
  return (
    <div>
      <H1>Достижения</H1>
      <Muted className="mt-1 mb-4">{unlocked.length} из {ACHIEVEMENTS.length} открыто</Muted>
      <div className="grid grid-cols-2 gap-3">
        {withStatus.map((a) => {
          const on = a.on;
          const Icon = a.icon;
          return (
            <Card key={a.id} T={T} style={{ opacity: on ? 1 : 0.55, position: "relative" }}>
              {on && (
                <button
                  onClick={() => shareOrDownloadCanvas(drawAchievementShareCard(T, { title: a.title, desc: a.desc }), `ritm-${a.id}.png`)}
                  aria-label={`Поделиться достижением: ${a.title}`}
                  className="absolute rounded-full flex items-center justify-center"
                  style={{ top: 8, right: 8, width: 26, height: 26, background: "rgba(255,255,255,0.08)", color: MUTED }}>
                  <Share2 size={13} />
                </button>
              )}
              <div className="flex flex-col items-center text-center gap-2 py-2">
                <span className="rounded-full flex items-center justify-center" style={{ width: 52, height: 52, background: on ? T.grad : "rgba(255,255,255,0.06)", boxShadow: on ? T.glow : "none", flexShrink: 0 }}>
                  {on ? <Icon size={24} color={T.on} /> : <Lock size={20} color={MUTED} />}
                </span>
                <div className="font-semibold" style={{ fontSize: 13 }}>{a.title}</div>
                <Muted size={11}>{a.desc}</Muted>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Публичный снимок прогресса для друзей ============
   Строится на клиенте из тех же данных, что и «Прогресс»/«Достижения», и фильтруется по
   настройкам приватности (st.friendsPrivacy) ДО отправки на сервер — если категория
   выключена, её ключи просто не попадают в объект, а не присылаются и скрываются при показе.
   Так безопаснее: сервер физически не получает то, что человек решил не показывать. */
function buildFriendSnapshot(st, privacy) {
  const p = privacy || DEFAULT.friendsPrivacy;
  const snap = {};
  if (p.streak) {
    snap.trainStreak = streakOf((k) => !!st.done[k]);
    snap.runStreak = streakOf((k) => !!st.runDone[k]);
  }
  if (p.workouts) {
    snap.totalTrainings = Object.values(st.done || {}).filter(Boolean).length;
    snap.totalRuns = Object.values(st.runDone || {}).filter(Boolean).length;
    snap.prCount = Object.keys(st.records || {}).length;
  }
  if (p.habits) {
    snap.habitStreak = (st.habits || []).reduce((m, h) => Math.max(m, streakOf((k) => !!h.log[k])), 0);
  }
  if (p.achievements) {
    const unlocked = ACHIEVEMENTS.filter((a) => a.check(st));
    snap.achievementsUnlocked = unlocked.length;
    snap.achievementIds = unlocked.map((a) => a.id);
  }
  if (p.weight) {
    const entries = Object.entries(st.weight || {}).sort(([a], [b]) => (a < b ? -1 : 1));
    if (entries.length) {
      snap.weightCurrent = Number(entries[entries.length - 1][1]);
      // Ближайшая запись к «30 дней назад» — не точная интерполяция, но достаточно для
      // показа «изменение за месяц» другу, без хранения всей истории веса на сервере.
      const monthAgoKey = keyOf(new Date(Date.now() - 30 * 86400000));
      const past = entries.find(([k]) => k >= monthAgoKey);
      if (past) snap.weightChange30d = Number((snap.weightCurrent - Number(past[1])).toFixed(1));
    }
  }
  if (p.weekStatus) {
    // Только дни ТЕКУЩЕЙ недели — нужно для общего календаря тренировок с другом (раздел
    // «Друзья» → «Тренировки»), а не для истории: будущие дни недели просто пока false.
    snap.thisWeekDone = {};
    snap.thisWeekRun = {};
    weekDays().forEach((d) => { const k = keyOf(d); snap.thisWeekDone[k] = !!st.done[k]; snap.thisWeekRun[k] = !!st.runDone[k]; });
  }
  return snap;
}

// Сколько тренировок/пробежек отмечено с момента создания общей цели (buildGoalProgress) —
// тот же счётчик, что видит сам человек на экране «Прогресс», только за ограниченное окно дат
// и без дожидания debounce-публикации: пересчитывается сразу при открытии раздела «Цели».
function buildGoalProgress(st, goal) {
  const src = goal.metric === "runs" ? st.runDone : st.done;
  const fromKey = goal.createdAt ? keyOf(new Date(goal.createdAt)) : null;
  let n = 0;
  for (const [k, v] of Object.entries(src || {})) {
    if (!v) continue;
    if (goal.deadline && k > goal.deadline) continue;
    if (fromKey && k < fromKey) continue;
    n++;
  }
  return n;
}

/* ============ Книги ============ */
function BookAddForm({ T, onAdd, onCancel }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");
  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onAdd({ title: t, author: author.trim(), pages: Number(pages) || 0, status: "planned" });
  };
  return (
    <Card T={T} className="flex flex-col gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название книги"
        className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Автор (необязательно)"
        className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
      <input value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Страниц всего (необязательно)"
        className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
      <div className="flex gap-2">
        <Ghost T={T} onClick={onCancel}>Отмена</Ghost>
        <Primary T={T} onClick={submit}>Добавить</Primary>
      </div>
    </Card>
  );
}

function BookRow({ T, book, onUpdate, onDelete }) {
  const pct = book.pages ? Math.min(100, Math.round((book.current / book.pages) * 100)) : null;
  return (
    <Card T={T}>
      <div className="flex items-start gap-3">
        <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}><BookOpen size={18} /></span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{book.title}</div>
          {book.author && <Muted size={12}>{book.author}</Muted>}
          {book.status === "reading" && book.pages > 0 && (
            <div className="mt-2">
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: T.grad }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <Muted size={11}>{book.current} из {book.pages} стр.</Muted>
                <div className="flex gap-1">
                  <button onClick={() => onUpdate({ current: Math.max(0, (book.current || 0) - 10) })} className="rounded-full px-2 py-0.5" style={{ border: `1px solid ${T.line}`, fontSize: 11, color: "#fff" }}>-10</button>
                  <button onClick={() => onUpdate({ current: Math.min(book.pages, (book.current || 0) + 10) })} className="rounded-full px-2 py-0.5" style={{ border: `1px solid ${T.line}`, fontSize: 11, color: "#fff" }}>+10</button>
                </div>
              </div>
            </div>
          )}
          {book.status === "done" && (
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => onUpdate({ rating: n })} aria-label={`Оценка ${n} из 5`}>
                  <Star size={14} color={n <= (book.rating || 0) ? T.a : MUTED} fill={n <= (book.rating || 0) ? T.a : "none"} />
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onDelete} aria-label="Удалить книгу" style={{ color: MUTED, flexShrink: 0 }}><Trash2 size={15} /></button>
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        {book.status !== "planned" && <Chip T={T} onClick={() => onUpdate({ status: "planned" })}>В планы</Chip>}
        {book.status !== "reading" && <Chip T={T} onClick={() => onUpdate({ status: "reading", current: book.current || 0 })}>Читаю</Chip>}
        {book.status !== "done" && <Chip T={T} onClick={() => onUpdate({ status: "done", current: book.pages || book.current || 0 })}>Прочитано</Chip>}
      </div>
    </Card>
  );
}

function BooksScreen({ T, st, up }) {
  const [adding, setAdding] = useState(false);
  const books = st.books || [];
  const addBook = (b) => up((s) => ({ books: [...(s.books || []), { id: "bk" + Date.now(), current: 0, rating: 0, ...b }] }));
  const updateBook = (id, patch) => up((s) => ({ books: (s.books || []).map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const deleteBook = (id) => up((s) => ({ books: (s.books || []).filter((b) => b.id !== id) }));
  const groups = [["reading", "Читаю"], ["planned", "В планах"], ["done", "Прочитано"]];

  return (
    <div>
      <H1>Книги</H1>
      <Muted className="mt-1 mb-4">Личный список чтения: что читаешь сейчас, что в планах и что уже прочитано.</Muted>

      {books.length === 0 && <Card T={T} className="mb-4"><Muted size={14}>Пока пусто. Добавь первую книгу ниже.</Muted></Card>}

      {groups.map(([status, label]) => {
        const list = books.filter((b) => b.status === status);
        if (!list.length) return null;
        return (
          <div key={status} className="mb-4">
            <H2>{label}</H2>
            <div className="flex flex-col gap-2">
              {list.map((b) => <BookRow key={b.id} T={T} book={b} onUpdate={(p) => updateBook(b.id, p)} onDelete={() => deleteBook(b.id)} />)}
            </div>
          </div>
        );
      })}

      {adding ? (
        <BookAddForm T={T} onAdd={(b) => { addBook(b); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : (
        <Ghost T={T} onClick={() => setAdding(true)}><Plus size={16} /> Добавить книгу</Ghost>
      )}
    </div>
  );
}

/* ============ Челленджи ============
   Два вида: «челлендж с целью» — фиксированный срок и ежедневная отметка (лог как у привычки, но с концом
   и итогом успех/провал), и «отказ от привычки» — просто счётчик дней с последнего срыва, без конца. */
function daysSince(startDate) {
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((b - a) / 86400000) + 1;
}

function ChallengeAddForm({ T, onAdd, onCancel }) {
  const [kind, setKind] = useState("goal");
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("30");
  const submit = () => {
    const t = title.trim();
    if (!t) return;
    if (kind === "goal") onAdd({ kind: "goal", title: t, days: Math.max(1, Math.min(365, Number(days) || 30)), startDate: keyOf(new Date()), log: {} });
    else onAdd({ kind: "quit", title: t, startedAt: Date.now(), bestStreakDays: 0 });
  };
  return (
    <Card T={T} className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        <Chip T={T} on={kind === "goal"} onClick={() => setKind("goal")}><Target size={13} /> Челлендж с целью</Chip>
        <Chip T={T} on={kind === "quit"} onClick={() => setKind("quit")}><Ban size={13} /> Отказ от привычки</Chip>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "goal" ? "Например, 30 дней растяжки" : "Например, Без сигарет"}
        className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
      {kind === "goal" && (
        <div className="flex items-center gap-2">
          <span style={{ color: MUTED, fontSize: 13 }}>Продолжительность, дней</span>
          <input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
            className="rounded-xl px-3 py-2 bg-transparent outline-none" style={{ width: 80, border: `1px solid ${T.line}`, color: "#fff" }} />
        </div>
      )}
      <div className="flex gap-2">
        <Ghost T={T} onClick={onCancel}>Отмена</Ghost>
        <Primary T={T} onClick={submit}>Добавить</Primary>
      </div>
    </Card>
  );
}

function GoalChallengeCard({ T, ch, onToggleToday, onDelete }) {
  const todayKey = keyOf(new Date());
  const doneCount = Object.values(ch.log || {}).filter(Boolean).length;
  const pct = Math.min(100, Math.round((doneCount / ch.days) * 100));
  const elapsed = daysSince(ch.startDate);
  const success = doneCount >= ch.days;
  const expired = !success && elapsed > ch.days;
  const checkedToday = !!ch.log?.[todayKey];
  return (
    <Card T={T}>
      <div className="flex items-start gap-3">
        <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: success ? T.grad : "rgba(255,255,255,0.06)", boxShadow: success ? T.glow : "none" }}>
          {success ? <Trophy size={18} color={T.on} /> : <Target size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{ch.title}</div>
          <Muted size={12}>{success ? "Цель достигнута!" : expired ? `Срок истёк — ${doneCount} из ${ch.days} дней` : `День ${Math.min(elapsed, ch.days)} из ${ch.days}`}</Muted>
          <div className="rounded-full overflow-hidden mt-2" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: T.grad }} />
          </div>
        </div>
        <button onClick={onDelete} aria-label="Удалить челлендж" style={{ color: MUTED, flexShrink: 0 }}><Trash2 size={15} /></button>
      </div>
      {!success && !expired && (
        <div className="mt-3">
          <Chip T={T} on={checkedToday} onClick={onToggleToday}>{checkedToday ? "Отмечено сегодня" : "Отметить сегодня"}</Chip>
        </div>
      )}
    </Card>
  );
}

function QuitChallengeCard({ T, ch, onRelapse, onDelete }) {
  const currentDays = Math.max(0, Math.floor((Date.now() - ch.startedAt) / 86400000));
  return (
    <Card T={T}>
      <div className="flex items-start gap-3">
        <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}><Ban size={18} /></span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{ch.title}</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 600, marginTop: 2 }}>{currentDays} <span style={{ fontSize: 15, fontWeight: 500, color: MUTED }}>{daysWord(currentDays)}</span></div>
          {ch.bestStreakDays > 0 && <Muted size={12}>Лучший результат: {ch.bestStreakDays} {daysWord(ch.bestStreakDays)}</Muted>}
        </div>
        <button onClick={onDelete} aria-label="Удалить" style={{ color: MUTED, flexShrink: 0 }}><Trash2 size={15} /></button>
      </div>
      <div className="mt-3"><Ghost T={T} onClick={onRelapse}><RefreshCcw size={15} /> Сорвался — начать заново</Ghost></div>
    </Card>
  );
}

function ChallengesScreen({ T, st, up }) {
  const [adding, setAdding] = useState(false);
  const list = st.challenges || [];
  const addChallenge = (c) => up((s) => ({ challenges: [...(s.challenges || []), { id: "chg" + Date.now(), ...c }] }));
  const deleteChallenge = (id) => up((s) => ({ challenges: (s.challenges || []).filter((c) => c.id !== id) }));
  const toggleToday = (id) => up((s) => {
    const k = keyOf(new Date());
    return { challenges: (s.challenges || []).map((c) => (c.id === id ? { ...c, log: { ...c.log, [k]: !c.log?.[k] } } : c)) };
  });
  const relapse = (id) => up((s) => ({
    challenges: (s.challenges || []).map((c) => {
      if (c.id !== id) return c;
      const currentDays = Math.max(0, Math.floor((Date.now() - c.startedAt) / 86400000));
      return { ...c, startedAt: Date.now(), bestStreakDays: Math.max(c.bestStreakDays || 0, currentDays) };
    }),
  }));

  const goals = list.filter((c) => c.kind === "goal");
  const quits = list.filter((c) => c.kind === "quit");

  return (
    <div>
      <H1>Челленджи</H1>
      <Muted className="mt-1 mb-4">Временные испытания с целью и счётчики дней без вредных привычек.</Muted>

      {list.length === 0 && <Card T={T} className="mb-4"><Muted size={14}>Пока пусто. Добавь первый челлендж ниже.</Muted></Card>}

      {quits.length > 0 && (
        <div className="mb-4">
          <H2>Отказ от привычек</H2>
          <div className="flex flex-col gap-2">
            {quits.map((c) => <QuitChallengeCard key={c.id} T={T} ch={c} onRelapse={() => relapse(c.id)} onDelete={() => deleteChallenge(c.id)} />)}
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div className="mb-4">
          <H2>Челленджи с целью</H2>
          <div className="flex flex-col gap-2">
            {goals.map((c) => <GoalChallengeCard key={c.id} T={T} ch={c} onToggleToday={() => toggleToday(c.id)} onDelete={() => deleteChallenge(c.id)} />)}
          </div>
        </div>
      )}

      {adding ? (
        <ChallengeAddForm T={T} onAdd={(c) => { addChallenge(c); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : (
        <Ghost T={T} onClick={() => setAdding(true)}><Plus size={16} /> Добавить челлендж</Ghost>
      )}
    </div>
  );
}

/* ============ Дневник ============ */
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

function dayLabel(dateStr) {
  const today = keyOf(new Date());
  const yesterday = keyOf(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Сегодня";
  if (dateStr === yesterday) return "Вчера";
  const d = new Date(dateStr + "T00:00:00");
  return cap(d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }));
}

function JournalEntryForm({ T, initial, onSave, onCancel }) {
  const [text, setText] = useState(initial?.text || "");
  const [mood, setMood] = useState(initial?.mood ?? null);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSave({ text: t, mood });
  };
  return (
    <Card T={T} className="flex flex-col gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Что запомнилось сегодня?" rows={4}
        className="rounded-xl px-4 py-3 bg-transparent outline-none resize-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
      <div className="flex items-center gap-2 flex-wrap">
        <Muted size={12}>Настроение:</Muted>
        {MOODS.map((m, i) => (
          <button key={i} onClick={() => setMood(mood === i + 1 ? null : i + 1)} aria-label={`Настроение ${i + 1} из 5`}
            className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, fontSize: 16, background: mood === i + 1 ? "rgba(255,255,255,0.12)" : "transparent", border: `1px solid ${mood === i + 1 ? T.a : "transparent"}` }}>
            {m}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Ghost T={T} onClick={onCancel}>Отмена</Ghost>
        <Primary T={T} onClick={submit}>{initial ? "Сохранить" : "Добавить"}</Primary>
      </div>
    </Card>
  );
}

function JournalEntryRow({ T, entry, onEdit, onDelete }) {
  const d = new Date(entry.createdAt);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return (
    <Card T={T}>
      <div className="flex items-start gap-3">
        {entry.mood ? <span style={{ fontSize: 20, flexShrink: 0 }}>{MOODS[entry.mood - 1]}</span> : null}
        <div className="flex-1 min-w-0">
          <Muted size={11}>{time}</Muted>
          <div className="mt-1" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{entry.text}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} aria-label="Изменить запись" style={{ color: MUTED }}><PenLine size={15} /></button>
          <button onClick={onDelete} aria-label="Удалить запись" style={{ color: MUTED }}><Trash2 size={15} /></button>
        </div>
      </div>
    </Card>
  );
}

function JournalScreen({ T, st, up }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const entries = [...(st.journal || [])].sort((a, b) => b.createdAt - a.createdAt);

  const addEntry = (e) => up((s) => ({ journal: [...(s.journal || []), { id: "jr" + Date.now(), date: keyOf(new Date()), createdAt: Date.now(), ...e }] }));
  const updateEntry = (id, patch) => up((s) => ({ journal: (s.journal || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const deleteEntry = (id) => up((s) => ({ journal: (s.journal || []).filter((e) => e.id !== id) }));

  const groups = [];
  let lastDate = null;
  for (const e of entries) {
    if (e.date !== lastDate) { groups.push({ date: e.date, items: [] }); lastDate = e.date; }
    groups[groups.length - 1].items.push(e);
  }

  return (
    <div>
      <H1>Дневник</H1>
      <Muted className="mt-1 mb-4">Личные заметки — что запомнилось, о чём подумал, как прошёл день. Видишь только ты, ничего никуда не публикуется.</Muted>

      {adding ? (
        <div className="mb-4"><JournalEntryForm T={T} onSave={(e) => { addEntry(e); setAdding(false); }} onCancel={() => setAdding(false)} /></div>
      ) : (
        <Ghost T={T} onClick={() => setAdding(true)}><Plus size={16} /> Новая запись</Ghost>
      )}

      {entries.length === 0 && !adding && <Card T={T} className="mt-4"><Muted size={14}>Пока пусто. Первая запись — кнопкой выше.</Muted></Card>}

      {groups.map((g) => (
        <div key={g.date} className="mt-5">
          <H2>{dayLabel(g.date)}</H2>
          <div className="flex flex-col gap-2">
            {g.items.map((e) => editingId === e.id ? (
              <JournalEntryForm key={e.id} T={T} initial={e} onSave={(patch) => { updateEntry(e.id, patch); setEditingId(null); }} onCancel={() => setEditingId(null)} />
            ) : (
              <JournalEntryRow key={e.id} T={T} entry={e} onEdit={() => setEditingId(e.id)} onDelete={() => deleteEntry(e.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ Дыхание ============ */
const BREATH_TECHNIQUES = [
  { id: "box", name: "Квадратное дыхание", desc: "Вдох, задержка, выдох, задержка — поровну. Снижает тревожность, помогает сосредоточиться.", phases: [["Вдох", 4, 1], ["Задержка", 4, 1], ["Выдох", 4, 0.55], ["Задержка", 4, 0.55]] },
  { id: "478", name: "4-7-8", desc: "Вдох на 4, задержка на 7, долгий выдох на 8. Классика для быстрого засыпания и снятия стресса.", phases: [["Вдох", 4, 1], ["Задержка", 7, 1], ["Выдох", 8, 0.55]] },
  { id: "calm", name: "Спокойное дыхание", desc: "Ровный вдох и выдох без задержек. Хорошо восстанавливает после тренировки.", phases: [["Вдох", 5, 1], ["Выдох", 5, 0.55]] },
];
const roundsWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "раундов"; const l = n % 10; return l === 1 ? "раунд" : l >= 2 && l <= 4 ? "раунда" : "раундов"; };

// Раунд и фаза внутри него считаются от общего числа прошедших секунд, а не пошаговым переходом состояний —
// так не бывает рассинхрона из-за устаревших замыканий в setInterval.
function cycleInfo(phases, elapsed, rounds) {
  const cycleLen = phases.reduce((n, p) => n + p[1], 0);
  const round = Math.floor(elapsed / cycleLen) + 1;
  const inCycle = elapsed % cycleLen;
  let acc = 0, idx = 0, into = 0;
  for (let i = 0; i < phases.length; i++) {
    if (inCycle < acc + phases[i][1]) { idx = i; into = inCycle - acc; break; }
    acc += phases[i][1];
  }
  const phase = phases[idx];
  return { round, phase, secondsLeft: phase[1] - into, done: round > rounds };
}

function BreathingSession({ T, technique, rounds, onFinish, onClose }) {
  const [elapsed, setElapsed] = useState(0);
  const finishedRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const info = cycleInfo(technique.phases, elapsed, rounds);
  useEffect(() => {
    if (info.done && !finishedRef.current) { finishedRef.current = true; onFinish(); }
  }, [info.done]);

  if (info.done) {
    return (
      <FullScreen T={T} center label="Дыхание завершено">
        <Confetti T={T} />
        <div className="relative w-full max-w-sm">
          <span className="rounded-full flex items-center justify-center mb-4 mx-auto ritm-pop" style={{ width: 76, height: 76, background: T.grad, boxShadow: T.glow }}><Check size={34} color={T.on} /></span>
          <H1>Готово</H1>
          <Muted className="mt-2 mb-6">{rounds} {roundsWord(rounds)} техники «{technique.name}» позади.</Muted>
          <Primary T={T} onClick={onClose}>Закрыть</Primary>
        </div>
      </FullScreen>
    );
  }

  return (
    <FullScreen T={T} center label="Дыхание">
      <button onClick={onClose} aria-label="Закрыть" className="absolute top-6 right-6 rounded-full p-2 ritm-hover" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={18} /></button>
      <Muted size={13} className="mb-2">Раунд {info.round} из {rounds}</Muted>
      <div className="rounded-full flex items-center justify-center" style={{
        width: 200, height: 200, background: T.grad, boxShadow: T.glow,
        transform: `scale(${info.phase[2]})`, transition: `transform ${info.phase[1]}s ease-in-out`,
      }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 700, color: T.on }}>{info.secondsLeft}</div>
      </div>
      <div key={info.phase[0]} className="mt-8 font-semibold" style={{ fontSize: 20, animation: "rise .4s ease-out" }}>{info.phase[0]}</div>
      <Muted size={13} className="mt-2">{technique.name}</Muted>
    </FullScreen>
  );
}

function BreathingScreen({ T, st, up }) {
  const [techId, setTechId] = useState(BREATH_TECHNIQUES[0].id);
  const [rounds, setRounds] = useState(5);
  const [active, setActive] = useState(false);
  const technique = BREATH_TECHNIQUES.find((t) => t.id === techId);
  const k = keyOf(new Date());
  const totalSessions = st.breathStats?.totalSessions || 0;
  const totalMinutes = st.breathStats?.totalMinutes || 0;
  const streak = streakOf((day) => !!st.breathLog?.[day]);

  const finish = () => {
    const minutes = Math.round((technique.phases.reduce((n, p) => n + p[1], 0) * rounds) / 60) || 1;
    up((s) => ({
      breathLog: { ...(s.breathLog || {}), [k]: true },
      breathStats: { totalSessions: (s.breathStats?.totalSessions || 0) + 1, totalMinutes: (s.breathStats?.totalMinutes || 0) + minutes },
    }));
  };

  return (
    <div>
      <H1>Дыхание</H1>
      <Muted className="mt-1 mb-4">Дыхательные техники для расслабления, концентрации и восстановления после тренировки.</Muted>

      <div className="flex gap-3 mb-4">
        <Card T={T} className="flex-1 text-center py-3">
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>{totalSessions}</div>
          <Muted size={11}>сессий всего</Muted>
        </Card>
        <Card T={T} className="flex-1 text-center py-3">
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>{streak}</div>
          <Muted size={11}>{daysWord(streak)} подряд</Muted>
        </Card>
        <Card T={T} className="flex-1 text-center py-3">
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>{totalMinutes}</div>
          <Muted size={11}>минут всего</Muted>
        </Card>
      </div>

      <H2>Техника</H2>
      <div className="flex flex-col gap-2 mb-4">
        {BREATH_TECHNIQUES.map((t) => (
          <Card key={t.id} T={T} onClick={() => setTechId(t.id)} className="flex items-center gap-3" style={{ border: `1px solid ${techId === t.id ? T.a : T.line}` }}>
            <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)" }}><Wind size={17} /></span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold" style={{ fontSize: 14 }}>{t.name}</div>
              <Muted size={12}>{t.desc}</Muted>
            </div>
            {techId === t.id && <Check size={16} color={T.a} />}
          </Card>
        ))}
      </div>

      <H2>Раундов</H2>
      <div className="flex gap-2 mb-6">
        {[3, 5, 8, 10].map((n) => <Chip key={n} T={T} on={rounds === n} onClick={() => setRounds(n)}>{n}</Chip>)}
      </div>

      <Primary T={T} onClick={() => setActive(true)}><PlayCircle size={18} /> Начать</Primary>

      {active && <BreathingSession T={T} technique={technique} rounds={rounds} onFinish={finish} onClose={() => setActive(false)} />}
    </div>
  );
}

/* ============ Вера и духовная практика ============
   Раздел намеренно не привязан к одной конкретной религии — направление выбирает сам человек
   (или собирает свой набор практик с нуля), список подстраивается под выбор. */
const FAITH_TRADITIONS = [
  { id: "christian", label: "Христианство", practices: [
    { id: "prayer_morning", label: "Утренняя молитва" },
    { id: "prayer_evening", label: "Вечерняя молитва" },
    { id: "reading", label: "Чтение Писания" },
    { id: "gratitude", label: "Благодарность за день" },
  ] },
  { id: "muslim", label: "Ислам", practices: [
    { id: "fajr", label: "Фаджр" },
    { id: "dhuhr", label: "Зухр" },
    { id: "asr", label: "Аср" },
    { id: "maghrib", label: "Магриб" },
    { id: "isha", label: "Иша" },
    { id: "quran", label: "Чтение Корана" },
  ] },
  { id: "spiritual", label: "Общая духовность", practices: [
    { id: "meditation", label: "Медитация / тишина" },
    { id: "gratitude", label: "Благодарность" },
    { id: "reading", label: "Духовное чтение" },
    { id: "reflection", label: "Вечерняя рефлексия" },
  ] },
  { id: "custom", label: "Своя практика", practices: [] },
];
const faithTraditionById = (id) => FAITH_TRADITIONS.find((t) => t.id === id) || null;
function faithPracticesFor(faith) {
  const preset = faithTraditionById(faith?.tradition)?.practices || [];
  return [...preset, ...(faith?.customPractices || [])];
}

function FaithSetup({ T, onPick }) {
  return (
    <div>
      <H1>Вера и духовная практика</H1>
      <Muted className="mt-1 mb-4">Раздел настраивается под тебя — выбери, что откликается, или собери свой набор практик с нуля. Направление можно сменить в любой момент из этого же раздела.</Muted>
      <div className="flex flex-col gap-2">
        {FAITH_TRADITIONS.map((t) => (
          <Card key={t.id} T={T} onClick={() => onPick(t.id)} className="flex items-center gap-3">
            <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}>
              <Feather size={18} />
            </span>
            <div className="flex-1">
              <div className="font-semibold" style={{ fontSize: 14 }}>{t.label}</div>
              <Muted size={12}>{t.id === "custom" ? "Придумай список практик сам" : `${t.practices.length} практик по умолчанию — можно менять`}</Muted>
            </div>
            <ChevronRight size={16} color={MUTED} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function FaithScreen({ T, st, up }) {
  const faith = st.faith || { tradition: null, customPractices: [], log: {} };
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const k = keyOf(new Date());

  const pickTradition = (id) => up((s) => ({ faith: { tradition: id, customPractices: s.faith?.customPractices || [], log: s.faith?.log || {} } }));
  const changeTradition = () => up((s) => ({ faith: { ...(s.faith || {}), tradition: null } }));
  const addPractice = () => {
    const t = name.trim();
    if (!t) return;
    up((s) => ({ faith: { ...(s.faith || {}), customPractices: [...(s.faith?.customPractices || []), { id: "fp" + Date.now(), label: t }] } }));
    setName("");
  };
  const delPractice = (id) => up((s) => ({ faith: { ...(s.faith || {}), customPractices: (s.faith?.customPractices || []).filter((p) => p.id !== id) } }));
  const toggle = (practiceId) => up((s) => {
    const log = s.faith?.log || {};
    const day = { ...(log[k] || {}) };
    if (day[practiceId]) delete day[practiceId]; else day[practiceId] = true;
    return { faith: { ...(s.faith || {}), log: { ...log, [k]: day } } };
  });

  if (!faith.tradition) return <FaithSetup T={T} onPick={pickTradition} />;

  const practices = faithPracticesFor(faith);
  const todayLog = faith.log?.[k] || {};
  const doneToday = practices.filter((p) => todayLog[p.id]).length;
  const streak = streakOf((day) => { const l = faith.log?.[day]; return !!l && Object.values(l).some(Boolean); });
  const traditionLabel = faithTraditionById(faith.tradition)?.label || "Своя практика";

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <H1>Вера</H1>
          <Muted className="mt-1">{traditionLabel} · настраивается в любой момент</Muted>
        </div>
        <button onClick={() => setEditing(true)} aria-label="Настроить раздел" className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
          <SettingsIcon size={17} />
        </button>
      </div>

      <div className="flex gap-3 my-4">
        <Card T={T} className="flex-1 text-center py-3">
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>{doneToday}/{practices.length || 0}</div>
          <Muted size={11}>сегодня</Muted>
        </Card>
        <Card T={T} className="flex-1 text-center py-3">
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>{streak}</div>
          <Muted size={11}>{daysWord(streak)} подряд</Muted>
        </Card>
      </div>

      {practices.length === 0 ? (
        <Card T={T}><Muted size={14}>Пока нет ни одной практики — добавь свою ниже.</Muted></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {practices.map((p) => (
            <Card key={p.id} T={T} className="flex items-center gap-3">
              <CheckBox T={T} on={!!todayLog[p.id]} onClick={() => toggle(p.id)} label={p.label} />
              <span className="flex-1" style={{ fontSize: 14 }}>{p.label}</span>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPractice()}
          placeholder="Своя практика" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={addPractice} aria-label="Добавить практику" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
      </div>

      {editing && (
        <Sheet T={T} title="Настройки раздела" sub="Смени направление или удали свои практики." onClose={() => setEditing(false)}>
          <Muted size={12} className="mb-2">Сейчас выбрано: {traditionLabel}</Muted>
          {(faith.customPractices || []).length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {faith.customPractices.map((p) => (
                <Card key={p.id} T={T} className="flex items-center gap-3">
                  <span className="flex-1" style={{ fontSize: 14 }}>{p.label}</span>
                  <button onClick={() => delPractice(p.id)} aria-label="Удалить практику" style={{ color: MUTED }}><Trash2 size={15} /></button>
                </Card>
              ))}
            </div>
          )}
          <Ghost T={T} onClick={() => { changeTradition(); setEditing(false); }}>Сменить направление</Ghost>
        </Sheet>
      )}
    </div>
  );
}

/* ============ Развитие ============ */
// Свои темы (книги, языки и что угодно ещё) со своими задачами внутри каждой
function DevScreen({ T, st, up, openTheme }) {
  const [name, setName] = useState("");
  const themes = st.devThemes || [];
  const addTheme = () => {
    const n = name.trim();
    if (!n) return;
    up((s) => ({ devThemes: [...(s.devThemes || []), { id: "dth" + Date.now(), name: n, tasks: [] }] }));
    setName("");
  };

  return (
    <div>
      <H1>Развитие</H1>
      <Muted className="mt-1 mb-4">Свои темы для целей вне спорта: книги, языки, что угодно. В каждой теме — свой список задач.</Muted>

      {themes.length === 0 ? (
        <Card T={T}><Muted size={14}>Пока нет ни одной темы. Создай первую ниже.</Muted></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {themes.map((th) => {
            const total = th.tasks.length;
            const done = th.tasks.filter((t) => t.done).length;
            return (
              <Card key={th.id} T={T} onClick={() => openTheme(th.id)} className="flex items-center gap-3">
                <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}>
                  <Folder size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{th.name}</div>
                  <Muted size={13}>{total === 0 ? "Пока без задач" : `${done} из ${total} выполнено`}</Muted>
                </div>
                <ChevronRight size={16} color={MUTED} />
              </Card>
            );
          })}
        </div>
      )}

      <H2>Новая тема</H2>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTheme()}
          placeholder="Например, «Гитара»" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={addTheme} aria-label="Создать тему" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
      </div>
    </div>
  );
}

function ThemeSheet({ T, theme, up, onClose }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [nameField, setNameField] = useState(theme.name);

  const patchTheme = (patch) => up((s) => ({ devThemes: s.devThemes.map((t) => (t.id === theme.id ? { ...t, ...patch } : t)) }));
  // Задачи внутри темы меняем через актуальное состояние (s.devThemes), а не через устаревший
  // объект theme — иначе быстрые последовательные изменения (два тычка подряд по чекбоксам)
  // могут отменять друг друга, как это было в WorkoutEditSheet до похожего исправления.
  const patchTasks = (fn) => up((s) => ({
    devThemes: s.devThemes.map((t) => (t.id === theme.id ? { ...t, tasks: fn(t.tasks || []) } : t))
  }));
  const addTask = () => {
    const t = text.trim();
    if (!t) return;
    patchTasks((tasks) => [...tasks, { id: "dtk" + Date.now(), text: t, done: false }]);
    setText("");
  };
  const toggleTask = (id) => patchTasks((tasks) => tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const delTask = (id) => patchTasks((tasks) => tasks.filter((t) => t.id !== id));
  const saveName = () => { const n = nameField.trim(); if (n) patchTheme({ name: n }); setEditing(false); };
  const delTheme = () => up((s) => ({ devThemes: s.devThemes.filter((t) => t.id !== theme.id) })) || onClose();

  return (
    <Sheet T={T} title={editing ? "" : theme.name} onClose={onClose}>
      {editing ? (
        <div className="flex gap-2 mb-4">
          <input value={nameField} onChange={(e) => setNameField(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} autoFocus
            className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 17, fontFamily: DISPLAY }} />
          <button onClick={saveName} aria-label="Сохранить название" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Check size={18} /></button>
        </div>
      ) : (
        <div className="flex gap-2 mb-4">
          <Ghost T={T} onClick={() => setEditing(true)}><PenLine size={15} /> Переименовать</Ghost>
          <Ghost T={T} onClick={delTheme}><Trash2 size={15} /> Удалить тему</Ghost>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {theme.tasks.length === 0 && <Muted size={14} className="py-2">Добавь первую задачу в эту тему.</Muted>}
        {theme.tasks.map((t) => (
          <Card key={t.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <CheckBox T={T} on={t.done} onClick={() => toggleTask(t.id)} label={t.text} />
            <span className="flex-1" style={{ opacity: t.done ? 0.5 : 1, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            {t.time && <span style={{ fontSize: 12, color: T.a, fontWeight: 700 }}>{t.time}</span>}
            <button onClick={() => delTask(t.id)} aria-label="Удалить задачу" style={{ color: MUTED }}><Trash2 size={15} /></button>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Новая задача" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={addTask} aria-label="Добавить задачу" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
      </div>
    </Sheet>
  );
}

/* ============ Питание ============ */
function MacroBar({ T, label, val, max }) {
  return (
    <div className="flex-1 min-w-0">
      <div style={{ fontSize: 12, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        {Math.round(val)}<span style={{ color: MUTED, fontWeight: 400 }}> / {max} г</span>
      </div>
      <div className="rounded-full mt-1 overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.08)" }}>
        <div className="rounded-full" style={{ width: `${Math.min(100, (val / Math.max(1, max)) * 100)}%`, height: "100%", background: T.grad, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

function MacroChips({ p, f, c }) {
  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      {[["Белки", p], ["Жиры", f], ["Углеводы", c]].map(([l, v]) => (
        <span key={l} className="rounded-full px-3 py-1" style={{ fontSize: 13, background: "rgba(255,255,255,0.07)" }}>{l} {Math.round(v)} г</span>
      ))}
    </div>
  );
}


/* ============ Питание в стиле Yazio ============
   Каждая запись дневника — «продукт × вес»: храним значения на 100 г и граммы, поэтому порцию
   можно поправить в любой момент и всё пересчитается. Источники: фото и текст (ИИ разбивает приём
   пищи на отдельные продукты), штрихкод (Open Food Facts + «Мои продукты»), фото этикетки, ручной ввод. */
const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const atwater = (x) => 4 * x.p + 4 * x.c + 9 * x.f;

// Приводит значения на 100 г к правдоподобным. fromLabel — данные с упаковки: им доверяем и только
// заполняем пропуски. Оценки ИИ сверяем с формулой 4×Б + 4×У + 9×Ж и исправляем явные ошибки.
function sanePer100(raw, fromLabel = false) {
  let p = Math.min(100, Math.max(0, Number(raw?.p ?? raw?.protein) || 0));
  let f = Math.min(100, Math.max(0, Number(raw?.f ?? raw?.fat) || 0));
  let c = Math.min(100, Math.max(0, Number(raw?.c ?? raw?.carbs) || 0));
  const sum = p + f + c;
  if (sum > 105) { const k = 100 / sum; p *= k; f *= k; c *= k; }
  let kcal = Math.max(0, Number(raw?.kcal) || 0);
  const est = atwater({ p, f, c });
  let corrected = false;
  if (!kcal && est > 0) { kcal = est; corrected = true; }
  else if (!fromLabel && est > 20 && (kcal < est * 0.7 || kcal > est * 1.3)) { kcal = est; corrected = true; }
  return { kcal: Math.round(Math.min(900, kcal)), p: round1(p), f: round1(f), c: round1(c), corrected };
}
const per100Of = (raw, fromLabel) => { const { corrected, ...v } = sanePer100(raw, fromLabel); return v; };

const nutrientsFor = (per100, grams) => {
  const k = Math.max(0, Number(grams) || 0) / 100;
  return { kcal: Math.round(per100.kcal * k), p: round1(per100.p * k), f: round1(per100.f * k), c: round1(per100.c * k) };
};

let entrySeq = 0;
function makeFoodEntry({ name, brand = "", per100, grams, meal, source, barcode = "", servingG = 0, packageG = 0, unit = "g" }) {
  const clean = per100Of(per100, true);
  const g = Math.max(1, Math.round(Number(grams) || 0));
  entrySeq += 1;
  return {
    id: `${Date.now()}-${entrySeq}`,
    name: String(name || "Продукт").slice(0, 80), brand: String(brand || "").slice(0, 60),
    meal, grams: g, per100: clean, ...nutrientsFor(clean, g),
    source, barcode, servingG, packageG, unit,
  };
}

// Недавние продукты: уникальные по названию и бренду, свежие первыми
function recentFoods(food, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const day of Object.keys(food || {}).sort().reverse()) {
    for (const e of [...(food[day] || [])].reverse()) {
      if (!e.per100) continue;
      const key = `${e.name}|${e.brand || ""}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// Единицы порции: граммы (или мл), порция и упаковка — если они известны
function portionUnits(product) {
  const u = product.unit === "ml" ? "мл" : "г";
  const units = [{ id: "g", label: u, grams: 1 }];
  if (product.servingG > 0) units.push({ id: "serving", label: `порция, ${product.servingG} ${u}`, grams: product.servingG });
  if (product.packageG > 0) units.push({ id: "package", label: `упаковка, ${product.packageG} ${u}`, grams: product.packageG });
  return units;
}

// Разбирает ответ ИИ: новый формат (на 100 г + вес) и старый (на всю порцию)
function parseAiItems(r) {
  return (r?.items || []).map((it, i) => {
    const grams = Math.max(0, Math.round(Number(it.grams) || 0));
    let per100 = it.per100 || it.per_100g;
    if (!per100 && grams > 0) {
      const k = 100 / grams;
      per100 = { kcal: (Number(it.kcal) || 0) * k, protein: (Number(it.protein) || 0) * k, fat: (Number(it.fat) || 0) * k, carbs: (Number(it.carbs) || 0) * k };
    }
    const clean = sanePer100(per100 || {}, false);
    const { corrected, ...values } = clean;
    return {
      key: i, name: String(it.name || "Продукт").slice(0, 80), grams: String(grams || ""),
      per100: values, corrected, confidence: it.confidence || "medium", include: grams > 0,
    };
  });
}

const LABEL_PROMPT = `Это фото упаковки продукта. Найди таблицу пищевой ценности и перепиши значения НА 100 г (или на 100 мл).
Если указано только на порцию и известен вес порции — пересчитай на 100 г. Если пересчитать нельзя — верни {"is_label": false}.
Не придумывай значения: бери только то, что напечатано на упаковке. Энергию давай в ккал (если указаны только кДж — раздели на 4,184).
Ответь строго одним JSON-объектом, без markdown и пояснений:
{"is_label": true, "name": "название с упаковки или пустая строка", "brand": "бренд или пустая строка", "unit": "g или ml", "per100": {"kcal": число, "protein": число, "fat": число, "carbs": число}, "serving_g": число или 0, "package_g": число или 0}
Если на фото нет таблицы пищевой ценности, верни {"is_label": false}.`;

async function lookupBarcode(code) {
  let r;
  try {
    r = await fetch(apiUrl(`/api/barcode?code=${encodeURIComponent(code)}`), { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new Error("network");
  }
  const type = (r.headers && r.headers.get && r.headers.get("content-type")) || "";
  if (!type.includes("json")) throw new Error("noserver");
  const data = await r.json().catch(() => ({}));
  if (r.status === 400) throw new Error("badcode");
  if (r.status === 404) throw new Error("notfound");
  if (!r.ok || !data.product) throw new Error("network");
  const p = data.product;
  const allergens = [...new Set([...(p.allergens || []).filter((a) => ALLERGENS[a]), ...detectAllergens(`${p.name} ${p.ingredients || ""}`)])];
  return { ...p, per100: per100Of(p.per100, true), allergens };
}

// Делится товаром, который пользователь только что сам проверил (сфотографировал этикетку
// или ввёл вручную), с общей базой RITM — чтобы этот же штрихкод в следующий раз сразу
// нашёлся у кого угодно ещё, без повторного сканирования (см. product-submit.mjs). Лучшее
// усилие: личная копия в st.products уже сохранена локально и работает сама по себе, так что
// неудача здесь (нет сети и т. п.) ничего не ломает и не показывается пользователю.
async function submitProductToServer(barcode, product) {
  try {
    // Подпись Telegram, токен сессии сайта или секрет нативной сборки — см. authHeaders
    const headers = authHeaders({ "Content-Type": "application/json" });
    await fetch(apiUrl("/api/product-submit"), { method: "POST", headers, body: JSON.stringify({ barcode, product }) });
  } catch (e) { /* не критично, см. комментарий выше */ }
}

function barcodeErrorText(code) {
  if (code === "noserver") return "На сервере нет функции поиска штрихкодов. Загрузи файл netlify/functions/barcode.mjs из архива и сделай деплой.";
  if (code === "badcode") return "В штрихкоде должно быть от 8 до 14 цифр.";
  return "Не удалось связаться с базой продуктов. Проверь интернет и попробуй ещё раз.";
}

function cameraErrorText(e) {
  const name = String(e?.name || e || "");
  if (/NotAllowed|Permission/i.test(name)) return "Нет доступа к камере. Разреши его Telegram в настройках телефона или сфотографируй штрихкод.";
  if (/NotFound|Overconstrained/i.test(name)) return "Камера не найдена. Сфотографируй штрихкод или введи цифры.";
  return "Камера не запустилась. Сфотографируй штрихкод или введи цифры вручную.";
}

const BARCODE_FORMATS = (F) => [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E].filter((x) => x !== undefined);

function NumberField({ T, label, value, onChange, unit, width = 64, decimal = true }) {
  return (
    <label className="flex items-center justify-between rounded-xl px-3 py-2" style={{ border: `1px solid ${T.line}`, background: T.card }}>
      <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      <span className="flex items-baseline gap-1">
        <input type="text" inputMode={decimal ? "decimal" : "numeric"} value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className="bg-transparent text-right outline-none" style={{ width, fontFamily: DISPLAY, fontSize: 16, color: "#fff" }} />
        {unit && <span style={{ fontSize: 11, color: MUTED }}>{unit}</span>}
      </span>
    </label>
  );
}
const toNum = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

function AllergyWarning({ found, allergies }) {
  const danger = (found || []).filter((a) => (allergies || []).includes(a));
  if (!danger.length) return null;
  return (
    <div className="rounded-2xl p-3 flex gap-3 mt-3" style={{ background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.65)" }}>
      <AlertTriangle size={20} color="#FF2D55" className="flex-shrink-0" />
      <div>
        <div className="font-semibold">Возможен аллерген: {alLabels(danger)}</div>
        <Muted size={12}>Ты отметил это в анкете. Проверь состав на упаковке.</Muted>
      </div>
    </div>
  );
}

// Выбор порции, как в карточке продукта Yazio: количество + единица, живой пересчёт КБЖУ и приём пищи
function PortionPicker({ T, product, allergies, initialGrams, initialMeal, submitLabel, onSubmit }) {
  const units = portionUnits(product);
  const startUnit = initialGrams ? units[0] : (units.find((u) => u.id === "serving") || units[0]);
  const [unitId, setUnitId] = useState(startUnit.id);
  const unit = units.find((u) => u.id === unitId) || units[0];
  const [amount, setAmount] = useState(String(initialGrams || (startUnit.id === "g" ? 100 : 1)));
  const [meal, setMeal] = useState(Number.isInteger(initialMeal) ? initialMeal : defaultMeal());
  const grams = Math.round(toNum(amount) * unit.grams);
  const n = nutrientsFor(product.per100, grams);
  const u = product.unit === "ml" ? "мл" : "г";
  const changeUnit = (id) => {
    const next = units.find((x) => x.id === id) || units[0];
    setUnitId(next.id);
    setAmount(next.id === "g" ? String(grams || 100) : "1");
  };

  return (
    <div>
      <Card T={T}>
        <div className="font-semibold">{product.name}</div>
        {product.brand && <Muted size={12}>{product.brand}</Muted>}
        <Muted size={12} className="mt-1">На 100 {u}: {product.per100.kcal} ккал, Б {product.per100.p}, Ж {product.per100.f}, У {product.per100.c}</Muted>
      </Card>
      <AllergyWarning found={product.allergens} allergies={allergies} />

      <div className="flex gap-2 mt-3">
        <div className="flex-1"><NumberField T={T} label="Сколько" value={amount} onChange={setAmount} width={70} /></div>
        {units.length > 1 && (
          <select value={unitId} onChange={(e) => changeUnit(e.target.value)} className="rounded-xl px-2 outline-none"
            style={{ border: `1px solid ${T.line}`, background: "#0b0b0d", color: "#fff", fontSize: 13, maxWidth: "48%" }} aria-label="Единица">
            {units.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        )}
        {units.length === 1 && <span className="flex items-center px-2" style={{ color: MUTED }}>{u}</span>}
      </div>
      {unitId === "g" && (
        <div className="flex gap-2 mt-2">
          {[50, 100, 150, 200, 250].map((g) => (
            <button key={g} onClick={() => setAmount(String(g))} className="flex-1 rounded-lg py-1.5"
              style={{ border: `1px solid ${grams === g ? T.a : T.line}`, fontSize: 12, color: "#fff" }}>{g}</button>
          ))}
        </div>
      )}

      <div className="flex items-baseline gap-2 mt-4">
        <span style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 600 }}>{n.kcal}</span>
        <span style={{ color: MUTED }}>ккал, {grams} {u}</span>
      </div>
      <MacroChips p={n.p} f={n.f} c={n.c} />
      <Segmented T={T} items={MEALS} value={meal} onChange={setMeal} />
      <Primary T={T} disabled={grams <= 0} onClick={() => onSubmit({ grams, meal })}>{submitLabel}</Primary>
    </div>
  );
}

function ProductSheet({ T, product, allergies, meal, grams, onClose, onAdd }) {
  return (
    <Sheet T={T} title="Добавить продукт" onClose={onClose}>
      <PortionPicker T={T} product={product} allergies={allergies} initialGrams={grams} initialMeal={meal}
        submitLabel="Добавить в дневник"
        onSubmit={({ grams: g, meal: m }) => onAdd(makeFoodEntry({ ...product, grams: g, meal: m, source: product.source || "recent" }))} />
    </Sheet>
  );
}

// Редактирование записи: вес и приём пищи; старые записи без данных на 100 г можно только перенести или удалить
function FoodEntrySheet({ T, entry, allergies, onSave, onDelete, onClose }) {
  const [meal, setMeal] = useState(entry.meal);
  return (
    <Sheet T={T} title="Запись в дневнике" onClose={onClose}>
      {entry.per100 ? (
        <PortionPicker T={T} product={entry} allergies={allergies} initialGrams={entry.grams} initialMeal={entry.meal}
          submitLabel="Сохранить"
          onSubmit={({ grams, meal: m }) => onSave({ grams, meal: m, ...nutrientsFor(entry.per100, grams) })} />
      ) : (
        <>
          <Card T={T}>
            <div className="font-semibold">{entry.name}</div>
            <Muted size={12}>{entry.kcal} ккал, Б {entry.p}, Ж {entry.f}, У {entry.c}</Muted>
          </Card>
          <Segmented T={T} items={MEALS} value={meal} onChange={setMeal} />
          <Primary T={T} onClick={() => onSave({ meal })}>Сохранить</Primary>
        </>
      )}
      <div className="mt-3"><Ghost T={T} onClick={onDelete}><Trash2 size={16} /> Удалить запись</Ghost></div>
    </Sheet>
  );
}

// Меню «+» у приёма пищи
function AddFoodSheet({ T, meal, aiLeft, recent, mine, onPhoto, onBarcode, onText, onManual, onPick, onPay, onClose }) {
  const aiBlocked = aiLeft === 0;
  const row = { border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)", color: "#fff" };
  const option = "w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left font-medium";
  const onFile = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(f); };
  return (
    <Sheet T={T} title={`Добавить: ${MEALS[meal].toLowerCase()}`} onClose={onClose}>
      <div className="flex flex-col gap-2 mt-2">
        <button onClick={onBarcode} className={option} style={row}><ScanBarcode size={18} /> Штрихкод с упаковки</button>
        {aiBlocked ? (
          <button onClick={() => onPay("scans")} className={option} style={row}><Lock size={18} /> Фото и описание — лимит на сегодня, открыть Pro</button>
        ) : (
          <>
            <label className={`${option} cursor-pointer`} style={row}>
              <Camera size={18} /> Сфотографировать еду
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            </label>
            <label className={`${option} cursor-pointer`} style={row}>
              <ImageIcon size={18} /> Фото из галереи
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
            <button onClick={onText} className={option} style={row}><PenLine size={18} /> Описать текстом</button>
          </>
        )}
        <button onClick={onManual} className={option} style={row}><Plus size={18} /> Ввести КБЖУ с упаковки</button>
      </div>
      {aiLeft !== null && !aiBlocked && <Muted size={12} className="mt-2">Распознаваний по фото и тексту сегодня: {aiLeft}</Muted>}

      {mine.length > 0 && (
        <>
          <H2>Мои продукты</H2>
          <div className="flex flex-col gap-2">
            {mine.map((p) => (
              <Card key={p.barcode || p.name} T={T} onClick={() => onPick(p)} className="flex items-center gap-3" style={{ padding: "10px 14px" }}>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <Muted size={11}>{p.per100.kcal} ккал на 100 {p.unit === "ml" ? "мл" : "г"}</Muted>
                </div>
                <Plus size={16} color={MUTED} />
              </Card>
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <H2>Недавние</H2>
          <div className="flex flex-col gap-2">
            {recent.map((e) => (
              <Card key={e.id} T={T} onClick={() => onPick(e, e.grams)} className="flex items-center gap-3" style={{ padding: "10px 14px" }}>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{e.name}</div>
                  <Muted size={11}>{e.grams} {e.unit === "ml" ? "мл" : "г"}, {e.kcal} ккал</Muted>
                </div>
                <Plus size={16} color={MUTED} />
              </Card>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

const SCAN_EL = "ritm-barcode-reader";
const FILE_EL = "ritm-barcode-file";

function BarcodeSheet({ T, products, allergies, meal, onClose, onAdd, onManual, onPhotoFood }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("input"); // input | camera | loading | result | notfound | empty
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);
  const scannerRef = useRef(null);
  const handledRef = useRef(false);

  const stopCamera = async () => {
    const sc = scannerRef.current;
    scannerRef.current = null;
    if (!sc) return;
    try { if (sc.isScanning) await sc.stop(); } catch (e) { /* уже остановлена */ }
    try { sc.clear(); } catch (e) { /* нечего очищать */ }
  };
  useEffect(() => () => { stopCamera(); }, []);

  const find = async (value) => {
    const clean = String(value || "").replace(/\D/g, "");
    setCode(clean);
    setError("");
    if (clean.length < 8 || clean.length > 14) { setStatus("input"); setError(barcodeErrorText("badcode")); return; }
    const mineProduct = products?.[clean];
    if (mineProduct) { setProduct({ ...mineProduct, barcode: clean, source: "mine" }); setStatus("result"); return; }
    setStatus("loading");
    try {
      const p = await lookupBarcode(clean);
      // p.source — "ritm" (нашли в общей базе, которую наполняют сами пользователи
      // приложения) или "off" (нашли в Open Food Facts); сохраняем как есть для подписи
      // в UI ниже, а не затираем общим "barcode" — это НЕ источник записи в дневнике
      // питания (та помечается отдельно, при самом добавлении, ниже по файлу).
      setProduct({ ...p, barcode: clean, source: p.source || "barcode" });
      setStatus(p.hasNutrition ? "result" : "empty");
    } catch (e) {
      if (e.message === "notfound") setStatus("notfound");
      else { setStatus("input"); setError(barcodeErrorText(e.message)); }
    }
  };

  // Живое сканирование: библиотека сама использует встроенный распознаватель телефона, если он есть
  useEffect(() => {
    if (status !== "camera") return undefined;
    let cancelled = false;
    handledRef.current = false;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
        if (cancelled) return;
        const sc = new Html5Qrcode(SCAN_EL, { formatsToSupport: BARCODE_FORMATS(F), verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
        scannerRef.current = sc;
        await sc.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => ({ width: Math.max(120, Math.floor(Math.min(w * 0.9, 320))), height: Math.max(60, Math.floor(Math.min(h * 0.45, 140))) }) },
          (decoded) => {
            if (handledRef.current) return;
            handledRef.current = true;
            stopCamera().then(() => find(decoded));
          },
          () => {},
        );
      } catch (e) {
        await stopCamera();
        if (!cancelled) { setStatus("input"); setError(cameraErrorText(e)); }
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  // Запасной путь: фото штрихкода — работает даже там, где живая камера недоступна
  const onBarcodePhoto = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setStatus("loading");
    setError("");
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
      const sc = new Html5Qrcode(FILE_EL, { formatsToSupport: BARCODE_FORMATS(F), verbose: false });
      const decoded = await sc.scanFile(file, false);
      try { sc.clear(); } catch (e) { /* нечего очищать */ }
      find(decoded);
    } catch (e) {
      setStatus("input");
      setError("Не удалось прочитать штрихкод с фото. Сними ближе, ровно и при хорошем свете или введи цифры.");
    }
  };

  const close = () => { stopCamera(); onClose(); };

  return (
    <Sheet T={T} title="Штрихкод продукта" onClose={close}>
      <div id={FILE_EL} style={{ display: "none" }} />
      {status === "input" && (
        <>
          <Muted size={13} className="mb-3">Наведи камеру на штрихкод упаковки — RITM найдёт продукт и посчитает КБЖУ для твоей порции.</Muted>
          <Primary T={T} onClick={() => setStatus("camera")}><Camera size={18} /> Сканировать камерой</Primary>
          <label className="mt-2 w-full rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2 cursor-pointer"
            style={{ border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)", color: "#fff" }}>
            <ImageIcon size={16} /> Сфотографировать штрихкод
            <input type="file" accept="image/*" capture="environment" onChange={onBarcodePhoto} className="hidden" />
          </label>
          <div className="flex gap-2 mt-3">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && find(code)}
              inputMode="numeric" placeholder="Или введи цифры под штрихкодом" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
              style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
            <button onClick={() => find(code)} className="rounded-xl px-4" style={{ background: T.grad, color: T.on }} aria-label="Найти продукт">
              <ScanBarcode size={20} />
            </button>
          </div>
          {error && <Muted size={13} className="mt-3" style={{ color: T.a }}>{error}</Muted>}
        </>
      )}

      {status === "camera" && (
        <>
          <div className="rounded-2xl overflow-hidden mt-2" style={{ border: `1px solid ${T.line}`, background: "#000", minHeight: 240 }}>
            <div id={SCAN_EL} style={{ width: "100%" }} />
          </div>
          <Muted size={12} className="text-center mt-2 mb-3">Держи штрихкод горизонтально внутри рамки</Muted>
          <Ghost T={T} onClick={() => { stopCamera(); setStatus("input"); }}>Ввести вручную</Ghost>
        </>
      )}

      {status === "loading" && <Loader T={T} text="Ищу продукт" />}

      {(status === "notfound" || status === "empty") && (
        <div className="py-2">
          <Card T={T}>
            <div className="font-semibold mb-1">{status === "notfound" ? "Продукта нет в базе" : `Нашёл «${product?.name}», но без КБЖУ`}</div>
            <Muted size={13}>
              Штрихкод {code}. База продуктов открытая и пополняется людьми — российские товары, особенно небольших производителей, в ней встречаются не всегда. Сфотографируй таблицу КБЖУ с упаковки один раз — RITM посчитает всё сам и запомнит продукт, в следующий раз он найдётся сразу.
            </Muted>
          </Card>
          <div className="flex flex-col gap-2 mt-3">
            <Primary T={T} onClick={() => onManual({ barcode: code, name: status === "empty" ? product?.name : "", brand: status === "empty" ? product?.brand : "", packageG: product?.packageG || 0, unit: product?.unit || "g", meal, withLabel: true })}>
              <Camera size={18} /> Сфотографировать таблицу КБЖУ
            </Primary>
            {onPhotoFood && (
              <label className="w-full rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2 cursor-pointer"
                style={{ border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)", color: "#fff" }}>
                <ImageIcon size={16} /> Нет упаковки — сфотографировать блюдо
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhotoFood(f); }} />
              </label>
            )}
            <Ghost T={T} onClick={() => onManual({ barcode: code, name: status === "empty" ? product?.name : "", brand: status === "empty" ? product?.brand : "", packageG: product?.packageG || 0, unit: product?.unit || "g", meal })}>
              <PenLine size={16} /> Ввести вручную
            </Ghost>
            <Ghost T={T} onClick={() => { setProduct(null); setCode(""); setStatus("input"); }}>Другой штрихкод</Ghost>
          </div>
        </div>
      )}

      {status === "result" && product && (
        <>
          {product.source === "mine" && <Muted size={12} className="mb-2">Из «Моих продуктов»</Muted>}
          {product.source === "ritm" && <Muted size={12} className="mb-2">Добавлено пользователем RITM — такого товара нет в открытой базе</Muted>}
          <PortionPicker T={T} product={product} allergies={allergies} initialMeal={meal} submitLabel="Добавить в дневник"
            onSubmit={({ grams, meal: m }) => onAdd(makeFoodEntry({ ...product, grams, meal: m, source: "barcode" }))} />
          <div className="mt-2"><Ghost T={T} onClick={() => { setProduct(null); setCode(""); setStatus("input"); }}>Другой штрихкод</Ghost></div>
        </>
      )}
    </Sheet>
  );
}

// Ручной ввод с упаковки + чтение этикетки по фото. Продукт со штрихкодом сохраняется в «Мои продукты»
function ManualFoodSheet({ T, init, allergies, aiLeft, onUsedAi, onAdd, onSaveProduct, onPay, onClose }) {
  const [name, setName] = useState(init.name || "");
  const [brand, setBrand] = useState(init.brand || "");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [f, setF] = useState("");
  const [c, setC] = useState("");
  const [grams, setGrams] = useState(String(init.packageG || 100));
  const [packageG, setPackageG] = useState(init.packageG || 0);
  const [servingG, setServingG] = useState(0);
  const [unit, setUnit] = useState(init.unit || "g");
  const [meal, setMeal] = useState(Number.isInteger(init.meal) ? init.meal : defaultMeal());
  const [save, setSave] = useState(!!init.barcode);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef(null);
  const u = unit === "ml" ? "мл" : "г";

  const raw = { kcal: toNum(kcal), p: toNum(p), f: toNum(f), c: toNum(c) };
  const per100 = per100Of(raw, true);
  const est = Math.round(atwater(per100));
  const mismatch = raw.kcal > 0 && est > 20 && (raw.kcal < est * 0.7 || raw.kcal > est * 1.3);
  const n = nutrientsFor(per100, toNum(grams));
  const ready = name.trim() && (raw.kcal > 0 || raw.p + raw.f + raw.c > 0) && toNum(grams) > 0;
  const found = detectAllergens(name);

  useEffect(() => { if (init.withLabel && aiLeft !== 0) setTimeout(() => fileRef.current?.click(), 250); }, []);

  const readLabel = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true);
    setNote("");
    try {
      const img = await fileToJpeg(file, 1600);
      const r = await askClaude([
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img.base64 } },
        { type: "text", text: LABEL_PROMPT },
      ]);
      if (!r.is_label || !r.per100) { setNote("Не нашёл таблицу пищевой ценности. Сфотографируй её ближе и ровнее или введи значения вручную."); return; }
      const v = per100Of(r.per100, true);
      setKcal(String(v.kcal)); setP(String(v.p)); setF(String(v.f)); setC(String(v.c));
      if (!name.trim() && r.name) setName(String(r.name).slice(0, 80));
      if (!brand.trim() && r.brand) setBrand(String(r.brand).slice(0, 60));
      if (r.unit === "ml") setUnit("ml");
      if (Number(r.package_g) > 0) { setPackageG(Math.round(r.package_g)); setGrams(String(Math.round(r.package_g))); }
      if (Number(r.serving_g) > 0) setServingG(Math.round(r.serving_g));
      setNote("Значения прочитаны с этикетки. Проверь их перед сохранением.");
      onUsedAi();
    } catch (err) {
      setNote(explainAiError(err) || "Не удалось прочитать этикетку. Введи значения вручную.");
    } finally {
      setReading(false);
    }
  };

  const submit = () => {
    const product = { name: name.trim(), brand: brand.trim(), per100, servingG, packageG: Number(packageG) || 0, unit, allergens: found };
    if (save && init.barcode) onSaveProduct(init.barcode, product);
    onAdd(makeFoodEntry({ ...product, grams: toNum(grams), meal, source: "manual", barcode: init.barcode || "" }));
  };

  return (
    <Sheet T={T} title="Продукт с упаковки" onClose={onClose}>
      {init.barcode && <Muted size={12} className="mb-2">Штрихкод {init.barcode}</Muted>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={readLabel} className="hidden" />
      {aiLeft === 0 ? (
        <Ghost T={T} onClick={() => onPay("scans")}><Lock size={16} /> Чтение этикетки по фото — лимит на сегодня</Ghost>
      ) : (
        <Ghost T={T} onClick={() => fileRef.current?.click()}><Camera size={16} /> {reading ? "Читаю этикетку…" : "Заполнить по фото этикетки"}</Ghost>
      )}
      {note && <Muted size={12} className="mt-2" style={{ color: T.a }}>{note}</Muted>}

      <div className="flex flex-col gap-2 mt-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название продукта"
          className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Бренд, необязательно"
          className="rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <div className="flex items-center justify-between mt-1">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Пищевая ценность на 100 {u}</span>
          <div className="flex gap-1">
            {[["g", "г"], ["ml", "мл"]].map(([id, l]) => (
              <button key={id} onClick={() => setUnit(id)} className="rounded-lg px-3 py-1"
                style={{ border: `1px solid ${unit === id ? T.a : T.line}`, fontSize: 12, color: "#fff" }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField T={T} label="Калории" value={kcal} onChange={setKcal} unit="ккал" width={56} />
          <NumberField T={T} label="Белки" value={p} onChange={setP} unit="г" width={56} />
          <NumberField T={T} label="Жиры" value={f} onChange={setF} unit="г" width={56} />
          <NumberField T={T} label="Углеводы" value={c} onChange={setC} unit="г" width={56} />
        </div>
        {mismatch && (
          <Muted size={12} style={{ color: "#ffd36a" }}>
            По белкам, жирам и углеводам выходит около {est} ккал. Проверь, не перепутаны ли значения: на 100 {u} или на порцию.
          </Muted>
        )}
        <NumberField T={T} label="Съел" value={grams} onChange={setGrams} unit={u} width={70} />
      </div>
      <AllergyWarning found={found} allergies={allergies} />

      <div className="flex items-baseline gap-2 mt-4">
        <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 600 }}>{n.kcal}</span>
        <span style={{ color: MUTED }}>ккал</span>
      </div>
      <MacroChips p={n.p} f={n.f} c={n.c} />
      {init.barcode && (
        <div className="flex items-center gap-3 mt-3">
          <span className="flex-1" style={{ fontSize: 14 }}>Запомнить в «Моих продуктах»</span>
          <Toggle T={T} on={save} onChange={setSave} label="Запомнить продукт" />
        </div>
      )}
      <Segmented T={T} items={MEALS} value={meal} onChange={setMeal} />
      <Primary T={T} disabled={!ready} onClick={submit}>Добавить в дневник</Primary>
    </Sheet>
  );
}

function Nutrition({ T, st, up, norm, program, run, openScan, openRecipe, openPay, openBarcode, openAdd, openEntry, onPhoto, openShopping }) {
  const now = new Date();
  const k = keyOf(now);
  const list = st.food[k] || [];
  const eaten = sumFood(list);
  const left = norm.kcal - eaten.kcal;
  const p = st.profile;
  const allergies = p.allergies || [];
  const scansLeft = st.pro ? null : Math.max(0, FREE_SCANS - (st.scans[k] || 0));
  const [showAll, setShowAll] = useState(false);
  const nutritionGoal = nutritionGoalOf(p);
  const recipes = rankRecipes(RECIPES.filter((r) => !r.allergens.some((a) => allergies.includes(a))), p.goal, left, norm.protein - eaten.p);
  const shown = showAll ? recipes : recipes.slice(0, 4);
  const ghost = { border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)", color: "#fff" };

  const isTrainDay = (program?.schedule[wdOf(now)] !== undefined) || (run?.schedule[wdOf(now)] !== undefined);
  const waterTarget = isTrainDay ? norm.waterTrain : norm.waterBase;
  const water = st.water[k] || 0;
  const addWater = (ml) => up((s) => ({ water: { ...s.water, [k]: Math.max(0, (s.water[k] || 0) + ml) } }));
  const setWater = (ml) => up((s) => ({ water: { ...s.water, [k]: Math.max(0, ml) } }));

  const hasRate = p.goal === "mass" || p.goal === "fat";
  const kgWeek = hasRate ? (p.rate || 0) / 100 * p.weight : 0;
  const etaWeeks = hasRate && kgWeek > 0 && p.targetKg > 0 ? Math.round(p.targetKg / kgWeek) : 0;
  const deficit = Math.round(norm.goalAdjustment || 0);
  const goalCard = deficit === 0 ? null : { loss: "Программа похудения", muscle: "Набор мышц", weight: "Набор массы" }[nutritionGoal] || null;

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) onPhoto(file, defaultMeal());
  };
  const delFood = (id) => up((s) => ({ food: { ...s.food, [k]: s.food[k].filter((x) => x.id !== id) } }));

  return (
    <div>
      <H1>Питание</H1>

      <Card T={T} className="mt-4" style={{ borderRadius: 22 }}>
        <div className="font-semibold mb-1">Цель питания</div>
        <Muted size={12}>RITM подстраивает калории и БЖУ под выбранную цель. Это ориентир, а не медицинское назначение.</Muted>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {NUTRITION_GOALS.map(([id, title]) => (
            <button key={id} onClick={() => up((s) => ({ profile: { ...s.profile, nutritionGoal: id } }))}
              className="rounded-xl px-3 py-3 text-left" style={{ border: `1px solid ${nutritionGoal === id ? T.a : T.line}`, background: nutritionGoal === id ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.03)" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
            </button>
          ))}
        </div>
        {p.age < 18 && nutritionGoal === "loss" && <Muted size={11} className="mt-3" style={{ color: "#ffd36a" }}>Для растущего организма RITM не задаёт жёсткий дефицит. Если цель — снижение веса, лучше обсудить её с родителем/врачом или спортивным специалистом.</Muted>}
      </Card>

      {goalCard && (
        <Card T={T} className="mt-4" style={{ borderRadius: 20, border: `1px solid ${T.a}55` }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={15} color={T.a} />
            <span className="font-semibold" style={{ fontSize: 14 }}>{goalCard}</span>
          </div>
          <Muted size={13}>
            {deficit >= 0 ? "Профицит" : "Дефицит"} {Math.abs(deficit)} ккал в день{hasRate && p.targetKg > 0 && etaWeeks > 0 ? `, цель ${p.targetKg} кг — примерно ${etaWeeks} ${weeksWord(etaWeeks)}` : ""}
          </Muted>
        </Card>
      )}

      <Card T={T} className="mt-4" style={{ borderRadius: 24 }}>
        <Muted size={13}>{left >= 0 ? "Осталось на сегодня" : "Больше нормы на"}</Muted>
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", textShadow: `0 0 24px ${T.a}66` }}>
            {Math.abs(Math.round(left)).toLocaleString("ru-RU")}
          </span>
          <span style={{ color: MUTED, fontSize: 14 }}>ккал</span>
        </div>
        <Muted size={13}>Съедено {Math.round(eaten.kcal)} из {norm.kcal.toLocaleString("ru-RU")}</Muted>
        <div className="flex gap-4 mt-4">
          <MacroBar T={T} label="Белки" val={eaten.p} max={norm.protein} />
          <MacroBar T={T} label="Жиры" val={eaten.f} max={norm.fat} />
          <MacroBar T={T} label="Углеводы" val={eaten.c} max={norm.carbs} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[['BMR', norm.bmr + ' ккал'], ['Активность', '×' + norm.activityFactor], ['Поддержание', norm.tdee + ' ккал']].map(([l,v]) => (
            <div key={l} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}>
              <div style={{ color: MUTED, fontSize: 10 }}>{l}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{v}</div>
            </div>
          ))}
        </div>
        <Muted size={11} className="mt-3">RITM учитывает базовый обмен, активность и цель. Тренировки не прибавляются второй раз отдельными «сожжёнными калориями».</Muted>
      </Card>

      <Card T={T} className="mt-3" style={{ borderRadius: 22 }}>
        <div className="flex items-center gap-3 mb-3">
          <Droplets size={20} color={T.a} />
          <div className="flex-1">
            <div className="font-semibold">Вода</div>
            <Muted size={12}>{(water / 1000).toFixed(2).replace(".", ",")} из {(waterTarget / 1000).toFixed(1).replace(".", ",")} л{isTrainDay ? ", сегодня тренировка — норма выше" : ""}</Muted>
          </div>
          {water > 0 && (
            <button onClick={() => addWater(-250)} className="rounded-full p-2 flex-shrink-0" style={ghost} aria-label="Убрать 250 мл"><Minus size={14} /></button>
          )}
        </div>
        <WaterCups T={T} water={water} target={waterTarget} onSet={setWater} />
        <Muted size={11} className="mt-3">Стаканчик — 250 мл. Нажми, чтобы налить до него; нажми на полный, чтобы опустошить обратно.</Muted>
      </Card>

      <div className="mt-4">
        {scansLeft === 0 ? (
          <>
            <Primary T={T} onClick={() => openPay("scans")}><Crown size={18} /> Безлимитное распознавание в Pro</Primary>
            <Muted size={12} className="mt-2 text-center">Бесплатные распознавания на сегодня закончились, завтра снова будет {FREE_SCANS}</Muted>
          </>
        ) : (
          <>
            <label className="w-full rounded-xl py-3 px-4 font-semibold flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: T.grad, color: T.on, boxShadow: T.glow }}>
              <Camera size={18} /> Сфотографировать еду
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            </label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button onClick={() => openBarcode(defaultMeal())} className="rounded-xl py-3 px-3 font-medium flex items-center justify-center gap-2" style={{ ...ghost, fontSize: 14 }}>
                <ScanBarcode size={16} /> Штрихкод
              </button>
              <label className="rounded-xl py-3 px-3 font-medium flex items-center justify-center gap-2 cursor-pointer" style={{ ...ghost, fontSize: 14 }}>
                <ImageIcon size={16} /> Из галереи
                <input type="file" accept="image/*" onChange={onFile} className="hidden" />
              </label>
              <button onClick={() => openScan({ text: true, meal: defaultMeal() })} className="rounded-xl py-3 px-3 font-medium flex items-center justify-center gap-2" style={{ ...ghost, fontSize: 14 }}>
                <PenLine size={16} /> Описать текстом
              </button>
            </div>
            {scansLeft !== null && <Muted size={12} className="mt-2 text-center">Бесплатных распознаваний сегодня: {scansLeft} из {FREE_SCANS}</Muted>}
          </>
        )}
      </div>

      <H2>Дневник питания</H2>
      <Muted size={12} className="mb-3">Нажми на запись, чтобы изменить вес или приём пищи.</Muted>
      {MEALS.map((label, mi) => {
        const items = list.filter((e) => e.meal === mi);
        return (
          <Card key={label} T={T} className="mb-3" style={{ borderRadius: 20 }}>
            <div className="flex items-center justify-between mb-2">
              <div><div className="font-semibold">{label}</div><Muted size={11}>{Math.round(sumFood(items).kcal)} / {norm.mealTargets?.[mi] || Math.round(norm.kcal * MEAL_SPLITS[mi])} ккал</Muted></div>
              <button onClick={() => openAdd(mi)} aria-label={`Добавить: ${label}`} className="rounded-xl px-3 py-2" style={{ border: `1px solid ${T.line}`, color: "#fff" }}><Plus size={16} /></button>
            </div>
            <div className="rounded-full mb-3 overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,.08)" }}>
              <div style={{ width: `${Math.min(100, (sumFood(items).kcal / Math.max(1, (norm.mealTargets?.[mi] || norm.kcal * MEAL_SPLITS[mi]))) * 100)}%`, height: "100%", background: T.grad }} />
            </div>
            {items.length === 0 ? (
              <Muted size={12}>Пока ничего не добавлено</Muted>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,.04)" }}>
                    <button onClick={() => openEntry(e.id)} className="flex-1 min-w-0 text-left" style={{ color: "#fff" }}>
                      <div className="truncate font-medium">{e.name}</div>
                      <Muted size={11}>{e.grams ? `${e.grams} ${e.unit === "ml" ? "мл" : "г"} · ` : ""}Б {e.p} · Ж {e.f} · У {e.c}</Muted>
                    </button>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{e.kcal}</span>
                    <button onClick={() => delFood(e.id)} aria-label="Удалить запись" style={{ color: MUTED }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      <H2>Как RITM считает</H2>
      <Card T={T} className="mb-5" style={{ borderRadius: 22 }}>
        <div className="font-semibold mb-2">Умный расчёт RITM</div>
        <Muted size={12}>RITM считает стартовую норму по базовому обмену, росту, весу, возрасту, полу и активности. Затем учитывает цель и выбранный темп изменения веса, а после этого распределяет калории между белками, жирами и углеводами. Это ориентир, а не медицинское назначение.</Muted>
        <div className="mt-3 grid gap-2">
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><b>🏋️ Набор мышц:</b> небольшой профицит, силовые тренировки, регулярный белок и углеводы.</div>
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><b>⚡ Тонус / поддержание:</b> ориентир около поддерживающей калорийности и полноценный рацион без экстремальных ограничений.</div>
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><b>🔥 Снижение веса:</b> для взрослых — умеренный дефицит; для растущих пользователей RITM не задаёт жёсткое ограничение калорий.</div>
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><b>📈 Набор массы:</b> небольшой профицит энергии и постепенное увеличение веса, без необходимости «есть как можно больше».</div>
        </div>
        <Muted size={11} className="mt-3">Основа знаний: спортивное питание, энергетический баланс, распределение белка/углеводов и гидратация. Рекомендации ACSM подчёркивают, что для прогресса важны не только белок, но и достаточная энергия, углеводы, восстановление и гидратация.</Muted>
      </Card>

      <H2>Рецепты для тебя</H2>
      <Muted size={13} className="mb-3">
        {allergies.length ? `Показываю только блюда без аллергенов: ${alLabels(allergies)}` : "Аллергии не указаны. Их можно добавить в настройках."}
      </Muted>

      <div className="mb-2">
        <Ghost T={T} onClick={openShopping}><ShoppingCart size={16} /> Список покупок</Ghost>
      </div>

      <Card T={T} onClick={st.pro ? () => openRecipe({ ai: true }) : () => openPay("recipes")} className="flex items-center gap-3 mb-2" style={{ border: `1px solid ${T.a}88`, boxShadow: st.pro ? T.glow : "none" }}>
        <Sparkles size={20} color={T.a} />
        <div className="flex-1">
          <div className="font-semibold">Придумать рецепт под остаток дня</div>
          <Muted size={12}>Учтёт оставшиеся калории, белок и твои аллергии</Muted>
        </div>
        {!st.pro && <span className="flex items-center gap-1" style={{ color: T.a, fontSize: 13, fontWeight: 600 }}><Lock size={12} />Pro</span>}
      </Card>

      {recipes.length === 0 ? (
        <Card T={T}><Muted size={14}>В базе нет блюд без всех отмеченных аллергенов. Попробуй рецепт от ИИ.</Muted></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((r) => {
            const tag = recipeTag(r);
            return (
              <Card key={r.id} T={T} onClick={() => openRecipe({ recipe: r })} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.name}</div>
                  <Muted size={12}>{r.time} мин, Б {r.p}, Ж {r.f}, У {r.c}</Muted>
                  {tag && <span className="inline-block rounded-full px-2 mt-1" style={{ fontSize: 11, border: `1px solid ${T.line}`, color: "rgba(255,255,255,0.8)" }}>{tag}</span>}
                </div>
                <div className="text-right">
                  <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600 }}>{r.kcal}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>ккал</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {recipes.length > 4 && (
        <div className="mt-3"><Ghost T={T} onClick={() => setShowAll(!showAll)}>{showAll ? "Свернуть" : `Показать все, ${recipes.length}`}</Ghost></div>
      )}
      <Muted size={12} className="mt-4">
        При серьёзной аллергии всё равно проверяй состав на упаковке: производители меняют рецептуры, а следы аллергенов встречаются в неожиданных продуктах.
      </Muted>
    </div>
  );
}

const productsWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "продуктов"; const l = n % 10; return l === 1 ? "продукт" : l >= 2 && l <= 4 ? "продукта" : "продуктов"; };

function FoodScanSheet({ T, init, allergies, memory, onClose, onAddMany, onUsed, onRemember }) {
  const [status, setStatus] = useState(init.error ? "error" : init.image ? "loading" : "input");
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const [error, setError] = useState(init.error ? "Не получилось открыть фото. Попробуй другое изображение." : "");
  const [meal, setMeal] = useState(Number.isInteger(init.meal) ? init.meal : defaultMeal());
  const [remembered, setRemembered] = useState(false);

  const analyze = async (content) => {
    setStatus("loading");
    try {
      const r = await askClaude(content);
      if (!r.is_food) {
        setError(init.image ? "На фото не видно еды. Сфотографируй тарелку сверху при хорошем свете." : "Не получилось понять, что за еда. Напиши название блюда и примерный вес.");
        setStatus("error");
        return;
      }
      const items = parseAiItems(r);
      if (!items.length) throw new Error("empty");
      const dish = String(r.dish || items[0].name);
      const found = [...new Set([...(r.allergens || []).filter((a) => ALLERGENS[a]), ...detectAllergens(dish + " " + items.map((x) => x.name).join(" "))])];
      setRes({ dish, items, found, note: r.note ? String(r.note) : "" });
      setStatus("result");
      setRemembered(false);
      onUsed();
    } catch (e) {
      setError(explainAiError(e) || "Не получилось распознать. Попробуй ещё раз или опиши блюдо текстом.");
      setStatus("error");
    }
  };
  // Подсказка из «памяти блюд»: если пользователь уже когда-то поправил похожее блюдо,
  // передаём эти значения модели как контекст — она сама решает, подходит ли это к фото,
  // так и для текстового описания сверяемся с памятью напрямую до похода в ИИ.
  const analyzePhoto = () => analyze([
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: init.base64 } },
    { type: "text", text: FOOD_PROMPT + memoryHintText(memory) },
  ]);
  const analyzeText = () => {
    const t = text.trim();
    if (!t) return;
    setStatus("loading");
    // Сначала проверяем «память блюд» — точные значения, которые пользователь уже сам
    // подтвердил для похожего блюда раньше. Если совпадение есть, не идём даже в локальную
    // базу: это точнее и быстрее, чем новая оценка.
    const tl = t.toLowerCase();
    const rememberedDish = Object.values(memory || {}).find((m) => {
      const dl = m.dish.toLowerCase();
      return tl.includes(dl) || dl.includes(tl);
    });
    if (rememberedDish) {
      const items = parseAiItems({ items: rememberedDish.items, allergens: [] });
      const found = detectAllergens(items.map((x) => x.name).join(" "));
      setRes({ dish: rememberedDish.dish, items, found, note: "Использованы твои сохранённые значения для этого блюда." });
      setStatus("result");
      setRemembered(true);
      onUsed();
      return;
    }
    // Текстовый ввод сначала пробуем встроенной локальной базой — бесплатно, мгновенно, офлайн.
    // Но используем её результат только если она разобрала ВЕСЬ текст (local.allMatched):
    // полсотни слов в словаре и регулярки не осилят список без запятых, непривычную
    // формулировку или просто незнакомое слово — раньше в этом случае либо показывалась
    // жёсткая ошибка, либо (из-за бага в самих регулярках) мог тихо получиться дикий вес вроде
    // 15000 г риса из «150 грамм». Теперь в обоих случаях текст уходит в ИИ — он справляется
    // со свободной речью на порядок лучше словарного разбора.
    const local = parseLocalFoodText(t);
    if (local && local.allMatched) {
      const items = parseAiItems(local);
      const found = [...new Set([...(local.allergens || []), ...detectAllergens(items.map(x=>x.name).join(" "))])];
      setRes({ dish: local.dish, items, found, note: local.note });
      setStatus("result");
      onUsed();
      return;
    }
    analyze([{ type: "text", text: FOOD_TEXT_PROMPT + memoryHintText(memory) + `\n\nЗапись пользователя: ${t}` }]);
  };

  useEffect(() => { if (init.image) analyzePhoto(); }, []);

  const setItem = (key, patch) => setRes((x) => ({ ...x, items: x.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  const chosen = res ? res.items.filter((it) => it.include && toNum(it.grams) > 0) : [];
  const tot = chosen.reduce((a, it) => {
    const n = nutrientsFor(it.per100, toNum(it.grams));
    return { kcal: a.kcal + n.kcal, p: a.p + n.p, f: a.f + n.f, c: a.c + n.c };
  }, { kcal: 0, p: 0, f: 0, c: 0 });
  const addAll = () => onAddMany(chosen.map((it) => makeFoodEntry({
    name: it.name, per100: it.per100, grams: toNum(it.grams), meal, source: init.image ? "photo" : "text",
  })));

  return (
    <Sheet T={T} title={status === "result" ? res.dish : "Подсчёт КБЖУ"} onClose={onClose}>
      {init.image && (
        <img src={init.image} alt="Фото еды" className="w-full rounded-2xl mt-3" style={{ height: 180, objectFit: "cover", border: `1px solid ${T.line}` }} />
      )}

      {status === "input" && (
        <div className="mt-3">
          <Muted size={13} className="mb-3">Напиши, что и сколько съел. Например: гречка 150 г, куриная грудка 120 г, огурец, чай с 2 ложками сахара.</Muted>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Что было на тарелке"
            className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-4"
            style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15, resize: "none", fontFamily: BODY }} />
          <Primary T={T} onClick={analyzeText} disabled={!text.trim()}>Посчитать КБЖУ</Primary>
        </div>
      )}

      {status === "loading" && <Loader T={T} text={init.image ? "Разбираю тарелку на продукты" : "Считаю калории и БЖУ"} />}

      {status === "error" && (
        <div className="py-6">
          <Muted className="text-center mb-6">{error}</Muted>
          <div className="flex flex-col gap-3">
            {init.image && <Primary T={T} onClick={analyzePhoto}>Попробовать снова</Primary>}
            {!init.image && !init.error && <Primary T={T} onClick={() => setStatus("input")}>Изменить описание</Primary>}
            <Ghost T={T} onClick={onClose}>Закрыть</Ghost>
          </div>
        </div>
      )}

      {status === "result" && (
        <div style={{ animation: "rise .3s ease-out" }}>
          <AllergyWarning found={res.found} allergies={allergies} />
          <div className="flex items-baseline gap-2 mt-4">
            <span style={{ fontFamily: DISPLAY, fontSize: 38, fontWeight: 600, textShadow: `0 0 24px ${T.a}66` }}>{Math.round(tot.kcal)}</span>
            <span style={{ color: MUTED }}>ккал</span>
          </div>
          <MacroChips p={tot.p} f={tot.f} c={tot.c} />

          <H2>Продукты</H2>
          <Muted size={12} className="mb-2">Поправь вес, если он отличается, — калории пересчитаются. Сними галочку с лишнего.</Muted>
          <div className="flex flex-col gap-2">
            {res.items.map((it) => {
              const n = nutrientsFor(it.per100, toNum(it.grams));
              return (
                <Card key={it.key} T={T} style={{ padding: "10px 12px", opacity: it.include ? 1 : 0.5 }}>
                  <div className="flex items-center gap-3">
                    <CheckBox T={T} on={it.include} size={22} onClick={() => setItem(it.key, { include: !it.include })} label={it.name} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{it.name}</div>
                      <Muted size={11}>
                        {it.per100.kcal} ккал на 100 г{it.confidence === "low" ? ", оценка приблизительная" : ""}{it.corrected ? ", калории уточнены по БЖУ" : ""}
                      </Muted>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{it.include ? n.kcal : 0}</span>
                  </div>
                  <div className="mt-2">
                    <NumberField T={T} label="Вес" value={it.grams} onChange={(v) => setItem(it.key, { grams: v })} unit="г" width={60} decimal={false} />
                  </div>
                </Card>
              );
            })}
          </div>
          <Muted size={12} className="mt-3">
            {res.note ? res.note + " " : ""}Оценка по фото приблизительная. Для упакованных продуктов точнее сканировать штрихкод.
          </Muted>
          {onRemember && (
            <div className="mt-3">
              <Ghost T={T} disabled={remembered || !chosen.length}
                onClick={() => { onRemember(res.dish, chosen); setRemembered(true); }}>
                {remembered ? <><Check size={16} /> Запомнено</> : <><Sparkles size={16} /> Запомнить это блюдо, чтобы в следующий раз было точнее</>}
              </Ghost>
            </div>
          )}
          <Segmented T={T} items={MEALS} value={meal} onChange={setMeal} />
          <Primary T={T} disabled={!chosen.length} onClick={addAll}>Добавить {chosen.length} {productsWord(chosen.length)}</Primary>
        </div>
      )}
    </Sheet>
  );
}

function RecipeSheet({ T, init, profile, left, onClose, onAdd, onAddShopping }) {
  const allergies = profile.allergies || [];
  const [recipe, setRecipe] = useState(init.recipe || null);
  const [status, setStatus] = useState(init.recipe ? "ready" : "loading");
  const [meal, setMeal] = useState(Number.isInteger(init.meal) ? init.meal : defaultMeal());
  const [errMsg, setErrMsg] = useState("");
  const [addedToShopping, setAddedToShopping] = useState(false);

  const generate = async () => {
    setStatus("loading");
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = normalizeRecipe(await askClaude(recipePrompt(profile, left, attempt > 0)));
        if (!r.ingredients.length) continue;
        // двойная проверка: ответ модели и собственный поиск аллергенов по ингредиентам
        const found = [...new Set([...r.allergens, ...detectAllergens(r.name + " " + r.ingredients.join(" "))])];
        if (allergies.some((a) => found.includes(a))) continue;
        setRecipe({ ...r, allergens: found, ai: true });
        setStatus("ready");
        return;
      } catch (e) { lastErr = e; }
    }
    setErrMsg(explainAiError(lastErr));
    setStatus("error");
  };

  useEffect(() => { if (!init.recipe) generate(); }, []);

  if (status === "loading") {
    return (
      <Sheet T={T} title="Рецепт под тебя" onClose={onClose}>
        <Loader T={T} text={allergies.length ? `Подбираю блюдо без аллергенов: ${alLabels(allergies)}` : "Подбираю блюдо под остаток дня"} />
      </Sheet>
    );
  }
  if (status === "error") {
    return (
      <Sheet T={T} title="Рецепт под тебя" onClose={onClose}>
        <Muted className="text-center py-6">{errMsg || "Не получилось подобрать безопасный рецепт. Попробуй ещё раз или выбери блюдо из списка."}</Muted>
        <div className="flex flex-col gap-3">
          <Primary T={T} onClick={generate}>Попробовать снова</Primary>
          <Ghost T={T} onClick={onClose}>Закрыть</Ghost>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet T={T} title={recipe.name} onClose={onClose}>
      <Muted size={13}>{recipe.time} мин, одна порция</Muted>
      <div className="flex items-baseline gap-2 mt-4">
        <span style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 600, textShadow: `0 0 24px ${T.a}66` }}>{recipe.kcal}</span>
        <span style={{ color: MUTED }}>ккал</span>
      </div>
      <MacroChips p={recipe.p} f={recipe.f} c={recipe.c} />

      {allergies.length > 0 ? (
        <div className="flex items-center gap-2 mt-4 rounded-xl px-3 py-2" style={{ border: `1px solid ${T.line}` }}>
          <Check size={14} color={T.a} className="flex-shrink-0" />
          <span style={{ fontSize: 13 }}>Без аллергенов: {alLabels(allergies)}</span>
        </div>
      ) : recipe.allergens.length > 0 && (
        <Muted size={12} className="mt-3">Содержит: {alLabels(recipe.allergens)}</Muted>
      )}

      <H2>Ингредиенты</H2>
      <div className="flex flex-col gap-2">
        {recipe.ingredients.map((x, i) => (
          <div key={i} className="flex gap-3 items-center" style={{ fontSize: 15 }}>
            <span className="rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: T.a }} />
            {x}
          </div>
        ))}
      </div>
      {onAddShopping && (
        <div className="mt-3">
          <Ghost T={T} onClick={() => { onAddShopping(recipe); setAddedToShopping(true); }}>
            {addedToShopping ? <><Check size={16} /> В списке покупок</> : <><ShoppingCart size={16} /> Добавить в список покупок</>}
          </Ghost>
        </div>
      )}

      <H2>Приготовление</H2>
      <div className="flex flex-col gap-3">
        {recipe.steps.map((s, i) => (
          <div key={i} className="flex gap-3">
            <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, border: `1px solid ${T.line}`, fontSize: 12, fontFamily: DISPLAY }}>{i + 1}</span>
            <span style={{ fontSize: 15, lineHeight: 1.45 }}>{s}</span>
          </div>
        ))}
      </div>

      {recipe.ai && <Muted size={12} className="mt-4">Рецепт составлен ИИ, КБЖУ примерные. Проверь состав продуктов по упаковке.</Muted>}

      <Segmented T={T} items={MEALS} value={meal} onChange={setMeal} />
      <div className="flex flex-col gap-3">
        <Primary T={T} onClick={() => onAdd({ name: recipe.name, kcal: recipe.kcal, p: recipe.p, f: recipe.f, c: recipe.c, meal })}>Добавить в дневник</Primary>
        {recipe.ai && <Ghost T={T} onClick={generate}><Sparkles size={16} /> Другой рецепт</Ghost>}
      </div>
    </Sheet>
  );
}

// Список покупок: рецепты на неделю превращаются в объединённый список ингредиентов,
// плюс можно дописать свои пункты вручную. Отметки и список сохраняются в st.shoppingList.
function ShoppingListSheet({ T, st, up, onClose }) {
  const sl = st.shoppingList || { recipes: [], checked: {}, custom: [] };
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const allergies = st.profile?.allergies || [];
  const items = shoppingIngredients(st);
  const checked = sl.checked || {};
  const plannedIds = new Set((sl.recipes || []).map((r) => r.id));

  const toggle = (key) => up((s) => {
    const cur = s.shoppingList || sl;
    return { shoppingList: { ...cur, checked: { ...(cur.checked || {}), [key]: !cur.checked?.[key] } } };
  });
  const addCustom = () => {
    const t = draft.trim();
    if (!t) return;
    up((s) => { const cur = s.shoppingList || sl; return { shoppingList: { ...cur, custom: [...(cur.custom || []), { id: "c" + Date.now(), text: t }] } }; });
    setDraft("");
  };
  const removeCustom = (id) => up((s) => {
    const cur = s.shoppingList || sl;
    const { ["c:" + id]: _drop, ...restChecked } = cur.checked || {};
    return { shoppingList: { ...cur, custom: (cur.custom || []).filter((c) => c.id !== id), checked: restChecked } };
  });
  const toggleRecipe = (r) => up((s) => {
    const cur = s.shoppingList || sl;
    const has = (cur.recipes || []).some((x) => x.id === r.id);
    const recipes = has ? (cur.recipes || []).filter((x) => x.id !== r.id) : [...(cur.recipes || []), { id: r.id, name: r.name, ingredients: r.ingredients }];
    return { shoppingList: { ...cur, recipes } };
  });
  const clearDone = () => up((s) => ({ shoppingList: { ...(s.shoppingList || sl), checked: {} } }));
  const clearAll = () => up(() => ({ shoppingList: { recipes: [], checked: {}, custom: [] } }));
  const doneCount = items.filter((i) => checked[i.key]).length;
  const dbRecipes = RECIPES.filter((r) => !r.allergens.some((a) => allergies.includes(a)));

  return (
    <Sheet T={T} title="Список покупок" sub="Выбери рецепты на неделю — ингредиенты соберутся в общий список. Можно дописать своё вручную." onClose={onClose}>
      <Ghost T={T} onClick={() => setPickerOpen((v) => !v)}>
        <BookOpen size={16} /> Рецепты в списке: {sl.recipes?.length || 0}
      </Ghost>

      {pickerOpen && (
        <div className="flex flex-col gap-2 mt-3 mb-1 max-h-56 overflow-y-auto no-scrollbar">
          {dbRecipes.map((r) => (
            <Card key={r.id} T={T} onClick={() => toggleRecipe(r)} className="flex items-center gap-3">
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium">{r.name}</div>
                <Muted size={11}>{r.ingredients.length} ингредиентов</Muted>
              </div>
              <CheckBox T={T} on={plannedIds.has(r.id)} onClick={() => toggleRecipe(r)} size={22} label={`Добавить в список: ${r.name}`} />
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3 mb-4">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Добавить своё, например «Молоко»" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={addCustom} aria-label="Добавить товар" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
      </div>

      {items.length === 0 ? (
        <Muted size={13} className="text-center py-4">Список пуст — выбери рецепты выше или добавь товар вручную.</Muted>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
              <CheckBox T={T} on={!!checked[it.key]} onClick={() => toggle(it.key)} size={22} label={it.text} />
              <span className="flex-1" style={{ fontSize: 14, textDecoration: checked[it.key] ? "line-through" : "none", opacity: checked[it.key] ? 0.5 : 1 }}>{it.text}</span>
              {it.custom && (
                <button onClick={() => removeCustom(it.id)} aria-label={`Удалить: ${it.text}`} className="flex-shrink-0"><X size={15} color={MUTED} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-4">
        {doneCount > 0 && <Ghost T={T} onClick={clearDone}>Снять отметки ({doneCount})</Ghost>}
        {items.length > 0 && <Ghost T={T} onClick={clearAll}><Trash2 size={16} /> Очистить весь список</Ghost>}
      </div>
    </Sheet>
  );
}

/* ============ Оплата ============ */
// RUB_PRICE, YEAR_SAVINGS_PCT и PRO_COMPARISON_ROWS — в src/plans.js (общие с лендингом сайта).
// Сравнение Free/Pro строится из тех же констант лимитов, что реально проверяет код.

const PAY_ERRORS = {
  platega_not_configured: "Оплата пока не подключена: на Netlify не заданы PLATEGA_MERCHANT_ID и PLATEGA_SECRET.",
  platega_auth: "Platega не принял ключи. Проверь PLATEGA_MERCHANT_ID и PLATEGA_SECRET на Netlify.",
  platega_error: "Платёжный сервис не ответил. Попробуй ещё раз через минуту.",
  platega_bad_response: "Платёжный сервис вернул неожиданный ответ. Попробуй ещё раз.",
};
const proUntilText = (ms) => new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

async function fetchProStatus(tx) {
  const r = await fetch(apiUrl(`/api/pro-status${tx ? `?tx=${encodeURIComponent(tx)}` : ""}`), { headers: authHeaders(), cache: "no-store" });
  if (!r.ok) throw new Error("status_" + r.status);
  return r.json();
}

// Последний известный статус Pro — на этом устройстве, отдельно для каждого аккаунта.
// Сервер остаётся главным: как только он ответил, кеш перезаписывается его ответом.
const PRO_CACHE_KEY = "ritm-pro-cache";
function readProCache() {
  try {
    const c = JSON.parse(localStorage.getItem(PRO_CACHE_KEY + userScope()) || "null");
    if (c?.until > Date.now()) return { active: true, until: c.until, plan: c.plan || null, cached: true };
  } catch (e) { /* нет кеша */ }
  return { active: false, until: 0 };
}
function writeProCache(p) {
  try { localStorage.setItem(PRO_CACHE_KEY + userScope(), JSON.stringify({ until: p?.active ? p.until || 0 : 0, plan: p?.plan || null, at: Date.now() })); } catch (e) { /* приватный режим */ }
}

// «Восстановить покупку»: сервер заново спрашивает Platega обо всех платежах человека
async function restorePurchaseApi() {
  const r = await fetch(apiUrl("/api/pro-status?restore=1"), { headers: authHeaders(), cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "restore_failed");
  return data;
}

// Поддержка (админ): найти человека, посмотреть его Pro и платежи, вернуть Pro
async function adminProApi(method, payload) {
  const isGet = method === "GET";
  const r = await fetch(apiUrl(`/api/admin-pro${isGet ? `?q=${encodeURIComponent(payload.q)}` : ""}`), {
    method,
    headers: authHeaders(isGet ? {} : { "Content-Type": "application/json" }),
    body: isGet ? undefined : JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "admin_pro_error");
  return data;
}

// Нужен ли вход, чтобы платить и активировать промокоды: на сайте Pro привязывается к Telegram-аккаунту,
// поэтому гостю сначала предлагаем войти через бота (в Mini App вход уже есть сам собой).
const needsLogin = () => isWeb() && !readSession();

/* ============ Промокоды на Pro ============
   Код создаётся админом прямо в приложении (экран доступен только тем, чей Telegram ID
   указан в ADMIN_TG_IDS на Netlify). Два типа:
   - "days"     — активируется один раз в Настройках → «Есть промокод?» и сразу даёт Pro
                  на указанное число дней (ручной способ выдать Pro, например, друзьям на пробу).
   - "discount" — вводится на экране оплаты и даёт скидку в процентах на обычную оплату через
                  Platega; списывается только после подтверждённой оплаты, не раньше. */
const PROMO_ERRORS = {
  promo_empty: "Введи код.",
  promo_not_found: "Такого кода нет — проверь, без ошибок ли он введён.",
  promo_used: "Этот код уже использован — каждый код работает только один раз.",
  promo_already_used: "Ты уже использовал этот код — повторно он тебе Pro/скидку не даст, даже если лимит на других людей ещё не исчерпан.",
  promo_is_discount: "Это промокод на скидку — он не даёт дни сразу. Введи его на экране оплаты Pro, перед нажатием «Оплатить».",
  promo_is_days: "Это промокод на дни Pro, а не на скидку — его нужно активировать в Настройках → «Есть промокод?», а не здесь.",
  bad_percent: "Скидка должна быть от 1 до 90%.",
  not_admin: "Этот экран недоступен: Telegram ID не в списке ADMIN_TG_IDS на Netlify.",
  admin_not_configured: "На Netlify не задана переменная ADMIN_TG_IDS — промокоды создавать некому.",
};
const telegramHeaders = () => authHeaders();

async function redeemPromoApi(code) {
  const r = await fetch("/api/redeem-promo", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...telegramHeaders() },
    body: JSON.stringify({ code }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "promo_error");
  return data;
}
// Проверяет код на скидку до оплаты (ничего не списывает) — чтобы показать новую цену.
async function checkPromoDiscountApi(code) {
  const r = await fetch("/api/check-promo-discount", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...telegramHeaders() },
    body: JSON.stringify({ code }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "promo_error");
  return data; // { code, percent }
}
async function fetchAdminPromoCodes() {
  const r = await fetch("/api/admin-promo", { headers: telegramHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "promo_error");
  return data.codes || [];
}
// opts: { type: "days", days } или { type: "discount", percent }
async function createPromoCodeApi(opts) {
  const r = await fetch("/api/admin-promo", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...telegramHeaders() },
    body: JSON.stringify(opts),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "promo_error");
  return data;
}

function RedeemPromoSheet({ T, onClose, onRedeemed }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [days, setDays] = useState(0);

  if (needsLogin()) {
    return (
      <Sheet T={T} title="Промокод на Pro" sub="Pro привязывается к твоему Telegram-аккаунту — войди, чтобы активировать код. Он заработает и на сайте, и в Mini App." onClose={onClose}>
        <TelegramLoginPanel T={T} after="redeemPromo" />
      </Sheet>
    );
  }

  const submit = async () => {
    if (!code.trim()) { setError(PROMO_ERRORS.promo_empty); return; }
    setStatus("loading");
    setError("");
    try {
      const r = await redeemPromoApi(code);
      setDays(r.days);
      setStatus("done");
      onRedeemed(r);
    } catch (e) {
      setStatus("error");
      setError(PROMO_ERRORS[e.message] || "Не получилось активировать код. Попробуй ещё раз.");
    }
  };

  if (status === "done") {
    return (
      <Sheet T={T} title="" onClose={onClose}>
        <div className="relative text-center py-6" style={{ animation: "rise .3s ease-out" }}>
          <Confetti T={T} />
          <div className="relative mx-auto rounded-full flex items-center justify-center mb-5 ritm-pop" style={{ width: 88, height: 88, background: T.grad, boxShadow: T.glow, color: T.on }}>
            <Crown size={38} />
          </div>
          <H1>Промокод активирован</H1>
          <Muted className="mt-2 mb-8">Добавлено {days} {daysWord(days)} Pro.</Muted>
          <Primary T={T} onClick={onClose}>Готово</Primary>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet T={T} title="Промокод на Pro" sub="Введи код — он одноразовый, дни Pro добавятся к уже оставшимся." onClose={onClose}>
      <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Например, AB3D-9KXQ" className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-3"
        style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 16, letterSpacing: 1, textTransform: "uppercase" }} />
      {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}
      <Primary T={T} onClick={submit} disabled={status === "loading"}>{status === "loading" ? "Проверяю…" : "Активировать"}</Primary>
    </Sheet>
  );
}

const PROMO_DAY_PRESETS = [1, 3, 7, 14, 30, 90];
const PROMO_DISCOUNT_PRESETS = [5, 10, 50];

const PROMO_COUNT_PRESETS = [1, 10, 50, 100];
// Сколько раз можно использовать ОДИН и тот же код — 1 (по умолчанию) — обычный одноразовый
// код; 10/50/100 — этот же код сработает у стольких разных людей (например, выложить один код
// в канал и дать его использовать первым 100 подписчикам).
const PROMO_USES_PRESETS = [1, 10, 50, 100];

function PromoAdminSheet({ T, onClose }) {
  const [type, setType] = useState("days"); // days | discount
  const [days, setDays] = useState(7);
  const [percent, setPercent] = useState(10);
  const [count, setCount] = useState(1); // сколько РАЗНЫХ одноразовых кодов создать за раз
  const [maxUses, setMaxUses] = useState(1); // сколько раз можно использовать КАЖДЫЙ из них
  const [codes, setCodes] = useState(null); // null = ещё грузится
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [justCreated, setJustCreated] = useState(null); // массив только что созданных записей, не null

  const load = () => fetchAdminPromoCodes().then(setCodes).catch((e) => { setError(PROMO_ERRORS[e.message] || "Не удалось загрузить список кодов."); setCodes([]); });
  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    setError("");
    try {
      const r = await createPromoCodeApi(type === "discount" ? { type: "discount", percent, count, maxUses } : { type: "days", days, count, maxUses });
      setJustCreated(r.codes || []);
      load();
    } catch (e) {
      setError(PROMO_ERRORS[e.message] || "Не удалось создать код.");
    } finally {
      setCreating(false);
    }
  };

  const copy = (text) => { try { navigator.clipboard?.writeText(text); } catch (e) {} };
  const codeLabel = (c) => c.type === "discount" ? `скидка ${c.percent}%` : `${c.days} ${daysWord(c.days)}`;
  const usesLabel = (c) => {
    const limit = Math.max(1, Number(c.maxUses) || 1);
    const used = Math.max(0, Number(c.uses) || (c.used ? 1 : 0));
    if (limit <= 1) return used > 0 ? `использован ${c.usedAt ? new Date(c.usedAt).toLocaleDateString("ru-RU") : ""}`.trim() : "не использован";
    return `${used} из ${limit} использований`;
  };

  return (
    <Sheet T={T} title="Промокоды (админ)" sub="Код «на дни» активируется в Настройках → «Есть промокод?» и сразу даёт Pro. Код «на скидку» вводится на экране оплаты и снижает цену — списывается только после реальной оплаты. По умолчанию каждый код одноразовый, но можно задать лимит — тогда один код сработает у нескольких разных людей." onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setType("days")} className="rounded-xl py-3 font-medium" style={{ border: `1px solid ${type === "days" ? T.a : T.line}`, background: type === "days" ? "rgba(255,255,255,0.07)" : T.card, color: "#fff" }}>На дни Pro</button>
        <button onClick={() => setType("discount")} className="rounded-xl py-3 font-medium" style={{ border: `1px solid ${type === "discount" ? T.a : T.line}`, background: type === "discount" ? "rgba(255,255,255,0.07)" : T.card, color: "#fff" }}>На скидку %</button>
      </div>

      {type === "days" ? (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {PROMO_DAY_PRESETS.map((d) => (
              <Chip key={d} T={T} on={days === d} onClick={() => setDays(d)}>{d} {daysWord(d)}</Chip>
            ))}
          </div>
          <div className="mb-4">
            <Stepper T={T} value={days} onChange={(v) => setDays(Math.min(365, v))} unit="дн." min={1} step={1} />
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {PROMO_DISCOUNT_PRESETS.map((p) => (
            <Chip key={p} T={T} on={percent === p} onClick={() => setPercent(p)}>−{p}%</Chip>
          ))}
        </div>
      )}

      <Muted size={12} className="mb-2">Сколько РАЗНЫХ кодов создать</Muted>
      <div className="flex flex-wrap gap-2 mb-4">
        {PROMO_COUNT_PRESETS.map((n) => (
          <Chip key={n} T={T} on={count === n} onClick={() => setCount(n)}>{n === 1 ? "1 код" : `${n} кодов`}</Chip>
        ))}
      </div>

      <Muted size={12} className="mb-2">Сколько раз можно использовать ОДИН код (разными людьми)</Muted>
      <div className="flex flex-wrap gap-2 mb-4">
        {PROMO_USES_PRESETS.map((n) => (
          <Chip key={n} T={T} on={maxUses === n} onClick={() => setMaxUses(n)}>{n === 1 ? "1 раз" : `${n} раз`}</Chip>
        ))}
      </div>
      {maxUses > 1 && (
        <Muted size={12} className="mb-4">
          {count === 1
            ? `Один код сработает у первых ${maxUses} разных людей, которые его введут — каждый человек может использовать его только один раз.`
            : `Каждый из ${count} кодов сработает у первых ${maxUses} разных людей — не только у одного человека.`}
        </Muted>
      )}

      <div className="mb-4">
        <Primary T={T} onClick={create} disabled={creating}>
          {creating ? "Создаю…" : count === 1 ? "Создать код" : `Создать ${count} кодов`}
        </Primary>
      </div>

      {justCreated && justCreated.length > 0 && (
        <Card T={T} className="mb-4" style={{ border: `1px solid ${T.a}88`, boxShadow: T.glow }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <Muted size={12}>
              {justCreated.length === 1 ? `Новый код: ${codeLabel(justCreated[0])}` : `Создано ${justCreated.length} кодов: ${codeLabel(justCreated[0])}`}
            </Muted>
            <button onClick={() => copy(justCreated.map((c) => c.code).join("\n"))} aria-label="Скопировать все коды" className="rounded-xl px-3 py-2 flex-shrink-0" style={{ border: `1px solid ${T.line}`, color: "#fff" }}><Check size={16} /></button>
          </div>
          {justCreated.length === 1 ? (
            <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>{justCreated[0].code}</span>
          ) : (
            <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 160 }}>
              {justCreated.map((c) => (
                <span key={c.code} style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>{c.code}</span>
              ))}
            </div>
          )}
        </Card>
      )}

      {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}

      <H2>Созданные коды</H2>
      {codes === null ? (
        <Loader T={T} text="Загружаю…" />
      ) : codes.length === 0 ? (
        <Muted size={13}>Пока ни одного кода не создано.</Muted>
      ) : (
        <div className="flex flex-col gap-2">
          {codes.map((c) => (
            <Card key={c.code} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, letterSpacing: 0.5 }}>{c.code}</div>
                <Muted size={12}>{codeLabel(c)} · {usesLabel(c)}</Muted>
              </div>
              {(Math.max(0, Number(c.uses) || (c.used ? 1 : 0)) >= Math.max(1, Number(c.maxUses) || 1)) ? <Check size={16} color={MUTED} /> : <span className="rounded-full" style={{ width: 8, height: 8, background: T.a }} />}
            </Card>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/* ============ Статистика (админ) ============
   Тот же человек, что видит создание промокодов (PROMO_ADMIN_USERNAMES) — отдельного списка
   не делаем, это один и тот же админ. Реальная проверка — на сервере, по ADMIN_TG_IDS,
   как и у промокодов. */
async function fetchAdminStats() {
  const r = await fetch(apiUrl("/api/admin-stats"), { headers: telegramHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "stats_error");
  return data.stats;
}

const ADMIN_STATS_ERRORS = {
  not_admin: "Этот экран недоступен: Telegram ID не в списке ADMIN_TG_IDS на Netlify.",
  admin_not_configured: "На Netlify не задана переменная ADMIN_TG_IDS — считать активность некому.",
};

function AdminStatsSheet({ T, onClose }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchAdminStats().then(setStats).catch((e) => setError(ADMIN_STATS_ERRORS[e.message] || "Не удалось загрузить статистику."));
  }, []);
  return (
    <Sheet T={T} title="Статистика" sub="Считается по факту открытия приложения: человек попадает в счёт, как только впервые открыл RITM." onClose={onClose}>
      {error ? (
        <Muted size={13} style={{ color: T.a }}>{error}</Muted>
      ) : !stats ? (
        <Loader T={T} text="Загружаю…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatTile T={T} label="Всего регистраций" value={stats.total} />
            <StatTile T={T} label="С Pro" value={stats.pro} />
          </div>
          <H2>Активны сейчас</H2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatTile T={T} label="Сегодня" value={stats.dau} />
            <StatTile T={T} label="7 дней" value={stats.wau} />
            <StatTile T={T} label="30 дней" value={stats.mau} />
          </div>
          <H2>Новых за</H2>
          <div className="grid grid-cols-2 gap-3">
            <StatTile T={T} label="Сегодня" value={stats.newToday} />
            <StatTile T={T} label="7 дней" value={stats.newWeek} />
          </div>
          <Muted size={12} className="mt-4">«Активны» — те, кто открывал RITM за последние N дней от текущего момента (скользящее окно, не календарные сутки).</Muted>
        </>
      )}
    </Sheet>
  );
}

/* ============ Восстановление Pro ============
   «Восстановить покупку» — для самого человека: если он платил, а Pro не видна, сервер
   перепроверяет в Platega все его платежи и засчитывает оплаченные. «Pro пользователя» —
   для админа (ADMIN_TG_IDS): найти человека по @username или ID, увидеть его платежи и историю
   Pro, перепроверить оплату или выдать дни вручную. */
const RESTORE_ERRORS = {
  restore_too_often: "Проверка уже была минуту назад — подожди немного и попробуй снова.",
  auth_required: "Войди через Telegram, чтобы восстановить покупку.",
  user_not_found: "Не нашёл такого человека. Он должен хотя бы раз открыть RITM — или введи его числовой Telegram ID.",
  not_admin: "Этот экран недоступен: Telegram ID не в списке ADMIN_TG_IDS на Netlify.",
  admin_not_configured: "На Netlify не задана переменная ADMIN_TG_IDS.",
  bad_days: "Количество дней — от 1 до 730.",
};

function RestorePurchaseButton({ T, onRestored }) {
  const [state, setState] = useState("idle"); // idle | loading | done | none | error
  const [msg, setMsg] = useState("");
  const run = async () => {
    setState("loading");
    setMsg("");
    try {
      const r = await restorePurchaseApi();
      onRestored?.(r);
      if (r.restored?.granted > 0) { setState("done"); setMsg(`Нашёл оплату — Pro активна до ${proUntilText(r.until)}.`); }
      else if (r.active) { setState("done"); setMsg(`Pro уже активна до ${proUntilText(r.until)}.`); }
      else { setState("none"); setMsg(`Оплаченных платежей не нашлось. Если ты платил — напиши в поддержку ${LEGAL.support} и приложи чек из банка, вернём Pro вручную.`); }
    } catch (e) {
      setState("error");
      setMsg(RESTORE_ERRORS[e.message] || "Не получилось проверить. Попробуй через минуту.");
    }
  };
  return (
    <div className="mt-2">
      <Ghost T={T} onClick={run} disabled={state === "loading"}>
        <RotateCcw size={16} className={state === "loading" ? "ritm-spin" : ""} /> {state === "loading" ? "Проверяю оплату…" : "Восстановить покупку"}
      </Ghost>
      {msg && <Muted size={12} className="mt-2" style={{ color: state === "done" ? T.a : undefined, animation: "rise .3s ease-out" }}>{msg}</Muted>}
    </div>
  );
}

const PAY_STATUS_LABEL = { CONFIRMED: "оплачен", CHARGEBACKED: "возврат", CANCELED: "отменён", PENDING: "не подтверждён" };
const PRO_SOURCE_LABEL = { payment: "оплата", promo: "промокод", admin: "выдано вручную", chargeback: "возврат денег" };

function AdminProSheet({ T, onClose }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [info, setInfo] = useState("");
  const call = async (fn) => {
    setBusy(true); setError(""); setInfo("");
    try { await fn(); } catch (e) { setError(RESTORE_ERRORS[e.message] || "Не получилось. Попробуй ещё раз."); }
    finally { setBusy(false); }
  };
  const find = () => q.trim() && call(async () => setData(await adminProApi("GET", { q: q.trim() })));
  const reconcile = () => call(async () => {
    const r = await adminProApi("POST", { action: "reconcile", userId: data.user.id });
    setData(r);
    setInfo(r.reconcile?.granted > 0 ? `Найдено и засчитано оплат: ${r.reconcile.granted}. Человеку ушло сообщение в Telegram.` : `Проверено платежей: ${r.reconcile?.checked?.length || 0}. Новых оплаченных нет — если человек платил, выдай дни вручную ниже.`);
  });
  const grant = () => call(async () => {
    const r = await adminProApi("POST", { action: "grant", userId: data.user.id, days, note });
    setData(r);
    setInfo(`Готово: Pro до ${proUntilText(r.pro.until)}. Человеку ушло сообщение в Telegram.`);
    setNote("");
  });
  const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <Sheet T={T} title="Pro пользователя" sub="Найди человека по @username или Telegram ID: увидишь его Pro, историю выдач и платежи. Сначала попробуй «Найти оплату в Platega» — так Pro вернётся по реальному платежу." onClose={onClose}>
      <div className="flex gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="@username или ID"
          className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={find} disabled={busy} className="rounded-xl px-4 font-semibold ritm-press" style={{ background: T.grad, color: T.on, opacity: busy ? 0.6 : 1 }}>Найти</button>
      </div>
      {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}
      {busy && !data && <Loader T={T} text="Ищу…" />}
      {data && (
        <div style={{ animation: "rise .3s ease-out" }}>
          <Card T={T} className="mb-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: T.grad, color: T.on, fontWeight: 700 }}>
                {(data.user.firstName || data.user.username || "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{data.user.firstName || "Без имени"} {data.user.username && <span style={{ color: MUTED, fontWeight: 500 }}>@{data.user.username}</span>}</div>
                <Muted size={12}>ID {data.user.id} · последний вход {fmtDate(data.user.lastSeenAt)}</Muted>
              </div>
            </div>
            <div className="mt-3 rounded-xl px-3 py-2" style={{ background: data.pro.active ? `${T.a}1A` : "rgba(255,255,255,0.04)", border: `1px solid ${data.pro.active ? `${T.a}55` : T.line}` }}>
              <div className="font-semibold" style={{ fontSize: 14, color: data.pro.active ? T.a : "#fff" }}>
                {data.pro.active ? `Pro активна до ${proUntilText(data.pro.until)}` : data.pro.until ? `Pro закончилась ${proUntilText(data.pro.until)}` : "Pro не было"}
              </div>
            </div>
          </Card>

          <Primary T={T} onClick={reconcile} disabled={busy}><RotateCcw size={16} /> Найти оплату в Platega</Primary>

          <H2>Выдать вручную</H2>
          <div className="flex flex-wrap gap-2 mb-3">
            {[7, 30, 90, 365].map((d) => <Chip key={d} T={T} on={days === d} onClick={() => setDays(d)}>{d} {daysWord(d)}</Chip>)}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Причина (видна только в истории)"
            className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-3" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 14 }} />
          <Ghost T={T} onClick={grant} disabled={busy}><Crown size={16} /> Выдать {days} {daysWord(days)} Pro</Ghost>
          {info && <Muted size={13} className="mt-3" style={{ color: T.a, animation: "rise .3s ease-out" }}>{info}</Muted>}

          <H2>Платежи</H2>
          {data.payments.length === 0 ? <Muted size={13}>Платежей через Platega за этим человеком нет.</Muted> : (
            <div className="flex flex-col gap-2">
              {data.payments.map((p) => (
                <Card key={p.id} T={T} style={{ padding: "10px 14px" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.plan === "year" ? "Год" : p.plan === "month" ? "Месяц" : p.plan || "—"}{p.amount ? ` · ${p.amount} ₽` : ""}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: p.status === "CONFIRMED" ? T.a : MUTED }}>{PAY_STATUS_LABEL[p.status] || p.status}</span>
                  </div>
                  <Muted size={11}>{fmtDate(p.at)} · {p.id}</Muted>
                </Card>
              ))}
            </div>
          )}

          <H2>История Pro</H2>
          {data.pro.history.length === 0 ? <Muted size={13}>История пустая (выдачи до этого обновления не записывались).</Muted> : (
            <div className="flex flex-col gap-1.5">
              {data.pro.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-2" style={{ fontSize: 13 }}>
                  <span>{h.days > 0 ? "+" : ""}{h.days} {daysWord(Math.abs(h.days))} · {PRO_SOURCE_LABEL[h.source] || h.source || "—"}{h.note ? ` · ${h.note}` : ""}</span>
                  <span style={{ color: MUTED, fontSize: 12 }}>{fmtDate(h.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ============ Перенос со старого сайта Netlify (админ) ============
   При переезде на новый аккаунт/сайт Netlify серверные данные (Pro, данные аккаунтов сайта, промокоды,
   друзья, чат, статистика) остаются на старом сайте — см. netlify/functions/admin-migrate.mjs. */
const MIGRATE_LABELS = {
  "ritm-pro": "Подписки Pro и платежи", "ritm-data": "Данные аккаунтов (сайт)", "ritm-users": "Пользователи и статистика",
  "ritm-promo": "Промокоды", "ritm-friends": "Друзья", "ritm-chat": "Чат", "ritm-plans": "Совместные тренировки",
  "ritm-goals": "Общие цели", "ritm-products": "База товаров по штрихкоду", "ritm-reminders": "Напоминания",
};
const MIGRATE_ERRORS = {
  migrate_not_configured: "На этом (новом) сайте не заданы переменные MIGRATE_FROM_SITE_ID и MIGRATE_FROM_TOKEN — см. инструкцию выше.",
  migrate_no_access: "Нет доступа к старому сайту: проверь MIGRATE_FROM_SITE_ID (ID старого сайта) и MIGRATE_FROM_TOKEN (токен старого аккаунта), потом сделай новый деплой.",
  not_admin: "Этот экран недоступен: Telegram ID не в списке ADMIN_TG_IDS на Netlify.",
  admin_not_configured: "На Netlify не задана переменная ADMIN_TG_IDS.",
};
async function adminMigrateApi(payload) {
  const r = await fetch(apiUrl("/api/admin-migrate"), payload
    ? { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(payload) }
    : { headers: authHeaders(), cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || "migrate_error"), { detail: data.detail });
  return data;
}

function AdminMigrateSheet({ T, onClose, onDone }) {
  const [check, setCheck] = useState(null); // { stores, counts } | { error }
  const [progress, setProgress] = useState({}); // store → { done, total, copied, merged }
  const [state, setState] = useState("idle"); // idle | running | done | error
  const [error, setError] = useState("");
  const load = () => adminMigrateApi().then(setCheck).catch((e) => setCheck({ error: MIGRATE_ERRORS[e.message] || `Не получилось: ${e.detail || e.message}` }));
  useEffect(() => { load(); }, []);

  const run = async () => {
    setState("running"); setError("");
    try {
      for (const store of check.stores) {
        let offset = 0, copied = 0, merged = 0;
        for (let guard = 0; guard < 2000; guard++) {
          const r = await adminMigrateApi({ store, offset });
          copied += r.copied; merged += r.merged; offset = r.nextOffset;
          setProgress((p) => ({ ...p, [store]: { done: r.nextOffset, total: r.total, copied, merged } }));
          if (r.done) break;
        }
      }
      setState("done");
      onDone?.();
    } catch (e) {
      setState("error");
      setError(MIGRATE_ERRORS[e.message] || `Перенос остановился: ${e.detail || e.message}. Нажми ещё раз — уже перенесённое не задвоится.`);
    }
  };
  const totals = Object.values(progress).reduce((a, p) => ({ copied: a.copied + p.copied, merged: a.merged + p.merged }), { copied: 0, merged: 0 });

  return (
    <Sheet T={T} title="Перенос со старого сайта" sub="Netlify хранит данные внутри сайта: при переезде на новый аккаунт Pro, данные аккаунтов, промокоды, друзья и чат остались на старом сайте. Здесь они копируются сюда. Повторный запуск безопасен — ничего не задваивается и не затирается." onClose={onClose}>
      <Card T={T} className="mb-4">
        <div className="font-semibold mb-2" style={{ fontSize: 14 }}>Один раз на новом сайте Netlify</div>
        <ol style={{ fontSize: 13, color: "rgba(255,255,255,.78)", paddingLeft: 18, listStyle: "decimal", lineHeight: 1.55 }}>
          <li>В <b>старом</b> аккаунте: сайт → Site configuration → Site details → скопируй <b>Site ID</b>.</li>
          <li>Там же: аватар → User settings → Applications → Personal access tokens → <b>New access token</b>.</li>
          <li>В <b>новом</b> сайте: Environment variables → <code>MIGRATE_FROM_SITE_ID</code> и <code>MIGRATE_FROM_TOKEN</code> → деплой.</li>
        </ol>
      </Card>
      {!check ? <Loader T={T} text="Проверяю доступ к старому сайту…" /> : check.error ? (
        <>
          <Muted size={13} className="mb-3" style={{ color: T.a }}>{check.error}</Muted>
          <Ghost T={T} onClick={() => { setCheck(null); load(); }}><RefreshCcw size={16} /> Проверить ещё раз</Ghost>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-4">
            {check.stores.map((s) => {
              const p = progress[s];
              const total = p?.total ?? check.counts[s] ?? 0;
              const pct = total ? Math.round(((p?.done || 0) / total) * 100) : p ? 100 : 0;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
                    <span>{MIGRATE_LABELS[s] || s}</span>
                    <span style={{ color: MUTED }}>{p ? `${p.done} из ${total}` : `${total} зап.`}</span>
                  </div>
                  <div className="rounded-full mt-1 overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: T.grad, transition: "width .3s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
          {state === "done" ? (
            <Card T={T} style={{ border: `1px solid ${T.a}55` }}>
              <div className="font-semibold" style={{ color: T.a }}>Перенос завершён</div>
              <Muted size={13} className="mt-1">Скопировано записей: {totals.copied}, объединено с уже существующими: {totals.merged}. Теперь переменные MIGRATE_FROM_* можно удалить, а токен — отозвать в старом аккаунте. Старый сайт пока не удаляй — пусть побудет запасной копией.</Muted>
            </Card>
          ) : (
            <Primary T={T} onClick={run} disabled={state === "running"}>
              {state === "running" ? <><RefreshCcw size={16} className="ritm-spin" /> Переношу…</> : "Перенести данные"}
            </Primary>
          )}
          {error && <Muted size={13} className="mt-3" style={{ color: T.a }}>{error}</Muted>}
        </>
      )}
    </Sheet>
  );
}

/* ============ Друзья ============
   Добавление — по Telegram-username, с заявкой и подтверждением в обе стороны: пока вторая
   сторона не примет заявку, профили друг другу не видны. Что именно видно в профиле друга —
   настраивает сам человек (st.friendsPrivacy, см. buildFriendSnapshot выше); сервер хранит
   только то, что уже прошло через этот фильтр на клиенте.
   Доступно только в Telegram Mini App — у отдельного iOS/Windows-приложения нет постоянного
   Telegram ID, по которому друга можно было бы найти или которым можно было бы назваться. */
async function friendsAction(action, payload) {
  const r = await fetch(apiUrl("/api/friends"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...telegramHeaders() },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "friends_error");
  return data;
}
async function fetchFriendsState() {
  const r = await fetch(apiUrl("/api/friends"), { headers: telegramHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "friends_error");
  return data;
}
const sendFriendRequestApi = (username) => friendsAction("request", { username });
const acceptFriendRequestApi = (fromId) => friendsAction("accept", { fromId });
const declineFriendRequestApi = (fromId) => friendsAction("decline", { fromId });
const removeFriendApi = (friendId) => friendsAction("remove", { friendId });
// «Пинг» для статистики — не критично, если не дошёл (посчитаемся активными в другой раз).
const touchUserApi = (pro) => fetch(apiUrl("/api/user-touch"), { method: "POST", headers: { "Content-Type": "application/json", ...telegramHeaders() }, body: JSON.stringify({ pro: !!pro }) }).catch(() => {});
// Публикация карточки прогресса тоже не критична — если не дошла, друзья просто увидят
// прошлую версию до следующей успешной попытки через 900 мс после любого изменения.
const publishSnapshotApi = (snapshot) => friendsAction("publish", { snapshot }).catch(() => {});

const FRIEND_ERRORS = {
  username_empty: "Введи имя пользователя.",
  user_not_found: "Такой пользователь не найден — чтобы его можно было найти, он должен хотя бы раз открыть RITM.",
  self: "Нельзя добавить в друзья самого себя.",
  already_friends: "Вы уже друзья.",
  already_pending: "Заявка уже отправлена этому человеку — остаётся подождать, пока он её примет.",
  incoming_exists: "Этот человек уже отправил тебе заявку — прими её ниже, в списке заявок, вместо того чтобы отправлять свою.",
  telegram_no_init_data: "Не получилось подтвердить, что это ты — попробуй переоткрыть приложение.",
  telegram_bad_signature: "Не получилось подтвердить, что это ты — попробуй переоткрыть приложение.",
  telegram_expired: "Сессия устарела — переоткрой приложение и попробуй снова.",
};

/* ============ Чат, общие тренировки и общие цели с друзьями ============
   Три отдельных API поверх той же дружбы. Общий принцип по всем трём: сервер только хранит
   и проверяет диапазоны, а что считать и показывать — решает клиент (как и карточка профиля
   друга выше). */
async function chatAction(opts = {}) {
  const qs = opts.params ? `?${new URLSearchParams(opts.params).toString()}` : "";
  const r = await fetch(apiUrl(`/api/chat${qs}`), { method: opts.method || "GET", headers: opts.method === "POST" ? { "Content-Type": "application/json", ...telegramHeaders() } : telegramHeaders(), body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "chat_error");
  return data;
}
const fetchChatList = () => chatAction({ params: { action: "list" } }).then((d) => d.conversations || []);
const fetchChatMessages = (withId, sinceAt) => chatAction({ params: sinceAt ? { with: withId, sinceAt } : { with: withId } }).then((d) => d.messages || []);
const sendChatMessageApi = (to, text) => chatAction({ method: "POST", body: { to, text } });

async function plansAction(opts = {}) {
  const r = await fetch(apiUrl("/api/plans"), { method: opts.method || "GET", headers: opts.method === "POST" ? { "Content-Type": "application/json", ...telegramHeaders() } : telegramHeaders(), body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "plans_error");
  return data;
}
const fetchPlans = () => plansAction().then((d) => d.plans || []);
const createPlanApi = (friendId, days) => plansAction({ method: "POST", body: { action: "create", friendId, days } }).then((d) => d.plan);
const setPlanDaysApi = (planId, days) => plansAction({ method: "POST", body: { action: "setDays", planId, days } }).then((d) => d.plan);
const leavePlanApi = (planId) => plansAction({ method: "POST", body: { action: "leave", planId } });

async function goalsAction(opts = {}) {
  const r = await fetch(apiUrl("/api/goals"), { method: opts.method || "GET", headers: opts.method === "POST" ? { "Content-Type": "application/json", ...telegramHeaders() } : telegramHeaders(), body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "goals_error");
  return data;
}
const fetchGoals = () => goalsAction().then((d) => d.goals || []);
const createGoalApi = (opts) => goalsAction({ method: "POST", body: { action: "create", ...opts } }).then((d) => d.goal);
const publishGoalProgressApi = (goalId, value) => goalsAction({ method: "POST", body: { action: "publishProgress", goalId, value } }).catch(() => {});
const leaveGoalApi = (goalId) => goalsAction({ method: "POST", body: { action: "leave", goalId } });

const GOAL_METRICS = [["workouts", "Тренировки"], ["runs", "Пробежки"]];

const FRIEND_PRIVACY_FIELDS = [
  { key: "streak", title: "Серии тренировок и бега", sub: "Сколько дней подряд тренируешься и бегаешь сейчас" },
  { key: "workouts", title: "Тренировки и рекорды", sub: "Сколько всего тренировок, пробежек и личных рекордов" },
  { key: "habits", title: "Привычки", sub: "Лучшая текущая серия привычки" },
  { key: "achievements", title: "Достижения", sub: "Какие значки уже открыты" },
  { key: "weight", title: "Вес тела", sub: "Текущий вес и изменение за 30 дней — по умолчанию скрыт" },
  { key: "weekStatus", title: "Эта неделя тренировок", sub: "Какие дни этой недели отмечены — нужно для общего календаря тренировок с другом" },
];

function FriendStatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Muted size={13}>{label}</Muted>
      <span className="font-semibold" style={{ fontSize: 14 }}>{value}</span>
    </div>
  );
}

function FriendAvatar({ T, name, size = 40 }) {
  return (
    <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: T.grad, boxShadow: T.glow, color: T.on, fontSize: size * 0.4, fontWeight: 700 }}>
      {(name || "?").trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

function FriendProfileView({ T, friend, onBack, onWrite, onRemove }) {
  const s = friend.stats || {};
  const has = (k) => s[k] !== undefined;
  const nothingShared = !has("trainStreak") && !has("totalTrainings") && !has("habitStreak") && !has("achievementsUnlocked") && !has("weightCurrent");
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 mb-3" style={{ color: MUTED, fontSize: 13, background: "none" }}>
        <ChevronLeft size={16} /> Все друзья
      </button>
      <div className="flex items-center gap-3 mb-4">
        <FriendAvatar T={T} name={friend.firstName || friend.username} size={52} />
        <div>
          <div className="font-semibold" style={{ fontSize: 17 }}>{friend.firstName || "Без имени"}</div>
          {friend.username && <Muted size={13}>@{friend.username}</Muted>}
        </div>
      </div>

      {nothingShared ? (
        <Muted size={13} className="mb-4">Этот человек пока ничего не показывает в профиле — зависит от его настроек приватности.</Muted>
      ) : (
        <Card T={T} className="mb-4">
          {has("trainStreak") && <FriendStatRow label="Серия силовых тренировок" value={`${s.trainStreak} дн.`} />}
          {has("runStreak") && <FriendStatRow label="Серия пробежек" value={`${s.runStreak} дн.`} />}
          {has("totalTrainings") && <FriendStatRow label="Тренировок всего" value={s.totalTrainings} />}
          {has("totalRuns") && <FriendStatRow label="Пробежек всего" value={s.totalRuns} />}
          {has("prCount") && <FriendStatRow label="Личных рекордов" value={s.prCount} />}
          {has("habitStreak") && <FriendStatRow label="Лучшая серия привычки" value={`${s.habitStreak} дн.`} />}
          {has("weightCurrent") && <FriendStatRow label="Текущий вес" value={`${fmt(String(s.weightCurrent))} кг`} />}
          {has("weightChange30d") && <FriendStatRow label="Изменение за 30 дней" value={`${s.weightChange30d > 0 ? "+" : ""}${fmt(String(s.weightChange30d))} кг`} />}
        </Card>
      )}

      {has("achievementsUnlocked") && (
        <>
          <H2>Достижения ({s.achievementsUnlocked} из {ACHIEVEMENTS.length})</H2>
          <div className="grid grid-cols-2 gap-3 mb-2">
            {ACHIEVEMENTS.filter((a) => (s.achievementIds || []).includes(a.id)).map((a) => {
              const Icon = a.icon;
              return (
                <Card key={a.id} T={T}>
                  <div className="flex flex-col items-center text-center gap-2 py-2">
                    <span className="rounded-full flex items-center justify-center" style={{ width: 44, height: 44, background: T.grad, boxShadow: T.glow }}>
                      <Icon size={20} color={T.on} />
                    </span>
                    <div className="font-semibold" style={{ fontSize: 12 }}>{a.title}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Ghost T={T} onClick={onWrite}><Send size={16} /> Написать</Ghost>
        <Ghost T={T} onClick={onRemove}><Trash2 size={16} /> Удалить из друзей</Ghost>
      </div>
    </div>
  );
}

function FriendsListSection({ T, st, up, data, error, reload, onWriteTo }) {
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [sendIsError, setSendIsError] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const submitAdd = async () => {
    const u = username.trim();
    if (!u) { setSendIsError(true); setSendMsg(FRIEND_ERRORS.username_empty); return; }
    setSending(true); setSendIsError(false); setSendMsg("");
    try {
      await sendFriendRequestApi(u);
      setUsername("");
      setSendMsg("Заявка отправлена.");
      reload();
    } catch (e) {
      setSendIsError(true);
      setSendMsg(FRIEND_ERRORS[e.message] || "Не удалось отправить заявку.");
    } finally {
      setSending(false);
    }
  };

  const privacy = st.friendsPrivacy || DEFAULT.friendsPrivacy;
  const setPrivacy = (key, val) => up((s) => ({ friendsPrivacy: { ...DEFAULT.friendsPrivacy, ...(s.friendsPrivacy || {}), [key]: val } }));

  if (viewing) {
    return (
      <FriendProfileView T={T} friend={viewing} onBack={() => setViewing(null)}
        onWrite={() => onWriteTo(viewing)}
        onRemove={async () => { await removeFriendApi(viewing.id).catch(() => {}); setViewing(null); reload(); }} />
    );
  }

  return (
    <div className="mt-4">
      <Muted size={13} className="mb-3">Добавь друга по Telegram-имени — он получит заявку и должен подтвердить её, прежде чем вы увидите профили друг друга.</Muted>
      <div className="flex gap-2 mb-2">
        <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAdd()}
          placeholder="@username" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={submitAdd} disabled={sending} aria-label="Отправить заявку в друзья" className="rounded-xl px-4 flex items-center justify-center flex-shrink-0" style={{ background: T.grad, color: T.on, boxShadow: T.glow, opacity: sending ? 0.6 : 1 }}>
          <UserPlus size={18} />
        </button>
      </div>
      {sendMsg && <Muted size={13} className="mb-3" style={{ color: sendIsError ? T.a : MUTED }}>{sendMsg}</Muted>}

      <div className="mb-4">
        <Ghost T={T} onClick={() => setShowPrivacy((v) => !v)}>
          <Eye size={16} /> {showPrivacy ? "Скрыть настройки приватности" : "Что видно друзьям"}
        </Ghost>
      </div>
      {showPrivacy && (
        <Card T={T} className="mb-4">
          {FRIEND_PRIVACY_FIELDS.map((f, i) => (
            <div key={f.key} className="flex items-center gap-3 py-2.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}>
              <div className="flex-1">
                <div className="font-medium" style={{ fontSize: 14 }}>{f.title}</div>
                <Muted size={12}>{f.sub}</Muted>
              </div>
              <Toggle T={T} on={!!privacy[f.key]} onChange={(v) => setPrivacy(f.key, v)} label={f.title} />
            </div>
          ))}
        </Card>
      )}

      {data === null ? (
        <Loader T={T} text="Загружаю…" />
      ) : (
        <>
          {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}

          {data.incoming.length > 0 && (
            <>
              <H2>Заявки в друзья</H2>
              <div className="flex flex-col gap-2 mb-2">
                {data.incoming.map((r) => (
                  <Card key={r.id} T={T} className="flex items-center gap-3">
                    <FriendAvatar T={T} name={r.firstName || r.username} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{r.firstName || "Без имени"}</div>
                      {r.username && <Muted size={12}>@{r.username}</Muted>}
                    </div>
                    <button onClick={async () => { await acceptFriendRequestApi(r.id).catch(() => {}); reload(); }} aria-label="Принять заявку" className="rounded-full p-2 flex-shrink-0" style={{ background: T.grad, color: T.on }}><Check size={16} /></button>
                    <button onClick={async () => { await declineFriendRequestApi(r.id).catch(() => {}); reload(); }} aria-label="Отклонить заявку" className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={16} /></button>
                  </Card>
                ))}
              </div>
            </>
          )}

          {data.outgoing.length > 0 && (
            <>
              <H2>Исходящие заявки</H2>
              <div className="flex flex-col gap-2 mb-2">
                {data.outgoing.map((r) => (
                  <Card key={r.id} T={T} className="flex items-center gap-3">
                    <FriendAvatar T={T} name={r.firstName || r.username} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{r.firstName || "Без имени"}</div>
                      <Muted size={12}>Ожидает подтверждения</Muted>
                    </div>
                    <button onClick={async () => { await declineFriendRequestApi(r.id).catch(() => {}); reload(); }} aria-label="Отозвать заявку" className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={16} /></button>
                  </Card>
                ))}
              </div>
            </>
          )}

          <H2>Друзья {data.friends.length > 0 ? `(${data.friends.length})` : ""}</H2>
          {data.friends.length === 0 ? (
            <Muted size={13}>Пока никого — добавь первого друга по имени выше.</Muted>
          ) : (
            <div className="flex flex-col gap-2">
              {data.friends.map((f) => (
                <Card key={f.id} T={T} onClick={() => setViewing(f)} className="flex items-center gap-3">
                  <FriendAvatar T={T} name={f.firstName || f.username} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-medium">{f.firstName || "Без имени"}</div>
                    <Muted size={12}>{f.stats?.trainStreak !== undefined ? `Серия тренировок: ${f.stats.trainStreak} дн.` : f.username ? `@${f.username}` : "Профиль скрыт настройками приватности"}</Muted>
                  </div>
                  <ChevronRight size={18} color={MUTED} />
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---- Чат ---- */
function ChatConversation({ T, friend, onBack }) {
  const [messages, setMessages] = useState(null); // null = загрузка
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastAtRef = useRef(0);
  const listRef = useRef(null);

  const poll = async (initial) => {
    try {
      const msgs = await fetchChatMessages(friend.id, initial ? 0 : lastAtRef.current);
      if (msgs.length) {
        lastAtRef.current = msgs[msgs.length - 1].at;
        setMessages((prev) => (initial ? msgs : [...(prev || []), ...msgs]));
      } else if (initial) {
        setMessages([]);
      }
      setError("");
    } catch (e) {
      setError("Не удалось обновить переписку.");
    }
  };

  useEffect(() => {
    poll(true);
    // Поллинг, а не настоящий real-time — Netlify Functions не держат постоянное соединение.
    // Раз в 4 секунды, пока открыт именно этот диалог.
    const timer = setInterval(() => poll(false), 4000);
    return () => clearInterval(timer);
  }, [friend.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const r = await sendChatMessageApi(friend.id, t);
      setText("");
      lastAtRef.current = r.message.at;
      setMessages((prev) => [...(prev || []), r.message]);
    } catch (e) {
      setError("Не удалось отправить — попробуй ещё раз.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 320 }}>
      <button onClick={onBack} className="flex items-center gap-1 mb-3 flex-shrink-0" style={{ color: MUTED, fontSize: 13, background: "none" }}>
        <ChevronLeft size={16} /> Все чаты
      </button>
      <div className="flex items-center gap-3 mb-3 flex-shrink-0">
        <FriendAvatar T={T} name={friend.firstName || friend.username} />
        <div className="font-semibold">{friend.firstName || friend.username || "Без имени"}</div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 pb-3">
        {messages === null ? (
          <Loader T={T} text="Загружаю…" />
        ) : messages.length === 0 ? (
          <Muted size={13} className="text-center mt-6">Сообщений пока нет — напиши первым.</Muted>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-2xl px-3 py-2" style={{
              alignSelf: m.from === friend.id ? "flex-start" : "flex-end",
              maxWidth: "80%",
              background: m.from === friend.id ? "rgba(255,255,255,0.08)" : T.grad,
              color: m.from === friend.id ? "#fff" : T.on,
            }}>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{new Date(m.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))
        )}
      </div>
      {error && <Muted size={12} className="mb-1" style={{ color: T.a }}>{error}</Muted>}
      <div className="flex gap-2 flex-shrink-0">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Сообщение…" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={submit} disabled={sending || !text.trim()} aria-label="Отправить сообщение" className="rounded-xl px-4 flex items-center justify-center flex-shrink-0" style={{ background: T.grad, color: T.on, boxShadow: T.glow, opacity: sending || !text.trim() ? 0.6 : 1 }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function ChatSection({ T, pendingFriend, onPendingConsumed }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);

  const load = () => fetchChatList().then((d) => { setList(d); setError(""); }).catch(() => { setError("Не удалось загрузить список чатов."); setList([]); });
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (pendingFriend) {
      setActive(pendingFriend);
      onPendingConsumed();
    }
  }, [pendingFriend]);

  if (active) {
    return <ChatConversation T={T} friend={active} onBack={() => { setActive(null); load(); }} />;
  }

  return (
    <div className="mt-4">
      {list === null ? (
        <Loader T={T} text="Загружаю…" />
      ) : error ? (
        <Muted size={13} style={{ color: T.a }}>{error}</Muted>
      ) : list.length === 0 ? (
        <Muted size={13}>Чаты появятся здесь — открой профиль друга на вкладке «Друзья» и нажми «Написать».</Muted>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((c) => (
            <Card key={c.id} T={T} onClick={() => setActive(c)} className="flex items-center gap-3">
              <FriendAvatar T={T} name={c.firstName || c.username} />
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium">{c.firstName || "Без имени"}</div>
                <Muted size={12} className="truncate">{c.lastMessage ? c.lastMessage.text : "Нет сообщений"}</Muted>
              </div>
              {c.unread > 0 && (
                <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ minWidth: 22, height: 22, padding: "0 6px", background: T.grad, color: T.on, fontSize: 12, fontWeight: 700 }}>{c.unread}</span>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Общий календарь тренировок ---- */
function WeekdayPicker({ T, value, onChange }) {
  return (
    <div className="flex gap-1.5 mb-4">
      {WD.map((label, i) => {
        const on = value.includes(i);
        return (
          <button key={i} onClick={() => onChange(on ? value.filter((d) => d !== i) : [...value, i].sort((a, b) => a - b))}
            className="flex-1 rounded-xl py-2 text-center font-medium" style={{ fontSize: 12, border: `1px solid ${on ? "transparent" : T.line}`, background: on ? T.grad : T.card, color: on ? T.on : "#fff" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({ T, plan, st, onEdit }) {
  const friend = plan.participants.find((p) => !p.isSelf);
  const week = weekDays();
  const myStatus = (d) => !!st.done[keyOf(d)] || !!st.runDone[keyOf(d)];
  const friendStatus = (d) => {
    if (!friend || (!friend.thisWeekDone && !friend.thisWeekRun)) return null;
    const k = keyOf(d);
    return !!friend.thisWeekDone?.[k] || !!friend.thisWeekRun?.[k];
  };
  return (
    <Card T={T} className="mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FriendAvatar T={T} name={friend?.firstName || friend?.username} size={32} />
          <div className="font-medium">{friend?.firstName || friend?.username || "Без имени"}</div>
        </div>
        <button onClick={onEdit} aria-label="Изменить дни" className="rounded-full p-2" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><PenLine size={15} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {week.map((d, i) => <div key={i} className="text-center" style={{ fontSize: 10, color: MUTED }}>{WD[i]}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {week.map((d, i) => {
          const scheduled = plan.days.includes(i);
          const done = myStatus(d);
          return (
            <div key={i} className="rounded-lg flex items-center justify-center" style={{ height: 24, background: done ? T.grad : scheduled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", boxShadow: done ? T.glow : "none" }}>
              {done && <Check size={12} color={T.on} />}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.map((d, i) => {
          const scheduled = plan.days.includes(i);
          const fs = friendStatus(d);
          return (
            <div key={i} className="rounded-lg flex items-center justify-center" style={{ height: 24, background: fs ? "rgba(255,255,255,0.22)" : scheduled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)" }}>
              {fs ? <Check size={12} color="#fff" /> : fs === null ? <Minus size={10} color={MUTED} /> : null}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <Muted size={11}>Ты</Muted>
        <Muted size={11}>{friend?.firstName || "Друг"}</Muted>
      </div>
    </Card>
  );
}

function PlanEditor({ T, friends, plan, onDone, onCancel }) {
  const [friendId, setFriendId] = useState(plan ? null : (friends[0]?.id ?? null));
  const [days, setDays] = useState(plan ? plan.days : [0, 2, 4]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      if (plan) await setPlanDaysApi(plan.id, days);
      else await createPlanApi(friendId, days);
      onDone();
    } catch (e) {
      setError("Не удалось сохранить. Попробуй ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4">
      <button onClick={onCancel} className="flex items-center gap-1 mb-3" style={{ color: MUTED, fontSize: 13, background: "none" }}>
        <ChevronLeft size={16} /> Все планы
      </button>
      {!plan && (
        <>
          <Muted size={13} className="mb-2">С кем тренироваться вместе</Muted>
          {friends.length === 0 ? (
            <Muted size={13} className="mb-4">Сначала добавь друга на вкладке «Друзья».</Muted>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {friends.map((f) => (
                <Chip key={f.id} T={T} on={friendId === f.id} onClick={() => setFriendId(f.id)}>{f.firstName || f.username || "Без имени"}</Chip>
              ))}
            </div>
          )}
        </>
      )}
      <Muted size={13} className="mb-2">В какие дни недели тренируетесь вместе</Muted>
      <WeekdayPicker T={T} value={days} onChange={setDays} />
      {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}
      <Primary T={T} onClick={submit} disabled={saving || (!plan && !friendId)}>{saving ? "Сохраняю…" : "Сохранить"}</Primary>
      {plan && (
        <div className="mt-3">
          <Ghost T={T} onClick={async () => { await leavePlanApi(plan.id).catch(() => {}); onDone(); }}><Trash2 size={16} /> Выйти из плана</Ghost>
        </div>
      )}
    </div>
  );
}

function PlansSection({ T, st, friends }) {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | план

  const load = () => fetchPlans().then((d) => { setPlans(d); setError(""); }).catch(() => { setError("Не удалось загрузить планы."); setPlans([]); });
  useEffect(() => { load(); }, []);

  if (editing) {
    return <PlanEditor T={T} friends={friends} plan={editing === "new" ? null : editing} onDone={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="mt-4">
      <Muted size={13} className="mb-3">Выберите с другом общие дни тренировок — видно, кто в какой день этой недели уже отметил тренировку или пробежку.</Muted>
      <div className="mb-4">
        <Ghost T={T} onClick={() => setEditing("new")}><Users size={16} /> Предложить общий план</Ghost>
      </div>
      {plans === null ? (
        <Loader T={T} text="Загружаю…" />
      ) : error ? (
        <Muted size={13} style={{ color: T.a }}>{error}</Muted>
      ) : plans.length === 0 ? (
        <Muted size={13}>Пока ни одного общего плана.</Muted>
      ) : (
        plans.map((p) => <PlanCard key={p.id} T={T} plan={p} st={st} onEdit={() => setEditing(p)} />)
      )}
    </div>
  );
}

/* ---- Общие цели ---- */
function GoalProgressBar({ T, label, value, target, highlight }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <Muted size={12}>{label}</Muted>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{value} / {target}</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 8, background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: highlight ? T.grad : "rgba(255,255,255,0.3)", transition: "width .3s" }} />
      </div>
    </div>
  );
}

function GoalCard({ T, goal, onLeave }) {
  return (
    <Card T={T} className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold">{goal.title}</div>
        <button onClick={onLeave} aria-label="Выйти из цели" className="rounded-full p-1.5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}><X size={14} /></button>
      </div>
      {goal.deadline && <Muted size={11} className="mb-2">До {new Date(goal.deadline).toLocaleDateString("ru-RU")}</Muted>}
      {goal.participants.map((p) => (
        <GoalProgressBar key={p.id} T={T} label={p.isSelf ? "Ты" : (p.firstName || p.username || "Друг")} value={p.progress} target={goal.target} highlight={p.isSelf} />
      ))}
    </Card>
  );
}

function GoalEditor({ T, friends, onDone, onCancel }) {
  const [friendId, setFriendId] = useState(friends[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(20);
  const [metric, setMetric] = useState("workouts");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim()) { setError("Введи название цели."); return; }
    if (!friendId) { setError("Выбери друга."); return; }
    setSaving(true); setError("");
    try {
      await createGoalApi({ friendId, title: title.trim(), target, metric, deadline: deadline || null });
      onDone();
    } catch (e) {
      setError("Не удалось создать цель. Попробуй ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4">
      <button onClick={onCancel} className="flex items-center gap-1 mb-3" style={{ color: MUTED, fontSize: 13, background: "none" }}>
        <ChevronLeft size={16} /> Все цели
      </button>
      <Muted size={13} className="mb-2">С кем общая цель</Muted>
      {friends.length === 0 ? (
        <Muted size={13} className="mb-4">Сначала добавь друга на вкладке «Друзья».</Muted>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {friends.map((f) => (
            <Chip key={f.id} T={T} on={friendId === f.id} onClick={() => setFriendId(f.id)}>{f.firstName || f.username || "Без имени"}</Chip>
          ))}
        </div>
      )}
      <Muted size={13} className="mb-2">Название цели</Muted>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, 20 тренировок до конца месяца"
        className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-4" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
      <Muted size={13} className="mb-2">Что считаем</Muted>
      <div className="flex gap-2 mb-4">
        {GOAL_METRICS.map(([id, label]) => (
          <Chip key={id} T={T} on={metric === id} onClick={() => setMetric(id)}>{label}</Chip>
        ))}
      </div>
      <Muted size={13} className="mb-2">Сколько раз — цель</Muted>
      <div className="mb-4"><Stepper T={T} value={target} onChange={(v) => setTarget(Math.max(1, v))} unit="раз" min={1} step={1} /></div>
      <Muted size={13} className="mb-2">Срок (необязательно)</Muted>
      <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
        className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-4" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15, colorScheme: "dark" }} />
      {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}
      <Primary T={T} onClick={submit} disabled={saving}>{saving ? "Создаю…" : "Создать цель"}</Primary>
    </div>
  );
}

function GoalsSection({ T, st, friends }) {
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => fetchGoals().then(async (list) => {
    // Догоняем свой прогресс сразу при открытии — если он успел сдвинуться с прошлой публикации.
    const updated = await Promise.all(list.map(async (g) => {
      const mine = buildGoalProgress(st, g);
      const mineServer = g.participants.find((p) => p.isSelf)?.progress ?? 0;
      if (mine !== mineServer) {
        await publishGoalProgressApi(g.id, mine);
        return { ...g, participants: g.participants.map((p) => (p.isSelf ? { ...p, progress: mine } : p)) };
      }
      return g;
    }));
    setGoals(updated);
    setError("");
  }).catch(() => { setError("Не удалось загрузить цели."); setGoals([]); });
  useEffect(() => { load(); }, []);

  if (creating) {
    return <GoalEditor T={T} friends={friends} onDone={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />;
  }

  return (
    <div className="mt-4">
      <Muted size={13} className="mb-3">Общая цель на двоих — у каждого свой счётчик, но цель одна, и видно, как продвигается друг.</Muted>
      <div className="mb-4">
        <Ghost T={T} onClick={() => setCreating(true)}><Target size={16} /> Создать общую цель</Ghost>
      </div>
      {goals === null ? (
        <Loader T={T} text="Загружаю…" />
      ) : error ? (
        <Muted size={13} style={{ color: T.a }}>{error}</Muted>
      ) : goals.length === 0 ? (
        <Muted size={13}>Пока ни одной общей цели.</Muted>
      ) : (
        goals.map((g) => <GoalCard key={g.id} T={T} goal={g} onLeave={async () => { await leaveGoalApi(g.id).catch(() => {}); load(); }} />)
      )}
    </div>
  );
}

/* ---- Экран «Друзья» целиком ---- */
const FRIENDS_SECTIONS = ["Друзья", "Чат", "Тренировки", "Цели"];

function FriendsScreen({ T, st, up }) {
  // Друзьям нужен постоянный Telegram ID: в Mini App он есть сам собой, на сайте — после входа через бота
  const available = inTelegram() || (isWeb() && !!readSession());
  const [section, setSection] = useState(0);
  const [friendsData, setFriendsData] = useState(null);
  const [friendsError, setFriendsError] = useState("");
  const [chatTarget, setChatTarget] = useState(null);

  const loadFriends = () => fetchFriendsState().then((d) => { setFriendsData(d); setFriendsError(""); }).catch((e) => { setFriendsError(FRIEND_ERRORS[e.message] || "Не удалось загрузить список друзей."); setFriendsData({ friends: [], incoming: [], outgoing: [] }); });
  useEffect(() => { if (available) loadFriends(); }, []);

  if (!available && isWeb()) {
    return (
      <div>
        <H1>Друзья</H1>
        <Muted className="mt-2 mb-5">Друзья, чат, совместные тренировки и общие цели работают через твой Telegram-аккаунт — так друзья находят тебя по @username. Войди, и всё, что есть в Mini App, появится здесь.</Muted>
        <TelegramLoginPanel T={T} after="friends" />
      </div>
    );
  }

  if (!available) {
    return (
      <div>
        <H1>Друзья</H1>
        <Muted className="mt-2">Друзья доступны только в Telegram Mini App — здесь нет надёжного способа узнать, кто ты, чтобы показать тебя другим людям.</Muted>
      </div>
    );
  }

  return (
    <div>
      <H1>Друзья</H1>
      <Segmented T={T} items={FRIENDS_SECTIONS} value={section} onChange={setSection} />
      {section === 0 && (
        <FriendsListSection T={T} st={st} up={up} data={friendsData} error={friendsError} reload={loadFriends}
          onWriteTo={(f) => { setChatTarget(f); setSection(1); }} />
      )}
      {section === 1 && <ChatSection T={T} pendingFriend={chatTarget} onPendingConsumed={() => setChatTarget(null)} />}
      {section === 2 && <PlansSection T={T} st={st} friends={friendsData?.friends || []} />}
      {section === 3 && <GoalsSection T={T} st={st} friends={friendsData?.friends || []} />}
    </div>
  );
}

// Почему открылось окно оплаты — первая строка окна говорит о том, во что человек только что упёрся,
// а не начинает с общего списка. Ключи передаются в openPay(...) из мест, где срабатывает лимит.
const PAYWALL_REASONS = {
  scans: [Camera, "Бесплатные фото еды на сегодня закончились", `Бесплатно — ${FREE_SCANS} распознавания в день. В Pro — без лимита: фото тарелки, описание текстом и фото этикетки.`],
  assistant: [Mic, "Бесплатные вопросы помощнику на сегодня закончились", `Бесплатно — ${FREE_ASSISTANT} вопросов в день. В Pro спрашивай сколько угодно — помощник видит твои тренировки, питание и вес.`],
  habits: [Repeat, `Бесплатно — до ${FREE_HABITS} привычек`, "В Pro — сколько угодно привычек с сериями дней."],
  workouts: [Dumbbell, `Бесплатно — ${FREE_WORKOUTS} своя тренировка`, "В Pro — сколько угодно своих тренировок и библиотека готовых программ."],
  templates: [Library, "Готовые программы — в Pro", "6 программ под зал, дом и гирю: фулбоди, верх/низ, push/pull/legs — расставятся по дням сами."],
  recipes: [Sparkles, "Рецепты от ИИ — в Pro", "Рецепты под остаток калорий и белка на сегодня, с учётом аллергий."],
  run_plan: [Footprints, "Беговой план дальше первой недели — в Pro", "Все недели плана: кроссы, длительные и интервалы, с пульсовыми зонами."],
  history: [TrendingUp, "Полная история — в Pro", `Бесплатно видно ${FREE_HISTORY} последние записи упражнения. В Pro — вся история и рекорды.`],
  insight: [Sparkles, "ИИ-разбор недели — в Pro", "Каждую неделю — короткий разбор: что идёт хорошо и что поправить."],
};
function PaywallReason({ T, reason }) {
  const r = PAYWALL_REASONS[reason];
  if (!r) return null;
  const [Icon, title, text] = r;
  return (
    <div className="flex items-start gap-3 rounded-2xl p-3.5 mb-4" style={{ background: `${T.a}14`, border: `1px solid ${T.a}40`, animation: "rise .3s ease-out" }}>
      <span className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: T.grad, color: T.on }}><Icon size={18} /></span>
      <div>
        <div className="font-semibold" style={{ fontSize: 14.5, lineHeight: 1.3 }}>{title}</div>
        <Muted size={12.5} className="mt-0.5">{text}</Muted>
      </div>
    </div>
  );
}

function PaySheet({ T, onClose, onPaid, pro, reason }) {
  const [plan, setPlan] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | creating | waiting | done | error
  const [error, setError] = useState("");
  const [payment, setPayment] = useState(null); // { url, transactionId }
  const [until, setUntil] = useState(0);
  const [chargeAmount, setChargeAmount] = useState(null); // фактическая сумма, которую вернул сервер при создании платежа
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(null); // { code, percent } | null
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState("");
  const planKey = plan === 0 ? "month" : "year";
  const rub = RUB_PRICE[planKey];
  // То же округление, что и на сервере (create-payment.mjs) — чтобы показанная цена совпадала с реально списанной.
  const discountedRub = promoApplied ? Math.max(1, Math.round(rub * (1 - promoApplied.percent / 100))) : rub;
  const plans = [["Месяц", `${RUB_PRICE.month} ₽ / 30 дней`], ["Год", `${RUB_PRICE.year} ₽ / 12 месяцев`]];

  // В Telegram — его браузер. На сайте — новая вкладка; если браузер её заблокировал (окно
  // открывается уже после ответа сервера), уходим на страницу оплаты в этой же вкладке —
  // Platega вернёт обратно на /app?payment=return, и платёж проверится при запуске.
  const open = (url) => {
    const tg = tgApp();
    if (tg?.openLink) { tg.openLink(url); return; }
    if (isCapacitorNative()) { openExternalLink(url); return; }
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  };

  const applyPromo = async () => {
    if (!promoInput.trim()) { setPromoError(PROMO_ERRORS.promo_empty); return; }
    setPromoChecking(true);
    setPromoError("");
    try {
      const r = await checkPromoDiscountApi(promoInput);
      setPromoApplied({ code: r.code, percent: r.percent });
    } catch (e) {
      setPromoError(PROMO_ERRORS[e.message] || "Не получилось применить код. Попробуй ещё раз.");
    } finally {
      setPromoChecking(false);
    }
  };
  const removePromo = () => { setPromoApplied(null); setPromoInput(""); setPromoError(""); };

  const pay = async () => {
    setStatus("creating");
    setError("");
    try {
      const res = await fetch(apiUrl("/api/create-payment"), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ plan: planKey, promoCode: promoApplied?.code || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "platega_error");
      setPayment({ url: data.url, transactionId: data.transactionId });
      setChargeAmount(data.amount ?? discountedRub);
      setStatus("waiting");
      if (isWeb()) savePendingTx(data.transactionId);
      goal("pro_payment_start", { plan: planKey });
      open(data.url);
    } catch (e) {
      setStatus("error");
      setError(PAY_ERRORS[e.message] || PROMO_ERRORS[e.message] || AI_ERRORS?.[e.message] || "Не удалось открыть оплату. Попробуй ещё раз.");
    }
  };

  const check = async (manual) => {
    if (!payment) return;
    try {
      const r = await fetchProStatus(payment.transactionId);
      if (r.paymentStatus === "CONFIRMED" && r.active) {
        clearPendingTx();
        setUntil(r.until);
        setStatus("done");
        goal("pro_paid", { plan: planKey });
        onPaid(r);
      } else if (r.paymentStatus === "CANCELED") {
        clearPendingTx();
        setStatus("error");
        setError("Платёж отменён или время на оплату истекло. Можно попробовать ещё раз.");
      } else if (manual) {
        setError("Оплата ещё не поступила. Если ты уже оплатил, подожди минуту — банк иногда подтверждает с задержкой.");
      }
    } catch (e) {
      if (manual) setError("Не удалось проверить оплату. Проверь интернет и нажми ещё раз.");
    }
  };

  // Пока ждём оплату — проверяем каждые 4 секунды и сразу при возвращении в приложение
  useEffect(() => {
    if (status !== "waiting") return undefined;
    const timer = setInterval(() => check(false), 4000);
    const stop = setTimeout(() => clearInterval(timer), 15 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") check(false); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); clearTimeout(stop); document.removeEventListener("visibilitychange", onVisible); };
  }, [status, payment]);

  if (needsLogin()) {
    return (
      <Sheet T={T} title="Оплата RITM Pro" sub="Pro привязывается к твоему Telegram-аккаунту — так она работает на сайте, в приложении на телефоне и в Mini App. Войди, и окно оплаты откроется снова." onClose={onClose}>
        <PaywallReason T={T} reason={reason} />
        <div className="flex items-baseline gap-2 mb-4">
          <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>{RUB_PRICE.month} ₽</span>
          <Muted size={13}>в месяц · или {RUB_PRICE.year} ₽ за год (−{YEAR_SAVINGS_PCT}%)</Muted>
        </div>
        <TelegramLoginPanel T={T} after="pay" />
      </Sheet>
    );
  }

  if (status === "done") {
    return (
      <Sheet T={T} title="" onClose={onClose}>
        <div className="relative text-center py-6" style={{ animation: "rise .3s ease-out" }}>
          <Confetti T={T} />
          <div className="relative mx-auto rounded-full flex items-center justify-center mb-5 ritm-pop" style={{ width: 88, height: 88, background: T.grad, boxShadow: T.glow, color: T.on }}>
            <Crown size={38} />
          </div>
          <H1>Pro подключена</H1>
          <Muted className="mt-2 mb-8">Оплата прошла. Pro активна до {proUntilText(until)} — на всех твоих устройствах.</Muted>
          <Primary T={T} onClick={onClose}>Готово</Primary>
        </div>
      </Sheet>
    );
  }

  if (status === "waiting") {
    return (
      <Sheet T={T} title="Ждём оплату" onClose={onClose}>
        <Loader T={T} text={`Оплати ${chargeAmount ?? discountedRub} ₽ по СБП на открывшейся странице. Как только банк подтвердит платёж, Pro включится сам.`} />
        {error && <Muted size={13} className="mb-3 text-center" style={{ color: T.a }}>{error}</Muted>}
        <div className="flex flex-col gap-2">
          <Primary T={T} onClick={() => check(true)}>Я оплатил — проверить</Primary>
          <Ghost T={T} onClick={() => open(payment.url)}>Открыть страницу оплаты снова</Ghost>
        </div>
        <Muted size={12} className="mt-3 text-center">Можно закрыть это окно: после оплаты бот пришлёт сообщение, а Pro включится автоматически.</Muted>
      </Sheet>
    );
  }

  return (
    <Sheet T={T} title="Оплата RITM Pro" onClose={onClose}>
      {!pro?.active && <PaywallReason T={T} reason={reason} />}
      {pro?.active && <Muted size={13} className="mb-3" style={{ color: T.a }}>Pro уже активна до {proUntilText(pro.until)}. Оплата продлит её — новые дни добавятся к оставшимся.</Muted>}
      <Card T={T} className="mb-4">
        <div className="font-semibold mb-3">Бесплатно vs Pro</div>
        <div className="grid mb-2" style={{ gridTemplateColumns: "1.3fr 0.8fr 0.8fr" }}>
          <span />
          <Muted size={11} style={{ textAlign: "center" }}>Сейчас</Muted>
          <span style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: T.a }}>Pro</span>
        </div>
        <div className="grid gap-2.5">
          {PRO_COMPARISON_ROWS.map(([label, free, proVal]) => (
            <div key={label} className="grid items-center" style={{ gridTemplateColumns: "1.3fr 0.8fr 0.8fr" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.82)" }}>{label}</span>
              <span style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>{free}</span>
              <span style={{ fontSize: 12, color: T.a, fontWeight: 600, textAlign: "center" }}>{proVal}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {plans.map(([t, d], i) => (
          <button key={t} onClick={() => setPlan(i)} className="relative rounded-2xl p-4 text-left"
            style={{ border: `1px solid ${plan === i ? T.a : T.line}`, background: plan === i ? "rgba(255,255,255,0.07)" : T.card, boxShadow: plan === i ? T.glow : "none", color: "#fff" }}>
            {i === 1 && YEAR_SAVINGS_PCT > 0 && (
              <span className="absolute rounded-full font-semibold" style={{ top: -10, right: 12, fontSize: 11, padding: "3px 9px", background: T.grad, color: T.on, boxShadow: T.glow }}>
                −{YEAR_SAVINGS_PCT}%
              </span>
            )}
            <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600 }}>{t}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{d}</div>
          </button>
        ))}
      </div>

      <Card T={T} className="mb-4">
        {promoApplied ? (
          <div className="flex items-center justify-between">
            <Muted size={13} style={{ color: "#fff" }}>Промокод {promoApplied.code} · −{promoApplied.percent}%</Muted>
            <button onClick={removePromo} aria-label="Убрать промокод" className="rounded-xl px-2 py-1" style={{ color: MUTED }}><X size={16} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyPromo()}
              placeholder="Промокод на скидку" className="flex-1 rounded-xl px-3 py-2 bg-transparent outline-none"
              style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 14, letterSpacing: 1, textTransform: "uppercase" }} />
            <button onClick={applyPromo} disabled={promoChecking} className="rounded-xl px-4 py-2 font-medium flex-shrink-0" style={{ border: `1px solid ${T.line}`, color: "#fff", opacity: promoChecking ? 0.6 : 1 }}>
              {promoChecking ? "…" : "Применить"}
            </button>
          </div>
        )}
        {promoError && <Muted size={12} className="mt-2" style={{ color: T.a }}>{promoError}</Muted>}
      </Card>

      <Card T={T} className="mb-4">
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14 }}>К оплате</span>
          <span className="flex items-center gap-2">
            {promoApplied && <span style={{ fontSize: 14, color: MUTED, textDecoration: "line-through" }}>{rub} ₽</span>}
            <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700 }}>{discountedRub} ₽</span>
          </span>
        </div>
        <Muted size={12} className="mt-1">Оплата через СБП. {plan === 0 ? "Доступ к Pro на 30 дней." : "Доступ к Pro на 12 месяцев."} Автоматических списаний нет.</Muted>
      </Card>

      <div className="flex flex-col gap-2 mb-5">
        <Ghost T={T} onClick={() => openExternal(LEGAL.offerUrl)}>Публичная оферта</Ghost>
        <Ghost T={T} onClick={() => openExternal(LEGAL.privacyUrl)}>Политика конфиденциальности</Ghost>
      </div>

      {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}
      <Primary T={T} onClick={pay} disabled={status === "creating"}>
        {status === "creating" ? "Открываю оплату…" : `Оплатить ${discountedRub} ₽ через СБП`}
      </Primary>
      <Muted size={12} className="mt-3 text-center">Нажимая «Оплатить», ты принимаешь условия публичной оферты. Откроется страница оплаты по СБП, чек придёт в электронном виде.</Muted>
    </Sheet>
  );
}

/* ============ Pro навсегда ============
   Telegram-юзернеймы (без «@», в нижнем регистре), у которых Pro включён всегда, без оплаты. */
const LIFETIME_PRO_USERNAMES = ["doltiii"];
const hasLifetimePro = (user) => !!user?.username && LIFETIME_PRO_USERNAMES.includes(String(user.username).toLowerCase());

// Чей юзернейм видит в Настройках вход в создание промокодов. Это только для UI —
// настоящая проверка прав всегда на сервере, по списку ADMIN_TG_IDS на Netlify.
// Если здесь и в ADMIN_TG_IDS разные люди — экран увидит не тот, кому сервер разрешит создавать коды.
const PROMO_ADMIN_USERNAMES = ["doltiii"];
const canSeePromoAdmin = (user) => !!user?.username && PROMO_ADMIN_USERNAMES.includes(String(user.username).toLowerCase());

// Переносит сохранённое расписание из прошлой версии ({ strength: {день: 0|1}, run: {день: 0} })
// в новый формат, чтобы ничего не потерялось после обновления
// Когда в TABS_ALL появляется новый раздел уже после того, как человек сам настроил
// видимые вкладки (tabsConfig сохранён), этот раздел не должен просто появиться в нижней
// панели без спроса — прячем его так же, как и остальные новые разделы при первом обновлении.
// Новый раздел сразу дописываем и в order — иначе он навсегда остаётся «новым»: раньше его прятали
// при каждой загрузке, и включённые вручную «Зарядка» и «Друзья» снова пропадали при следующем входе.
function fixTabsConfig(cfg) {
  if (!cfg) return cfg;
  const known = new Set(cfg.order || []);
  const newIds = TABS_ALL.map((t) => t[0]).filter((id) => !known.has(id));
  if (!newIds.length) return cfg;
  return { ...cfg, order: [...(cfg.order || []), ...newIds], hidden: [...new Set([...(cfg.hidden || []), ...newIds])] };
}
// Порядок со всеми разделами: сохранённый плюс те, которых в нём ещё нет (в конец)
function completeTabsOrder(order) {
  const base = order?.length ? order : DEFAULT_TABS_CONFIG.order;
  const known = new Set(base);
  return [...base, ...TABS_ALL.map((t) => t[0]).filter((id) => !known.has(id))];
}
// Разовое исправление для тех, у кого раздел уже попал под ошибку выше: дописываем недостающие
// разделы в order, НЕ трогая hidden — что человек включил, остаётся включённым, что выключено — выключенным.
function migrateTabs(rest) {
  if (!rest.tabsOrderComplete) {
    const cfg = rest.tabsConfig ? { ...rest.tabsConfig, order: completeTabsOrder(rest.tabsConfig.order) } : rest.tabsConfig;
    return rest.chargeRevealed ? cfg : revealCharge(cfg);
  }
  return rest.chargeRevealed ? fixTabsConfig(rest.tabsConfig) : revealCharge(fixTabsConfig(rest.tabsConfig));
}
// «Зарядка» раньше автоматически прятался у всех как «новый раздел» (см. fixTabsConfig выше) —
// теперь комплекс полностью готов (3 режима, проверено), и его стоит показать. Открываем его
// один раз тем, у кого он уже успел спрятаться, и больше не трогаем — дальше человек сам решает
// через «Разделы»; флаг chargeRevealed (ниже, в migrateState) не даёт повторять это на каждой загрузке.
function revealCharge(cfg) {
  if (!cfg?.hidden?.includes("charge")) return cfg;
  return { ...cfg, hidden: cfg.hidden.filter((id) => id !== "charge") };
}

function migrateState(st) {
  const old = st.customSchedule;
  const hasOld = old && (Object.keys(old.strength || {}).length || Object.keys(old.run || {}).length);
  if (st.schedule || !hasOld || !st.profile) {
    const { customSchedule, ...rest } = st;
    return { ...rest, reminders: { ...DEFAULT_REMINDERS, ...(rest.reminders || {}) }, taskLists: rest.taskLists?.length ? rest.taskLists : DEFAULT.taskLists, books: rest.books || [], challenges: rest.challenges || [], journal: rest.journal || [], breathLog: rest.breathLog || {}, breathStats: rest.breathStats || DEFAULT.breathStats, faith: rest.faith || DEFAULT.faith, shoppingList: rest.shoppingList || { recipes: [], checked: {}, custom: [] }, healthKit: rest.healthKit || { connected: false, lastSyncAt: 0 }, tabsConfig: migrateTabs(rest), tourSeen: rest.tourSeen ?? !!rest.profile, chargeRevealed: true, tabsOrderComplete: true };
  }
  const order = runLevel(st.profile) === 0 ? ["walkrun", "recovery", "longwalk"] : ["recovery", "hard", "walkrun", "long"];
  const runDays = Object.keys(old.run || {}).map(Number).sort((a, b) => a - b);
  const schedule = {};
  for (let d = 0; d < 7; d++) {
    const sv = old.strength?.[d];
    const ri = runDays.indexOf(d);
    schedule[d] = {
      strength: sv === 0 || sv === "0" ? "A" : sv === 1 || sv === "1" ? "B" : null,
      run: ri === -1 ? null : order[ri % order.length],
    };
  }
  const { customSchedule, ...rest } = st;
  return { ...rest, schedule, reminders: { ...DEFAULT_REMINDERS, ...(rest.reminders || {}) }, taskLists: rest.taskLists?.length ? rest.taskLists : DEFAULT.taskLists, books: rest.books || [], challenges: rest.challenges || [], journal: rest.journal || [], breathLog: rest.breathLog || {}, breathStats: rest.breathStats || DEFAULT.breathStats, faith: rest.faith || DEFAULT.faith, shoppingList: rest.shoppingList || { recipes: [], checked: {}, custom: [] }, healthKit: rest.healthKit || { connected: false, lastSyncAt: 0 }, tabsConfig: migrateTabs(rest), tourSeen: rest.tourSeen ?? !!rest.profile, chargeRevealed: true, tabsOrderComplete: true };
}

/* ============ Голосовой помощник ============
   Распознавание и озвучка голоса — встроенные функции браузера, бесплатны и не требуют ключа.
   На вопросы отвечает тот же сервер и тот же ключ Anthropic, что уже настроен для распознавания еды —
   отдельный ключ для помощника не нужен. Бесплатно — FREE_ASSISTANT вопросов в день, дальше нужен Pro
   (константа объявлена в самом начале файла, рядом с остальными бесплатными лимитами). */
// Готовые вопросы для тех, кто не знает, с чего начать разговор с помощником
const ASSISTANT_SUGGESTIONS = [
  "Что съесть сегодня, чтобы добрать белок?",
  "Почему у меня остановился прогресс?",
  "Как подготовиться к завтрашней тренировке?",
  "Стоит ли сегодня бежать или отдохнуть?",
];
const getSpeechRecognition = () => (typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
const canListen = () => !!getSpeechRecognition();
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

function speak(text) {
  if (!canSpeak() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ru-RU";
    window.speechSynthesis.speak(u);
  } catch (e) { /* озвучка недоступна — ответ остаётся текстом на экране */ }
}

// Краткий контекст о пользователе — без личных данных, только то, что нужно для ответа.
// Чем полнее контекст, тем предметнее совет: добавляем серии, тренд веса и другие разделы,
// которыми человек реально пользуется, а не только сегодняшний срез.
function assistantContext(st, norm, program, run) {
  const p = st.profile || {};
  const k = keyOf(new Date());
  const eaten = sumFood(st.food?.[k] || []);
  const wd = wdOf(new Date());
  const trainStreak = streakOf((x) => !!st.done[x]);
  const runStreak = streakOf((x) => !!st.runDone[x]);
  const habitStreak = (st.habits || []).reduce((m, h) => Math.max(m, streakOf((x) => !!h.log[x])), 0);
  const weightEntries = Object.entries(st.weight || {}).sort(([a], [b]) => (a < b ? -1 : 1));
  const weightTrend = weightEntries.length >= 2
    ? Number(weightEntries[weightEntries.length - 1][1]) - Number(weightEntries[Math.max(0, weightEntries.length - 15)][1])
    : null;
  const bits = [
    `цель — ${{ mass: "набор массы", fat: "похудение", strength: "сила", endurance: "выносливость" }[p.goal] || "не указана"}`,
    `уровень — ${{ beginner: "новичок", intermediate: "средний", advanced: "опытный" }[p.level] || "не указан"}`,
    norm ? `норма ${norm.kcal} ккал в день, съедено сегодня ${Math.round(eaten.kcal)} ккал, белка съедено ${Math.round(eaten.p)} из ${norm.protein} г` : null,
    program ? (program.schedule[wd] !== undefined ? "сегодня по плану силовая тренировка" : "сегодня по плану нет силовой") : null,
    run ? (run.schedule[wd] !== undefined ? "сегодня по плану есть пробежка" : "сегодня пробежки нет") : null,
    st.wellbeing?.[k] ? `самочувствие сегодня отмечено: энергия ${st.wellbeing[k].energy}/5` : null,
    trainStreak ? `серия силовых тренировок: ${trainStreak} дн. подряд` : null,
    runStreak ? `серия пробежек: ${runStreak} дн. подряд` : null,
    habitStreak ? `лучшая текущая серия привычки: ${habitStreak} дн.` : null,
    weightTrend != null ? `вес тела за последние записи изменился на ${weightTrend > 0 ? "+" : ""}${weightTrend.toFixed(1)} кг` : null,
  ];
  return bits.filter(Boolean).join("; ");
}

function VoiceAssistant({ T, st, up, norm, program, run, onPay }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | thinking | error
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const recRef = useRef(null);
  const k = keyOf(new Date());
  const used = Number(st.assistantUses?.[k]) || 0;
  const left = st.pro ? null : Math.max(0, FREE_ASSISTANT - used);

  const ask = async (q) => {
    const text = q.trim();
    if (!text) return;
    if (left === 0) { onPay("assistant"); return; }
    setQuestion(text);
    setAnswer("");
    setError("");
    setStatus("thinking");
    up((s) => ({ assistantUses: { ...s.assistantUses, [k]: (Number(s.assistantUses?.[k]) || 0) + 1 } }));
    try {
      const a = await askAssistantText(text, assistantContext(st, norm, program, run));
      setAnswer(a);
      setStatus("idle");
      speak(a);
    } catch (e) {
      setError(explainAiError(e) || "Не получилось получить ответ. Попробуй ещё раз.");
      setStatus("error");
    }
  };

  const startListening = () => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "ru-RU";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => { const said = e.results?.[0]?.[0]?.transcript || ""; if (said) ask(said); };
    rec.onerror = () => { setListening(false); setError("Не расслышал. Попробуй ещё раз или напиши вопрос текстом."); setStatus("error"); };
    rec.onend = () => setListening(false);
    setError("");
    setListening(true);
    try { rec.start(); } catch (e) { setListening(false); }
  };
  const stopListening = () => { try { recRef.current?.stop(); } catch (e) { /* уже остановлен */ } setListening(false); };

  const close = () => { stopListening(); try { window.speechSynthesis?.cancel(); } catch (e) { /* ок */ } setOpen(false); setQuestion(""); setAnswer(""); setError(""); setStatus("idle"); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Голосовой помощник" title="Помощник"
        className="fixed rounded-full flex items-center justify-center z-30 ritm-press right-4 lg:right-8 bottom-[calc(98px+env(safe-area-inset-bottom))] lg:bottom-8"
        style={{ width: 54, height: 54, background: T.grad, color: T.on, boxShadow: T.glow }}>
        <Mic size={22} />
      </button>
    );
  }

  return (
    <Sheet T={T} title="Помощник" sub="Спроси голосом или текстом о тренировках, питании и приложении." onClose={close}>
      {left === 0 && (
        <Card T={T} className="mb-4" onClick={() => onPay("assistant")}>
          <div className="font-semibold mb-1">Бесплатные вопросы на сегодня закончились</div>
          <Muted size={13}>В Pro — без ограничений. Нажми, чтобы открыть.</Muted>
        </Card>
      )}
      {left !== null && left > 0 && <Muted size={12} className="mb-3">Осталось бесплатных вопросов сегодня: {left}</Muted>}

      {canListen() ? (
        <div className="flex flex-col items-center py-4">
          <button onClick={listening ? stopListening : startListening} disabled={left === 0}
            className="rounded-full flex items-center justify-center mb-3" style={{ width: 84, height: 84, background: listening ? T.a : T.grad, color: T.on, boxShadow: T.glow, animation: listening ? "breathe 1.4s ease-in-out infinite" : "none" }}
            aria-label={listening ? "Остановить запись" : "Начать запись"}>
            {listening ? <MicOff size={30} /> : <Mic size={30} />}
          </button>
          <Muted size={13}>{listening ? "Слушаю…" : "Нажми и скажи вопрос"}</Muted>
        </div>
      ) : (
        <Muted size={12} className="mb-3">Голосовой ввод не поддерживается этим браузером — спроси текстом.</Muted>
      )}

      <div className="flex gap-2 mt-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (ask(typed), setTyped(""))}
          placeholder="Или напиши вопрос" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} disabled={left === 0} />
        <button onClick={() => { ask(typed); setTyped(""); }} disabled={left === 0 || !typed.trim()} aria-label="Спросить"
          className="rounded-xl px-4" style={{ background: T.grad, color: T.on, opacity: left === 0 || !typed.trim() ? 0.4 : 1 }}><Send size={18} /></button>
      </div>

      {!question && status !== "thinking" && (
        <div className="flex flex-wrap gap-2 mt-3">
          {ASSISTANT_SUGGESTIONS.map((q) => (
            <Chip key={q} T={T} on={false} onClick={() => left !== 0 && ask(q)}>{q}</Chip>
          ))}
        </div>
      )}

      {status === "thinking" && <Loader T={T} text="Думаю над ответом" />}
      {question && status !== "thinking" && (
        <Card T={T} className="mt-4">
          <Muted size={12} className="mb-1">Вопрос</Muted>
          <div style={{ fontSize: 14 }}>{question}</div>
        </Card>
      )}
      {answer && (
        <Card T={T} className="mt-3">
          <div className="flex items-start justify-between gap-2">
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>{answer}</div>
            {canSpeak() && <button onClick={() => speak(answer)} aria-label="Озвучить ответ" style={{ color: T.a, flexShrink: 0 }}><Volume2 size={18} /></button>}
          </div>
        </Card>
      )}
      {error && <Muted size={13} className="mt-3" style={{ color: T.a }}>{error}</Muted>}
    </Sheet>
  );
}


const STEP_GOAL = 10000;
const SLEEP_GOAL = 8;
const WELLBEING_LABELS = {
  energy: ["Разбит", "Устал", "Средне", "Бодро", "Отлично"],
  mood: ["Плохое", "Так себе", "Нормальное", "Хорошее", "Отличное"],
  soreness: ["Сильная", "Заметная", "Лёгкая", "Почти нет", "Нет"],
};
const weekAgoKeys = () => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return keyOf(d); });
const shortDay = (k) => WD[wdOf(new Date(k + "T00:00:00"))];

function Rating({ T, value, onChange, labels }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-label={labels[n - 1]} className="flex-1 rounded-xl py-2 flex flex-col items-center gap-1"
          style={{ border: `1px solid ${value === n ? T.a : T.line}`, background: value === n ? "rgba(255,255,255,0.08)" : T.card }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: value === n ? T.a : "#fff" }}>{n}</span>
        </button>
      ))}
    </div>
  );
}

// Открывается и вручную из «Здоровья», и сразу после гида по тренировке — один и тот же формат записи
function WellbeingSheet({ T, existing, afterWorkout, onSave, onClose }) {
  const [energy, setEnergy] = useState(existing?.energy || 3);
  const [mood, setMood] = useState(existing?.mood || 3);
  const [soreness, setSoreness] = useState(existing?.soreness || 3);
  const [note, setNote] = useState(existing?.note || "");
  return (
    <Sheet T={T} title={afterWorkout ? "Как тренировка?" : "Как самочувствие"} onClose={onClose}>
      {afterWorkout && <Muted size={13} className="mb-4">Тренировка сохранена. Пара вопросов — и данные попадут в «Здоровье».</Muted>}
      <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }} className="mb-2">Энергия — {WELLBEING_LABELS.energy[energy - 1]}</div>
      <Rating T={T} value={energy} onChange={setEnergy} labels={WELLBEING_LABELS.energy} />
      <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }} className="mb-2 mt-4">Настроение — {WELLBEING_LABELS.mood[mood - 1]}</div>
      <Rating T={T} value={mood} onChange={setMood} labels={WELLBEING_LABELS.mood} />
      <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }} className="mb-2 mt-4">Мышечная боль — {WELLBEING_LABELS.soreness[soreness - 1]}</div>
      <Rating T={T} value={soreness} onChange={setSoreness} labels={WELLBEING_LABELS.soreness} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Заметка, необязательно"
        className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mt-4" style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 14, resize: "none", fontFamily: BODY }} />
      <div className="mt-4"><Primary T={T} onClick={() => onSave({ energy, mood, soreness, note: note.trim(), at: Date.now() })}>Сохранить</Primary></div>
      {afterWorkout && <Ghost T={T} onClick={onClose}>Пропустить</Ghost>}
    </Sheet>
  );
}

function MiniBars({ T, values, max, unit, goal }) {
  return (
    <div className="flex items-end gap-2" style={{ height: 64 }}>
      {values.map(({ k: dk, v }) => (
        <div key={dk} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
          <div className="w-full rounded-t-md" style={{ height: `${max ? Math.max(3, (v / max) * 100) : 3}%`, background: goal && v >= goal ? T.grad : "rgba(255,255,255,0.14)", minHeight: 3 }} />
          <span style={{ fontSize: 10, color: MUTED }}>{shortDay(dk)}</span>
        </div>
      ))}
    </div>
  );
}

/* ============ Экспорт данных ============
   CSV, чтобы открывалось в любой таблице. Строим файл прямо в браузере — сервер не нужен,
   данные ведь и так лежат только у человека в Telegram.
   Экранирование по правилам CSV: значение в кавычках, если есть запятая, кавычка или перенос строки. */
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells) => cells.map(csvCell).join(",") + "\r\n";

function downloadCSV(filename, header, rows) {
  const bom = "\uFEFF"; // чтобы Excel сразу понял кодировку UTF-8, а не показал кракозябры
  const text = bom + csvRow(header) + rows.map(csvRow).join("");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportWorkouts(st) {
  const rows = [];
  for (const h of [...(st.trainHistory || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const name = EX[h.exId]?.name || h.exId;
    (h.sets || []).forEach((s, i) => rows.push([h.date, name, i + 1, s.reps, s.weight ?? "", h.note || ""]));
  }
  downloadCSV("ritm-trenirovki.csv", ["Дата", "Упражнение", "Подход", "Повторы", "Вес, кг", "Заметка"], rows);
}
function exportFood(st) {
  const rows = [];
  for (const date of Object.keys(st.food || {}).sort()) {
    for (const e of st.food[date]) rows.push([date, MEALS[e.meal] ?? "", e.name, e.grams, e.kcal, e.p, e.f, e.c]);
  }
  downloadCSV("ritm-pitanie.csv", ["Дата", "Приём пищи", "Продукт", "Граммы", "Ккал", "Белки", "Жиры", "Углеводы"], rows);
}
function exportWeight(st) {
  const rows = Object.entries(st.weight || {}).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => [d, v]);
  downloadCSV("ritm-ves.csv", ["Дата", "Вес, кг"], rows);
}

// Простой линейный график по редким точкам (вес обычно вводят не каждый день, в отличие от шагов и сна)
function WeightChart({ T, entries, label = "График веса" }) {
  if (entries.length < 2) {
    return <Muted size={13} className="text-center py-6">Записей пока мало — график появится после второй записи.</Muted>;
  }
  const W = 320, H = 96, pad = 10;
  const values = entries.map((e) => e.v);
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(0.5, max - min);
  const x = (i) => pad + (i / (entries.length - 1)) * (W - pad * 2);
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
  const points = entries.map((e, i) => `${x(i)},${y(e.v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={points} pathLength="1" className="ritm-draw" fill="none" stroke={T.a} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {entries.map((e, i) => <circle key={e.k} className="ritm-dot" style={{ animationDelay: `${300 + (i / entries.length) * 1000}ms`, transformBox: "fill-box", transformOrigin: "center" }} cx={x(i)} cy={y(e.v)} r={i === entries.length - 1 ? 4 : 2.5} fill={i === entries.length - 1 ? T.a : "rgba(255,255,255,0.5)"} />)}
    </svg>
  );
}

/* ============ Замеры тела ============ */
const BODY_MEASUREMENTS = [
  { id: "waist", label: "Талия" },
  { id: "chest", label: "Грудь" },
  { id: "hips", label: "Бёдра" },
  { id: "arm", label: "Бицепс" },
  { id: "thigh", label: "Бедро (нога)" },
  { id: "neck", label: "Шея" },
];

function MeasurementsCard({ T, st, up }) {
  const [metric, setMetric] = useState(BODY_MEASUREMENTS[0].id);
  const k = keyOf(new Date());
  const measurements = st.measurements || {};
  const entries = Object.entries(measurements)
    .filter(([, v]) => v && v[metric] != null)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-16)
    .map(([dk, v]) => ({ k: dk, v: Number(v[metric]) }));
  const todayVal = measurements[k]?.[metric];
  const draft = todayVal ?? entries.at(-1)?.v ?? 60;
  const [input, setInput] = useState(Math.round(draft * 10) / 10);
  // Переключение метрики или изменение сохранённых данных извне — подтягиваем актуальное значение в степпер
  useEffect(() => { setInput(Math.round(draft * 10) / 10); }, [metric, todayVal]);
  const save = () => up((s) => ({ measurements: { ...(s.measurements || {}), [k]: { ...(s.measurements?.[k] || {}), [metric]: input } } }));
  const current = BODY_MEASUREMENTS.find((m) => m.id === metric);
  const delta = entries.length > 1 ? Math.round((entries.at(-1).v - entries[0].v) * 10) / 10 : 0;

  return (
    <Card T={T} className="mt-3">
      <div className="flex items-center gap-3 mb-3">
        <Ruler size={20} color={T.a} />
        <div className="flex-1">
          <div className="font-semibold">Замеры тела</div>
          <Muted size={12}>{delta !== 0 ? `${delta > 0 ? "+" : ""}${delta} см за период на графике` : "Отмечай раз в 1–2 недели — так честнее видно тренд"}</Muted>
        </div>
      </div>
      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar" style={{ paddingBottom: 2 }}>
        {BODY_MEASUREMENTS.map((m) => (
          <Chip key={m.id} T={T} on={metric === m.id} onClick={() => setMetric(m.id)}>{m.label}</Chip>
        ))}
      </div>
      <div className="flex items-center justify-between mb-3">
        <Stepper T={T} value={input} onChange={setInput} unit="см" min={10} step={0.5} />
        <Ghost T={T} onClick={save}>{todayVal != null ? "Обновить" : "Записать"}</Ghost>
      </div>
      <WeightChart T={T} entries={entries} label={`График: ${current.label}`} />
    </Card>
  );
}

// Вес изменился заметно с последнего пересчёта нормы — раз в ~2 недели предлагаем обновить,
// а не спрашиваем на каждый чих
function weightNudge(st) {
  const entries = Object.entries(st.weight || {}).sort(([a], [b]) => (a < b ? 1 : -1));
  if (!entries.length || !st.profile) return null;
  const latest = entries[0][1];
  const diff = Math.abs(latest - (st.profile.weight || latest));
  const daysSinceDismiss = st.normNudgeAt ? (Date.now() - st.normNudgeAt) / 86400000 : 999;
  if (diff >= 1 && daysSinceDismiss >= 14) return latest;
  return null;
}

function RecalcSheet({ T, st, up, onClose }) {
  const p = st.profile;
  const latest = Object.entries(st.weight || {}).sort(([a], [b]) => (a < b ? 1 : -1))[0]?.[1];
  const [weight, setWeight] = useState(Math.round((latest ?? p.weight) * 10) / 10);
  const apply = () => {
    up((s) => ({ profile: { ...s.profile, weight }, normNudgeAt: Date.now() }));
    tapFeedback(); // раньше здесь вызывался haptic(), которого в этой области нет, — кнопка роняла приложение
    onClose();
  };
  const dismiss = () => { up({ normNudgeAt: Date.now() }); onClose(); };
  return (
    <Sheet T={T} title="Пересчитать норму" sub={`Сейчас в анкете указано ${p.weight} кг.`} onClose={onClose}>
      <label className="flex items-center justify-between rounded-xl px-4 py-3 mb-4" style={{ border: `1px solid ${T.line}`, background: T.card }}>
        <span style={{ fontSize: 14 }}>Текущий вес</span>
        <Stepper T={T} value={weight} onChange={setWeight} unit="кг" min={20} step={0.2} />
      </label>
      <Muted size={13} className="mb-4">Калории и БЖУ пересчитаются от нового веса. Остальные данные анкеты не изменятся.</Muted>
      <Primary T={T} onClick={apply}>Пересчитать норму</Primary>
      <Ghost T={T} onClick={dismiss}>Не сейчас</Ghost>
    </Sheet>
  );
}

function HealthScreen({ T, st, up, openWellbeing, openRecalc }) {
  const k = keyOf(new Date());
  const steps = Number(st.steps[k]) || 0;
  const sleep = st.sleep[k] || { hours: 0, quality: 3 };
  const wellToday = st.wellbeing[k];
  const week = weekAgoKeys();
  const stepsWeek = week.map((dk) => ({ k: dk, v: Number(st.steps[dk]) || 0 }));
  const sleepWeek = week.map((dk) => ({ k: dk, v: Number(st.sleep[dk]?.hours) || 0 }));
  const avgSleep = sleepWeek.filter((x) => x.v > 0);
  const avgSleepVal = avgSleep.length ? (avgSleep.reduce((a, x) => a + x.v, 0) / avgSleep.length).toFixed(1) : null;
  const setSteps = (v) => up((s) => ({ steps: { ...s.steps, [k]: Math.max(0, v) } }));
  const setSleep = (patch) => up((s) => ({ sleep: { ...s.sleep, [k]: { ...(s.sleep[k] || { hours: 0, quality: 3 }), ...patch } } }));
  const recent = Object.entries(st.wellbeing || {}).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 7);
  const weightEntries = Object.entries(st.weight || {}).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-16).map(([dk, v]) => ({ k: dk, v: Number(v) }));
  const weightToday = st.weight[k];
  const weightDraft = weightToday ?? weightEntries.at(-1)?.v ?? st.profile?.weight ?? 70;
  const [weightInput, setWeightInput] = useState(Math.round(weightDraft * 10) / 10);
  const saveWeight = () => up((s) => ({ weight: { ...s.weight, [k]: weightInput } }));
  const weightDelta = weightEntries.length > 1 ? Math.round((weightEntries.at(-1).v - weightEntries[0].v) * 10) / 10 : 0;

  const native = isCapacitorNative();
  const hk = st.healthKit || { connected: false, lastSyncAt: 0 };
  const [hkBusy, setHkBusy] = useState(false);
  const [hkError, setHkError] = useState(null);
  const connectHealth = async () => {
    setHkBusy(true); setHkError(null);
    try {
      const granted = await requestHealthAccess();
      if (!granted) { setHkError("Доступ не дан, либо Здоровье недоступно на этом устройстве."); setHkBusy(false); return; }
      const res = await syncHealthData(up);
      if (!res.stepsCount && !res.weightCount) setHkError("Подключилось, но за последние дни в Здоровье нет ни шагов, ни веса.");
    } catch (e) {
      setHkError("Не получилось связаться со Здоровьем. Попробуй ещё раз.");
    }
    setHkBusy(false);
  };

  return (
    <>
      <H1>Здоровье</H1>
      <Muted className="mt-1 mb-4">Шаги, сон и самочувствие. Всё хранится только у тебя в Telegram.</Muted>

      {native && (
        <Card T={T} className="mb-3">
          <div className="flex items-center gap-3 mb-2">
            <Heart size={20} color={T.a} />
            <div className="flex-1">
              <div className="font-semibold">Apple Health</div>
              <Muted size={12}>
                {hk.connected
                  ? `Подключено · синхронизация ${hk.lastSyncAt ? new Date(hk.lastSyncAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "ещё не было"}`
                  : "Шаги и вес можно подтягивать из Здоровья автоматически"}
              </Muted>
            </div>
          </div>
          <Muted size={12} className="mb-3">Сон Здоровье не передаёт — этого не умеет используемый модуль, вноси его вручную, как и раньше. Тренировки не импортируются, чтобы не путать с отметками «выполнено» в приложении.</Muted>
          {hkError && <Muted size={12} className="mb-2" style={{ color: "#ff6b6b" }}>{hkError}</Muted>}
          <Ghost T={T} onClick={connectHealth} disabled={hkBusy}>
            {hkBusy ? "Синхронизирую…" : hk.connected ? "Синхронизировать сейчас" : "Подключить Apple Health"}
          </Ghost>
        </Card>
      )}

      <Card T={T}>
        <div className="flex items-center gap-3 mb-2">
          <Activity size={20} color={T.a} />
          <div className="flex-1">
            <div className="font-semibold">Шаги</div>
            <Muted size={12}>{steps.toLocaleString("ru-RU")} из {STEP_GOAL.toLocaleString("ru-RU")}</Muted>
          </div>
        </div>
        <div className="rounded-full mb-3 overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ width: `${Math.min(100, (steps / STEP_GOAL) * 100)}%`, height: "100%", background: T.grad, transition: "width .4s ease" }} />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => setSteps(steps + 1000)} className="rounded-xl py-2 font-medium" style={{ border: `1px solid ${T.line}`, background: T.card, color: "#fff" }}>+1000</button>
          <button onClick={() => setSteps(steps + 3000)} className="rounded-xl py-2 font-medium" style={{ border: `1px solid ${T.line}`, background: T.card, color: "#fff" }}>+3000</button>
          <button onClick={() => setSteps(0)} className="rounded-xl py-2 flex items-center justify-center" style={{ border: `1px solid ${T.line}`, background: T.card, color: "#fff" }} aria-label="Сбросить шаги"><RotateCcw size={16} /></button>
        </div>
        <Muted size={12} className="mb-2">За неделю</Muted>
        <MiniBars T={T} values={stepsWeek} max={Math.max(STEP_GOAL, ...stepsWeek.map((x) => x.v))} goal={STEP_GOAL} />
      </Card>

      {weightNudge(st) != null && (
        <Card T={T} className="mt-3" onClick={openRecalc} style={{ border: `1px solid ${T.a}` }}>
          <div className="flex items-center gap-3">
            <Scale size={20} color={T.a} />
            <div className="flex-1">
              <div className="font-semibold">Вес изменился</div>
              <Muted size={12}>По записям сейчас {weightNudge(st)} кг, а в анкете {st.profile.weight} кг. Пересчитать норму КБЖУ?</Muted>
            </div>
            <ChevronRight size={18} color={MUTED} />
          </div>
        </Card>
      )}

      <Card T={T} className="mt-3">
        <div className="flex items-center gap-3 mb-3">
          <Scale size={20} color={T.a} />
          <div className="flex-1">
            <div className="font-semibold">Вес тела</div>
            <Muted size={12}>{weightDelta !== 0 ? `${weightDelta > 0 ? "+" : ""}${weightDelta} кг за период на графике` : "Отмечай раз в несколько дней — так честнее видно тренд"}</Muted>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <Stepper T={T} value={weightInput} onChange={setWeightInput} unit="кг" min={20} step={0.2} />
          <Ghost T={T} onClick={saveWeight}>{weightToday != null ? "Обновить" : "Записать"}</Ghost>
        </div>
        <WeightChart T={T} entries={weightEntries} />
      </Card>

      <MeasurementsCard T={T} st={st} up={up} />

      <Card T={T} className="mt-3">
        <div className="flex items-center gap-3 mb-3">
          <Moon size={20} color={T.a} />
          <div className="flex-1">
            <div className="font-semibold">Сон</div>
            <Muted size={12}>Прошлой ночью{avgSleepVal ? `, в среднем за неделю ${avgSleepVal} ч` : ""}</Muted>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <Stepper T={T} value={sleep.hours} onChange={(v) => setSleep({ hours: Math.max(0, Math.min(14, v)) })} unit="ч" min={0} />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setSleep({ quality: n })} aria-label={`Качество сна ${n} из 5`}
                className="rounded-full flex items-center justify-center" style={{ width: 28, height: 28, background: n <= sleep.quality ? T.grad : "rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: n <= sleep.quality ? T.on : MUTED }}>{n}</span>
              </button>
            ))}
          </div>
        </div>
        <Muted size={12} className="mb-2">За неделю, часы</Muted>
        <MiniBars T={T} values={sleepWeek} max={Math.max(SLEEP_GOAL, ...sleepWeek.map((x) => x.v))} goal={SLEEP_GOAL} />
      </Card>

      <Card T={T} className="mt-3" onClick={() => openWellbeing(false)}>
        <div className="flex items-center gap-3">
          <Wind size={20} color={T.a} />
          <div className="flex-1">
            <div className="font-semibold">Самочувствие сегодня</div>
            <Muted size={12}>{wellToday ? `Энергия ${wellToday.energy}/5 · настроение ${wellToday.mood}/5 · боль ${6 - wellToday.soreness}/5` : "Ещё не отмечено — нажми, чтобы записать"}</Muted>
          </div>
          <ChevronRight size={18} color={MUTED} />
        </div>
      </Card>

      {recent.length > 0 && (
        <>
          <H2>История самочувствия</H2>
          <div className="flex flex-col gap-2">
            {recent.map(([dk, w]) => (
              <Card key={dk} style={{ padding: "12px 16px" }} T={T}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{dk}</span>
                  <span style={{ fontSize: 12, color: MUTED }}>энергия {w.energy} · настроение {w.mood} · боль {6 - w.soreness}</span>
                </div>
                {w.note && <Muted size={12} className="mt-1">{w.note}</Muted>}
              </Card>
            ))}
          </div>
        </>
      )}
      {!(native && hk.connected) && (
        <Muted size={12} className="mt-4">
          {native
            ? "Шаги можно подтягивать автоматически — подключи Apple Health в карточке выше."
            : "Шагомер по датчикам телефона напрямую подключить нельзя — вводи шаги вручную или переноси из приложения-часов."}
        </Muted>
      )}
    </>
  );
}

/* ============ Юридическая информация ============ */
// Документы лежат на самом сайте (public/legal, короткие адреса — в public/_redirects).
// Ссылки относительные: открываются на том адресе, где сейчас работает сайт (netlify.app или ritmru.ru);
// в нативных сборках, где адрес не http(s), — на основном домене.
const LEGAL_SITE = "https://ritmru.ru";
const LEGAL_DOCS = {
  offer: ["Публичная оферта", "/offer"],
  terms: ["Пользовательское соглашение", "/terms"],
  privacy: ["Политика конфиденциальности", "/privacy"],
  consent: ["Согласие на обработку данных", "/consent"],
};
const LEGAL = {
  support: "@doltiii",
  email: "dimatdt2011@gmail.com",
  offerUrl: LEGAL_DOCS.offer[1],
  privacyUrl: LEGAL_DOCS.privacy[1],
  termsUrl: LEGAL_DOCS.terms[1],
  consentUrl: LEGAL_DOCS.consent[1],
  verificationWord: "Plaтега",
};

function openExternal(url) {
  const u = String(url);
  const origin = /^https?:$/.test(window.location.protocol) ? window.location.origin : LEGAL_SITE;
  const absolute = u.startsWith("http") ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`;
  openExternalLink(absolute);
}

function LegalSheet({ T, type, onClose }) {
  const [title, url] = LEGAL_DOCS[type] || LEGAL_DOCS.terms;
  return (
    <Sheet T={T} title={title} onClose={onClose}>
      <Muted size={13} className="mb-5">
        Документ постоянно доступен пользователю по кнопке ниже. Для банковской проверки используется актуальная версия проекта.
      </Muted>
      <Card T={T} style={{ borderRadius: 20 }}>
        <div className="font-semibold mb-2">{title}</div>
        <Muted size={13}>
          Актуальная редакция документа размещена на отдельной публичной странице RITM и постоянно доступна пользователю.
        </Muted>
      </Card>
      <Primary T={T} onClick={() => openExternal(url)}>
        Открыть документ
      </Primary>
    </Sheet>
  );
}



/* ============ Pro: расширенная статистика ============ */
function ProStats({ T, st, norm }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate() - (6 - i)); return d;
  });
  const foodTotals = days.map((d) => sumFood(st.food[keyOf(d)] || []));
  const avgKcal = Math.round(foodTotals.reduce((a, x) => a + x.kcal, 0) / 7);
  const avgProtein = Math.round(foodTotals.reduce((a, x) => a + x.p, 0) / 7);
  const completedTasks = days.reduce((n, d) => {
    const k = keyOf(d);
    return n + (st.tasks[k] || []).filter((t) => t.done).length + (st.dailyTasks || []).filter((t) => taskOccursOn(t, d) && t.log?.[k]).length;
  }, 0);
  const trainingDays = days.filter((d) => st.done[keyOf(d)] || st.runDone[keyOf(d)]).length;
  const proteinPct = norm?.protein ? Math.min(100, Math.round((avgProtein / norm.protein) * 100)) : 0;
  const kcalPct = norm?.kcal ? Math.min(100, Math.round((avgKcal / norm.kcal) * 100)) : 0;
  const tip = proteinPct < 80 ? "Белка в среднем мало — добавь белковый продукт к 1–2 приёмам пищи." : kcalPct < 85 ? "Средняя калорийность ниже цели — проверь, не пропускаешь ли приёмы пищи." : "Темп питания выглядит ровно. Сохраняй режим и отслеживай тренировки.";
  return (
    <Card T={T} className="mb-4" style={{ borderRadius: 22, border: `1px solid ${T.a}66` }}>
      <div className="flex items-center gap-2 mb-1"><Crown size={17} color={T.a} /><span className="font-semibold">Pro · статистика за 7 дней</span></div>
      <Muted size={12} className="mb-3">Короткий отчёт по питанию, активности и задачам.</Muted>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><Muted size={11}>Средние ккал</Muted><div className="font-semibold">{avgKcal} / {norm?.kcal || "—"}</div><Muted size={11}>{kcalPct}% цели</Muted></div>
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><Muted size={11}>Средний белок</Muted><div className="font-semibold">{avgProtein} / {norm?.protein || "—"} г</div><Muted size={11}>{proteinPct}% цели</Muted></div>
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><Muted size={11}>Активные дни</Muted><div className="font-semibold">{trainingDays} / 7</div></div>
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}><Muted size={11}>Задачи выполнено</Muted><div className="font-semibold">{completedTasks}</div></div>
      </div>
      <div className="rounded-xl p-3 mt-2" style={{ background: "rgba(255,255,255,.04)" }}><b style={{ fontSize: 12 }}>💡 RITM:</b><Muted size={12} style={{ display: "inline" }}> {tip}</Muted></div>
    </Card>
  );
}

// Сводка за неделю для ИИ-разбора — та же основа расчётов, что и в ProStats, но текстом для промпта
function weeklyInsightContext(st, norm) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d;
  });
  const foodTotals = days.map((d) => sumFood(st.food[keyOf(d)] || []));
  const avgKcal = Math.round(foodTotals.reduce((a, x) => a + x.kcal, 0) / 7);
  const avgProtein = Math.round(foodTotals.reduce((a, x) => a + x.p, 0) / 7);
  const trainingDays = days.filter((d) => st.done[keyOf(d)] || st.runDone[keyOf(d)]).length;
  const trainStreak = streakOf((k) => !!st.done[k]);
  const runStreak = streakOf((k) => !!st.runDone[k]);
  const weightEntries = Object.entries(st.weight || {}).sort(([a], [b]) => (a < b ? -1 : 1));
  const weightTrend = weightEntries.length >= 2
    ? Number(weightEntries[weightEntries.length - 1][1]) - Number(weightEntries[Math.max(0, weightEntries.length - 8)][1])
    : null;
  const bits = [
    norm ? `норма ${norm.kcal} ккал и ${norm.protein} г белка в день` : null,
    `в среднем за неделю съедено ${avgKcal} ккал, белка ${avgProtein} г`,
    `активных дней (тренировка или бег) за неделю: ${trainingDays} из 7`,
    trainStreak ? `текущая серия силовых тренировок: ${trainStreak} дн. подряд` : "силовых тренировок подряд сейчас нет",
    runStreak ? `текущая серия пробежек: ${runStreak} дн. подряд` : null,
    weightTrend != null ? `вес тела за последние записи изменился на ${weightTrend > 0 ? "+" : ""}${weightTrend.toFixed(1)} кг` : null,
  ];
  return bits.filter(Boolean).join("; ");
}

/* ============ Pro: ИИ-разбор недели ============
   Раз в неделю по запросу — короткий персональный разбор от того же ИИ, что распознаёт еду.
   Результат кешируется в st.aiInsight по ключу недели (понедельник), чтобы не тратить запросы
   на каждое открытие «Прогресса» — обновить можно вручную кнопкой. */
function AIWeeklyInsight({ T, st, up, norm }) {
  const weekKey = keyOf(weekDays()[0]);
  const cached = st.aiInsight?.weekKey === weekKey ? st.aiInsight : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const text = await fetchWeeklyInsight(weeklyInsightContext(st, norm));
      up({ aiInsight: { weekKey, text, at: Date.now() } });
    } catch (e) {
      setError(explainAiError(e) || "Не получилось получить разбор. Попробуй ещё раз позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card T={T} className="mb-4" style={{ borderRadius: 22, border: `1px solid ${T.a}66` }}>
      <div className="flex items-center gap-2 mb-1"><Sparkles size={17} color={T.a} /><span className="font-semibold">ИИ-разбор недели</span></div>
      <Muted size={12} className="mb-3">Персональный итог по тренировкам, питанию и весу за последние 7 дней.</Muted>
      {cached ? (
        <>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{cached.text}</div>
          <button onClick={generate} disabled={loading} className="flex items-center gap-1 mt-3" style={{ fontSize: 12, color: MUTED }}>
            <RefreshCcw size={12} /> {loading ? "Обновляю…" : "Обновить разбор"}
          </button>
        </>
      ) : loading ? (
        <Loader T={T} text="Готовлю разбор недели" />
      ) : (
        <Ghost T={T} onClick={generate}><Sparkles size={16} /> Получить разбор недели</Ghost>
      )}
      {error && <Muted size={12} className="mt-2" style={{ color: T.a }}>{error}</Muted>}
    </Card>
  );
}

/* ============ Настройки ============ */
function SettingsScreen({ T, st, up, openPay, go, norm, lifetimePro, openLegal, sync, onSyncNow, proUntil, openRecalc, openTabs, openTodayLayout, openTour, promoAdmin, openRedeemPromo, openPromoAdmin, openAbout, openAdminStats, openLogin, openInstall, openAdminPro, onProRestored, openAdminMigrate }) {
  const p = st.profile;
  const al = p.allergies || [];
  const toggleAllergy = (id) => up((s) => {
    const cur = s.profile.allergies || [];
    return { profile: { ...s.profile, allergies: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } };
  });
  const openSupport = () => {
    const tg = tgApp();
    if (tg?.openTelegramLink) tg.openTelegramLink("https://t.me/doltiii");
    else openExternalLink("https://t.me/doltiii");
  };
  const [errorLog] = useState(() => readErrorLog());
  const [logCopied, setLogCopied] = useState(false);
  const copyErrorLog = async () => {
    try { await navigator.clipboard.writeText(errorLogText()); setLogCopied(true); setTimeout(() => setLogCopied(false), 2000); }
    catch (e) { /* буфер обмена недоступен — ничего страшного, это необязательная функция */ }
  };
  const Row = ({ title, sub, on, onChange }) => (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <Muted size={12}>{sub}</Muted>
      </div>
      <Toggle T={T} on={on} onChange={onChange} label={title} />
    </div>
  );
  return (
    <div>
      <div className="flex items-center gap-3">
        <button onClick={() => go("today")} aria-label="Назад" className="rounded-full p-2" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
          <ChevronLeft size={18} />
        </button>
        <H1>Настройки</H1>
      </div>

      {isWeb() && <AccountCard T={T} sync={sync} onSyncNow={onSyncNow} openLogin={openLogin} openInstall={openInstall} />}
      {inTelegram() && <div className="mt-4"><SyncCard T={T} sync={sync} onSyncNow={onSyncNow} /></div>}

      <Card T={T} className="mt-4" style={{ borderRadius: 24, boxShadow: st.pro ? T.glow : "none" }}>
        <div className="flex items-center gap-3 mb-1">
          <Crown size={20} color={st.pro ? T.a : "#fff"} />
          <span className="font-semibold">{lifetimePro ? "Pro навсегда" : proUntil ? `Pro активна до ${proUntilText(proUntil)}` : st.pro ? "Pro активна" : "Бесплатный план"}</span>
        </div>
        <Muted size={13} className={st.pro ? "" : "mb-4"}>
          {st.pro ? "Все функции открыты: расширенная статистика, ИИ-разбор недели, безлимитное распознавание и дополнительные возможности." : "Pro добавляет расширенную статистику, еженедельный ИИ-разбор прогресса, безлимитное распознавание еды, рецепты от ИИ, полную историю и полный беговой план."}
        </Muted>
        {!st.pro && <Primary T={T} onClick={openPay}>Открыть Pro от {RUB_PRICE.month} ₽</Primary>}
      </Card>

      {!lifetimePro && proUntil > 0 && <div className="mt-3"><Ghost T={T} onClick={openPay}>Продлить Pro</Ghost></div>}
      {!lifetimePro && <div className="mt-2"><Ghost T={T} onClick={openRedeemPromo}><Sparkles size={16} /> Есть промокод?</Ghost></div>}
      {!lifetimePro && (inTelegram() || (isWeb() && readSession())) && <RestorePurchaseButton T={T} onRestored={onProRestored} />}
      {promoAdmin && <div className="mt-2"><Ghost T={T} onClick={openPromoAdmin}><Crown size={16} /> Промокоды (админ)</Ghost></div>}
      {promoAdmin && <div className="mt-2"><Ghost T={T} onClick={openAdminStats}><BarChart3 size={16} /> Статистика (админ)</Ghost></div>}
      {promoAdmin && <div className="mt-2"><Ghost T={T} onClick={openAdminPro}><UserRound size={16} /> Pro пользователя (поддержка)</Ghost></div>}
      {promoAdmin && <div className="mt-2"><Ghost T={T} onClick={openAdminMigrate}><Download size={16} /> Перенос со старого сайта Netlify</Ghost></div>}
      {st.pro && <ProStats T={T} st={st} norm={norm} />}

      <H2>Тема</H2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(THEMES).map(([id, th]) => (
          <button key={id} onClick={() => up({ theme: id })} className="rounded-2xl p-2 text-left"
            style={{ border: `1px solid ${st.theme === id ? th.a : T.line}`, boxShadow: st.theme === id ? th.glow : "none", background: T.card, color: "#fff" }}>
            <div className="rounded-xl mb-2" style={{ height: 76, background: th.preview }} />
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="font-medium" style={{ fontSize: 14 }}>{th.name}</span>
              {st.theme === id && <Check size={15} />}
            </div>
          </button>
        ))}
        {(() => {
          const custom = themeFromColor(st.customColor);
          return (
            <button onClick={() => up({ theme: "custom" })} className="rounded-2xl p-2 text-left"
              style={{ border: `1px solid ${st.theme === "custom" ? custom.a : T.line}`, boxShadow: st.theme === "custom" ? custom.glow : "none", background: T.card, color: "#fff" }}>
              <div className="rounded-xl mb-2 relative overflow-hidden" style={{ height: 76, background: custom.preview }}>
                {/* Нативный input[type=color] — цветовое колесо браузера/ОС, значит буквально любой цвет,
                    без необходимости рисовать свой color-picker. Растянут поверх превью и прозрачен. */}
                <input type="color" aria-label="Свой акцентный цвет" value={/^#[0-9a-f]{6}$/i.test(st.customColor || "") ? st.customColor : "#FF6B6B"}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => up({ theme: "custom", customColor: e.target.value })}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: 0, padding: 0 }} />
                <div style={{ position: "absolute", right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13, background: custom.a, border: "2px solid rgba(255,255,255,.7)", pointerEvents: "none" }} />
              </div>
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="font-medium" style={{ fontSize: 14 }}>Свой цвет</span>
                {st.theme === "custom" && <Check size={15} />}
              </div>
            </button>
          );
        })()}
      </div>
      <Muted size={12} className="mt-2">Нажми на кружок в превью «Свой цвет», чтобы выбрать любой оттенок — остальные цвета фона и свечения подстроятся под него сами.</Muted>

      <H2>Напоминания</H2>
      <Card T={T} style={{ paddingTop: 8, paddingBottom: 8 }}>
        <div className="flex items-center gap-3 py-2">
          <div className="rounded-xl p-2" style={{ background: T.card, border: `1px solid ${T.line}` }}><Bell size={18} /></div>
          <div className="flex-1">
            <div className="font-semibold">Умные напоминания</div>
            <Muted size={12}>RITM напоминает о плане, тренировке и задачах в заданное время.</Muted>
          </div>
          <Toggle T={T} on={st.reminders?.enabled ?? st.notify} onChange={(v) => up((s) => ({ notify: v, reminders: { ...DEFAULT_REMINDERS, ...(s.reminders || {}), enabled: v } }))} label="Умные напоминания" />
        </div>
        {(st.reminders?.enabled ?? st.notify) && (
          <>
            <div className="rounded-2xl mt-3 p-3" style={{ border: `1px solid ${T.line}`, background: "rgba(255,255,255,.025)" }}>
              <div className="flex items-center gap-2 mb-2"><Clock size={15} /><span className="font-medium">План на день</span></div>
              <div className="flex items-center justify-between gap-3">
                <Muted size={12}>Во сколько напомнить о сегодняшнем плане</Muted>
                <input type="time" value={st.reminders?.planTime || "08:00"} onChange={(e) => up((s) => ({ reminders: { ...DEFAULT_REMINDERS, ...(s.reminders || {}), planTime: e.target.value } }))} className="rounded-xl px-3 py-2 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff" }} />
              </div>
            </div>
            <div className="rounded-2xl mt-2 p-3" style={{ border: `1px solid ${T.line}`, background: "rgba(255,255,255,.025)" }}>
              <div className="flex items-center gap-2 mb-2"><Dumbbell size={15} /><span className="font-medium">Тренировка</span></div>
              <div className="flex items-center justify-between gap-3">
                <Muted size={12}>Напомнить в день силовой или беговой тренировки</Muted>
                <Toggle T={T} on={st.reminders?.training ?? true} onChange={(v) => up((s) => ({ reminders: { ...DEFAULT_REMINDERS, ...(s.reminders || {}), training: v } }))} label="Тренировки" />
              </div>
              <div className="flex items-center justify-between gap-3 mt-3">
                <Muted size={12}>Время напоминания</Muted>
                <input type="time" value={st.reminders?.trainingTime || "18:00"} onChange={(e) => up((s) => ({ reminders: { ...DEFAULT_REMINDERS, ...(s.reminders || {}), trainingTime: e.target.value } }))} className="rounded-xl px-3 py-2 bg-transparent outline-none" style={{ border: `1px solid ${T.line}`, color: "#fff" }} />
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div><div className="font-medium">Задачи по времени</div><Muted size={12}>Напоминать о ежедневных и разовых задачах в указанное время.</Muted></div>
              <Toggle T={T} on={st.reminders?.tasks ?? true} onChange={(v) => up((s) => ({ reminders: { ...DEFAULT_REMINDERS, ...(s.reminders || {}), tasks: v } }))} label="Задачи" />
            </div>
            <Muted size={11}>Важно: в Mini App автоматические напоминания работают, когда RITM открыт. Для фоновых сообщений от бота нужен отдельный серверный планировщик и база настроек.</Muted>
          </>
        )}
      </Card>

      <H2>Аллергии</H2>
      <Card T={T}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ALLERGENS).map(([id, a]) => (
            <Chip key={id} T={T} on={al.includes(id)} onClick={() => toggleAllergy(id)}>{a.label}</Chip>
          ))}
        </div>
        <Muted size={12} className="mt-3">Рецепты с этими продуктами скрываются, а при распознавании еды появится предупреждение.</Muted>
      </Card>

      <H2>Анкета</H2>
      <Card T={T}>
        <div style={{ fontSize: 15, lineHeight: 1.6 }}>
          Цель: {LABELS.goal[p.goal]}<br />
          Уровень: {LABELS.level[p.level]}<br />
          {p.age} лет, {p.height} см, {p.weight} кг<br />
          Место: {LABELS.place[p.place]}, {p.days} силовые в неделю<br />
          Норма: {norm.kcal.toLocaleString("ru-RU")} ккал, Б {norm.protein}, Ж {norm.fat}, У {norm.carbs}
          {(p.goal === "mass" || p.goal === "fat") && p.targetKg > 0 && (() => {
            const kgWeek = (p.rate || 0) / 100 * p.weight;
            const eta = kgWeek > 0 ? Math.round(p.targetKg / kgWeek) : 0;
            return <><br />Цель: {p.goal === "mass" ? "+" : "−"}{p.targetKg} кг, примерно {eta} {weeksWord(eta)}</>;
          })()}
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <Ghost T={T} onClick={openRecalc}><Scale size={16} /> Обновить вес и пересчитать норму</Ghost>
          <Ghost T={T} onClick={() => up({ profile: null })}>Пройти анкету заново</Ghost>
        </div>
      </Card>

      <H2>Разделы приложения</H2>
      <Muted size={13} className="mb-2">Выбери, какие вкладки показывать внизу экрана, и в каком порядке.</Muted>
      <div className="flex flex-col gap-2">
        <Ghost T={T} onClick={openTodayLayout}><LayoutDashboard size={16} /> Настроить главный экран</Ghost>
        <Ghost T={T} onClick={openTabs}><LayoutGrid size={16} /> Настроить разделы</Ghost>
        <Ghost T={T} onClick={openTour}><PlayCircle size={16} /> Показать обучение заново</Ghost>
      </div>

      <div className="mt-2"><Ghost T={T} onClick={openAbout}><Folder size={16} /> О приложении, экспорт и документы</Ghost></div>

      <H2>Поддержка</H2>
      <div className="flex flex-col gap-2">
        <Ghost T={T} onClick={openSupport}><Send size={16} /> Написать в поддержку ({LEGAL.support})</Ghost>
        {errorLog.length > 0 && (
          <Ghost T={T} onClick={copyErrorLog}>
            <AlertTriangle size={16} /> {logCopied ? "Скопировано!" : `Скопировать журнал ошибок (${errorLog.length})`}
          </Ghost>
        )}
      </div>
      {errorLog.length > 0 && (
        <Muted size={11} className="mt-2">Если что-то ведёт себя не так — скопируй журнал и пришли в поддержку, так проще понять, что случилось.</Muted>
      )}
    </div>
  );
}

// Экспорт CSV, юридические документы и служебная информация — реже нужные пункты,
// вынесенные из основного экрана Настроек в отдельный под-экран, чтобы не перегружать его.
function AboutSheet({ T, st, openLegal, onClose }) {
  return (
    <Sheet T={T} title="О приложении" onClose={onClose}>
      <H2>Экспорт данных</H2>
      <Muted size={13} className="mb-2">Файлы CSV — открываются в Excel, Google Таблицах, Numbers.</Muted>
      <Card T={T} style={{ paddingTop: 4, paddingBottom: 4 }}>
        <button onClick={() => exportWorkouts(st)} className="w-full flex items-center gap-3 py-3 text-left" style={{ color: "#fff" }}>
          <Download size={18} color={MUTED} /><span className="flex-1 font-medium">Тренировки</span>
          <Muted size={12}>{(st.trainHistory || []).length}</Muted>
        </button>
        <div style={{ height: 1, background: T.line }} />
        <button onClick={() => exportFood(st)} className="w-full flex items-center gap-3 py-3 text-left" style={{ color: "#fff" }}>
          <Download size={18} color={MUTED} /><span className="flex-1 font-medium">Питание</span>
          <Muted size={12}>{Object.keys(st.food || {}).length} дн.</Muted>
        </button>
        <div style={{ height: 1, background: T.line }} />
        <button onClick={() => exportWeight(st)} className="w-full flex items-center gap-3 py-3 text-left" style={{ color: "#fff" }}>
          <Download size={18} color={MUTED} /><span className="flex-1 font-medium">Вес</span>
          <Muted size={12}>{Object.keys(st.weight || {}).length} зап.</Muted>
        </button>
      </Card>

      <H2>Документы и оплата</H2>
      <Card T={T}>
        <div className="flex flex-col gap-2">
          <Ghost T={T} onClick={() => openLegal("offer")}>Публичная оферта</Ghost>
          <Ghost T={T} onClick={() => openLegal("terms")}>Пользовательское соглашение</Ghost>
          <Ghost T={T} onClick={() => openLegal("privacy")}>Политика конфиденциальности</Ghost>
          <Ghost T={T} onClick={() => openLegal("consent")}>Согласие на обработку данных</Ghost>
        </div>
      </Card>

      <Card T={T} className="mt-3">
        <div className="font-semibold mb-1">Информация для проверки</div>
        <Muted size={12}>Кодовое слово: <span style={{ color: "#fff", fontWeight: 700 }}>{LEGAL.verificationWord}</span></Muted>
        <Muted size={12} className="mt-1">Поддержка: {LEGAL.support}</Muted>
      </Card>

      <Muted size={12} className="mt-6">
        Программа носит рекомендательный характер и не заменяет консультацию врача или тренера.
      </Muted>
    </Sheet>
  );
}

/* ============ Сайт: вход, установка приложения, аккаунт ============
   Только вне Telegram и нативных сборок (isWeb). Вход — через Telegram-бота: тот же аккаунт,
   что и в Mini App, поэтому Pro, промокоды и данные общие. Без входа можно пользоваться
   как гость — данные тогда только на этом устройстве, а ИИ и оплата просят войти. */
const LOGIN_ERRORS = {
  telegram_token_missing: "Вход ещё не настроен: на сервере не задан BOT_TOKEN.",
  telegram_token_format: "Вход ещё не настроен: BOT_TOKEN на сервере записан неверно.",
  telegram_unreachable: "Сервер не смог связаться с Telegram. Попробуй через минуту.",
};
// После входа страница перезагружается (меняется аккаунт и хранилище данных) — что открыть
// после перезагрузки, запоминаем здесь (например, окно оплаты, с которого человек пошёл входить).
const AFTER_LOGIN_KEY = "ritm-after-login";
function finishLogin(after) {
  try { if (after) sessionStorage.setItem(AFTER_LOGIN_KEY, after); } catch (e) { /* приватный режим */ }
  window.location.reload();
}

function TelegramLoginPanel({ T, after }) {
  const [req, setReq] = useState(null); // { token, secret, botUrl, bot, expiresAt, botReady, botError }
  const [status, setStatus] = useState("loading"); // loading | ready | waiting | done | error
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false); // ждём подтверждения дольше 20 секунд — показываем запасной способ
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (status !== "waiting") { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(t);
  }, [status, req]);
  const manualCommand = req ? `/start login_${req.token}` : "";
  const copyCommand = async () => {
    try { await navigator.clipboard.writeText(manualCommand); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { /* буфер недоступен — команду видно на экране */ }
  };

  const create = async () => {
    setStatus("loading");
    setError("");
    try {
      setReq(await startTelegramLogin());
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(LOGIN_ERRORS[e.message] || "Не удалось начать вход. Проверь интернет и попробуй ещё раз.");
    }
  };
  useEffect(() => { create(); }, []);

  // Ссылка живёт 10 минут — если человек долго не нажимал, тихо готовим новую
  useEffect(() => {
    if (status !== "ready" || !req) return undefined;
    const t = setTimeout(create, Math.max(5000, req.expiresAt - Date.now() - 30000));
    return () => clearTimeout(t);
  }, [status, req]);

  // Пока человек в Telegram — спрашиваем сервер каждые 2 секунды и сразу при возвращении на сайт
  useEffect(() => {
    if (status !== "waiting" || !req) return undefined;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const r = await pollTelegramLogin(req.token, req.secret);
        if (stopped) return;
        if (r.status === "ok") {
          stopped = true;
          saveSession(r.session, r.user);
          goal("login_done", { after: after || "welcome" });
          setStatus("done");
          finishLogin(after);
        } else if (r.status === "expired") {
          create();
        }
      } catch (e) { /* нет сети — попробуем на следующем шаге */ }
    };
    const id = setInterval(tick, 2000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [status, req]);

  if (status === "loading") return <Loader T={T} text="Готовлю вход…" />;
  if (status === "done") return <Loader T={T} text="Вход выполнен, открываю RITM…" />;
  if (status === "error") {
    return (
      <div>
        <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>
        <Ghost T={T} onClick={create}><RefreshCcw size={16} /> Попробовать снова</Ghost>
      </div>
    );
  }
  return (
    <div>
      {req.botReady === false && (
        <Card T={T} className="mb-3" style={{ border: `1px solid ${T.a}55` }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} color={T.a} className="flex-shrink-0 mt-0.5" />
            <Muted size={12}>Бот сейчас не подключён к сайту, поэтому может не ответить на «Старт». Причина: {req.botError}. Попробуй через минуту — сайт переподключает бота сам. Подробнее: {window.location.origin}/api/health</Muted>
          </div>
        </Card>
      )}
      <PrimaryLink T={T} href={req.botUrl} onClick={() => setStatus("waiting")}>
        <Send size={18} /> {status === "waiting" ? "Открыть Telegram ещё раз" : "Войти через Telegram"}
      </PrimaryLink>
      {status === "waiting" ? (
        <Card T={T} className="mt-3" style={{ animation: "rise .3s ease-out" }}>
          <div className="flex items-center gap-3">
            <span className="rounded-full flex-shrink-0" style={{ width: 18, height: 18, border: `2px solid ${T.line}`, borderTopColor: T.a, animation: "ritmSpin .9s linear infinite" }} />
            <div className="font-semibold" style={{ fontSize: 14 }}>Жду подтверждения в Telegram</div>
          </div>
          <ol className="mt-3 flex flex-col gap-1.5" style={{ fontSize: 13, color: "rgba(255,255,255,.75)", paddingLeft: 18, listStyle: "decimal" }}>
            <li>В открывшемся чате с @{req.bot} нажми «Старт» (или «Перезапустить»).</li>
            <li>Бот пришлёт сообщение — нажми под ним «Подтвердить вход».</li>
            <li>Вернись сюда — вход завершится сам.</li>
          </ol>
          {slow && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.line}`, animation: "rise .3s ease-out" }}>
              <div className="font-semibold mb-1" style={{ fontSize: 13 }}>Бот не прислал кнопку?</div>
              <Muted size={12} className="mb-2">Иногда Telegram открывает чат, но не отправляет «Старт» сам. Скопируй команду и отправь её боту @{req.bot} обычным сообщением:</Muted>
              <button onClick={copyCommand} className="w-full rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 ritm-press ritm-hover text-left"
                style={{ border: `1px dashed ${T.line}`, background: "rgba(255,255,255,0.03)", color: "#fff", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12.5 }}>
                <span className="truncate">{manualCommand}</span>
                <span className="flex-shrink-0" style={{ color: copied ? T.a : MUTED, fontFamily: BODY, fontSize: 12 }}>{copied ? "Скопировано" : "Копировать"}</span>
              </button>
              <a href={`https://t.me/${req.bot}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2" style={{ color: T.a, fontSize: 12.5 }}>Открыть чат с @{req.bot}</a>
            </div>
          )}
        </Card>
      ) : (
        <Muted size={12} className="mt-3 text-center">Откроется чат с ботом @{req.bot}. Пароль не нужен — вход подтверждается кнопкой в Telegram.</Muted>
      )}
    </div>
  );
}

function LoginSheet({ T, onClose, after }) {
  return (
    <Sheet T={T} title="Вход через Telegram" sub="Тот же аккаунт, что и в Mini App: Pro, промокоды и все данные будут общими на сайте, в приложении на телефоне и в Telegram." onClose={onClose}>
      <TelegramLoginPanel T={T} after={after} />
    </Sheet>
  );
}

// Первый экран сайта для тех, кто ещё не входил и не начал без входа.
// Главное действие — начать (анкета без регистрации): раньше первой кнопкой был вход через Telegram,
// а старт без входа шёл вторым, с предупреждением — новый посетитель упирался в выбор раньше,
// чем видел пользу. Вход — для тех, кто уже пользуется Mini App; он раскрывается по кнопке
// (и только тогда создаётся ссылка для входа).
function WebWelcome({ T, onGuest }) {
  const [showLogin, setShowLogin] = useState(false);
  const points = [
    [Dumbbell, "Программа силовых под цель", "Зал, дом или гиря — вес и повторы растут сами"],
    [Apple, "Норма калорий и БЖУ", "Калории по фото еды, штрихкоду или тексту"],
    [PlayCircle, "Гид по каждой тренировке", "Разминка, подходы с таймером отдыха и фото техники"],
  ];
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md" style={{ animation: "rise .4s ease-out" }}>
        <a href="/" className="inline-flex mb-10" style={{ color: "#fff", textDecoration: "none" }} aria-label="RITM — на главную"><Wordmark T={T} size={22} /></a>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
          Твоя программа — <span style={{ background: T.grad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>через минуту</span>
        </h1>
        <Muted className="mt-3 mb-7" size={15}>Ответь на несколько вопросов — RITM соберёт тренировки, беговой план и норму калорий. Бесплатно, без регистрации.</Muted>
        <div className="flex flex-col gap-3 mb-7">
          {points.map(([Icon, title, sub]) => (
            <div key={title} className="flex items-start gap-3">
              <span className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: T.card, border: `1px solid ${T.line}` }}><Icon size={18} color={T.a} /></span>
              <div>
                <div className="font-semibold" style={{ fontSize: 15 }}>{title}</div>
                <Muted size={13}>{sub}</Muted>
              </div>
            </div>
          ))}
        </div>
        <Primary T={T} onClick={onGuest}>Начать — анкета на минуту <ChevronRight size={18} /></Primary>
        <Muted size={12} className="mt-2 text-center">Прогресс сохранится в этом браузере. Войти через Telegram можно в любой момент — он перенесётся в аккаунт.</Muted>
        <div className="flex items-center gap-3 my-6"><span className="flex-1" style={{ height: 1, background: T.line }} /><Muted size={12}>уже пользуешься RITM в Telegram?</Muted><span className="flex-1" style={{ height: 1, background: T.line }} /></div>
        {showLogin ? (
          <div style={{ animation: "rise .3s ease-out" }}><TelegramLoginPanel T={T} /></div>
        ) : (
          <>
            <Ghost T={T} onClick={() => setShowLogin(true)}><Send size={16} /> Войти через Telegram</Ghost>
            <Muted size={12} className="mt-2 text-center">Тот же аккаунт, что в Mini App: Pro, друзья и все данные.</Muted>
          </>
        )}
      </div>
    </div>
  );
}

function InstallSteps({ T, steps }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map(([Icon, text], i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, background: T.grad, color: T.on, fontWeight: 700, fontSize: 13 }}>{i + 1}</span>
          <span className="flex-1" style={{ fontSize: 14, lineHeight: 1.4 }}>{text}</span>
          {Icon && <Icon size={18} color={MUTED} />}
        </li>
      ))}
    </ol>
  );
}

// Установка приложения: Android/компьютер — системная кнопка (beforeinstallprompt), iPhone — инструкция
function InstallSheet({ T, onClose }) {
  const inst = useInstall();
  const [result, setResult] = useState("");
  const doPrompt = async () => setResult(await inst.prompt());
  let body;
  if (inst.installed) {
    body = (
      <Card T={T}><div className="flex items-center gap-3"><Check size={20} color={T.a} /><span className="font-semibold">RITM уже установлен на это устройство</span></div></Card>
    );
  } else if (inst.ios) {
    body = inst.inApp ? (
      <>
        <Muted size={14} className="mb-4">Этот браузер не умеет добавлять сайты на экран «Домой». Открой эту страницу в Safari — нажми «…» или значок компаса и выбери «Открыть в Safari».</Muted>
        <Ghost T={T} onClick={() => { try { navigator.clipboard?.writeText(window.location.origin + "/app"); setResult("copied"); } catch (e) { /* нет буфера */ } }}>
          {result === "copied" ? <><Check size={16} /> Ссылка скопирована</> : "Скопировать ссылку"}
        </Ghost>
      </>
    ) : (
      <>
        <Muted size={14} className="mb-4">На iPhone приложение ставится прямо из Safari — без App Store, за 10 секунд. Иконка появится на экране «Домой», RITM будет открываться на весь экран, как обычное приложение.</Muted>
        <InstallSteps T={T} steps={[
          [Share, <>Нажми «Поделиться» внизу экрана Safari</>],
          [SquarePlus, <>Пролистай и выбери «На экран „Домой“»</>],
          [Check, <>Нажми «Добавить» в правом верхнем углу</>],
        ]} />
        <Muted size={12} className="mt-4">После установки войди через Telegram ещё раз: приложение на экране «Домой» хранит вход отдельно от Safari.</Muted>
      </>
    );
  } else if (inst.canPrompt) {
    body = (
      <>
        <Muted size={14} className="mb-4">RITM установится как обычное приложение: иконка на рабочем столе, отдельное окно, быстрый запуск — и та же оплата и данные, что на сайте.</Muted>
        <Primary T={T} onClick={doPrompt}><Download size={18} /> Установить RITM</Primary>
        {result === "dismissed" && <Muted size={12} className="mt-2 text-center">Установка отменена — можно повторить в любой момент из меню браузера.</Muted>}
      </>
    );
  } else if (inst.android) {
    body = (
      <>
        <Muted size={14} className="mb-4">Открой сайт в Chrome — RITM установится как приложение с иконкой на главном экране.</Muted>
        <InstallSteps T={T} steps={[
          [MoreHorizontal, <>Нажми меню ⋮ в правом верхнем углу Chrome</>],
          [Smartphone, <>Выбери «Установить приложение» (или «Добавить на главный экран»)</>],
          [Check, <>Подтверди установку</>],
        ]} />
      </>
    );
  } else {
    body = (
      <>
        <Muted size={14} className="mb-4">На компьютере RITM ставится из Chrome, Edge или Яндекс Браузера и открывается в отдельном окне.</Muted>
        <InstallSteps T={T} steps={[
          [Monitor, <>Найди значок установки в правой части адресной строки</>],
          [Download, <>Нажми «Установить»</>],
        ]} />
        <Muted size={12} className="mt-4">На телефоне открой этот же сайт: Android — Chrome, iPhone — Safari.</Muted>
      </>
    );
  }
  return (
    <Sheet T={T} title="Установить приложение" onClose={onClose}>
      {body}
      {ANDROID_APK_URL && inst.android && !inst.installed && (
        <a href={ANDROID_APK_URL} download className="mt-3 w-full rounded-2xl py-3 px-4 font-medium flex items-center justify-center gap-2 ritm-press ritm-hover"
          style={{ border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.035)", color: "#fff", textDecoration: "none" }}>
          <Download size={16} /> Скачать APK для Android
        </a>
      )}
    </Sheet>
  );
}

// Полоска «Установи приложение» на «Сегодня» — только на сайте, пока не установлено и не закрыто
const INSTALL_HINT_KEY = "ritm-install-hint-closed";
function InstallBanner({ T, onOpen }) {
  const inst = useInstall();
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem(INSTALL_HINT_KEY) === "1"; } catch (e) { return false; } });
  if (closed || inst.installed) return null;
  const close = () => { setClosed(true); try { localStorage.setItem(INSTALL_HINT_KEY, "1"); } catch (e) { /* ок */ } };
  return (
    <div className="flex items-center gap-3 rounded-[20px] p-3 pl-4 mb-5" style={{ background: `linear-gradient(135deg, ${T.a}1F, ${T.b}14)`, border: `1px solid ${T.a}33` }}>
      <Smartphone size={20} color={T.a} className="flex-shrink-0" />
      <button onClick={onOpen} className="flex-1 text-left min-w-0" style={{ color: "#fff" }}>
        <div className="font-semibold" style={{ fontSize: 14 }}>Установи RITM на {inst.ios ? "iPhone" : inst.android ? "телефон" : "компьютер"}</div>
        <Muted size={12}>Иконка на экране, запуск в один тап</Muted>
      </button>
      <button onClick={onOpen} className="rounded-xl px-3 py-2 font-semibold flex-shrink-0 ritm-press" style={{ background: T.grad, color: T.on, fontSize: 13 }}>Установить</button>
      <button onClick={close} aria-label="Скрыть" className="p-1 flex-shrink-0" style={{ color: MUTED }}><X size={16} /></button>
    </div>
  );
}

// Аккаунт в Настройках сайта: кто вошёл, синхронизация, выход / вход, установка
function AccountCard({ T, sync, onSyncNow, openLogin, openInstall }) {
  const session = readSession();
  const inst = useInstall();
  const logout = () => {
    if (!window.confirm("Выйти из аккаунта на этом устройстве? Данные останутся в аккаунте — войди снова, и они вернутся.")) return;
    clearSession();
    setGuest(false);
    window.location.reload();
  };
  const u = session?.user;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <Card T={T}>
        <div className="flex items-center gap-3">
          <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, background: u ? T.grad : "rgba(255,255,255,0.08)", color: u ? T.on : "#fff", fontFamily: DISPLAY, fontWeight: 700, fontSize: 18 }}>
            {u ? (u.first_name || u.username || "?").slice(0, 1).toUpperCase() : <UserRound size={20} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{u ? (u.first_name || "Аккаунт Telegram") : "Гость"}</div>
            <Muted size={12}>{u ? (u.username ? `@${u.username} · вход через Telegram` : "Вход через Telegram") : "Данные только в этом браузере"}</Muted>
          </div>
          {u && <button onClick={logout} aria-label="Выйти" className="rounded-xl p-2 ritm-press ritm-hover" style={{ color: MUTED, border: `1px solid ${T.line}` }}><LogOut size={16} /></button>}
        </div>
        {!u && <div className="mt-4"><Primary T={T} onClick={openLogin}><LogIn size={17} /> Войти через Telegram</Primary></div>}
      </Card>
      {u && <SyncCard T={T} sync={sync} onSyncNow={onSyncNow} />}
      {!inst.installed && <Ghost T={T} onClick={openInstall}><Smartphone size={16} /> Установить приложение на телефон</Ghost>}
    </div>
  );
}

// После самой первой тренировки: поздравление и «что дальше». Это лучший момент, чтобы гость сайта
// сохранил прогресс (вошёл через Telegram — тогда и бот напомнит о следующей тренировке), а не на старте.
const WD_ACC = ["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"];
function nextStrengthDay(program) {
  const w = wdOf(new Date());
  for (let d = 1; d <= 7; d++) {
    const wd = (w + d) % 7;
    const idx = program.schedule[wd];
    const own = program.customDays?.[wd];
    if (idx !== undefined || own) return { when: d === 1 ? "завтра" : WD_ACC[wd], title: idx !== undefined ? program.days[idx]?.title : null };
  }
  return null;
}
function FirstWorkoutDoneSheet({ T, program, st, web, session, openInstall, onClose }) {
  const next = nextStrengthDay(program);
  const inst = useInstall();
  const guest = web && !session;
  const remindAt = st.reminders?.trainingTime || "18:00";
  useEffect(() => { goal("first_workout_done_screen", { guest }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet T={T} title="" onClose={onClose}>
      <div className="relative text-center pt-2 pb-2">
        <Confetti T={T} count={44} />
        <div className="relative mx-auto rounded-full flex items-center justify-center mb-4 ritm-pop" style={{ width: 84, height: 84, background: T.grad, boxShadow: T.glow, color: T.on }}>
          <Trophy size={36} />
        </div>
        <H1>Первая тренировка позади!</H1>
        <Muted className="mt-2">Самое сложное — начать. Вес и повторы в следующий раз RITM подберёт сам по сегодняшним подходам.</Muted>
      </div>
      {next && (
        <Card T={T} className="mt-4 flex items-center gap-3">
          <CalendarDays size={20} color={T.a} className="flex-shrink-0" />
          <div>
            <div className="font-semibold" style={{ fontSize: 15 }}>Следующая — {next.when}</div>
            {next.title && <Muted size={12}>{next.title}{!guest ? ` · напомню в ${remindAt}` : ""}</Muted>}
          </div>
        </Card>
      )}
      {guest ? (
        <div className="mt-4">
          <Card T={T} style={{ border: `1px solid ${T.a}55` }}>
            <div className="font-semibold mb-1">Сохрани прогресс</div>
            <Muted size={13}>Сейчас он хранится только в этом браузере. Войди через Telegram — и тренировки будут в аккаунте: на телефоне, компьютере и в Mini App, а бот напомнит о следующей.</Muted>
          </Card>
          <div className="mt-3"><TelegramLoginPanel T={T} /></div>
          <button onClick={onClose} className="w-full mt-3 py-2 text-center" style={{ color: MUTED, fontSize: 13 }}>Позже</button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {web && !inst.installed && <Ghost T={T} onClick={openInstall}><Smartphone size={16} /> Поставить RITM на телефон</Ghost>}
          <Primary T={T} onClick={onClose}>Отлично!</Primary>
        </div>
      )}
    </Sheet>
  );
}

function PaidSheet({ T, until, onClose }) {
  return (
    <Sheet T={T} title="" onClose={onClose}>
      <div className="relative text-center py-6" style={{ animation: "rise .3s ease-out" }}>
        <Confetti T={T} />
        <div className="relative mx-auto rounded-full flex items-center justify-center mb-5 ritm-pop" style={{ width: 88, height: 88, background: T.grad, boxShadow: T.glow, color: T.on }}>
          <Crown size={38} />
        </div>
        <H1>Pro подключена</H1>
        <Muted className="mt-2 mb-8">Оплата прошла. Pro активна до {proUntilText(until)} — на сайте, в приложении и в Mini App.</Muted>
        <Primary T={T} onClick={onClose}>Готово</Primary>
      </div>
    </Sheet>
  );
}

/* ============ Приложение ============ */
// Полный набор доступных разделов нижней навигации. "today" всегда виден и закреплён первым —
// остальные можно скрывать и переставлять на экране «Разделы» в Настройках.
const TABS_ALL = [
  ["today", "Сегодня", Home],
  ["train", "Силовые", Dumbbell],
  ["run", "Бег", Footprints],
  ["food", "Питание", Apple],
  ["health", "Здоровье", Activity],
  ["dev", "Развитие", BookOpen],
  ["cal", "Календарь", CalendarDays],
  ["progress", "Прогресс", TrendingUp],
  ["achievements", "Награды", Medal],
  ["books", "Книги", Library],
  ["challenges", "Челленджи", Target],
  ["journal", "Дневник", NotebookPen],
  ["breathe", "Дыхание", Wind],
  ["faith", "Вера", Feather],
  ["charge", "Зарядка", Sunrise],
  ["friends", "Друзья", Users],
];
const MIN_VISIBLE_TABS = 3;
// Новые разделы по умолчанию скрыты, чтобы у существующих пользователей нижняя панель
// не переполнилась сама собой после обновления — включаются вручную на экране «Разделы»
const DEFAULT_TABS_CONFIG = { order: TABS_ALL.map((t) => t[0]), hidden: ["progress", "achievements", "books", "challenges", "journal", "breathe", "faith", "friends"] };
function effectiveTabs(st) {
  const cfg = st.tabsConfig || DEFAULT_TABS_CONFIG;
  const order = cfg.order?.length ? cfg.order : DEFAULT_TABS_CONFIG.order;
  const known = new Set(order);
  const allIds = TABS_ALL.map((t) => t[0]);
  const full = [...order.filter((id) => allIds.includes(id)), ...allIds.filter((id) => !known.has(id))];
  const hidden = new Set(cfg.hidden || []);
  return full.filter((id) => id === "today" || !hidden.has(id)).map((id) => TABS_ALL.find((t) => t[0] === id)).filter(Boolean);
}

// Сколько кнопок помещается в один ряд нижней навигации, включая саму кнопку «Ещё» —
// если видимых разделов больше, первые NAV_PRIMARY_LIMIT-1 остаются внизу как обычно,
// а все остальные уходят под одну кнопку «Ещё», которая открывает сетку с полным списком.
// Раньше при >7 разделах панель переносилась на вторую строку — мелкий текст, разделы
// наползали друг на друга. Теперь внизу всегда один аккуратный ряд.
const NAV_PRIMARY_LIMIT = 5;

// Сетка дополнительных разделов, которые не поместились в основной ряд — открывается
// по кнопке «Ещё». Текущий раздел подсвечен так же, как кнопки в основном ряду.
function MoreTabsSheet({ T, tabs, active, onPick, onClose }) {
  return (
    <Sheet T={T} title="Ещё разделы" onClose={onClose}>
      <div className="grid grid-cols-3 gap-3">
        {tabs.map(([id, label, Icon]) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => { onPick(id); onClose(); }}
              className="flex flex-col items-center gap-2 rounded-2xl py-4 px-1"
              style={{ border: `1px solid ${on ? T.a : T.line}`, background: on ? "rgba(255,255,255,0.07)" : T.card, boxShadow: on ? T.glow : "none", color: "#fff" }}>
              <Icon size={22} color={on ? T.a : "#fff"} style={on ? { filter: `drop-shadow(0 0 6px ${T.a})` } : undefined} />
              <span style={{ fontSize: 12, fontWeight: on ? 600 : 500, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// Боковое меню на широком экране (компьютер, планшет в альбомной ориентации). На телефоне скрыто —
// там нижняя панель. Здесь помещаются все включённые разделы сразу, без кнопки «Ещё».
function Sidebar({ T, tabs, active, go, pro, openPay, user, web, openInstall, openLogin }) {
  const inst = useInstall();
  const NavItem = ({ id, label, Icon }) => {
    const on = active === id;
    return (
      <button onClick={() => go(id)} aria-current={on ? "page" : undefined}
        className="flex items-center gap-3 rounded-2xl px-3 py-2 ritm-press ritm-hover text-left w-full"
        style={{ background: on ? "rgba(255,255,255,0.07)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.62)" }}>
        <Icon size={19} color={on ? T.a : "currentColor"} strokeWidth={on ? 2.3 : 1.9} />
        <span className="flex-1" style={{ fontSize: 14.5, fontWeight: on ? 600 : 500 }}>{label}</span>
        {on && <span className="rounded-full" style={{ width: 6, height: 6, background: T.a }} />}
      </button>
    );
  };
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 flex-col"
      style={{ width: 264, padding: "26px 16px 18px", borderRight: `1px solid ${T.line}`, background: "rgba(6,7,9,0.55)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <button onClick={() => go("today")} className="px-3 mb-6 text-left" style={{ color: "#fff" }} aria-label="RITM — на «Сегодня»">
        <Wordmark T={T} size={20} />
      </button>
      <nav className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar flex-1 min-h-0">
        {tabs.map(([id, label, Icon]) => <NavItem key={id} id={id} label={label} Icon={Icon} />)}
        <div className="my-1.5 mx-3" style={{ height: 1, background: T.line }} />
        <NavItem id="settings" label="Настройки" Icon={SettingsIcon} />
      </nav>
      <div className="flex flex-col gap-2 pt-4">
        {!pro && (
          <button onClick={openPay} className="rounded-2xl p-3.5 text-left ritm-press" style={{ background: `linear-gradient(135deg, ${T.a}26, ${T.b}1A)`, border: `1px solid ${T.a}40`, color: "#fff" }}>
            <div className="flex items-center gap-2 font-semibold" style={{ fontSize: 14 }}><Crown size={16} color={T.a} /> RITM Pro</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Безлимит ИИ, полная статистика — от {RUB_PRICE.month} ₽</div>
          </button>
        )}
        {web && !inst.installed && (
          <button onClick={openInstall} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 ritm-press ritm-hover" style={{ color: "rgba(255,255,255,0.75)", fontSize: 13.5 }}>
            <Download size={16} /> Установить приложение
          </button>
        )}
        {web && (user ? (
          <button onClick={() => go("settings")} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 ritm-press ritm-hover text-left" style={{ color: "#fff" }}>
            <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, background: T.grad, color: T.on, fontWeight: 700, fontSize: 14 }}>
              {(user.first_name || user.username || "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>{user.first_name || "Аккаунт"}</span>
              {user.username && <span className="block truncate" style={{ fontSize: 12, color: MUTED }}>@{user.username}</span>}
            </span>
          </button>
        ) : (
          <button onClick={openLogin} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 ritm-press ritm-hover" style={{ color: "#fff", fontSize: 13.5, border: `1px solid ${T.line}` }}>
            <LogIn size={16} /> Войти через Telegram
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ============ Настройка главного экрана «Сегодня» ============
   Кастомизация под конкретного человека: какие блоки показывать на «Сегодня» и в каком
   порядке — та же идея, что и в «Разделах приложения», но для содержимого одного экрана. */
const TODAY_BLOCKS_ALL = [
  ["train", "Тренировки", "Силовые и бег", Dumbbell],
  ["food", "Питание", "Калории и быстрое фото еды", Apple],
  ["habits", "Привычки", "Трекер привычек", Repeat],
  ["tasks", "Задачи на сегодня", "Список и добавление задач", ListFilter],
];
const DEFAULT_TODAY_LAYOUT = { order: TODAY_BLOCKS_ALL.map((b) => b[0]), hidden: [] };
const MIN_VISIBLE_TODAY_BLOCKS = 1;
function effectiveTodayLayout(st) {
  const cfg = st.todayLayout || DEFAULT_TODAY_LAYOUT;
  const order = cfg.order?.length ? cfg.order : DEFAULT_TODAY_LAYOUT.order;
  const allIds = TODAY_BLOCKS_ALL.map((b) => b[0]);
  const known = new Set(order);
  const full = [...order.filter((id) => allIds.includes(id)), ...allIds.filter((id) => !known.has(id))];
  const hidden = new Set(cfg.hidden || []);
  return { order: full, hidden };
}

function TodayLayoutSheet({ T, st, up, onClose }) {
  const layout = effectiveTodayLayout(st);
  const visibleCount = layout.order.filter((id) => !layout.hidden.has(id)).length;
  const move = (idx, dir) => {
    const next = [...layout.order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    up({ todayLayout: { order: next, hidden: [...layout.hidden] } });
  };
  const toggleHidden = (id) => {
    const isHidden = layout.hidden.has(id);
    if (!isHidden && visibleCount <= MIN_VISIBLE_TODAY_BLOCKS) return; // нельзя скрыть последний видимый блок
    const h = new Set(layout.hidden);
    if (isHidden) h.delete(id); else h.add(id);
    up({ todayLayout: { order: layout.order, hidden: [...h] } });
  };
  return (
    <Sheet T={T} title="Главный экран" onClose={onClose}>
      <Muted size={13} className="mb-3">Выбери, какие блоки показывать на «Сегодня», и в каком порядке. Хотя бы один блок должен остаться включённым.</Muted>
      <div className="flex flex-col gap-2">
        {layout.order.map((id, idx) => {
          const b = TODAY_BLOCKS_ALL.find((x) => x[0] === id);
          if (!b) return null;
          const [, title, desc, Icon] = b;
          const isHidden = layout.hidden.has(id);
          return (
            <div key={id} className="rounded-2xl flex items-center gap-3 px-3 py-3" style={{ border: `1px solid ${T.line}`, background: T.card, opacity: isHidden ? 0.55 : 1 }}>
              <Icon size={18} color={isHidden ? MUTED : "#fff"} />
              <div className="flex-1 min-w-0">
                <div className="font-medium" style={{ fontSize: 14 }}>{title}</div>
                <Muted size={12}>{desc}</Muted>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={`Выше: ${title}`} className="rounded-lg p-1.5" style={{ opacity: idx === 0 ? 0.3 : 1 }}><ChevronUp size={16} color={MUTED} /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === layout.order.length - 1} aria-label={`Ниже: ${title}`} className="rounded-lg p-1.5" style={{ opacity: idx === layout.order.length - 1 ? 0.3 : 1 }}><ChevronDown size={16} color={MUTED} /></button>
                <button onClick={() => toggleHidden(id)} aria-pressed={!isHidden} aria-label={`Показывать: ${title}`} className="rounded-lg p-1.5">
                  {isHidden ? <EyeOff size={16} color={MUTED} /> : <Eye size={16} color={T.a} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function programForReminder(st, w) {
  try {
    if (!st.profile) return null;
    const p = buildProgram(st.profile, st.exLog, st.schedule, st.workouts);
    const own = (st.workouts || []).find((x) => x.id === p.customDays[w]);
    if (own) return { name: own.name };
    if (p.schedule[w] !== undefined && p.days[p.schedule[w]]) return { name: p.days[p.schedule[w]].title };
  } catch {}
  return null;
}

export default function App() {
  const [st, setSt] = useState(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  // ?tab=food и т.п. — быстрые действия с иконки установленного приложения (shortcuts в манифесте)
  const [tab, setTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      return t && (t === "settings" || TABS_ALL.some(([id]) => id === t)) ? t : "today";
    } catch (e) { return "today"; }
  });
  const [sheet, setSheet] = useState(null);
  const [replayTour, setReplayTour] = useState(false);
  // Для журнала ошибок: если что-то упадёт, в логе будет видно, на каком экране и с какой шторкой
  useEffect(() => { if (typeof window !== "undefined") window.__ritmCurrentTab = sheet?.type ? `${tab}/${sheet.type}` : tab; }, [tab, sheet]);
  const T = getTheme(st);
  const tg = typeof window !== "undefined" ? tgApp() : null;
  // Аккаунт меняется только через перезагрузку (вход/выход на сайте), поэтому читаем один раз
  const [user] = useState(() => currentUser());
  const web = isWeb();
  const [session] = useState(() => (web ? readSession() : null));
  // Сайт без входа: сначала экран приветствия, пока человек не войдёт или не выберет «без входа»
  // ?start=1 — кнопка «Начать бесплатно» на лендинге: сразу анкета, без экрана выбора «войти или нет»
  const [webGate, setWebGate] = useState(() => {
    if (!web || session || isGuest()) return false;
    try {
      if (new URLSearchParams(window.location.search).get("start") === "1") { setGuest(true); goal("start_guest", { from: "landing" }); return false; }
    } catch (e) { /* ок */ }
    return true;
  });
  const name = user?.first_name || "атлет";
  const lifetimePro = hasLifetimePro(user);
  const promoAdmin = canSeePromoAdmin(user);

  // Сохраняем локальную копию сразу при любом изменении состояния. Это важно для
  // полей тренировки: если пользователь быстро закрыл Mini App, введённые подходы
  // и повторы не должны ждать debounce перед сохранением.
  const stRef = useRef(st);
  stRef.current = st;
  const syncRef = useRef(null);
  const [sync, setSync] = useState({ mode: "local", ok: null, at: 0, busy: false });
  // Pro запоминается на устройстве: если сервер не ответил (нет сети, медленный старт, устаревшая
  // подпись Telegram), оплаченная Pro остаётся видна до своей даты окончания, а не «слетает».
  const [serverPro, setServerProState] = useState(() => readProCache());
  const setServerPro = (next) => setServerProState((prev) => {
    const value = typeof next === "function" ? next(prev) : next;
    writeProCache(value);
    return value;
  });
  const refreshPro = (attempt = 0) => fetchProStatus()
    .then((r) => setServerPro({ active: !!r.active, until: r.until || 0, plan: r.plan }))
    .catch(() => { if (attempt < 3) setTimeout(() => refreshPro(attempt + 1), 4000 * (attempt + 1)); });

  // Локальную копию пишем сразу: если приложение резко закрыли, введённые подходы не потеряются.
  // Время изменения нужно синхронизации, чтобы понимать, какая версия новее.
  const up = (patch) => setSt((s) => {
    const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch), updatedAt: Date.now() };
    stRef.current = next;
    writeLocalState(next);
    return next;
  });
  const haptic = tapFeedback;

  useEffect(() => {
    try { tg?.ready(); tg?.expand(); tg?.setHeaderColor?.("#000000"); tg?.setBackgroundColor?.("#000000"); } catch (e) {}
    // В Windows-приложении напоминания идут через обычный Notification API (см. sendRitmReminder) —
    // на него, в отличие от iOS, нужно один раз явно запросить разрешение при запуске.
    if (isElectron() && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (tg?.initData || session) {
      refreshPro();
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshPro(); });
    }
    const local = readLocalState();
    const initial = local ? migrateState({ ...DEFAULT, ...local }) : DEFAULT;
    stRef.current = initial;
    setSt(initial);

    // Куда синхронизировать: в Mini App — облако Telegram (как раньше) и сервер (чтобы те же данные
    // были на сайте и в приложении); на сайте после входа — только сервер; гость и нативные
    // сборки — только это устройство.
    const api = cloudApi();
    const transports = [];
    if (api) transports.push(["", telegramTransport(api)]);
    if (tg?.initData || session) transports.push(["-srv", serverTransport()]);
    if (!transports.length) { setLoaded(true); return undefined; }
    const mode = api ? "cloud" : "server";
    const results = {};
    const applyState = (next) => {
      const full = migrateState({ ...DEFAULT, ...next });
      stRef.current = full;
      setSt(full);
    };
    const engines = transports.map(([kind, transport]) => {
      const meta = readSyncMeta(kind);
      return createSync({
        transport, meta, applyState,
        getState: () => stRef.current,
        onStatus: (res) => {
          writeSyncMeta(meta, kind);
          results[kind] = res;
          // Статус показываем по основному хранилищу: в Mini App — облако Telegram, на сайте — сервер
          const main = results[transports[0][0]] || res;
          setSync({ mode, busy: false, ok: main.ok, at: main.ok ? main.at : 0 });
        },
      });
    });
    // Хранилища — строго по очереди, чтобы два цикла не применяли данные одновременно
    const runFrom = async (start) => { for (let i = start; i < engines.length; i++) await engines[i].run(); };
    const run = async () => {
      setSync((x) => ({ ...x, mode, busy: true }));
      await runFrom(0);
    };
    const isDirty = (s) => engines.some((e) => e.isDirty(s));
    syncRef.current = { run, isDirty };
    setSync((x) => ({ ...x, mode, busy: true }));

    // Пока идёт первая синхронизация основного хранилища, показываем заставку, чтобы на новом устройстве
    // не открылась пустая анкета. Остальные (в Mini App — сервер сайта) догоняют уже в фоне.
    let finished = false;
    const done = () => { if (!finished) { finished = true; setLoaded(true); } };
    engines[0].run().finally(() => { done(); runFrom(1); });
    const fallback = setTimeout(done, 6000);

    const onVisible = () => { if (document.visibilityState === "visible") run(); else if (isDirty(stRef.current)) run(); };
    document.addEventListener("visibilitychange", onVisible);
    const onActivated = () => run();
    try { tg?.onEvent?.("activated", onActivated); tg?.onEvent?.("deactivated", onActivated); } catch (e) { /* старая версия Telegram */ }
    const timer = setInterval(() => { if (document.visibilityState === "visible") run(); }, 60000);
    return () => {
      clearTimeout(fallback);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      try { tg?.offEvent?.("activated", onActivated); tg?.offEvent?.("deactivated", onActivated); } catch (e) { /* нет событий */ }
    };
  }, []);

  // Постоянно синхронизируем изменения с Telegram CloudStorage и сервером напоминаний.
  // Это позволяет открыть RITM на другом устройстве и получать сообщения из Telegram
  // даже после полного закрытия Mini App.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      writeLocalState(st);
      const engine = syncRef.current;
      if (engine && engine.isDirty(st)) engine.run();
      const initData = tg?.initData;
      const trainingByDay = {};
      for (let d = 0; d < 7; d++) {
        const strength = programForReminder(st, d);
        let name = strength?.name || "";
        if (!name && st.profile) { try { if (buildRun(st.profile, st.schedule).schedule[d] !== undefined) name = "Бег"; } catch {} }
        if (name) trainingByDay[String(d)] = name;
      }
      const tasks = [];
      Object.entries(st.tasks || {}).forEach(([date, list]) => (Array.isArray(list) ? list : []).forEach(t => tasks.push({ id:`${date}:${t.id}`, text:String(t.text || ""), time:t.time || null, repeat:t.repeat || {type:"once", date}, done:!!t.done, log:t.log || {} })));
      (st.dailyTasks || []).forEach(t => tasks.push({ id:String(t.id), text:String(t.text || ""), time:t.time || null, repeat:t.repeat || {type:"daily"}, done:!!t.done, log:t.log || {} }));
      if (initData) {
        const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow"; } catch { return "Europe/Moscow"; } })();
        registerReminders({ initData, reminderData: { timezone, reminders: st.reminders || DEFAULT_REMINDERS, tasks, trainingByDay } });
        // Статистика для админа и карточка прогресса для друзей — в Mini App и на сайте после входа,
        // у отдельного приложения нет постоянного Telegram ID для того и другого (см. комментарий
        // перед friendsAction выше). Обе попытки не критичны — у них свой catch внутри.
        touchUserApi(st.pro);
        publishSnapshotApi(buildFriendSnapshot(st, st.friendsPrivacy));
      } else if (session) {
        // Сайт после входа через бота: тот же Telegram ID, поэтому напоминания присылает бот
        // (даже когда сайт закрыт), а друзья видят карточку прогресса так же, как из Mini App
        const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow"; } catch { return "Europe/Moscow"; } })();
        registerReminders({ reminderData: { timezone, reminders: st.reminders || DEFAULT_REMINDERS, tasks, trainingByDay } });
        touchUserApi(st.pro);
        publishSnapshotApi(buildFriendSnapshot(st, st.friendsPrivacy));
      } else if (isStandalone()) {
        const cfg = { ...DEFAULT_REMINDERS, ...(st.reminders || {}), enabled: st.reminders?.enabled ?? st.notify };
        scheduleNativeReminders(cfg, trainingByDay, tasks);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [loaded, st]);

  useEffect(() => {
    if (!loaded || !st.profile) return;
    const sentRuntime = new Set();
    const checkReminders = () => {
      const cfg = { ...DEFAULT_REMINDERS, ...(st.reminders || {}), enabled: st.reminders?.enabled ?? st.notify };
      if (!cfg.enabled) return;
      const now = new Date();
      const k = keyOf(now);
      const w = wdOf(now);
      const daily = (st.dailyTasks || []).filter((t) => taskOccursOn(t, now));
      const oneOff = st.tasks?.[k] || [];
      const strength = programForReminder(st, w);
      const runToday = !!(st.profile && buildRun(st.profile, st.schedule).schedule[w] !== undefined);
      const trainingName = strength?.name || (runToday ? "Пробежка" : "");
      const mark = (id) => {
        const key = `${k}:${id}`;
        if (sentRuntime.has(key) || st.reminders?.sent?.[key]) return false;
        sentRuntime.add(key);
        up((s) => ({ reminders: { ...DEFAULT_REMINDERS, ...(s.reminders || {}), sent: { ...(s.reminders?.sent || {}), [key]: Date.now() } } }));
        return true;
      };
      if (cfg.plan && reminderTimeReached(cfg.planTime, now) && mark("plan")) {
        const pending = [...daily.filter(t => !t.log?.[k]), ...oneOff.filter(t => !t.done)];
        const taskText = pending.length ? `Задач на сегодня: ${pending.length}.` : "Задач на сегодня пока нет.";
        const workoutText = trainingName ? ` Сегодня: ${trainingName}.` : " Сегодня день восстановления.";
        sendRitmReminder("RITM · План на день", `${taskText}${workoutText} Открой RITM и начни с главного.`);
      }
      if (cfg.training && reminderTimeReached(cfg.trainingTime, now) && trainingName && mark("training")) {
        sendRitmReminder("RITM · Время тренировки", `Сегодня по плану: ${trainingName}. Готов начать?`);
      }
      if (cfg.tasks) {
        [...daily, ...oneOff].forEach((t) => {
          if (!t.time || !reminderTimeReached(t.time, now)) return;
          const done = t.repeat ? !!t.log?.[k] : !!t.done;
          if (done || !mark(`task:${t.id}`)) return;
          sendRitmReminder("RITM · Задача", `Время задачи: ${t.text}`);
        });
      }
    };
    checkReminders();
    const id = setInterval(checkReminders, 20000);
    return () => clearInterval(id);
  }, [loaded, st]);

  // Сайт: вернулись со страницы оплаты (или открыли сайт заново после оплаты) — проверяем платёж
  useEffect(() => {
    if (!web) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("payment")) {
      params.delete("payment");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash);
    }
    const tx = session ? readPendingTx() : null;
    if (!tx) return;
    fetchProStatus(tx).then((r) => {
      if (r.paymentStatus === "CONFIRMED" && r.active) {
        clearPendingTx();
        goal("pro_paid", { plan: r.plan });
        setServerPro({ active: true, until: r.until, plan: r.plan });
        setSheet({ type: "paid", until: r.until });
      } else if (r.paymentStatus === "CANCELED" || r.paymentStatus === "CHARGEBACKED") {
        clearPendingTx();
      }
    }).catch(() => {});
  }, []);

  // Сайт: после входа страница перезагрузилась — открываем то, ради чего человек входил
  useEffect(() => {
    if (!web || !loaded || !st.profile || !session) return;
    let after = null;
    try { after = sessionStorage.getItem(AFTER_LOGIN_KEY); sessionStorage.removeItem(AFTER_LOGIN_KEY); } catch (e) { /* ок */ }
    if (after === "pay") setSheet({ type: "pay" });
    else if (after === "redeemPromo") setSheet({ type: "redeemPromo" });
    else if (after === "friends") setTab("friends");
  }, [loaded, !!st.profile]);

  const week = st.profile ? Math.min(3, Math.floor((Date.now() - (st.profile.created || Date.now())) / 6048e5)) : 0;
  const program = useMemo(() => (st.profile ? buildProgram(st.profile, st.exLog, st.schedule, st.workouts) : null), [st.profile, st.exLog, st.schedule, st.workouts]);
  const run = useMemo(() => (st.profile ? buildRun(st.profile, st.schedule) : null), [st.profile, st.schedule]);
  const norm = useMemo(() => (st.profile ? calcNutrition(st.profile) : null), [st.profile]);
  const todayKey = keyOf(new Date());
  // Все экраны видят Pro, если он оплачен или выдан навсегда
  // Pro: навсегда по нику, оплачено (статус с сервера) или включено в старой версии приложения
  // В отдельном приложении (iOS или Windows, не внутри Telegram) Pro включён сразу — платить себе незачем,
  // а вся серверная оплата всё равно завязана на Telegram-аккаунт, которого тут нет.
  const view = lifetimePro || serverPro.active || isStandalone() ? { ...st, pro: true } : st;
  const todayFood = sumFood(st.food[todayKey] || []);
  const leftToday = norm ? { kcal: norm.kcal - todayFood.kcal, p: norm.protein - todayFood.p } : null;

  const addFood = (e) => {
    const k = keyOf(new Date());
    const entry = { id: Date.now(), name: e.name, meal: e.meal, kcal: Math.round(e.kcal), p: Math.round(e.p), f: Math.round(e.f), c: Math.round(e.c) };
    up((s) => ({ food: { ...s.food, [k]: [...(s.food[k] || []), entry] } }));
    setSheet(null);
    haptic();
  };
  const aiLeft = view.pro ? null : Math.max(0, FREE_SCANS - (st.scans[todayKey] || 0));
  const addEntries = (entries) => {
    const k = keyOf(new Date());
    up((s) => ({ food: { ...s.food, [k]: [...(s.food[k] || []), ...entries] } }));
    setSheet(null);
    haptic();
  };
  const updateFood = (id, patch) => {
    const k = keyOf(new Date());
    up((s) => ({ food: { ...s.food, [k]: (s.food[k] || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) } }));
    setSheet(null);
  };
  const deleteFood = (id) => {
    const k = keyOf(new Date());
    up((s) => ({ food: { ...s.food, [k]: (s.food[k] || []).filter((e) => e.id !== id) } }));
    setSheet(null);
  };
  const saveProduct = (barcode, product) => {
    up((s) => ({ products: { ...(s.products || {}), [barcode]: { ...product, barcode } } }));
    // Это ровно тот момент, когда товара ещё не было в базе и человек только что сам его
    // проверил — самый ценный случай, чтобы поделиться с общей базой RITM (см. комментарий
    // у submitProductToServer).
    submitProductToServer(barcode, product);
  };
  // «Память блюд»: пользователь подтверждает правильную граммовку/состав блюда один раз,
  // и в следующий раз подсказка идёт в промпт (для фото) или подставляется напрямую (для текста).
  const rememberDish = (dish, items) => up((s) => ({
    foodMemory: {
      ...(s.foodMemory || {}),
      [normalizeDishKey(dish)]: {
        dish,
        items: items.map((it) => ({ name: it.name, grams: toNum(it.grams), per100: it.per100 })),
        savedAt: Date.now(),
      },
    },
  }));
  const startPhotoScan = async (file, meal) => {
    try {
      const img = await fileToJpeg(file);
      setSheet({ type: "scan", init: { image: img.url, base64: img.base64, meal } });
    } catch (err) {
      setSheet({ type: "scan", init: { error: true, meal } });
    }
  };
  const countScan = () => up((s) => {
    const k = keyOf(new Date());
    return { scans: { ...s.scans, [k]: (s.scans[k] || 0) + 1 } };
  });
  // Двойная прогрессия: обновляем текущий вес/цель по упражнению, пишем запись в дневник
  // и проверяем личный рекорд — возвращаем результат, чтобы гид по тренировке мог его показать
  const saveTraining = (entry) => {
    const pr = checkPR(st.records, entry);
    up((s) => ({
      exLog: { ...s.exLog, [entry.exId]: { weight: entry.weight, lastMin: entry.minReps } },
      trainHistory: [entry, ...(s.trainHistory || [])],
      records: pr.hit ? { ...s.records, [entry.exId]: { weight: pr.weight ?? s.records?.[entry.exId]?.weight ?? null, reps: pr.reps ?? s.records?.[entry.exId]?.reps ?? null, at: Date.now() } } : s.records,
    }));
    haptic();
    return pr;
  };

  // streakOf обходит дни назад, пока не найдёт разрыв — стоимость растёт вместе с длиной серии
  // и числом привычек/задач. Пересчитываем только когда реально меняются данные, влияющие на серию,
  // а не на каждый рендер App (который перерисовывается почти при любом up() в приложении).
  const myStreak = useMemo(() => {
    const active = (k) => !!(st.done[k] || st.runDone[k] || st.habits.some((h) => h.log[k]) || (st.dailyTasks || []).some((t) => t.log[k]) || (st.tasks[k] || []).some((t) => t.done));
    return streakOf(active);
  }, [st.done, st.runDone, st.habits, st.dailyTasks, st.tasks]);

  const go = (t) => { haptic(); setTab(t); window.scrollTo?.(0, 0); };
  // reason — что именно упёрлось в бесплатный лимит («scans», «assistant»…): окно оплаты начинает
  // с этого, а не с общего списка. Вызов прямо из onClick передаёт событие — тогда причина «direct».
  const openPay = (reason) => {
    const r = typeof reason === "string" ? reason : "direct";
    goal("paywall_open", { reason: r });
    setSheet({ type: "pay", reason: r });
  };
  const openSchedule = () => setSheet({ type: "schedule" });
  // effectiveTabs — чистая функция от st.tabsConfig, но раньше пересчитывалась по три раза за рендер
  // (тут, внутри VoiceAssistant и внутри IIFE у <nav>) — считаем один раз и передаём дальше.
  const navTabs = useMemo(() => effectiveTabs(st), [st.tabsConfig]);
  // «Минимум + Ещё»: если видимых разделов больше NAV_PRIMARY_LIMIT, в ряду остаются первые
  // NAV_PRIMARY_LIMIT-1 (today всегда среди них, он всегда первый), а остальные — в сетке
  // по кнопке «Ещё». Если разделов немного, панель выглядит как раньше, без «Ещё».
  const navOverflow = useMemo(() => (navTabs.length > NAV_PRIMARY_LIMIT ? navTabs.slice(NAV_PRIMARY_LIMIT - 1) : []), [navTabs]);
  const navPrimary = navOverflow.length ? navTabs.slice(0, NAV_PRIMARY_LIMIT - 1) : navTabs;

  return (
    <div className="min-h-screen w-full text-white" style={{ background: T.bg, backgroundAttachment: "fixed", fontFamily: BODY, transition: "background .4s", "--ritm-accent": T.a }}>
      <GlobalStyle />
      {webGate ? (
        <WebWelcome T={T} onGuest={() => { setGuest(true); setWebGate(false); goal("start_guest", { from: "welcome" }); }} />
      ) : !loaded ? (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5">
          <RitmMark T={T} size={44} animated />
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "0.3em", fontSize: 18 }}>RITM</div>
          {sync.mode !== "local" && <Muted size={12}>Загружаю твои данные…</Muted>}
        </div>
      ) : !st.profile ? (
        <Onboarding T={T} onDone={(p) => { up({ profile: p }); setTab("today"); }} />
      ) : (!st.tourSeen || replayTour) ? (
        <AppTour T={T} st={st} canSkip={replayTour}
          onSkip={() => setReplayTour(false)}
          onDone={(hidden) => {
            up((s) => ({ tourSeen: true, chargeRevealed: true, tabsOrderComplete: true, tabsConfig: { order: completeTabsOrder(s.tabsConfig?.order), hidden } }));
            setReplayTour(false);
          }} />
      ) : (
        <>
          <Sidebar T={T} tabs={navTabs} active={tab} go={go} pro={view.pro} openPay={openPay}
            user={user} web={web} openInstall={() => setSheet({ type: "install" })} openLogin={() => setSheet({ type: "login" })} />
          <div className="lg:pl-[264px]">
          <main key={tab} className="ritm-stagger max-w-md md:max-w-xl lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-8 lg:px-10 pt-6 md:pt-8 lg:pt-12 pb-[140px] lg:pb-16" style={{ animation: "fade .25s ease-out" }}>
            {/* Установку предлагаем после первой тренировки, а не сразу после анкеты — сначала польза */}
            {tab === "today" && web && Object.keys(st.done || {}).length > 0 && <div className="lg:hidden"><InstallBanner T={T} onOpen={() => setSheet({ type: "install" })} /></div>}
            {tab === "today" && <Today T={T} st={view} up={up} program={program} run={run} week={week} go={go} name={name} streak={myStreak} norm={norm} onPhoto={startPhotoScan}
              openSession={(dayTitle, items, range) => setSheet({ type: "session", dayTitle, items, range })} />}
            {tab === "train" && (
              <Train T={T} st={view} up={up} program={program} openSchedule={openSchedule}
                openEx={(item) => setSheet({ type: "ex", item, range: program.range })}
                openNewWorkout={() => {
                  const current = view.workouts || [];
                  if (!view.pro && current.length >= FREE_WORKOUTS) { openPay("workouts"); return; }
                  const w = { id: "w" + Date.now(), name: "Новая тренировка", items: [] };
                  up((s) => ({ workouts: [...(s.workouts || []), w] }));
                  setSheet({ type: "workout", id: w.id });
                }}
                openWorkout={(id) => setSheet({ type: "workout", id })}
                openTemplates={() => { if (!view.pro) { openPay("templates"); return; } setSheet({ type: "templates" }); }}
                openSession={(dayTitle, items, range) => setSheet({ type: "session", dayTitle, items, range })} />
            )}
            {tab === "run" && <Run T={T} st={view} up={up} run={run} week={week} openPay={openPay} openSchedule={openSchedule} isCustom={!!st.schedule} />}
            {tab === "food" && (
              <Nutrition T={T} st={view} up={up} norm={norm} program={program} run={run} openPay={openPay}
                openScan={(init) => setSheet({ type: "scan", init })}
                openRecipe={(init) => setSheet({ type: "recipe", init })}
                openBarcode={(meal) => setSheet({ type: "barcode", meal })}
                openAdd={(meal) => setSheet({ type: "addfood", meal })}
                openEntry={(id) => setSheet({ type: "entry", id })}
                openShopping={() => setSheet({ type: "shopping" })}
                onPhoto={startPhotoScan} />
            )}
            {tab === "health" && <HealthScreen T={T} st={view} up={up} openWellbeing={() => setSheet({ type: "wellbeing" })} openRecalc={() => setSheet({ type: "recalc" })} />}
            {tab === "dev" && <DevScreen T={T} st={view} up={up} openTheme={(id) => setSheet({ type: "theme", id })} />}
            {tab === "cal" && <CalendarScreen T={T} st={view} up={up} program={program} run={run} week={week} openPay={openPay} openSchedule={openSchedule} />}
            {tab === "progress" && <ProgressScreen T={T} st={view} up={up} norm={norm} />}
            {tab === "achievements" && <AchievementsScreen T={T} st={view} />}
            {tab === "books" && <BooksScreen T={T} st={view} up={up} />}
            {tab === "challenges" && <ChallengesScreen T={T} st={view} up={up} />}
            {tab === "journal" && <JournalScreen T={T} st={view} up={up} />}
            {tab === "breathe" && <BreathingScreen T={T} st={view} up={up} />}
            {tab === "faith" && <FaithScreen T={T} st={view} up={up} />}
            {tab === "charge" && <ChargeScreen T={T} />}
            {tab === "friends" && <FriendsScreen T={T} st={view} up={up} />}
            {tab === "settings" && <SettingsScreen T={T} st={view} up={up} openPay={openPay} go={go} norm={norm} lifetimePro={lifetimePro} openLegal={(type) => setSheet({ type })} sync={sync} onSyncNow={() => syncRef.current?.run()} proUntil={serverPro.active ? serverPro.until : 0} openRecalc={() => setSheet({ type: "recalc" })} openTabs={() => setSheet({ type: "tabs" })} openTodayLayout={() => setSheet({ type: "todayLayout" })} openTour={() => setReplayTour(true)} promoAdmin={promoAdmin} openRedeemPromo={() => setSheet({ type: "redeemPromo" })} openPromoAdmin={() => setSheet({ type: "promoAdmin" })} openAbout={() => setSheet({ type: "about" })} openAdminStats={() => setSheet({ type: "adminStats" })}
              openLogin={() => setSheet({ type: "login" })} openInstall={() => setSheet({ type: "install" })}
              openAdminPro={() => setSheet({ type: "adminPro" })}
              openAdminMigrate={() => setSheet({ type: "adminMigrate" })}
              onProRestored={(r) => setServerPro({ active: !!r.active, until: r.until || 0, plan: r.plan })} />}
          </main>
          </div>

          {/* Телефон: плавающая панель снизу. Компьютер: боковое меню (Sidebar), панель скрыта. */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden" style={{ padding: "0 12px calc(10px + env(safe-area-inset-bottom))", pointerEvents: "none" }}>
            {(() => {
              // «Минимум + Ещё»: столько разделов, сколько видно в один ряд (NAV_PRIMARY_LIMIT), плюс
              // кнопка «Ещё», открывающая сетку с остальными — вместо прежнего переноса на вторую строку.
              const moreActive = navOverflow.some(([id]) => id === tab);
              const activeOverflow = moreActive ? navOverflow.find(([id]) => id === tab) : null;
              const [, moreLabel, MoreIcon] = activeOverflow || [null, "Ещё", MoreHorizontal];
              const item = (key, on, Icon, label, onClick, extra = {}) => (
                <button key={key} onClick={onClick} aria-current={on ? "page" : undefined} {...extra}
                  className="flex flex-col items-center justify-center gap-1 py-2 rounded-[20px] ritm-press min-w-0"
                  style={{ flex: "1 1 0%", background: on ? "rgba(255,255,255,0.08)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.45)" }}>
                  <Icon key={on ? "on" : "off"} size={20} color={on ? T.a : "currentColor"} strokeWidth={on ? 2.3 : 1.9} className={on ? "ritm-pop" : ""} />
                  <span style={{ fontSize: 10.5, fontWeight: on ? 650 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                </button>
              );
              return (
                <div className="max-w-md mx-auto flex gap-1 p-1.5 rounded-[26px]"
                  style={{ pointerEvents: "auto", background: "rgba(14,15,18,0.84)", backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)", border: `1px solid ${T.line}`, boxShadow: "0 14px 44px rgba(0,0,0,.5)" }}>
                  {navPrimary.map(([id, label, Icon]) => item(id, tab === id, Icon, label, () => go(id)))}
                  {navOverflow.length > 0 && item("more", moreActive, MoreIcon, moreLabel, () => setSheet({ type: "more" }), { "aria-label": "Ещё разделы" })}
                </div>
              );
            })()}
          </nav>

          {sheet?.type === "more" && (
            <MoreTabsSheet T={T} tabs={navOverflow} active={tab} onPick={go} onClose={() => setSheet(null)} />
          )}

          <VoiceAssistant T={T} st={view} up={up} norm={norm} program={program} run={run} onPay={openPay} />

          {sheet?.type === "ex" && (
            <ExerciseSheet T={T} item={sheet.item} range={sheet.range || program.range} pro={view.pro}
              history={(st.trainHistory || []).filter((h) => h.exId === sheet.item.id)}
              onClose={() => setSheet(sheet.returnTo ? { type: "workout", id: sheet.returnTo } : null)} onSave={saveTraining} />
          )}
          {sheet?.type === "session" && (
            <SessionRunner T={T} dayTitle={sheet.dayTitle} items={sheet.items} range={sheet.range}
              onSaveExercise={saveTraining}
              onFinish={() => {
                // Первая тренировка в жизни — после опроса самочувствия покажем «что дальше» (FirstWorkoutDoneSheet)
                const first = !Object.keys(st.done || {}).length;
                goalOnce("first_workout"); goal("workout_done");
                const k2 = keyOf(new Date()); up((s) => ({ done: { ...s.done, [k2]: true } }));
                setSheet({ type: "wellbeing", afterWorkout: true, first });
              }}
              onClose={() => setSheet(null)} />
          )}
          {sheet?.type === "wellbeing" && (
            <WellbeingSheet T={T} afterWorkout={!!sheet.afterWorkout} existing={st.wellbeing?.[keyOf(new Date())]}
              onSave={(w) => { const k2 = keyOf(new Date()); up((s) => ({ wellbeing: { ...s.wellbeing, [k2]: w } })); setSheet(sheet.first ? { type: "firstDone" } : null); haptic(); }}
              onClose={() => setSheet(sheet.first ? { type: "firstDone" } : null)} />
          )}
          {sheet?.type === "firstDone" && (
            <FirstWorkoutDoneSheet T={T} program={program} st={st} web={web} session={session}
              openLogin={() => setSheet({ type: "login" })} openInstall={() => setSheet({ type: "install" })}
              onClose={() => setSheet(null)} />
          )}
          {sheet?.type === "recalc" && <RecalcSheet T={T} st={st} up={up} onClose={() => setSheet(null)} />}
          {sheet?.type === "tabs" && <TabsManagerSheet T={T} st={st} up={up} onClose={() => setSheet(null)} />}
          {sheet?.type === "todayLayout" && <TodayLayoutSheet T={T} st={st} up={up} onClose={() => setSheet(null)} />}
          {sheet?.type === "about" && <AboutSheet T={T} st={st} openLegal={(type) => setSheet({ type })} onClose={() => setSheet(null)} />}
          {sheet?.type === "workout" && (() => {
            const w = (st.workouts || []).find((x) => x.id === sheet.id);
            if (!w) return null;
            return (
              <WorkoutEditSheet T={T} workout={w} up={up}
                onOpenPicker={() => setSheet({ type: "picker", workoutId: w.id })}
                onLogItem={(item) => { const r = resolveWorkoutItem(item, st.profile, st.exLog); setSheet({ type: "ex", item: r, range: r.range, returnTo: w.id }); }}
                onClose={() => setSheet(null)} />
            );
          })()}
          {sheet?.type === "picker" && (
            <ExercisePickerSheet T={T} profile={st.profile}
              onPick={(item) => {
                up((s) => ({ workouts: s.workouts.map((w) => (w.id === sheet.workoutId ? { ...w, items: [...w.items, item] } : w)) }));
                setSheet({ type: "workout", id: sheet.workoutId });
              }}
              onClose={() => setSheet({ type: "workout", id: sheet.workoutId })} />
          )}
          {sheet?.type === "schedule" && (
            <ScheduleSheet T={T} st={st} onClose={() => setSheet(null)}
              onSave={(schedule) => { up({ schedule }); setSheet(null); haptic(); }} />
          )}
          {sheet?.type === "templates" && (
            <ProgramTemplatesSheet T={T} st={st}
              onApply={(tpl) => { applyProgramTemplate(up, st, tpl); setSheet(null); haptic(); }}
              onClose={() => setSheet(null)} />
          )}
          {sheet?.type === "pay" && <PaySheet T={T} pro={serverPro} reason={sheet.reason} onClose={() => setSheet(null)} onPaid={(r) => setServerPro({ active: true, until: r.until, plan: r.plan })} />}
          {sheet?.type === "paid" && <PaidSheet T={T} until={sheet.until} onClose={() => setSheet(null)} />}
          {sheet?.type === "login" && <LoginSheet T={T} onClose={() => setSheet(null)} />}
          {sheet?.type === "install" && <InstallSheet T={T} onClose={() => setSheet(null)} />}
          {sheet?.type === "redeemPromo" && (
            <RedeemPromoSheet T={T} onClose={() => setSheet(null)} onRedeemed={(r) => setServerPro((s) => ({ active: true, until: r.until, plan: s.plan }))} />
          )}
          {sheet?.type === "promoAdmin" && <PromoAdminSheet T={T} onClose={() => setSheet(null)} />}
          {sheet?.type === "adminStats" && <AdminStatsSheet T={T} onClose={() => setSheet(null)} />}
          {sheet?.type === "adminPro" && <AdminProSheet T={T} onClose={() => setSheet(null)} />}
          {sheet?.type === "adminMigrate" && (
            <AdminMigrateSheet T={T} onClose={() => setSheet(null)}
              onDone={() => { refreshPro(); syncRef.current?.run(); }} />
          )}
          {LEGAL_DOCS[sheet?.type] && <LegalSheet T={T} type={sheet.type} onClose={() => setSheet(null)} />}
          {sheet?.type === "addfood" && (
            <AddFoodSheet T={T} meal={sheet.meal} aiLeft={aiLeft} onClose={() => setSheet(null)} onPay={openPay}
              recent={recentFoods(st.food, 10)} mine={Object.values(st.products || {}).slice(-10).reverse()}
              onPhoto={(file) => startPhotoScan(file, sheet.meal)}
              onBarcode={() => setSheet({ type: "barcode", meal: sheet.meal })}
              onText={() => setSheet({ type: "scan", init: { text: true, meal: sheet.meal } })}
              onManual={() => setSheet({ type: "manual", init: { meal: sheet.meal } })}
              onPick={(product, grams) => setSheet({ type: "product", product, grams, meal: sheet.meal })} />
          )}
          {sheet?.type === "barcode" && (
            <BarcodeSheet T={T} products={st.products} allergies={st.profile.allergies || []} meal={Number.isInteger(sheet.meal) ? sheet.meal : defaultMeal()}
              onClose={() => setSheet(null)} onAdd={(entry) => addEntries([entry])}
              onManual={(init) => setSheet({ type: "manual", init })}
              onPhotoFood={(file) => startPhotoScan(file, Number.isInteger(sheet.meal) ? sheet.meal : defaultMeal())} />
          )}
          {sheet?.type === "manual" && (
            <ManualFoodSheet T={T} init={sheet.init} allergies={st.profile.allergies || []} aiLeft={aiLeft}
              onUsedAi={countScan} onPay={openPay} onClose={() => setSheet(null)}
              onSaveProduct={saveProduct} onAdd={(entry) => addEntries([entry])} />
          )}
          {sheet?.type === "product" && (
            <ProductSheet T={T} product={sheet.product} grams={sheet.grams} meal={sheet.meal} allergies={st.profile.allergies || []}
              onClose={() => setSheet(null)} onAdd={(entry) => addEntries([entry])} />
          )}
          {sheet?.type === "entry" && (() => {
            const entry = (st.food[todayKey] || []).find((e) => e.id === sheet.id);
            return entry ? (
              <FoodEntrySheet T={T} entry={entry} allergies={st.profile.allergies || []} onClose={() => setSheet(null)}
                onSave={(patch) => updateFood(entry.id, patch)} onDelete={() => deleteFood(entry.id)} />
            ) : null;
          })()}
          {sheet?.type === "scan" && (
            <FoodScanSheet T={T} init={sheet.init} allergies={st.profile.allergies || []} memory={st.foodMemory}
              onClose={() => setSheet(null)} onAddMany={addEntries} onUsed={countScan} onRemember={rememberDish} />
          )}
          {sheet?.type === "recipe" && (
            <RecipeSheet T={T} init={sheet.init} profile={st.profile} left={leftToday}
              onClose={() => setSheet(null)} onAdd={addFood} onAddShopping={(r) => addRecipeToShoppingList(up, r)} />
          )}
          {sheet?.type === "shopping" && (
            <ShoppingListSheet T={T} st={st} up={up} onClose={() => setSheet(null)} />
          )}
          {sheet?.type === "theme" && (() => {
            const theme = (st.devThemes || []).find((t) => t.id === sheet.id);
            return theme ? <ThemeSheet T={T} theme={theme} up={up} onClose={() => setSheet(null)} /> : null;
          })()}
        </>
      )}
    </div>
  );
}
