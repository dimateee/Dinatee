/* План подготовки к ОГЭ-2027.
   Источники (на октябрь 2026): проекты демоверсий ФИПИ от 26.08.2026; Порядок ГИА-9
   (итоговое собеседование — вторая среда февраля, доп. дни — вторая среда марта и третий понедельник апреля;
   заявление — до 1 марта). Расписание ОГЭ-2027 ещё не утверждено, его даты — ориентиры по 2026 году. */
import { starsOf } from "../lib/progress.jsx";

export const EXAM_DATE = "2027-06-01"; // ориентир: основной период в 2026 году начался 2 июня

export const MILESTONES = [
  { date: "2026-11-15", title: "ФИПИ утверждает итоговые демоверсии ОГЭ-2027", note: "Сейчас на сайте — проекты от 26 августа. Проверь, не изменилось ли что-то.", approx: true },
  { date: "2026-12-25", title: "Ожидается проект расписания ОГЭ-2027", note: "Минпросвещения и Рособрнадзор публикуют его в конце года.", approx: true },
  { date: "2027-02-10", title: "Итоговое собеседование по русскому", note: "Это допуск к ОГЭ. Запасные дни — 10 марта и 19 апреля." },
  { date: "2027-03-01", title: "Последний день подачи заявления на ОГЭ", note: "В заявлении указывают два предмета по выбору." },
  { date: "2027-04-21", title: "Досрочный период", note: "Ориентир по 2026 году: с 21 апреля по 18 мая.", approx: true },
  { date: "2027-06-01", title: "Основной период ОГЭ", note: "Ориентир по 2026 году: со 2 июня по 6 июля.", approx: true },
];

// Что поменялось в 2027 году — по проектам демоверсий ФИПИ
export const CHANGES = {
  math: "Без изменений: 25 заданий, максимум 31 балл, 3 ч 55 мин.",
  rus: "Структура прежняя. В сочинении 13.1–13.3 новый критерий: примеры из текста нужно не только привести, но и пояснить. За сочинение — до 8 баллов вместо 7, за всю работу — до 38 вместо 37. Итоговое собеседование: 3 задания вместо 4, подробный пересказ убрали, времени на подготовку больше.",
  phys: "Существенных изменений нет.",
  inf: "Существенных изменений нет.",
  chem: "Существенных изменений нет.",
  bio: "Существенных изменений нет.",
  hist: "Убрали задание на причинно-следственные связи. Новое задание — найти и исправить ошибки в историческом тексте.",
  soc: "Самые большие изменения: 20 заданий вместо 24, максимум 32 балла вместо 37. Новое задание 17 с развёрнутым ответом — анализ социальной информации с выводами и аргументами.",
};

export const MATERIALS = [
  { title: "Демоверсии, спецификации и кодификаторы ОГЭ-2027", text: "ФИПИ — официальные документы по всем предметам. Начни с демоверсии своих предметов.", url: "https://fipi.ru/oge/demoversii-specifikacii-kodifikatory", emoji: "📄" },
  { title: "Итоговое собеседование 2027", text: "ФИПИ — демоверсия и критерии. В 2027 году 3 задания вместо 4.", url: "https://fipi.ru/itogovoe-sobesedovanie", emoji: "🗣️" },
  { title: "Открытый банк заданий ОГЭ", text: "ФИПИ — настоящие задания по всем предметам.", url: "https://oge.fipi.ru/bank/", emoji: "🏛️" },
  { title: "Навигатор самостоятельной подготовки", text: "ФИПИ — методические рекомендации и типичные ошибки.", url: "https://fipi.ru/navigator-podgotovki/navigator-oge", emoji: "🧭" },
  { title: "Рособрнадзор — новости ГИА", text: "Здесь появится утверждённое расписание ОГЭ-2027.", url: "https://obrnadzor.gov.ru/", emoji: "📅" },
  { title: "Разбор изменений ОГЭ-2027", text: "«Мел» — понятный разбор новых демоверсий: история, сочинение, собеседование.", url: "https://mel.fm/ucheba/shkola/2903168-kak-izmenitsya-oge-2027-razbor-novykh-demoversy-i-kodifikatorov-fipi", emoji: "📰" },
];

// Этапы подготовки. target — сколько звёзд нужно в каждой теме к концу этапа (зависит от цели ученика)
export const PHASES = [
  { id: "base", title: "Фундамент", from: "2026-09-01", to: "2026-12-27", emoji: "🧱",
    goal: "Пройти все темы хотя бы на одну звезду и привыкнуть заниматься каждый день.",
    tips: ["Разминка 10 минут каждый день", "2 новые темы по математике и по одной по остальным предметам в неделю", "Ошибся — открой разбор и реши ещё одно похожее задание"],
    target: () => 1 },
  { id: "topics", title: "Все темы", from: "2026-12-28", to: "2027-02-28", emoji: "🗺️",
    goal: "Довести темы до уверенного уровня и сдать итоговое собеседование 10 февраля.",
    tips: ["Темы без звёзд и слабые темы — в первую очередь", "Мини-тест по одному предмету раз в неделю", "Русский: потренируй собеседование по демоверсии ФИПИ (3 задания)"],
    target: (g) => Math.min(2, g - 2) },
  { id: "variants", title: "Варианты", from: "2027-03-01", to: "2027-04-30", emoji: "📝",
    goal: "Решать полные варианты на время и закрывать пробелы.",
    tips: ["Пробный вариант по каждому предмету раз в неделю", "После варианта — разбор каждой ошибки", "Цель «4» и «5»: по математике добавь задания второй части"],
    target: (g) => Math.max(1, g - 2) },
  { id: "finish", title: "Финиш", from: "2027-05-01", to: "2027-07-10", emoji: "🏁",
    goal: "Повторение, два варианта в неделю, спокойствие и режим сна.",
    tips: ["2 варианта в неделю по каждому предмету", "Повторяй только слабые темы — новое уже не учим", "За день до экзамена — лёгкая разминка и сон"],
    target: (g) => Math.max(1, g - 2) },
];

