import { useState, useEffect, useMemo } from "react";
import {
  Home, Dumbbell, Footprints, CalendarDays, Settings as SettingsIcon,
  Check, Plus, ChevronLeft, ChevronRight, Flame, Lock, Crown, Send, X, Timer,
  Trash2, Star, Camera, Image as ImageIcon, PenLine, Sparkles, AlertTriangle, Apple,
  BookOpen, Folder, GripVertical, ListPlus, Repeat, Droplets, Minus,
} from "lucide-react";

/* ============ Хранилище на телефоне ============ */
// Данные лежат в памяти Telegram на этом устройстве. Для синхронизации между устройствами нужен сервер с базой.
const storage = {
  get: (key) => { const v = localStorage.getItem(key); return v ? { value: v } : null; },
  set: (key, value) => localStorage.setItem(key, value),
};

/* ============ Темы ============ */
const THEMES = {
  mono: {
    name: "Монохром",
    bg: "radial-gradient(130% 70% at 50% -20%, #5a5a5f 0%, #161618 40%, #000000 75%)",
    card: "rgba(255,255,255,0.035)",
    line: "rgba(255,255,255,0.09)",
    a: "#FFFFFF",
    b: "#8E8E96",
    grad: "linear-gradient(135deg,#FFFFFF 0%,#B4B4BC 55%,#6a6a72 100%)",
    glow: "0 0 18px rgba(255,255,255,0.45), 0 0 60px rgba(255,255,255,0.12)",
    on: "#000000",
    preview: "linear-gradient(135deg,#000 0%,#3a3a3f 60%,#e4e4e8 100%)",
  },
  pulse: {
    name: "Красно-синий",
    bg: "radial-gradient(80% 55% at 0% 0%, rgba(255,45,85,0.38) 0%, rgba(0,0,0,0) 60%), radial-gradient(80% 55% at 100% 100%, rgba(47,107,255,0.42) 0%, rgba(0,0,0,0) 60%), #000000",
    card: "rgba(255,255,255,0.045)",
    line: "rgba(255,255,255,0.11)",
    a: "#FF2D55",
    b: "#2F6BFF",
    grad: "linear-gradient(135deg,#FF2D55 0%,#2F6BFF 100%)",
    glow: "0 0 18px rgba(255,45,85,0.5), 0 0 60px rgba(47,107,255,0.3)",
    on: "#FFFFFF",
    preview: "linear-gradient(135deg,#FF2D55 0%,#000 50%,#2F6BFF 100%)",
  },
};
const MUTED = "rgba(255,255,255,0.55)";
const DISPLAY = "'Unbounded', 'Manrope', system-ui, sans-serif";
const BODY = "'Manrope', system-ui, -apple-system, sans-serif";

/* ============ Даты ============ */
const pad = (n) => String(n).padStart(2, "0");
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

/* ============ Анкета ============ */
const QUESTIONS = [
  { key: "goal", title: "Какая у тебя главная цель?", hint: "От цели зависят повторы, веса и отдых между подходами",
    options: [["mass", "Набрать мышцы"], ["fat", "Сбросить вес"], ["strength", "Стать сильнее"], ["endurance", "Выносливость и бег"]] },
  { key: "sex", title: "Твой пол", hint: "Нужен для расчёта стартовых весов", options: [["m", "Мужской"], ["f", "Женский"]] },
  { key: "body", title: "Параметры тела", hint: "Рабочие веса считаются от веса тела", numbers: [
    { k: "age", label: "Возраст", unit: "лет", min: 16, max: 80 },
    { k: "height", label: "Рост", unit: "см", min: 130, max: 230 },
    { k: "weight", label: "Вес", unit: "кг", min: 35, max: 200 },
  ] },
  { key: "targetKg", title: "На сколько кг хочешь измениться?", hint: "Округлённо — это ориентир, не точная цифра",
    condition: (a) => a.goal === "mass" || a.goal === "fat",
    numbers: [{ k: "targetKg", label: "Изменение веса", unit: "кг", min: 1, max: 40 }] },
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
  { key: "allergies", title: "Есть пищевая аллергия?", hint: "Уберу эти продукты из рецептов и предупрежу, если увижу их на фото", multi: true },
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

// Формула Миффлина — Сан Жеора, активность по числу тренировок
function calcNutrition(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
  const act = { 2: 1.375, 3: 1.46, 4: 1.55 }[p.days] || 1.4;
  const tdee = bmr * act;
  let kcal;
  if (p.goal === "mass" || p.goal === "fat") {
    const maxRate = isAdult(p.age) ? Infinity : 0.4;
    const rate = Math.min(maxRate, p.rate || (p.goal === "mass" ? 0.25 : 0.3));
    const sign = p.goal === "mass" ? 1 : -1;
    kcal = tdee + sign * ((rate / 100) * p.weight * KCAL_PER_KG) / 7;
  } else {
    kcal = tdee * { strength: 1.05, endurance: 1 }[p.goal];
  }
  const floor = Math.max(bmr, p.sex === "f" ? 1200 : 1500);
  kcal = Math.round(Math.max(kcal, floor) / 10) * 10;
  // при большом весе белок считаем от «опорного» веса, чтобы не завышать
  const refW = Math.min(p.weight, 25 * (p.height / 100) ** 2 * 1.15);
  const protein = Math.round(refW * { mass: 1.8, strength: 1.8, fat: 2, endurance: 1.4 }[p.goal]);
  const fat = Math.round(Math.max(refW * 0.9, (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  // Вода: 33 мл/кг веса — общепринятый в клинической практике ориентир (согласуется с нормами EFSA/NAM
  // при пересчёте на среднего человека), плюс надбавка в тренировочный день на потери с потом
  const waterBase = Math.round((p.weight * 33) / 10) * 10;
  const waterTrain = Math.round((waterBase + 500) / 10) * 10;
  return { kcal, protein, fat, carbs, waterBase, waterTrain };
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
};

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
  const last = Math.max(range.lo, Math.min(range.hi, rec.lastMin ?? range.lo));
  if (last >= range.hi && seed != null) {
    return { target: range.lo, weight: roundStep(rec.weight + (e.step || 2.5), e.step || 2.5), leveledUp: true, prevWeight: rec.weight };
  }
  return { target: last, weight: rec.weight ?? seed, leveledUp: last >= range.hi, first: false };
}

function buildProgram(p, exLog) {
  const range = repRangeFor(p);
  const template = TEMPLATES[p.place] || BODYWEIGHT_TEMPLATE;
  const setsPerSession = Math.max(2, Math.round(WEEKLY_SETS[p.level] / p.days));

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
        leveledUp: prog.leveledUp, prevWeight: prog.prevWeight, first: prog.first,
      };
    });
    return { title: `Тренировка ${letter}`, list };
  };

  const days = [makeDay("A"), makeDay("B")];
  const schedule = {};
  STRENGTH_DAYS[p.days].forEach((d, i) => (schedule[d] = i % 2));
  const durationMin = SESSION_MIN[p.place] || 40;
  return { range, days, schedule, place: p.place, durationMin, setsPerSession, weeklySets: setsPerSession * p.days };
}

const exWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "упражнений"; const l = n % 10; return l === 1 ? "упражнение" : l >= 2 && l <= 4 ? "упражнения" : "упражнений"; };

/* ============ Свои тренировки ============
   Приводит элемент своей тренировки (встроенное упражнение или придуманное) к тому же виду,
   что и элементы автопрограммы — чтобы ExerciseRow/ExerciseSheet работали одинаково с обоими.
   Встроенные используют общий st.exLog, поэтому прогресс переносится между автопрограммой
   и своими тренировками. У придуманных верхняя граница диапазона намеренно недостижима —
   автоматического роста веса для них нет, только память «в прошлый раз было столько-то»,
   а вес человек подстраивает сам через поле веса на подход. */
