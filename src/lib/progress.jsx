/* Прогресс ученика: опыт, уровни, серия дней, статистика по темам и достижения.
   Хранится на устройстве и в облаке Telegram, чтобы не потерялся при смене телефона. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cloud } from "./telegram.js";

const KEY = "oge-quest-v1";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY = {
  v: 1, profile: null, xp: 0,
  days: { last: "", streak: 0, best: 0 },
  today: { d: "", xp: 0 },
  topics: {}, warm: {}, blitzBest: 0, bestCombo: 0,
  ach: [], variants: [], p2: {},
};

/* ---------- Уровни ---------- */
const TITLES = ["Новичок", "Ученик", "Решатель", "Знаток", "Эксперт", "Мастер", "Гуру ОГЭ", "Легенда"];
export const levelStart = (l) => 50 * l * (l - 1);
export const levelOf = (xp) => { let l = 1; while (xp >= levelStart(l + 1)) l++; return l; };
export const levelTitle = (l) => TITLES[Math.min(l - 1, TITLES.length - 1)];
export function levelProgress(xp) {
  const l = levelOf(xp), a = levelStart(l), b = levelStart(l + 1);
  return { level: l, title: levelTitle(l), into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
}

/* ---------- Звёзды за тему ---------- */
export function starsOf(stat) {
  const [c = 0, t = 0] = stat || [];
  if (c >= 30 && c / t >= 0.7) return 3;
  if (c >= 15) return 2;
  if (c >= 5) return 1;
  return 0;
}

/* ---------- Достижения ---------- */
export const ACHIEVEMENTS = [
  { id: "first", emoji: "🌱", title: "Первый шаг", text: "Первый правильный ответ", test: (s) => [...Object.values(s.topics), ...Object.values(s.warm)].some(([c]) => c > 0) },
  { id: "streak3", emoji: "🔥", title: "В огне", text: "3 дня подряд", test: (s) => s.days.streak >= 3 },
  { id: "streak7", emoji: "🌋", title: "Неделя силы", text: "7 дней подряд", test: (s) => s.days.streak >= 7 },
  { id: "combo10", emoji: "⚡", title: "Комбо ×10", text: "10 правильных подряд", test: (s) => s.bestCombo >= 10 },
  { id: "blitz20", emoji: "⏱️", title: "Молния", text: "20 ответов в блице", test: (s) => s.blitzBest >= 20 },
  { id: "star3", emoji: "🌟", title: "Мастер темы", text: "3 звезды в любой теме", test: (s) => Object.values(s.topics).some((x) => starsOf(x) === 3) },
  { id: "explorer", emoji: "🧭", title: "Исследователь", text: "Попробовал все 15 тем", test: (s) => Object.keys(s.topics).length >= 15 },
  { id: "variant", emoji: "📝", title: "Как на экзамене", text: "Решил пробный вариант", test: (s) => s.variants.length > 0 },
  { id: "grade5", emoji: "🏆", title: "Отличник", text: "«5» за пробный вариант", test: (s) => s.variants.some((v) => v[2] === 5) },
  { id: "xp1000", emoji: "💎", title: "Тысячник", text: "1000 опыта", test: (s) => s.xp >= 1000 },
  { id: "part2", emoji: "🧠", title: "Вторая часть", text: "Разобрал 5 заданий второй части", test: (s) => Object.keys(s.p2).length >= 5 },
];

/* ---------- Контекст ---------- */
const Ctx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {}
  return EMPTY;
}

// Серия дней: продолжается, если вчера занимались, и сбрасывается после пропуска
function touchDay(s) {
  const d = today();
  if (s.days.last === d) return s;
  const streak = s.days.last === yesterday() ? s.days.streak + 1 : 1;
  return { ...s, days: { last: d, streak, best: Math.max(s.days.best, streak) } };
}
function addXp(s, amount) {
  const d = today();
  const t = s.today.d === d ? s.today : { d, xp: 0 };
  return { ...s, xp: s.xp + amount, today: { d, xp: t.xp + amount } };
}

export function ProgressProvider({ children }) {
  const [state, setState] = useState(load);
  const [toasts, setToasts] = useState([]);
  const timer = useRef(null);

  // При запуске подтягиваем облачную копию — берём ту, где больше опыта
  useEffect(() => {
    cloud.get(KEY).then((raw) => {
      if (!raw) return;
      try {
        const remote = { ...EMPTY, ...JSON.parse(raw) };
        setState((local) => (remote.xp > local.xp ? remote : local));
      } catch {}
    });
  }, []);

  useEffect(() => {
    const raw = JSON.stringify(state);
    try { localStorage.setItem(KEY, raw); } catch {}
    clearTimeout(timer.current);
    timer.current = setTimeout(() => cloud.set(KEY, raw), 1500);
  }, [state]);

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((x) => [...x, { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3200);
  }, []);

  // Применяем изменение и сообщаем о новых достижениях и уровнях
  const apply = useCallback((fn) => {
    setState((prev) => {
      let next = fn(prev);
      const fresh = ACHIEVEMENTS.filter((a) => !next.ach.includes(a.id) && a.test(next));
      if (fresh.length) {
        next = { ...next, ach: [...next.ach, ...fresh.map((a) => a.id)] };
        setTimeout(() => fresh.forEach((a) => toast({ kind: "ach", emoji: a.emoji, title: a.title, text: a.text })), 0);
      }
      const lp = levelOf(prev.xp), ln = levelOf(next.xp);
      if (ln > lp) setTimeout(() => toast({ kind: "level", emoji: "🎉", title: `Уровень ${ln}!`, text: levelTitle(ln) }), 0);
      return next;
    });
  }, [toast]);

  const actions = {
    setProfile: (profile) => apply((s) => ({ ...s, profile })),
    // Ответ на задание: опыт растёт с комбо, но не больше +10 бонуса
    answer: ({ topic, warm, correct, combo = 0 }) => {
      const gained = correct ? 10 + Math.min(combo, 5) * 2 : 0;
      apply((s) => {
        let n = { ...s, bestCombo: Math.max(s.bestCombo, combo + (correct ? 1 : 0)) };
        if (topic) { const [c = 0, t = 0] = n.topics[topic] || []; n.topics = { ...n.topics, [topic]: [c + (correct ? 1 : 0), t + 1] }; }
        if (warm) { const [c = 0, t = 0] = n.warm[warm] || []; n.warm = { ...n.warm, [warm]: [c + (correct ? 1 : 0), t + 1] }; }
        if (gained) n = addXp(touchDay(n), gained);
        return n;
      });
      return gained;
    },
    bonus: (amount) => apply((s) => addXp(touchDay(s), amount)),
    blitz: (score) => apply((s) => ({ ...s, blitzBest: Math.max(s.blitzBest, score) })),
    variant: (score, grade) => apply((s) => ({ ...s, variants: [[today(), score, grade], ...s.variants].slice(0, 12) })),
    part2: (id, pts) => apply((s) => addXp(touchDay({ ...s, p2: { ...s.p2, [id]: pts } }), 15 + pts * 10)),
    reset: () => setState(EMPTY),
  };

  return <Ctx.Provider value={{ state, toasts, toast, ...actions }}>{children}</Ctx.Provider>;
}

export const useProgress = () => useContext(Ctx);
export const todayKey = today;

// Серия на экране: если пропущен больше чем один день — огонёк погас
export const currentStreak = (s) => (s.days.last === today() || s.days.last === yesterday() ? s.days.streak : 0);