export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const daysUntil = (iso, now = new Date()) => Math.ceil((new Date(`${iso}T00:00:00`) - new Date(dayKey(now) + "T00:00:00")) / 864e5);

export function currentPhase(now = new Date()) {
  const k = dayKey(now);
  return PHASES.find((p) => k >= p.from && k <= p.to) || (k < PHASES[0].from ? PHASES[0] : PHASES.at(-1));
}

// Понедельник текущей недели — ключ недели
export function weekStart(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

// Готовность по предмету: средняя доля звёзд по темам
export const readiness = (subject, topics) =>
  Math.round((subject.topics.reduce((s, t) => s + starsOf(topics[t.id]), 0) / (subject.topics.length * 3)) * 100);

/* Задачи на неделю. Темы подбираются автоматически: первые по порядку, где звёзд меньше цели этапа.
   Отметка «готово» ставится сама, когда ученик выполнил условие в приложении. */
export function weekTasks({ state, subjects, goal = 4, now = new Date() }) {
  const phase = currentPhase(now);
  const target = Math.max(1, phase.target(goal));
  const week = weekStart(now);
  const tasks = [];

  const active = (state.active || []).filter((d) => d >= week).length;
  tasks.push({ id: "days", kind: "auto", title: "Заниматься 5 дней из 7", detail: `Уже ${active} из 5`, done: active >= 5, go: ["warmup"] });

  for (const s of subjects) {
    const per = s.id === "math" && (phase.id === "base" || phase.id === "topics") ? 2 : 1;
    const todo = s.topics.filter((t) => starsOf(state.topics[t.id]) < target).slice(0, per);
    for (const t of todo) {
      const have = starsOf(state.topics[t.id]);
      tasks.push({ id: `topic-${t.id}`, kind: "auto", subject: s, title: `${s.short}: ${t.title}`, detail: `Звёзды ${have} из ${target}`, done: false, go: ["topic", { id: t.id }] });
    }
    if (!todo.length) tasks.push({ id: `topics-${s.id}`, kind: "auto", subject: s, title: `${s.short}: все темы на ${target} ⭐`, detail: "Цель этапа выполнена", done: true });
  }

  // Пробники: на этапе «Все темы» — по одному предмету в неделю по очереди, дальше — по всем предметам
  const weekNo = Math.floor(new Date(`${week}T00:00:00`) / (7 * 864e5));
  const testSubjects = phase.id === "base" ? [] : phase.id === "topics" ? [subjects[weekNo % subjects.length]] : subjects;
  const timesPerWeek = phase.id === "finish" ? 2 : 1;
  for (const s of testSubjects) {
    const doneCount = state.variants.filter((v) => v[0] >= week && (v[3] || "math") === s.id).length;
    tasks.push({ id: `test-${s.id}`, kind: "auto", subject: s, title: `${s.short}: ${s.id === "math" ? "пробный вариант" : "мини-тест"}${timesPerWeek > 1 ? ` × ${timesPerWeek}` : ""}`, detail: `Сделано ${Math.min(doneCount, timesPerWeek)} из ${timesPerWeek}`, done: doneCount >= timesPerWeek, go: ["variants", { subject: s.id }] });
  }

  // Ручные задачи — ученик отмечает сам
  const manual = state.plan?.[week] || [];
  const addManual = (id, title, detail, url) => tasks.push({ id, kind: "manual", title, detail, url, done: manual.includes(id) });
  if (subjects.some((s) => s.id === "rus") && phase.id === "topics" && dayKey(now) <= "2027-02-10") {
    addManual("interview", "Русский: прорепетировать итоговое собеседование", "Демоверсия ФИПИ, 3 задания — вслух, с таймером", "https://fipi.ru/itogovoe-sobesedovanie");
  }
  if (subjects.some((s) => s.id === "rus") && phase.id !== "base") {
    addManual("essay", "Русский: написать сочинение 13.1–13.3", "Новое в 2027: каждый пример из текста нужно пояснить", "https://fipi.ru/oge/demoversii-specifikacii-kodifikatory");
  }
  if (goal >= 4 && subjects.some((s) => s.id === "math") && phase.id !== "base") {
    addManual("part2", "Математика: 2 задания второй части", "Раздел «Варианты» → часть 2");
  }
  if (phase.id === "base") addManual("demo", "Открыть демоверсию ФИПИ своих предметов", "Посмотри, как выглядит настоящий экзамен", "https://fipi.ru/oge/demoversii-specifikacii-kodifikatory");

  return { phase, target, week, tasks };
}