function resolveWorkoutItem(item, profile, exLog) {
  if (!item.custom) {
    const e = EX[item.exId];
    const range = repRangeFor(profile);
    const seed = seedWeight(profile, e);
    const prog = progressFor(exLog, item.exId, e, range, seed);
    return {
      id: item.exId, sets: item.sets, target: prog.target, weight: prog.weight,
      weightLabel: prog.weight != null ? `${fmt(prog.weight)} кг${e.per || ""}` : "свой вес",
      leveledUp: prog.leveledUp, prevWeight: prog.prevWeight, first: prog.first,
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
    leveledUp: false, first: prog.first,
    exercise: e, range,
  };
}

/* ============ Алгоритм бега ============
   3–4 пробежки в неделю, чередуя типы. В основе недели — 80% спокойного объёма
   (длительная, кросс-поход, восстановительный кросс) и 20% быстрой работы
   (ускорения или фартлек, чередуются по неделям). Для тех, кто ещё не бегает
   без остановки, — прогрессия бег/шаг по вариантам из методики (6/4 → 7/3 → 8/2). */
function buildRun(p) {
  const L = { "0": 0, "1": 1, "3": 2, "5": 3 }[p.run];
  const hrmax = 220 - p.age;
  const steadyCeil = Math.round(hrmax * 0.82); // 3 зона — длительная, кросс-поход
  const recoveryCeil = Math.round(hrmax * 0.76); // восстановительный кросс
  const zone = [Math.round(hrmax * 0.6), Math.round(hrmax * 0.7)]; // для сводки на карточке анкеты

  const strengthDays = STRENGTH_DAYS[p.days];
  const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !strengthDays.includes(d));
  const runDays = Math.min(free.length, p.days <= 3 ? 4 : 3);

  let weeks;
  if (L === 0) {
    // ещё не бегает без остановки — прогрессия бег/шаг по методике, без пульсовых интервалов и ускорений
    const ratios = [[6, 4], [7, 3], [8, 2], [8, 2]];
    weeks = [0, 1, 2, 3].map((w) => {
      const [run, walk] = ratios[w];
      const mainMin = 30 + w * 5;
      const mainReps = Math.max(3, Math.round(mainMin / (run + walk)));
      const main = { id: "walkrun", title: "Бег/шаг", hrCeil: steadyCeil,
        summary: `${mainReps} × (${run} мин бег / ${walk} мин быстрый шаг)`,
        lines: [`${mainReps} повторов: ${run} мин бега, ${walk} мин быстрым шагом`, `Держи пульс до ${steadyCeil} уд/мин`] };
      const recovery = { id: "recovery", title: "Восстановительный кросс", hrCeil: recoveryCeil,
        summary: `${20 + w * 5} мин легко, можно с переходом на шаг`,
        lines: [`${20 + w * 5} минут в очень лёгком темпе`, `Переходи на шаг, если пульс выше ${recoveryCeil} уд/мин`] };
      const long = { id: "walkrun", title: "Длинный бег/шаг", hrCeil: steadyCeil,
        summary: `${Math.round(mainReps * 1.4)} × (${run} мин бег / ${walk} мин быстрый шаг)`,
        lines: [`${Math.round(mainReps * 1.4)} повторов: ${run} мин бега, ${walk} мин быстрым шагом`, `Держи пульс до ${steadyCeil} уд/мин`] };
      return runDays >= 4 ? [main, recovery, main, long] : [main, recovery, long];
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
    const hardPool = [intervals, fartlek];
    weeks = [0, 1, 2, 3].map((w) => {
      const hard = hardPool[w % 2];
      if (runDays >= 4) return [recovery, hard, walkrun, long];
      return [recovery, hard, long];
    });
  }

  // Раскладываем runDays тренировок по свободным дням: тяжёлый день — не впритык к длительной
  const chosen = free.length <= runDays ? free : (() => {
    const withLong = free.includes(6) ? 6 : free[free.length - 1];
    const rest = free.filter((d) => d !== withLong);
    const step = Math.max(1, Math.floor(rest.length / (runDays - 1 || 1)));
    const picked = [];
    for (let i = 0; i < rest.length && picked.length < runDays - 1; i += step) picked.push(rest[i]);
    return [...picked, withLong].sort((a, b) => a - b);
  })();
  const schedule = {};
  chosen.slice(0, runDays).forEach((d, i) => (schedule[d] = i));

  return { zone, weeks, schedule, runDays, steadyCeil, recoveryCeil };
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

/* ============ Дневник питания и ИИ ============ */
const FREE_SCANS = 3;
const MEALS = ["Завтрак", "Обед", "Ужин", "Перекус"];
const defaultMeal = () => { const h = new Date().getHours(); return h < 11 ? 0 : h < 16 ? 1 : h < 21 ? 2 : 3; };
const sumFood = (list) => list.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, f: a.f + e.f, c: a.c + e.c }), { kcal: 0, p: 0, f: 0, c: 0 });
const num = (v) => Math.max(0, Math.round(Number(v) || 0));

// Запрос идёт на наш сервер (/api/claude), ключ API хранится только там.
// Ошибки прокидываются с кодом причины (auth/upstream/network/badjson), чтобы экран
// распознавания мог показать не одно и то же «не получилось», а что именно сломалось.
async function askClaude(content) {
  let response;
  try {
    response = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData || "",
      },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    throw new Error("network");
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("auth");
    throw new Error("upstream:" + response.status);
  }
  const data = await response.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!text.trim()) throw new Error("empty");
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

// Переводит код ошибки askClaude в конкретную подсказку, что именно чинить —
// вместо одного и того же «не получилось» на любую причину
function explainAiError(e) {
  const msg = String(e?.message || "");
  if (msg === "auth") return "Сервер отклонил запрос. Проверь, что приложение открыто из Telegram, и что на хостинге верно указаны BOT_TOKEN и ANTHROPIC_API_KEY.";
  if (msg === "network") return "Нет связи с сервером. Проверь интернет-соединение и попробуй ещё раз.";
  if (msg.startsWith("upstream:5")) return "Сервер распознавания недоступен. Проверь ANTHROPIC_API_KEY на хостинге и что аккаунт активен в поддерживаемом регионе.";
  if (msg.startsWith("upstream:4")) return "Сервер отклонил запрос. Проверь переменные окружения на хостинге и передеплой.";
  if (msg === "empty" || msg === "noformat" || msg === "badjson") return "Не получилось разобрать ответ сервера. Попробуй ещё раз через минуту.";
  return "";
}

function fileToJpeg(file, max = 1024) {
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
        const url = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ url, base64: url.split(",")[1] });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const FOOD_PROMPT = `Ты спортивный нутрициолог. Определи блюдо и продукты и оцени пищевую ценность съеденной порции.
Оценивай вес по размеру тарелки, приборов и типичным порциям. Учитывай масло и соусы, если они заметны.
Ответь строго одним JSON-объектом на первой же строке, без markdown, вступления и пояснений до или после:
{"is_food": true, "dish": "короткое название по-русски", "items": [{"name": "продукт", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число}], "allergens": ["ключи из списка gluten, milk, eggs, nuts, peanut, fish, shellfish, soy, sesame, которые вероятно есть в блюде"], "confidence": "high, medium или low", "note": "одно короткое предложение о том, что может быть неточно"}
Если это не еда, верни {"is_food": false}.`;

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
const DEFAULT = {
  profile: null, theme: "mono", pro: false, tasks: {}, dailyTasks: [], done: {}, runDone: {},
  notify: true, food: {}, scans: {}, exLog: {}, trainHistory: [], water: {},
  workouts: [],
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
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Unbounded:wght@400;600;700&display=swap');
      @keyframes breathe { 0%,100% { opacity:.45; transform:scale(1);} 50% { opacity:.9; transform:scale(1.06);} }
      @keyframes rise { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:none;} }
      .no-scrollbar::-webkit-scrollbar { display:none }
      input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0 }
      input::placeholder { color: rgba(255,255,255,.35) }
      button { -webkit-tap-highlight-color: transparent }
      button:focus-visible, input:focus-visible { outline:2px solid rgba(255,255,255,.85); outline-offset:2px }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important } }
    `}</style>
  );
}

const H1 = ({ children }) => (
  <h1 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{children}</h1>
);
const Muted = ({ children, className = "", size = 14, style }) => (
  <p className={className} style={{ color: MUTED, fontSize: size, lineHeight: 1.45, ...style }}>{children}</p>
);
const H2 = ({ children, right }) => (
  <div className="flex items-center justify-between mt-7 mb-3">
    <h2 style={{ fontSize: 17, fontWeight: 700 }}>{children}</h2>
    {right}
  </div>
);

function Card({ T, children, className = "", style, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`w-full text-left rounded-2xl p-4 ${className}`}
      style={{ background: T.card, border: `1px solid ${T.line}`, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", color: "#fff", ...style }}>
      {children}
    </Tag>
  );
}

function Primary({ T, children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full rounded-xl py-3 px-4 font-semibold flex items-center justify-center gap-2 transition-opacity"
      style={{ background: T.grad, color: T.on, boxShadow: disabled ? "none" : T.glow, opacity: disabled ? 0.35 : 1 }}>
      {children}
    </button>
  );
}

function Ghost({ T, children, onClick }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl py-3 px-4 font-medium flex items-center justify-center gap-2"
      style={{ border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)", color: "#fff" }}>
      {children}
    </button>
  );
}

function Toggle({ T, on, onChange, label }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} aria-label={label} className="relative rounded-full flex-shrink-0"
      style={{ width: 46, height: 26, background: on ? T.grad : "rgba(255,255,255,0.12)", boxShadow: on ? T.glow : "none", transition: "background .2s" }}>
      <span className="absolute rounded-full" style={{ width: 20, height: 20, top: 3, left: on ? 23 : 3, background: on ? T.on : "#fff", transition: "left .2s" }} />
    </button>
  );
}

function CheckBox({ T, on, onClick, size = 26, label }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label} className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, border: on ? "none" : "1.5px solid rgba(255,255,255,0.3)", background: on ? T.grad : "transparent", boxShadow: on ? T.glow : "none", color: T.on, transition: "all .2s" }}>
      {on && <Check size={size * 0.55} strokeWidth={3} />}
    </button>
  );
}

function Segmented({ T, items, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl my-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.line}` }}>
      {items.map((it, i) => (
        <button key={i} onClick={() => onChange(i)} className="flex-1 rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-1"
          style={{ background: value === i ? T.grad : "transparent", color: value === i ? T.on : "#fff", transition: "background .2s" }}>
          {it}
        </button>
      ))}
    </div>
  );
}

function Sheet({ T, title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-y-auto no-scrollbar"
        style={{ maxHeight: "90vh", background: "#000", borderRadius: "28px 28px 0 0", boxShadow: `0 -1px 0 ${T.a}66, 0 -20px 60px ${T.a}22`, padding: "20px 20px 36px", animation: "rise .28s ease-out" }}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{title}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "#fff" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Orb({ T, value }) {
  const r = 86, c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto my-4" style={{ width: 200, height: 200 }}>
      <div className="absolute rounded-full" style={{ top: 30, left: 30, right: 30, bottom: 30, background: T.grad, filter: "blur(40px)", animation: "breathe 6s ease-in-out infinite" }} />
      <svg width="200" height="200" className="relative">
        <defs>
          <linearGradient id="orbGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={T.a} />
            <stop offset="100%" stopColor={T.b} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
        <circle cx="100" cy="100" r={r} stroke="url(#orbGrad)" strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dashoffset .8s ease", filter: `drop-shadow(0 0 8px ${T.a})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div style={{ fontFamily: DISPLAY, fontSize: 46, fontWeight: 600, letterSpacing: "-0.03em", textShadow: `0 0 24px ${T.a}88` }}>
          {Math.round(value * 100)}<span style={{ fontSize: 20, color: MUTED }}>%</span>
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>дня выполнено</div>
      </div>
    </div>
  );
}

/* ============ Анкета ============ */
function Chip({ T, on, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="rounded-full px-4 py-2 flex items-center gap-1 font-medium"
      style={{ fontSize: 14, border: `1px solid ${on ? "transparent" : T.line}`, background: on ? T.grad : T.card, color: on ? T.on : "#fff", boxShadow: on ? T.glow : "none", transition: "all .2s" }}>
      {on && <Check size={13} strokeWidth={3} />}
      {children}
    </button>
  );
}

function Loader({ T, text }) {
  return (
    <div className="flex flex-col items-center py-10 gap-5">
      <div className="rounded-full" style={{ width: 56, height: 56, background: T.grad, boxShadow: T.glow, animation: "breathe 1.6s ease-in-out infinite" }} />
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

function Onboarding({ T, onDone }) {
  const [i, setI] = useState(0);
  const [a, setA] = useState({ age: 25, height: 175, weight: 70, allergies: [], targetKg: 5 });
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
          <Primary T={T} onClick={() => onDone({ ...a, created: Date.now() })}>Получить программу</Primary>
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
        ) : <span style={{ fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "0.2em", fontSize: 14 }}>FORMA</span>}
        <span style={{ color: MUTED, fontSize: 13 }}>{pos + 1} из {applicable(a).length}</span>
      </div>
      <div className="flex gap-1 mb-8">
        {applicable(a).map((qq, idx) => (
          <div key={idx} className="flex-1 rounded-full" style={{ height: 3, background: idx <= pos ? T.grad : "rgba(255,255,255,0.1)", boxShadow: idx === pos ? T.glow : "none" }} />
        ))}
      </div>

      <div key={i} style={{ animation: "rise .3s ease-out" }}>
        <H1>{q.title}</H1>
        {hint && <Muted className="mt-2 mb-6">{hint}</Muted>}

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
            <div className="mt-4"><Primary T={T} onClick={nextNumbers}>Дальше</Primary></div>
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

/* ============ Сегодня ============ */
function Today({ T, st, up, program, run, week, go, name, streak, norm }) {
  const now = new Date();
  const k = keyOf(now);
  const w = wdOf(now);
  const dayIdx = program.schedule[w];
  const runIdx = run.schedule[w];
  const tasks = st.tasks[k] || [];
  const daily = st.dailyTasks || [];
  const checks = [...tasks.map((t) => t.done), ...daily.map((t) => !!t.log[k]), ...st.habits.map((h) => !!h.log[k])];
  if (dayIdx !== undefined) checks.push(!!st.done[k]);
  if (runIdx !== undefined) checks.push(!!st.runDone[k]);
  const value = checks.length ? checks.filter(Boolean).length / checks.length : 0;
  const runLocked = !st.pro && week > 0;
  const eaten = sumFood(st.food[k] || []);

  const toggleHabit = (id) => up((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, log: { ...h.log, [k]: !h.log[k] } } : h)) }));
  const toggleTask = (id) => up((s) => ({ tasks: { ...s.tasks, [k]: s.tasks[k].map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } }));
  const toggleDaily = (id) => up((s) => ({ dailyTasks: s.dailyTasks.map((t) => (t.id === id ? { ...t, log: { ...t.log, [k]: !t.log[k] } } : t)) }));
  const [newText, setNewText] = useState("");
  const [newDaily, setNewDaily] = useState(false);
  const addTask = () => {
    const t = newText.trim();
    if (!t) return;
    if (newDaily) up((s) => ({ dailyTasks: [...(s.dailyTasks || []), { id: "dl" + Date.now(), text: t, log: {} }] }));
    else up((s) => ({ tasks: { ...s.tasks, [k]: [...(s.tasks[k] || []), { id: Date.now(), text: t, done: false }] } }));
    setNewText("");
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

      <div className="grid grid-cols-2 gap-3">
        <Card T={T} onClick={() => go("train")} style={{ borderRadius: 22 }}>
          <div className="flex items-center justify-between mb-3">
            <Dumbbell size={20} />
            {dayIdx !== undefined && st.done[k] && <Check size={16} color={T.a} />}
          </div>
          {dayIdx !== undefined ? (
            <>
              <div className="font-semibold">{program.days[dayIdx].title}</div>
              <Muted size={12}>{program.days[dayIdx].list.length} упражнения, около {program.durationMin} мин</Muted>
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

      <Card T={T} onClick={() => go("food")} className="mt-3" style={{ borderRadius: 22 }}>
        <div className="flex items-center gap-3">
          <Apple size={20} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Питание</div>
            <Muted size={12}>{Math.round(eaten.kcal)} из {norm.kcal} ккал, белок {Math.round(eaten.p)} из {norm.protein} г</Muted>
          </div>
          <Camera size={18} color={MUTED} />
        </div>
        <div className="rounded-full mt-3 overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ width: `${Math.min(100, (eaten.kcal / norm.kcal) * 100)}%`, height: "100%", background: T.grad, transition: "width .6s ease" }} />
        </div>
      </Card>

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

      <H2 right={<button onClick={() => go("cal")} style={{ color: MUTED, fontSize: 13 }}>Календарь</button>}>Задачи на сегодня</H2>
      {daily.length === 0 && tasks.length === 0 ? (
        <Muted size={13} className="mb-2">Пока пусто. Добавь задачу ниже — разовую на сегодня или ежедневную.</Muted>
      ) : (
        <div className="flex flex-col gap-2 mb-2">
          {daily.map((t) => (
            <Card key={t.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
              <CheckBox T={T} on={!!t.log[k]} onClick={() => toggleDaily(t.id)} label={t.text} />
              <span className="flex-1" style={{ opacity: t.log[k] ? 0.55 : 1 }}>{t.text}</span>
              <Repeat size={13} color={MUTED} />
            </Card>
          ))}
          {tasks.map((t) => (
            <Card key={t.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
              <CheckBox T={T} on={t.done} onClick={() => toggleTask(t.id)} label={t.text} />
              <span className="flex-1" style={{ opacity: t.done ? 0.5 : 1, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            </Card>
          ))}
        </div>
      )}
      <div className="flex gap-2 mb-2">
        <input value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Новая задача" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
          style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
        <button onClick={addTask} aria-label="Добавить задачу" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
      </div>
      <Chip T={T} on={newDaily} onClick={() => setNewDaily(!newDaily)}><Repeat size={13} /> Ежедневная</Chip>
    </div>
  );
}

/* ============ Силовые ============ */
function ExerciseRow({ T, it, idx, onClick }) {
  const e = it.exercise || EX[it.id];
  return (
    <Card T={T} onClick={onClick} className="flex items-center gap-3">
      <span style={{ fontFamily: DISPLAY, fontSize: 13, color: MUTED, width: 16 }}>{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{e.name}</div>
        <Muted size={13}>{it.sets} {setsWord(it.sets)} по {it.target}{it.first ? "" : "+"} повторов</Muted>
      </div>
      <div className="text-right">
        <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600 }}>{it.weightLabel}</div>
        {it.leveledUp && <div style={{ fontSize: 11, color: T.a }}>вес вырос</div>}
      </div>
      <ChevronRight size={16} color={MUTED} />
    </Card>
  );
}

function Train({ T, st, up, program, openEx, openWorkouts, openNewWorkout, openWorkout }) {
  const [mode, setMode] = useState(0); // 0 = автопрограмма, 1 = свои тренировки
  const now = new Date();
  const k = keyOf(now);
  const todayIdx = program.schedule[wdOf(now)];
  const [sel, setSel] = useState(todayIdx ?? 0);
  const day = program.days[sel];
  const { range } = program;
  const onDays = Object.keys(program.schedule).filter((d) => program.schedule[d] === sel).map((d) => WD[d]).join(", ");
  const base = day.list.filter((it) => it.cat === "base");
  const iso = day.list.filter((it) => it.cat === "iso");
  const workouts = st.workouts || [];

  return (
    <div>
      <H1>Силовые</H1>
      <Segmented T={T} items={["Программа", "Свои"]} value={mode} onChange={setMode} />

      {mode === 0 ? (
        <>
          <Muted className="mt-1">
            Формат — фулбади: вся база и изоляция каждую тренировку. {range.lo}–{range.hi} повторов до технического отказа, отдых {range.restLabel}.
          </Muted>
          <Muted size={13} className="mt-1">Объём: {program.setsPerSession} {setsWord(program.setsPerSession)} на группу мышц за тренировку, {program.weeklySets} в неделю.</Muted>
          <Segmented T={T} items={program.days.map((d) => d.title)} value={sel} onChange={setSel} />
          <Muted size={13} className="mb-3">По дням: {onDays}</Muted>

          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }} className="mb-2">База</div>
          <div className="flex flex-col gap-2">
            {base.map((it) => <ExerciseRow key={it.id} T={T} it={it} idx={day.list.indexOf(it)} onClick={() => openEx(it)} />)}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }} className="mt-4 mb-2">Изоляция</div>
          <div className="flex flex-col gap-2">
            {iso.map((it) => <ExerciseRow key={it.id} T={T} it={it} idx={day.list.indexOf(it)} onClick={() => openEx(it)} />)}
          </div>

          <div className="mt-6">
            {todayIdx === sel ? (
              st.done[k] ? (
                <Card T={T} className="flex items-center gap-3" style={{ boxShadow: T.glow }}>
                  <Check size={20} color={T.a} />
                  <div>
                    <div className="font-semibold">Тренировка завершена</div>
                    <Muted size={13}>Отметка сохранена в календаре и серии дней</Muted>
                  </div>
                </Card>
              ) : (
                <Primary T={T} onClick={() => up((s) => ({ done: { ...s.done, [k]: true } }))}>Завершить тренировку</Primary>
              )
            ) : (
              <Muted size={13} className="text-center">Эта тренировка не на сегодня. Открой упражнение, чтобы посмотреть технику.</Muted>
            )}
          </div>
        </>
      ) : (
        <>
          <Muted className="mt-1 mb-4">Собери тренировку из своих упражнений или из базы — вес и повторы можно менять как угодно.</Muted>
          {workouts.length === 0 ? (
            <Card T={T}><Muted size={14}>Пока нет своих тренировок. Создай первую ниже.</Muted></Card>
          ) : (
            <div className="flex flex-col gap-2">
              {workouts.map((w) => (
                <Card key={w.id} T={T} onClick={() => openWorkout(w.id)} className="flex items-center gap-3">
                  <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}>
                    <ListPlus size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{w.name}</div>
                    <Muted size={13}>{w.items.length} {exWord(w.items.length)}</Muted>
                  </div>
                  <ChevronRight size={16} color={MUTED} />
                </Card>
              ))}
            </div>
          )}
          <div className="mt-4"><Primary T={T} onClick={openNewWorkout}><Plus size={18} /> Создать тренировку</Primary></div>
        </>
      )}
    </div>
  );
}

function WorkoutItemRow({ T, it, onLog, onDelete, onUpdate }) {
  const label = it.custom ? it.customName : EX[it.exId].name;
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
          <input type="number" inputMode="numeric" value={it.sets} onChange={(e) => onUpdate({ sets: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
            className="bg-transparent text-right outline-none" style={{ width: 32, fontFamily: DISPLAY, fontSize: 14, color: "#fff" }} />
        </label>
        <label className="flex-1 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ border: `1px solid ${T.line}` }}>
          <span style={{ fontSize: 11, color: MUTED }}>повторов</span>
          <input type="number" inputMode="numeric" value={it.target} onChange={(e) => onUpdate({ target: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
            className="bg-transparent text-right outline-none" style={{ width: 32, fontFamily: DISPLAY, fontSize: 14, color: "#fff" }} />
        </label>
      </div>
    </Card>
  );
}

function WorkoutEditSheet({ T, workout, up, onOpenPicker, onLogItem, onClose }) {
  const [name, setName] = useState(workout.name);
  const patchWorkout = (patch) => up((s) => ({ workouts: s.workouts.map((w) => (w.id === workout.id ? { ...w, ...patch } : w)) }));
  const saveName = () => { const n = name.trim(); patchWorkout({ name: n || workout.name }); if (!n) setName(workout.name); };
  const updateItem = (id, patch) => patchWorkout({ items: workout.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const delItem = (id) => patchWorkout({ items: workout.items.filter((it) => it.id !== id) });
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
  const weighted = item.weight != null;
  const [sets, setSets] = useState(() => Array.from({ length: item.sets }, () => ({ reps: String(item.target), weight: weighted ? String(item.weight) : "" })));
  const [note, setNote] = useState("");
  const [left, setLeft] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const [down, hold, upT] = e.tempo.split("-").map(Number);
  const total = Math.max(1, down + hold + upT);
  const p1 = (down / total) * 100;
  const p2 = ((down + hold) / total) * 100;
  const anim = `tempo_${item.id}`;

  const updateSet = (i, patch) => setSets(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const finishSet = (i) => { if (i < item.sets - 1) setLeft(range.rest); };

  const save = () => {
    const cleaned = sets.map((s) => ({ reps: Math.max(0, Math.round(Number(s.reps) || 0)), weight: weighted ? Math.max(0, Number(s.weight) || 0) : null }));
    const minReps = Math.min(...cleaned.map((s) => s.reps));
    const lastWeight = weighted ? cleaned[cleaned.length - 1].weight : null;
    onSave({ id: Date.now(), exId: item.id, date: keyOf(new Date()), sets: cleaned, note: note.trim(), minReps, weight: lastWeight });
    setSaved(true);
  };

  const shown = pro ? history : history.slice(0, 3);

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
      <style>{`@keyframes ${anim}{0%{transform:scaleY(1)}${p1}%{transform:scaleY(.2)}${p2}%{transform:scaleY(.2)}100%{transform:scaleY(1)}}`}</style>
      <div className="flex items-center gap-2">
        <Muted size={13}>{e.muscles || "Своё упражнение"}</Muted>
        {e.cat && <span className="rounded-full px-2" style={{ fontSize: 11, border: `1px solid ${T.line}`, color: MUTED }}>{e.cat === "base" ? "База" : "Изоляция"} · {GROUP_LABEL[e.group]}</span>}
      </div>

      <div className="flex gap-5 items-stretch mt-5">
        <div className="relative rounded-2xl overflow-hidden flex-shrink-0" style={{ width: 58, height: 132, border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)" }}>
          {e.time ? (
            <div className="absolute left-0 right-0 bottom-0" style={{ height: "100%", background: T.grad, opacity: 0.85, animation: "breathe 3s ease-in-out infinite" }} />
          ) : (
            <div className="absolute left-0 right-0 bottom-0" style={{ height: "100%", background: T.grad, transformOrigin: "bottom", animation: `${anim} ${total}s ease-in-out infinite`, boxShadow: T.glow }} />
          )}
        </div>
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
          ? `Первый раз — выполняй до технического отказа в диапазоне ${range.lo}–${range.hi}. Это когда следующий чистый повтор уже не сделать.`
          : item.leveledUp && weighted
          ? `В прошлый раз ты дошёл до ${range.hi} повторов на каждом подходе — вес вырос, целься на ${range.lo} с новым весом.`
          : `В прошлый раз худший подход — ${item.target} повторов. Постарайся повторить или превзойти на каждом подходе.`}
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
          {!pro && history.length > 3 && <Muted size={12} className="mt-2">Ещё {history.length - 3} записей — полная история в Pro.</Muted>}
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

function Run({ T, st, up, run, week, openPay }) {
  const [sel, setSel] = useState(week);
  const now = new Date();
  const k = keyOf(now);
  const todayIdx = run.schedule[wdOf(now)];
  const locked = (w) => !st.pro && w > 0;
  const dayOf = (i) => WD[Object.keys(run.schedule).find((d) => run.schedule[d] === i)];

  return (
    <div>
      <H1>Бег</H1>
      <Muted className="mt-1">{run.runDays} пробежки в неделю, чередуя тип: 80% объёма — спокойный бег, 20% — быстрая работа.</Muted>
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
          <Primary T={T} onClick={openPay}>Открыть Pro</Primary>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {run.weeks[sel].map((s, i) => (
            <RunCard key={i} T={T} s={s} dayLabel={dayOf(i)} isToday={sel === week && todayIdx === i}
              done={!!st.runDone[k]} onToggleDone={() => up((x) => ({ runDone: { ...x.runDone, [k]: !x.runDone[k] } }))} />
          ))}
        </div>
      )}
      <Muted size={12} className="mt-4">Перед бегом разминайся 5–10 минут, после заканчивай спокойным шагом. Ускорения и фартлек чередуются по неделям.</Muted>
    </div>
  );
}

/* ============ Календарь и привычки ============ */
function CalendarScreen({ T, st, up, program, run, week, openPay }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(keyOf(today));
  const [text, setText] = useState("");
  const [dailyMode, setDailyMode] = useState(false);
  const [habitName, setHabitName] = useState("");

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = wdOf(new Date(y, m, 1));
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => new Date(y, m, i + 1))];
  const selDate = new Date(sel + "T00:00:00");
  const habitWeek = weekDays(selDate);
  const weekLabel = `${habitWeek[0].getDate()} ${MONTHS[habitWeek[0].getMonth()].slice(0, 3).toLowerCase()} – ${habitWeek[6].getDate()} ${MONTHS[habitWeek[6].getMonth()].slice(0, 3).toLowerCase()}`;
  const selW = wdOf(selDate);
  const tasks = st.tasks[sel] || [];
  const daily = st.dailyTasks || [];
  const canAddHabit = st.pro || st.habits.length < 3;

  const addTask = () => {
    const t = text.trim();
    if (!t) return;
    if (dailyMode) up((s) => ({ dailyTasks: [...(s.dailyTasks || []), { id: "dl" + Date.now(), text: t, log: {} }] }));
    else up((s) => ({ tasks: { ...s.tasks, [sel]: [...(s.tasks[sel] || []), { id: Date.now(), text: t, done: false }] } }));
    setText("");
  };
  const toggleTask = (id) => up((s) => ({ tasks: { ...s.tasks, [sel]: s.tasks[sel].map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } }));
  const delTask = (id) => up((s) => ({ tasks: { ...s.tasks, [sel]: s.tasks[sel].filter((t) => t.id !== id) } }));
  const toggleDaily = (id) => up((s) => ({ dailyTasks: s.dailyTasks.map((t) => (t.id === id ? { ...t, log: { ...t.log, [sel]: !t.log[sel] } } : t)) }));
  const delDaily = (id) => up((s) => ({ dailyTasks: s.dailyTasks.filter((t) => t.id !== id) }));
  const addHabit = () => {
    const n = habitName.trim();
    if (!n) return;
    if (!canAddHabit) return openPay();
    up((s) => ({ habits: [...s.habits, { id: "h" + Date.now(), name: n, log: {} }] }));
    setHabitName("");
  };
  const toggleHabitDay = (id, key) => up((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, log: { ...h.log, [key]: !h.log[key] } } : h)) }));
  const delHabit = (id) => up((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  const Dot = ({ c }) => <span style={{ width: 4, height: 4, borderRadius: 4, background: c, display: "inline-block" }} />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <H1>{MONTHS[m]}</H1>
        <div className="flex gap-2">
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
                  {program.schedule[w] !== undefined && <Dot c={isSel ? T.on : T.a} />}
                  {run.schedule[w] !== undefined && <Dot c={isSel ? T.on : T.b} />}
                  {((st.tasks[k] || []).length > 0 || daily.length > 0) && <Dot c={isSel ? T.on : "rgba(255,255,255,0.6)"} />}
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

      <H2>{cap(selDate.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }))}</H2>
      <div className="flex flex-col gap-2">
        {program.schedule[selW] !== undefined && (
          <Card T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <Dumbbell size={18} />
            <span className="flex-1">{program.days[program.schedule[selW]].title}</span>
            {st.done[sel] && <Check size={16} color={T.a} />}
          </Card>
        )}
        {run.schedule[selW] !== undefined && (
          <Card T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <Footprints size={18} />
            <span className="flex-1">Бег: {run.weeks[week][run.schedule[selW]].title.toLowerCase()}</span>
            {!st.pro && week > 0 ? <Lock size={14} color={MUTED} /> : st.runDone[sel] && <Check size={16} color={T.a} />}
          </Card>
        )}
        {daily.map((t) => (
          <Card key={t.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <CheckBox T={T} on={!!t.log[sel]} onClick={() => toggleDaily(t.id)} label={t.text} />
            <span className="flex-1" style={{ opacity: t.log[sel] ? 0.5 : 1 }}>{t.text}</span>
            <Repeat size={13} color={MUTED} />
            <button onClick={() => delDaily(t.id)} aria-label="Удалить ежедневную задачу" style={{ color: MUTED }}><Trash2 size={16} /></button>
          </Card>
        ))}
        {tasks.map((t) => (
          <Card key={t.id} T={T} className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
            <CheckBox T={T} on={t.done} onClick={() => toggleTask(t.id)} label={t.text} />
            <span className="flex-1" style={{ opacity: t.done ? 0.5 : 1, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            <button onClick={() => delTask(t.id)} aria-label="Удалить задачу" style={{ color: MUTED }}><Trash2 size={16} /></button>
          </Card>
        ))}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Новая задача" className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
            style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
          <button onClick={addTask} aria-label="Добавить задачу" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}><Plus size={20} /></button>
        </div>
        <Chip T={T} on={dailyMode} onClick={() => setDailyMode(!dailyMode)}><Repeat size={13} /> Ежедневная</Chip>
      </div>

      <H2 right={!st.pro && <span style={{ color: MUTED, fontSize: 13 }}>{st.habits.length} из 3</span>}>Трекер привычек</H2>
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
            placeholder={canAddHabit ? "Новая привычка" : "Больше 3 привычек в Pro"} className="flex-1 rounded-xl px-4 py-3 bg-transparent outline-none"
            style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15 }} />
          <button onClick={canAddHabit ? addHabit : openPay} aria-label="Добавить привычку" className="rounded-xl px-4" style={{ background: T.grad, color: T.on }}>
            {canAddHabit ? <Plus size={20} /> : <Lock size={18} />}
          </button>
        </div>
      </div>
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
  const addTask = () => {
    const t = text.trim();
    if (!t) return;
    patchTheme({ tasks: [...theme.tasks, { id: "dtk" + Date.now(), text: t, done: false }] });
    setText("");
  };
  const toggleTask = (id) => patchTheme({ tasks: theme.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  const delTask = (id) => patchTheme({ tasks: theme.tasks.filter((t) => t.id !== id) });
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

function Nutrition({ T, st, up, norm, program, run, openScan, openRecipe, openPay }) {
  const now = new Date();
  const k = keyOf(now);
  const list = st.food[k] || [];
  const eaten = sumFood(list);
  const left = norm.kcal - eaten.kcal;
  const p = st.profile;
  const allergies = p.allergies || [];
  const scansLeft = st.pro ? null : Math.max(0, FREE_SCANS - (st.scans[k] || 0));
  const [showAll, setShowAll] = useState(false);
  const recipes = rankRecipes(RECIPES.filter((r) => !r.allergens.some((a) => allergies.includes(a))), p.goal, left, norm.protein - eaten.p);
  const shown = showAll ? recipes : recipes.slice(0, 4);
  const ghost = { border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.03)", color: "#fff" };

  const isTrainDay = (program?.schedule[wdOf(now)] !== undefined) || (run?.schedule[wdOf(now)] !== undefined);
  const waterTarget = isTrainDay ? norm.waterTrain : norm.waterBase;
  const water = st.water[k] || 0;
  const addWater = (ml) => up((s) => ({ water: { ...s.water, [k]: Math.max(0, (s.water[k] || 0) + ml) } }));

  const hasRate = p.goal === "mass" || p.goal === "fat";
  const kgWeek = hasRate ? (p.rate || 0) / 100 * p.weight : 0;
  const etaWeeks = hasRate && kgWeek > 0 && p.targetKg > 0 ? Math.round(p.targetKg / kgWeek) : 0;
  const deficit = Math.round(norm.kcal - (10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5)) * ({ 2: 1.375, 3: 1.46, 4: 1.55 }[p.days] || 1.4));

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const img = await fileToJpeg(file);
      openScan({ image: img.url, base64: img.base64 });
    } catch (err) {
      openScan({ error: true });
    }
  };
  const delFood = (id) => up((s) => ({ food: { ...s.food, [k]: s.food[k].filter((x) => x.id !== id) } }));

  return (
    <div>
      <H1>Питание</H1>

      {hasRate && p.targetKg > 0 && (
        <Card T={T} className="mt-4" style={{ borderRadius: 20, border: `1px solid ${T.a}55` }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={15} color={T.a} />
            <span className="font-semibold" style={{ fontSize: 14 }}>{p.goal === "mass" ? "Программа набора массы" : "Программа похудения"}</span>
          </div>
          <Muted size={13}>
            {p.goal === "mass" ? "Профицит" : "Дефицit"} {Math.abs(deficit)} ккал/день · цель {p.targetKg} кг · примерно {etaWeeks} {weeksWord(etaWeeks)} при текущем темпе
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
      </Card>

      <Card T={T} className="mt-3" style={{ borderRadius: 22 }}>
        <div className="flex items-center gap-3 mb-2">
          <Droplets size={20} color={T.a} />
          <div className="flex-1">
            <div className="font-semibold">Вода</div>
            <Muted size={12}>{(water / 1000).toFixed(2).replace(".", ",")} из {(waterTarget / 1000).toFixed(1).replace(".", ",")} л{isTrainDay ? ", сегодня тренировка — норма выше" : ""}</Muted>
          </div>
        </div>
        <div className="rounded-full mb-3 overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ width: `${Math.min(100, (water / waterTarget) * 100)}%`, height: "100%", background: T.grad, transition: "width .4s ease" }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => addWater(250)} className="rounded-xl py-2 font-medium" style={ghost}>+250 мл</button>
          <button onClick={() => addWater(500)} className="rounded-xl py-2 font-medium" style={ghost}>+500 мл</button>
          <button onClick={() => addWater(-250)} className="rounded-xl py-2 flex items-center justify-center" style={ghost} aria-label="Убрать 250 мл"><Minus size={16} /></button>
        </div>
      </Card>

      <div className="mt-4">
        {scansLeft === 0 ? (
          <>
            <Primary T={T} onClick={openPay}><Crown size={18} /> Безлимитное распознавание в Pro</Primary>
            <Muted size={12} className="mt-2 text-center">Бесплатные распознавания на сегодня закончились, завтра снова будет {FREE_SCANS}</Muted>
          </>
        ) : (
          <>
            <label className="w-full rounded-xl py-3 px-4 font-semibold flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: T.grad, color: T.on, boxShadow: T.glow }}>
              <Camera size={18} /> Сфотографировать еду
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="rounded-xl py-3 px-3 font-medium flex items-center justify-center gap-2 cursor-pointer" style={{ ...ghost, fontSize: 14 }}>
                <ImageIcon size={16} /> Из галереи
                <input type="file" accept="image/*" onChange={onFile} className="hidden" />
              </label>
              <button onClick={() => openScan({ text: true })} className="rounded-xl py-3 px-3 font-medium flex items-center justify-center gap-2" style={{ ...ghost, fontSize: 14 }}>
                <PenLine size={16} /> Описать текстом
              </button>
            </div>
            {scansLeft !== null && <Muted size={12} className="mt-2 text-center">Бесплатных распознаваний сегодня: {scansLeft} из {FREE_SCANS}</Muted>}
          </>
        )}
      </div>

      <H2>Дневник</H2>
      {list.length === 0 ? (
        <Card T={T}><Muted size={14}>Пока пусто. Сфотографируй приём пищи или добавь рецепт из списка ниже.</Muted></Card>
      ) : (
        MEALS.map((label, mi) => {
          const items = list.filter((e) => e.meal === mi);
          if (!items.length) return null;
          return (
            <div key={label} className="mb-3">
              <div className="flex justify-between mb-2" style={{ fontSize: 13 }}>
                <span className="font-semibold">{label}</span>
                <span style={{ color: MUTED }}>{Math.round(sumFood(items).kcal)} ккал</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((e) => (
                  <Card key={e.id} T={T} className="flex items-center gap-3" style={{ padding: "10px 14px" }}>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{e.name}</div>
                      <Muted size={12}>Б {e.p}, Ж {e.f}, У {e.c}</Muted>
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600 }}>{e.kcal}</span>
                    <button onClick={() => delFood(e.id)} aria-label="Удалить запись" style={{ color: MUTED }}><Trash2 size={15} /></button>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}

      <H2>Рецепты для тебя</H2>
      <Muted size={13} className="mb-3">
        {allergies.length ? `Показываю только блюда без аллергенов: ${alLabels(allergies)}` : "Аллергии не указаны. Их можно добавить в настройках."}
      </Muted>

      <Card T={T} onClick={st.pro ? () => openRecipe({ ai: true }) : openPay} className="flex items-center gap-3 mb-2" style={{ border: `1px solid ${T.a}88`, boxShadow: st.pro ? T.glow : "none" }}>
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

function FoodScanSheet({ T, init, allergies, onClose, onAdd, onUsed }) {
  const [status, setStatus] = useState(init.error ? "error" : init.image ? "loading" : "input");
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const [error, setError] = useState(init.error ? "Не получилось открыть фото. Попробуй другое изображение." : "");
  const [portion, setPortion] = useState(100);
  const [meal, setMeal] = useState(defaultMeal());

  const analyze = async (content) => {
    setStatus("loading");
    try {
      const r = await askClaude(content);
      if (!r.is_food) {
        setError(init.image ? "На фото не видно еды. Сфотографируй тарелку сверху при хорошем свете." : "Не получилось понять, что за еда. Напиши название блюда и примерный вес.");
        setStatus("error");
        return;
      }
      const items = (r.items || []).map((it) => ({ name: String(it.name || "Продукт"), grams: num(it.grams), kcal: num(it.kcal), p: num(it.protein), f: num(it.fat), c: num(it.carbs) }));
      if (!items.length) throw new Error("empty");
      const dish = String(r.dish || items[0].name);
      const found = [...new Set([...(r.allergens || []).filter((a) => ALLERGENS[a]), ...detectAllergens(dish + " " + items.map((x) => x.name).join(" "))])];
      setRes({ dish, items, found, confidence: r.confidence, note: r.note ? String(r.note) : "" });
      setPortion(100);
      setStatus("result");
      onUsed();
    } catch (e) {
      setError(explainAiError(e) || "Не получилось распознать. Попробуй ещё раз или опиши блюдо текстом.");
      setStatus("error");
    }
  };
  const analyzePhoto = () => analyze([
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: init.base64 } },
    { type: "text", text: FOOD_PROMPT },
  ]);
  const analyzeText = () => {
    const t = text.trim();
    if (!t) return;
    analyze([{ type: "text", text: `Пользователь описал, что съел: «${t}».\n${FOOD_PROMPT}` }]);
  };

  useEffect(() => { if (init.image) analyzePhoto(); }, []);

  const k = portion / 100;
  const tot = res ? res.items.reduce((a, x) => ({ kcal: a.kcal + x.kcal * k, p: a.p + x.p * k, f: a.f + x.f * k, c: a.c + x.c * k, g: a.g + x.grams * k }), { kcal: 0, p: 0, f: 0, c: 0, g: 0 }) : null;
  const danger = res ? res.found.filter((a) => allergies.includes(a)) : [];
  const conf = { high: "высокая", medium: "средняя", low: "низкая" }[res?.confidence] || "средняя";

  return (
    <Sheet T={T} title={status === "result" ? res.dish : "Подсчёт КБЖУ"} onClose={onClose}>
      {init.image && (
        <img src={init.image} alt="Фото еды" className="w-full rounded-2xl mt-3" style={{ height: 180, objectFit: "cover", border: `1px solid ${T.line}` }} />
      )}

      {status === "input" && (
        <div className="mt-3">
          <Muted size={13} className="mb-3">Напиши, что и сколько съел. Например: гречка 150 г, куриная грудка 120 г, огурец.</Muted>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Что было на тарелке"
            className="w-full rounded-xl px-4 py-3 bg-transparent outline-none mb-4"
            style={{ border: `1px solid ${T.line}`, color: "#fff", fontSize: 15, resize: "none", fontFamily: BODY }} />
          <Primary T={T} onClick={analyzeText} disabled={!text.trim()}>Посчитать КБЖУ</Primary>
        </div>
      )}

      {status === "loading" && <Loader T={T} text={init.image ? "Распознаю блюдо и считаю калории" : "Считаю калории и БЖУ"} />}

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
          {danger.length > 0 && (
            <div className="rounded-2xl p-3 flex gap-3 mt-4" style={{ background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.65)" }}>
              <AlertTriangle size={20} color="#FF2D55" className="flex-shrink-0" />
              <div>
                <div className="font-semibold">Возможен аллерген: {alLabels(danger)}</div>
                <Muted size={12}>Ты отметил это в анкете. По фото состав определяется неточно, уточни у того, кто готовил.</Muted>
              </div>
            </div>
          )}

          <div className="flex items-baseline gap-2 mt-4">
            <span style={{ fontFamily: DISPLAY, fontSize: 38, fontWeight: 600, textShadow: `0 0 24px ${T.a}66` }}>{Math.round(tot.kcal)}</span>
            <span style={{ color: MUTED }}>ккал</span>
          </div>
          <MacroChips p={tot.p} f={tot.f} c={tot.c} />
          <Muted size={12} className="mt-2">Точность оценки: {conf}</Muted>

          <H2>Состав</H2>
          <div className="flex flex-col gap-2">
            {res.items.map((x, i) => (
              <div key={i} className="flex justify-between gap-3" style={{ fontSize: 14 }}>
                <span>{x.name}, {Math.round(x.grams * k)} г</span>
                <span style={{ color: MUTED }}>{Math.round(x.kcal * k)} ккал</span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex justify-between" style={{ fontSize: 13 }}>
              <span>Размер порции</span>
              <span style={{ color: MUTED }}>{portion}%, около {Math.round(tot.g)} г</span>
            </div>
            <input type="range" min={50} max={200} step={10} value={portion} onChange={(e) => setPortion(Number(e.target.value))}
              className="w-full mt-2" style={{ accentColor: T.a }} aria-label="Размер порции" />
          </div>

          <Muted size={12} className="mt-2">
            {res.note ? res.note + " " : ""}Калории по фото — это оценка. Если знаешь точный вес, поправь размер порции.
          </Muted>

          <Segmented T={T} items={MEALS} value={meal} onChange={setMeal} />
          <Primary T={T} onClick={() => onAdd({ name: res.dish, kcal: tot.kcal, p: tot.p, f: tot.f, c: tot.c, meal })}>Добавить в дневник</Primary>
        </div>
      )}
    </Sheet>
  );
}

function RecipeSheet({ T, init, profile, left, onClose, onAdd }) {
  const allergies = profile.allergies || [];
  const [recipe, setRecipe] = useState(init.recipe || null);
  const [status, setStatus] = useState(init.recipe ? "ready" : "loading");
  const [meal, setMeal] = useState(defaultMeal());
  const [errMsg, setErrMsg] = useState("");

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

/* ============ Оплата ============ */
const RUB_PRICE = { month: 150, year: 1200 }; // ₽ за месяц и за год — значения меняются только здесь

function PaySheet({ T, onClose, onPaid }) {
  const [plan, setPlan] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | creating | error | done
  const [error, setError] = useState("");
  const planKey = plan === 0 ? "month" : "year";
  const rub = RUB_PRICE[planKey];
  const plans = [["Месяц", `${RUB_PRICE.month} ₽ / 30 дней`], ["Год", `${RUB_PRICE.year} ₽ / 12 месяцев`]];

  const pay = async () => {
    setStatus("creating");
    setError("");
    try {
      const res = await fetch("/api/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData || "" },
        body: JSON.stringify({ plan: planKey, currency: "RUB" }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error(data.error || "no link");
      const tg = window.Telegram?.WebApp;
      if (tg?.openLink) tg.openLink(data.link);
      else window.open(data.link, "_blank", "noopener,noreferrer");
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setError(e?.message || "Не удалось открыть оплату по СБП.");
    }
  };

  if (status === "done") {
    return (
      <Sheet T={T} title="" onClose={onPaid}>
        <div className="text-center py-6" style={{ animation: "rise .3s ease-out" }}>
          <div className="mx-auto rounded-full flex items-center justify-center mb-5" style={{ width: 88, height: 88, background: T.grad, boxShadow: T.glow, color: T.on }}>
            <Crown size={38} />
          </div>
          <H1>Pro подключена</H1>
          <Muted className="mt-2 mb-8">После подтверждения оплаты доступ к Pro будет активирован.</Muted>
          <Primary T={T} onClick={onPaid}>Готово</Primary>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet T={T} title="Оплата FORMA Pro" onClose={onClose}>
      <Muted size={13} className="mb-5">Выберите тариф. Перед оплатой пользователю доступны стоимость в рублях, политика конфиденциальности и пользовательское соглашение.</Muted>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {plans.map(([t, d], i) => (
          <button key={t} onClick={() => setPlan(i)} className="rounded-2xl p-4 text-left"
            style={{ border: `1px solid ${plan === i ? T.a : T.line}`, background: plan === i ? "rgba(255,255,255,0.07)" : T.card, boxShadow: plan === i ? T.glow : "none", color: "#fff" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600 }}>{t}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{d}</div>
          </button>
        ))}
      </div>

      <Card T={T} className="mb-4">
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14 }}>К оплате</span>
          <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700 }}>{rub} ₽</span>
        </div>
        <Muted size={12} className="mt-1">Оплата через СБП НСПК. Комиссия по формату подключения — 8,5%.</Muted>
      </Card>

      <div className="flex flex-col gap-2 mb-5">
        <Ghost T={T} onClick={() => openExternal(LEGAL.privacyUrl)}>Политика конфиденциальности</Ghost>
        <Ghost T={T} onClick={() => openExternal(LEGAL.termsUrl)}>Пользовательское соглашение</Ghost>
      </div>

      {error && <Muted size={13} className="mb-3" style={{ color: T.a }}>{error}</Muted>}
      <Primary T={T} onClick={pay} disabled={status === "creating"}>
        {status === "creating" ? "Открываю оплату…" : `Оплатить ${rub} ₽ через СБП`}
      </Primary>
      <Muted size={12} className="mt-3 text-center">После нажатия откроется страница оплаты по СБП. Актуальная цена показывается непосредственно перед оплатой.</Muted>
    </Sheet>
  );
}

/* ============ Юридическая информация ============ */
const LEGAL = {
  support: "@doltiii",
  privacyUrl: "https://telegra.ph/Politika-konfidencialnosti-08-01-83",
  termsUrl: "https://telegra.ph/Polzovatelskoe-soglashenie-08-01-39",
  verificationWord: "Plaтега",
};

function openExternal(url) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function LegalSheet({ T, type, onClose }) {
  const privacy = type === "privacy";
  const title = privacy ? "Политика конфиденциальности" : "Пользовательское соглашение";
  const url = privacy ? LEGAL.privacyUrl : LEGAL.termsUrl;
  return (
    <Sheet T={T} title={title} onClose={onClose}>
      <Muted size={13} className="mb-5">
        Документ постоянно доступен пользователю по кнопке ниже. Для банковской проверки используется актуальная версия проекта.
      </Muted>
      <Card T={T} style={{ borderRadius: 20 }}>
        <div className="font-semibold mb-2">{title}</div>
        <Muted size={13}>
          Актуальная редакция размещена на Telegraph. В документе должны быть указаны данные именно проекта ASCEND и актуальная дата.
        </Muted>
      </Card>
      <Primary T={T} onClick={() => openExternal(url)}>
        Открыть документ
      </Primary>
    </Sheet>
  );
}



/* ============ Настройки ============ */
function SettingsScreen({ T, st, up, openPay, go, norm }) {
  const p = st.profile;
  const al = p.allergies || [];
  const toggleAllergy = (id) => up((s) => {
    const cur = s.profile.allergies || [];
    return { profile: { ...s.profile, allergies: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } };
  });
  const openSupport = () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink("https://t.me/doltiii");
    else window.open("https://t.me/doltiii", "_blank");
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

      <Card T={T} className="mt-4" style={{ borderRadius: 24, boxShadow: st.pro ? T.glow : "none" }}>
        <div className="flex items-center gap-3 mb-1">
          <Crown size={20} color={st.pro ? T.a : "#fff"} />
          <span className="font-semibold">{st.pro ? "Pro активна" : "Бесплатный план"}</span>
        </div>
        <Muted size={13} className={st.pro ? "" : "mb-4"}>
          {st.pro ? "Все функции открыты" : "Pro добавляет безлимитное распознавание еды, рецепты от ИИ, автопрогрессию весов и полный беговой план"}
        </Muted>
        {!st.pro && <Primary T={T} onClick={openPay}>Открыть Pro за 150 ₽</Primary>}
      </Card>

      <H2>Фон</H2>
      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <H2>Уведомления</H2>
      <Card T={T} style={{ paddingTop: 4, paddingBottom: 4 }}>
        <Row title="Напоминания" sub="Бот напишет утром о плане на день" on={st.notify} onChange={(v) => up({ notify: v })} />
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
        <div className="mt-4"><Ghost T={T} onClick={() => up({ profile: null })}>Пройти анкету заново</Ghost></div>
      </Card>

      <H2>Документы и оплата</H2>
      <Card T={T}>
        <div className="flex flex-col gap-2">
          <Ghost T={T} onClick={() => setSheet({ type: "privacy" })}>Политика конфиденциальности</Ghost>
          <Ghost T={T} onClick={() => setSheet({ type: "terms" })}>Пользовательское соглашение</Ghost>
        </div>
      </Card>

      <Card T={T} className="mt-3">
        <div className="font-semibold mb-1">Информация для проверки</div>
        <Muted size={12}>Кодовое слово: <span style={{ color: "#fff", fontWeight: 700 }}>{LEGAL.verificationWord}</span></Muted>
        <Muted size={12} className="mt-1">Поддержка: {LEGAL.support}</Muted>
      </Card>

      <Muted size={12} className="mt-6 mb-2">
        Программа носит рекомендательный характер и не заменяет консультацию врача или тренера.
      </Muted>

      <H2>Поддержка</H2>
      <Ghost T={T} onClick={openSupport}><Send size={16} /> Написать в поддержку ({LEGAL.support})</Ghost>
    </div>
  );
}

/* ============ Приложение ============ */
const TABS = [
  ["today", "Сегодня", Home],
  ["train", "Силовые", Dumbbell],
  ["run", "Бег", Footprints],
  ["food", "Питание", Apple],
  ["dev", "Развитие", BookOpen],
  ["cal", "Календарь", CalendarDays],
];

export default function App() {
  const [st, setSt] = useState(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [sheet, setSheet] = useState(null);
  const T = THEMES[st.theme] || THEMES.mono;
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
  const name = tg?.initDataUnsafe?.user?.first_name || "атлет";

  const up = (patch) => setSt((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  const haptic = () => { try { tg?.HapticFeedback?.impactOccurred("light"); } catch (e) {} };

  useEffect(() => {
    try { tg?.ready(); tg?.expand(); tg?.setHeaderColor?.("#000000"); tg?.setBackgroundColor?.("#000000"); } catch (e) {}
    (async () => {
      try {
        const r = storage.get("forma-state");
        if (r && r.value) setSt({ ...DEFAULT, ...JSON.parse(r.value) });
      } catch (e) { /* первый запуск */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try { storage.set("forma-state", JSON.stringify(st)); } catch (e) { console.error("Не удалось сохранить", e); }
    }, 500);
    return () => clearTimeout(t);
  }, [st, loaded]);

  const week = st.profile ? Math.min(3, Math.floor((Date.now() - (st.profile.created || Date.now())) / 6048e5)) : 0;
  const program = useMemo(() => (st.profile ? buildProgram(st.profile, st.exLog) : null), [st.profile, st.exLog]);
  const run = useMemo(() => (st.profile ? buildRun(st.profile) : null), [st.profile]);
  const norm = useMemo(() => (st.profile ? calcNutrition(st.profile) : null), [st.profile]);
  const todayKey = keyOf(new Date());
  const todayFood = sumFood(st.food[todayKey] || []);
  const leftToday = norm ? { kcal: norm.kcal - todayFood.kcal, p: norm.protein - todayFood.p } : null;

  const addFood = (e) => {
    const k = keyOf(new Date());
    const entry = { id: Date.now(), name: e.name, meal: e.meal, kcal: Math.round(e.kcal), p: Math.round(e.p), f: Math.round(e.f), c: Math.round(e.c) };
    up((s) => ({ food: { ...s.food, [k]: [...(s.food[k] || []), entry] } }));
    setSheet(null);
    haptic();
  };
  const countScan = () => up((s) => {
    const k = keyOf(new Date());
    return { scans: { ...s.scans, [k]: (s.scans[k] || 0) + 1 } };
  });
  // Двойная прогрессия: обновляем текущий вес/цель по упражнению и пишем запись в дневник
  const saveTraining = (entry) => {
    up((s) => ({
      exLog: { ...s.exLog, [entry.exId]: { weight: entry.weight, lastMin: entry.minReps } },
      trainHistory: [entry, ...(s.trainHistory || [])],
    }));
    haptic();
  };

  const active = (k) => !!(st.done[k] || st.runDone[k] || st.habits.some((h) => h.log[k]) || (st.dailyTasks || []).some((t) => t.log[k]) || (st.tasks[k] || []).some((t) => t.done));
  const myStreak = streakOf(active);

  const go = (t) => { haptic(); setTab(t); window.scrollTo?.(0, 0); };
  const openPay = () => setSheet({ type: "pay" });

  return (
    <div className="min-h-screen w-full text-white" style={{ background: T.bg, backgroundAttachment: "fixed", fontFamily: BODY, transition: "background .4s" }}>
      <GlobalStyle />
      {!loaded ? (
        <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: DISPLAY, letterSpacing: "0.3em", textShadow: T.glow }}>FORMA</div>
      ) : !st.profile ? (
        <Onboarding T={T} onDone={(p) => { up({ profile: p }); setTab("today"); }} />
      ) : (
        <>
          <main key={tab} className="max-w-md mx-auto px-5 pt-6" style={{ paddingBottom: 110, animation: "rise .25s ease-out" }}>
            {tab === "today" && <Today T={T} st={st} up={up} program={program} run={run} week={week} go={go} name={name} streak={myStreak} norm={norm} />}
            {tab === "train" && (
              <Train T={T} st={st} up={up} program={program}
                openEx={(item) => setSheet({ type: "ex", item, range: program.range })}
                openNewWorkout={() => {
                  const w = { id: "w" + Date.now(), name: "Новая тренировка", items: [] };
                  up((s) => ({ workouts: [...(s.workouts || []), w] }));
                  setSheet({ type: "workout", id: w.id });
                }}
                openWorkout={(id) => setSheet({ type: "workout", id })} />
            )}
            {tab === "run" && <Run T={T} st={st} up={up} run={run} week={week} openPay={openPay} />}
            {tab === "food" && (
              <Nutrition T={T} st={st} up={up} norm={norm} program={program} run={run} openPay={openPay}
                openScan={(init) => setSheet({ type: "scan", init })}
                openRecipe={(init) => setSheet({ type: "recipe", init })} />
            )}
            {tab === "dev" && <DevScreen T={T} st={st} up={up} openTheme={(id) => setSheet({ type: "theme", id })} />}
            {tab === "cal" && <CalendarScreen T={T} st={st} up={up} program={program} run={run} week={week} openPay={openPay} />}
            {tab === "settings" && <SettingsScreen T={T} st={st} up={up} openPay={openPay} go={go} norm={norm} />}
          </main>

          <nav className="fixed bottom-0 left-0 right-0 z-40" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderTop: `1px solid ${T.line}` }}>
            <div className="max-w-md mx-auto flex px-1 pt-2" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
              {TABS.map(([id, label, Icon]) => {
                const on = tab === id;
                return (
                  <button key={id} onClick={() => go(id)} aria-current={on ? "page" : undefined}
                    className="flex flex-col items-center gap-1 flex-1 py-1" style={{ color: on ? "#fff" : "rgba(255,255,255,0.4)" }}>
                    <Icon size={21} color={on ? T.a : "currentColor"} style={on ? { filter: `drop-shadow(0 0 6px ${T.a})` } : undefined} />
                    <span style={{ fontSize: 10, fontWeight: on ? 600 : 500 }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {sheet?.type === "ex" && (
            <ExerciseSheet T={T} item={sheet.item} range={sheet.range || program.range} pro={st.pro}
              history={(st.trainHistory || []).filter((h) => h.exId === sheet.item.id)}
              onClose={() => setSheet(sheet.returnTo ? { type: "workout", id: sheet.returnTo } : null)} onSave={saveTraining} />
          )}
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
          {sheet?.type === "pay" && <PaySheet T={T} onClose={() => setSheet(null)} onPaid={() => { up({ pro: true }); setSheet(null); }} />}
          {sheet?.type === "privacy" && <LegalSheet T={T} type="privacy" onClose={() => setSheet(null)} />}
          {sheet?.type === "terms" && <LegalSheet T={T} type="terms" onClose={() => setSheet(null)} />}
          {sheet?.type === "scan" && (
            <FoodScanSheet T={T} init={sheet.init} allergies={st.profile.allergies || []}
              onClose={() => setSheet(null)} onAdd={addFood} onUsed={countScan} />
          )}
          {sheet?.type === "recipe" && (
            <RecipeSheet T={T} init={sheet.init} profile={st.profile} left={leftToday}
              onClose={() => setSheet(null)} onAdd={addFood} />
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
