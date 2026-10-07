// Главная страница сайта RITM: что умеет приложение, цены, установка на телефон и компьютер.
// Само приложение живёт по адресу /app (src/App.jsx) — лендинг его не подгружает.
import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  Dumbbell, Footprints, Apple, Activity, CalendarDays, Mic, TrendingUp, BookOpen, Target,
  Camera, ScanBarcode, Timer, Cloud, Crown, Smartphone, Monitor, Share, SquarePlus, Check,
  Download, MoreHorizontal, Send, ArrowRight, ChevronDown, ShieldCheck, Wind, Sparkles,
  Users, Sunrise, Droplets, Palette, Minus, Plus,
} from "lucide-react";
import { useInstall, ANDROID_APK_URL, inTelegram } from "./web.js";
import { RUB_PRICE, YEAR_SAVINGS_PCT, PRO_COMPARISON_ROWS, LEGAL_LINKS } from "./plans.js";
import { CountUp, useInView, reducedMotion } from "./motion.jsx";
import { goal } from "./analytics.js";

const C = {
  bg: "#08090B",
  surface: "#101114",
  card: "rgba(255,255,255,0.04)",
  line: "rgba(255,255,255,0.08)",
  a: "#C6FF3D",
  b: "#38E0C8",
  grad: "linear-gradient(135deg,#D4FF5C 0%,#9BF26A 45%,#38E0C8 100%)",
  on: "#0A0B0D",
  muted: "rgba(255,255,255,0.58)",
};
// Страница уже пришла готовым HTML (scripts/prerender.mjs) и первый экран отыграл появление —
// когда React перерисует её, не повторяем анимацию, иначе текст мигнёт.
const PRERENDERED = typeof document !== "undefined" && !!document.getElementById("prerender");
const DISPLAY = "'Geologica', 'Onest', system-ui, sans-serif";
const BODY = "'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif";

const FEATURES = [
  [Dumbbell, "Силовые под твою цель", "Программа на 2–4 дня в неделю для зала, дома или с гирей. Вес и повторы растут сами, гид ведёт по подходам с таймером отдыха и фото техники, карта мышц показывает, что качаешь."],
  [Users, "Друзья и чат", "Добавляй друзей по @username, переписывайся прямо в приложении, планируйте совместные тренировки и ставьте общие цели. Что видно друзьям — решаешь ты."],
  [Sunrise, "Зарядка", "Пять коротких комплексов под таймер: утренняя зарядка, разминка среди дня, вечерняя растяжка, перед тяжёлой тренировкой и перед бегом."],
  [Footprints, "Беговой план", "3–4 пробежки в неделю: спокойные кроссы, длительная и интервалы, с пульсовыми зонами и подсказками."],
  [Camera, "Калории по фото", "Сфотографируй тарелку — ИИ разберёт её на продукты с весом и КБЖУ. Или штрихкод с общей базой товаров, или просто текстом. Любимые блюда можно запомнить."],
  [Apple, "Питание и рецепты", "Норма калорий и БЖУ из анкеты, рецепты под остаток дня, список покупок на неделю и учёт воды."],
  [Activity, "Здоровье", "Шаги, сон, вес с графиком, замеры тела и самочувствие после тренировок. Норма пересчитывается, когда вес меняется."],
  [CalendarDays, "Календарь и задачи", "Задачник в духе TickTick: приоритеты, списки, повторы и время. Плюс трекер привычек с сериями дней."],
  [Mic, "Голосовой помощник", "Спроси голосом «что съесть, чтобы добрать белок» — помощник ответит с учётом твоих данных за неделю."],
  [TrendingUp, "Прогресс и награды", "Графики тренировок, бега, веса и питания, личные рекорды, ИИ-разбор недели и бейджи за достижения."],
  [BookOpen, "Развитие", "Книги с прогрессом по страницам, челленджи, дневник с настроением, дыхательные практики и свои темы."],
];

const FAQ = [
  ["Нужен ли Telegram?", "Вход на сайте — через Telegram-бота: так твой аккаунт, Pro и данные одни и те же в Mini App, на сайте и в приложении на телефоне. Без входа можно попробовать всё бесплатное — данные тогда хранятся только в этом браузере."],
  ["Как установить на iPhone?", "Открой сайт в Safari, нажми «Поделиться» и выбери «На экран „Домой“». Появится иконка RITM, приложение будет открываться на весь экран — App Store не нужен."],
  ["Как установить на Android?", "Открой сайт в Chrome и нажми «Установить» — на этой странице или в меню ⋮ браузера. RITM появится среди приложений с собственной иконкой."],
  ["Как оплатить Pro?", "По СБП через Platega — из приложения банка в пару касаний. 150 ₽ за месяц или 1200 ₽ за год. Автоматических списаний нет: продлеваешь, только когда сам захочешь."],
  ["Pro, купленная в Telegram, работает на сайте?", "Да. Pro привязана к Telegram-аккаунту — она активна везде, где ты вошёл этим аккаунтом. И наоборот: оплатил на сайте — Pro уже есть в Mini App."],
  ["Друзья и чат работают на сайте?", "Да. После входа через Telegram на сайте и в приложении на телефоне доступны те же друзья, чат, совместные тренировки и общие цели, что и в Mini App — это один и тот же аккаунт."],
  ["Мои данные синхронизируются?", "Да. Тренировки, питание, задачи и всё остальное одинаковы на телефоне, компьютере и в Mini App. Без интернета приложение тоже открывается, а изменения отправятся, когда связь вернётся."],
];

function Mark({ size = 22 }) {
  const bars = [0.55, 1, 0.72, 0.38];
  return (
    <span className="inline-flex items-end" aria-hidden="true" style={{ height: size, gap: size * 0.12 }}>
      {bars.map((h, i) => <span key={i} style={{ width: size * 0.17, height: size * h, borderRadius: size, background: C.grad }} />)}
    </span>
  );
}
function Wordmark({ size = 20 }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.5 }}>
      <Mark size={size} />
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "0.16em", lineHeight: 1 }}>RITM</span>
    </span>
  );
}

function Btn({ href, onClick, children, primary, big, ...rest }) {
  const style = primary
    ? { background: C.grad, color: C.on, boxShadow: "0 10px 32px rgba(170,255,80,0.22)" }
    : { background: "rgba(255,255,255,0.05)", color: "#fff", border: `1px solid ${C.line}`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" };
  const cls = `inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-transform active:scale-[.98] ${big ? "px-6 py-4 text-[16px]" : "px-4 py-2.5 text-[14px]"}`;
  if (href) return <a href={href} onClick={onClick} className={cls} style={{ ...style, textDecoration: "none" }} {...rest}>{children}</a>;
  return <button onClick={onClick} className={cls} style={style} {...rest}>{children}</button>;
}

// Заголовок раздела проявляется из размытия по словам, одно за другим
function Words({ text }) {
  return String(text).split(" ").map((w, i, arr) => (
    <Fragment key={i}><span className="w" style={{ "--i": i }}>{w}</span>{i < arr.length - 1 ? " " : ""}</Fragment>
  ));
}

const SectionTitle = ({ kicker, title, sub }) => (
  <div className="max-w-2xl mb-10 reveal">
    {kicker && <div className="mb-3 font-semibold uppercase" style={{ color: C.a, fontSize: 12, letterSpacing: "0.14em" }}>{kicker}</div>}
    <h2 className="words" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(28px, 4.2vw, 44px)", letterSpacing: "-0.04em", lineHeight: 1.05 }}><Words text={title} /></h2>
    {sub && <p className="mt-4" style={{ color: C.muted, fontSize: 17, lineHeight: 1.55 }}>{sub}</p>}
  </div>
);

// «Горы» из столбиков ритма: силуэт эквалайзера, который поднимается снизу первого экрана при прокрутке.
// Высоты считаются детерминированно — рисунок одинаковый при каждой загрузке.
function Ridge({ bars = 26, seed = 1, peak = 0.9, fill, cap, className = "", style }) {
  const hs = Array.from({ length: bars }, (_, i) => {
    const x = i / (bars - 1);
    const hill = Math.pow(Math.sin(Math.PI * (x * 0.9 + 0.05 + seed * 0.07)), 2);
    const wobble = 0.5 + 0.5 * Math.sin(i * 1.7 + seed * 3.1) * Math.cos(i * 0.6 + seed);
    return Math.min(100, 100 * (0.18 + peak * (0.55 * hill + 0.3 * wobble)));
  });
  return (
    <div className={`${className} flex items-end`} style={{ gap: "max(3px, .5vw)", ...style }} aria-hidden="true">
      {hs.map((h, i) => (
        <span key={i} className="flex-1" style={{ height: `${h}%`, borderRadius: "999px 999px 0 0", background: cap ? `linear-gradient(to bottom, ${cap} 0, ${cap} 10px, ${fill} 22px)` : fill }} />
      ))}
    </div>
  );
}

// Большой знак RITM на фоне всей страницы: «вырастает» на первом экране и остаётся
// приглушённым за содержимым (как цветок у stkkrokus.com). Высота каждого столбика — от прокрутки (--p).
function BgMark() {
  const bars = [0.55, 1, 0.72, 0.38];
  return (
    <div className="bg-mark fixed inset-0 pointer-events-none" aria-hidden="true" style={{ zIndex: 2 }}>
      <div className="bg-mark-inner absolute left-1/2 flex items-end" style={{ bottom: "6vh", height: "min(52vh, 420px)", gap: "min(2.2vh, 18px)" }}>
        <div className="bg-glow absolute rounded-full" style={{ inset: "20% -40% -10%", background: C.grad, filter: "blur(80px)" }} />
        {bars.map((h, i) => (
          <span key={i} className="bg-bar relative" style={{ "--i": i, width: "min(6.5vh, 52px)", height: `${h * 100}%`, borderRadius: 999, background: C.grad, boxShadow: "0 0 40px rgba(198,255,61,.25)" }} />
        ))}
      </div>
    </div>
  );
}

// Карточка с графиком, который «прорисовывается» при прокрутке, как профиль маршрута:
// линия рисуется слева направо, заливка проявляется, на пике появляется метка.
function smoothPath(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
  }
  return d;
}
function ProgressCard({ tag, title, sub, data, peakLabel, stats, delay = 0 }) {
  const ref = useRef(null);
  const on = useInView(ref, { threshold: 0.35 });
  const id = useId().replace(/:/g, "");
  const W = 320, H = 120, padX = 6, padTop = 26, padBottom = 8;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [padX + (i / (data.length - 1)) * (W - padX * 2), padTop + (1 - (v - min) / (max - min || 1)) * (H - padTop - padBottom)]);
  const line = smoothPath(pts);
  const peakI = data.indexOf(max);
  const [px, py] = pts[peakI];
  return (
    <div ref={ref} className={`glass rounded-[26px] p-5 lift reveal ${on ? "in drawn" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="relative" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="absolute inset-0 overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.a} stopOpacity=".28" /><stop offset="100%" stopColor={C.a} stopOpacity="0" /></linearGradient>
            <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#D4FF5C" /><stop offset="100%" stopColor={C.b} /></linearGradient>
          </defs>
          <path d={`${line} L${W - padX},${H} L${padX},${H} Z`} fill={`url(#f${id})`} className="chart-fill" style={{ transitionDelay: `${delay + 700}ms` }} />
          <path d={line} fill="none" stroke={`url(#s${id})`} strokeWidth="2.4" strokeLinecap="round" pathLength="1" className="chart-line" style={{ transitionDelay: `${delay + 150}ms` }} />
          <line x1={padX} x2={W - padX} y1={H - 1} y2={H - 1} stroke="rgba(255,255,255,.1)" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="chart-peak absolute" style={{ left: `${(px / W) * 100}%`, top: py, transitionDelay: `${delay + 1100}ms` }}>
          <span className="absolute rounded-full" style={{ width: 10, height: 10, left: -5, top: -5, background: C.a, boxShadow: `0 0 0 4px rgba(198,255,61,.18), 0 0 18px ${C.a}` }} />
          <span className="absolute whitespace-nowrap font-semibold" style={{ bottom: 10, left: px / W > 0.7 ? "auto" : -8, right: px / W > 0.7 ? -8 : "auto", fontSize: 11.5, color: C.a }}>▲ {peakLabel}</span>
        </div>
      </div>
      <div className="mt-5 inline-flex rounded-full px-2.5 py-1 font-semibold" style={{ fontSize: 11, background: "rgba(198,255,61,.1)", color: C.a, border: "1px solid rgba(198,255,61,.22)" }}>{tag}</div>
      <h3 className="mt-3" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>{title}</h3>
      <div style={{ color: C.muted, fontSize: 13.5 }}>{sub}</div>
      <div className="mt-4 flex gap-8">
        {stats.map(([n, l]) => (
          <div key={l}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}><CountUp value={n} start={on} /></div>
            <div style={{ color: C.muted, fontSize: 12 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Макет телефона с экраном «Сегодня» — чистый HTML/SVG, без картинок
function PhoneMock() {
  const r = 52, c = 2 * Math.PI * r, value = 0.72;
  return (
    <div className="relative mx-auto phone-float" style={{ width: 300, height: 610, maxWidth: "100%" }}>
      <div className="absolute rounded-full" style={{ inset: "18% 8%", background: C.grad, filter: "blur(70px)", opacity: 0.32, animation: "glowPulse 5s ease-in-out infinite" }} />
      <div className="relative h-full rounded-[46px] p-[10px]" style={{ background: "linear-gradient(160deg,#2a2c31,#0d0e10)", boxShadow: "0 40px 100px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.08)" }}>
        <div className="h-full rounded-[37px] overflow-hidden relative" style={{ background: "radial-gradient(110% 55% at 0% -10%, rgba(198,255,61,0.16) 0%, rgba(0,0,0,0) 55%), #08090B" }}>
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: 10, width: 92, height: 26, background: "#000" }} />
          <div className="px-5 pt-14">
            <div style={{ fontSize: 10.5, color: C.muted }}>Среда, 7 октября</div>
            <div className="flex items-center justify-between">
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19, letterSpacing: "-0.03em" }}>Привет, Аня</div>
              <div className="rounded-full px-2 py-0.5 flex items-center gap-1" style={{ border: `1px solid ${C.line}`, fontSize: 11 }}>🔥 12</div>
            </div>
            <div className="relative mx-auto my-4" style={{ width: 136, height: 136 }}>
              <svg width="136" height="136" viewBox="0 0 136 136">
                <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={C.a} /><stop offset="100%" stopColor={C.b} /></linearGradient></defs>
                {Array.from({ length: 36 }, (_, i) => {
                  const ang = (i / 36) * Math.PI * 2 - Math.PI / 2;
                  return <line key={i} x1={68 + 62 * Math.cos(ang)} y1={68 + 62 * Math.sin(ang)} x2={68 + 66 * Math.cos(ang)} y2={68 + 66 * Math.sin(ang)} stroke={i < 26 ? C.a : "rgba(255,255,255,.14)"} strokeWidth="1.6" strokeLinecap="round" />;
                })}
                <circle cx="68" cy="68" r={r} stroke="rgba(255,255,255,.07)" strokeWidth="9" fill="none" />
                <circle cx="68" cy="68" r={r} stroke="url(#lg)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 68 68)"
                  style={{ "--c": c, animation: "ringFill 1.6s .4s cubic-bezier(.3,.7,.3,1) both" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "-0.05em" }}>72<span style={{ fontSize: 13, color: C.muted }}>%</span></div>
                <div style={{ fontSize: 9, color: C.muted }}>дня выполнено</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[[Dumbbell, "Верх тела A", "6 упражнений · 50 мин"], [Footprints, "Лёгкий кросс", "35 мин, зона 2"]].map(([I, t, s]) => (
                <div key={t} className="rounded-2xl p-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                  <I size={15} />
                  <div className="mt-2 font-semibold" style={{ fontSize: 12 }}>{t}</div>
                  <div style={{ fontSize: 9.5, color: C.muted }}>{s}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-3 mt-2" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2"><Apple size={15} /><span className="font-semibold" style={{ fontSize: 12 }}>Питание</span><Camera size={14} color={C.muted} className="ml-auto" /></div>
              <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>1 480 из 2 150 ккал · белок 96 из 130 г</div>
              <div className="rounded-full mt-2 overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,.08)" }}><div style={{ width: "69%", height: "100%", background: C.grad }} /></div>
            </div>
            <div className="rounded-2xl p-3 mt-2 flex items-center gap-2" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <span className="rounded-full flex items-center justify-center" style={{ width: 18, height: 18, background: C.grad, color: C.on }}><Check size={11} strokeWidth={3} /></span>
              <span style={{ fontSize: 12, opacity: .6 }}>Растяжка 10 минут</span>
            </div>
          </div>
          <div className="absolute left-3 right-3 bottom-3 rounded-[22px] p-1 flex" style={{ background: "rgba(14,15,18,.9)", border: `1px solid ${C.line}` }}>
            {[[Activity, "Сегодня", true], [Dumbbell, "Силовые"], [Footprints, "Бег"], [Apple, "Питание"], [MoreHorizontal, "Ещё"]].map(([I, l, on]) => (
              <div key={l} className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-[18px]" style={{ background: on ? "rgba(255,255,255,.08)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,.45)" }}>
                <I size={14} color={on ? C.a : "currentColor"} />
                <span style={{ fontSize: 8 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Живое демо гида по тренировке: три подхода жима на наклонной скамье с темпом, отдыхом и итогом.
// Правило роста веса то же, что в приложении (progressFor в App.jsx, «двойная прогрессия»):
// если во всех подходах дошёл до верхней границы диапазона — в следующий раз вес +2,5 кг,
// иначе цель — повторить или превзойти худший подход.
const DEMO = { name: "Жим штанги на наклонной скамье", weight: 40, sets: 3, lo: 8, hi: 12, step: 2.5, down: 3, pause: 1, up: 1, rest: 15 };
const fmtKg = (v) => String(v).replace(".", ",");

function DemoStepper({ value, onChange, unit, step = 1, min = 0, label }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label={`Меньше: ${label}`} className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, border: `1px solid ${C.line}`, color: "#fff" }}><Minus size={16} /></button>
      <span className="text-center overflow-hidden" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, minWidth: 54 }}><span key={value} className="demo-tick">{fmtKg(value)}</span></span>
      <button onClick={() => onChange(value + step)} aria-label={`Больше: ${label}`} className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, border: `1px solid ${C.line}`, color: "#fff" }}><Plus size={16} /></button>
      <span style={{ fontSize: 13, color: C.muted }}>{unit}</span>
    </div>
  );
}

function WorkoutDemo() {
  const [phase, setPhase] = useState("set"); // set | rest | done
  const [set, setSet] = useState(1);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(DEMO.weight);
  const [log, setLog] = useState([]);
  const [left, setLeft] = useState(DEMO.rest);
  const [tempoWord, setTempoWord] = useState("вниз");
  const started = useRef(false);
  const ref = useRef(null);
  const visible = useInView(ref, { threshold: 0.25 });
  const cycle = DEMO.down + DEMO.pause + DEMO.up;

  // Подпись темпа синхронно с анимацией (CSS-анимация идёт тот же цикл в `cycle` секунд)
  useEffect(() => {
    if (phase !== "set" || !visible) return undefined;
    const t0 = performance.now();
    const id = setInterval(() => {
      const t = ((performance.now() - t0) / 1000) % cycle;
      setTempoWord(t < DEMO.down ? "вниз" : t < DEMO.down + DEMO.pause ? "пауза" : "вверх");
    }, 120);
    return () => clearInterval(id);
  }, [phase, set, visible, cycle]);

  useEffect(() => {
    if (phase !== "rest") return undefined;
    if (left <= 0) { setPhase("set"); return undefined; }
    const id = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, left]);

  const touch = () => { if (!started.current) { started.current = true; goal("demo_start"); } };
  const finishSet = () => {
    touch();
    const next = [...log, { reps, weight }];
    setLog(next);
    if (set >= DEMO.sets) { setPhase("done"); goal("demo_done"); return; }
    setSet(set + 1);
    setLeft(DEMO.rest);
    setPhase("rest");
  };
  const restart = () => { setLog([]); setSet(1); setReps(10); setWeight(DEMO.weight); setPhase("set"); };

  const minReps = Math.min(...log.map((l) => l.reps));
  const lastWeight = log.length ? log[log.length - 1].weight : weight;
  const levelUp = log.length > 0 && minReps >= DEMO.hi;
  const r = 52, c = 2 * Math.PI * r;

  return (
    <div ref={ref} className="glass rounded-[28px] p-5 sm:p-7 reveal">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div style={{ fontSize: 12.5, color: C.muted }}>Демо · упражнение 1 из 1</div>
          <div className="font-semibold truncate" style={{ fontSize: 17 }}>{DEMO.name}</div>
        </div>
        <span className="rounded-full px-2.5 py-1 font-semibold flex-shrink-0" style={{ fontSize: 11, background: "rgba(198,255,61,.1)", color: C.a, border: "1px solid rgba(198,255,61,.22)" }}>пример</span>
      </div>
      <div className="flex gap-1 my-4">
        {Array.from({ length: DEMO.sets }, (_, i) => (
          <span key={i} className="flex-1 rounded-full" style={{ height: 4, background: i < log.length ? C.a : i === log.length && phase !== "done" ? C.grad : "rgba(255,255,255,0.12)", transition: "background .4s" }} />
        ))}
      </div>

      {phase === "set" && (
        <div key={`set-${set}`} className="demo-in">
          <div className="text-center">
            <div style={{ fontSize: 13, color: C.muted }}>Подход {set} из {DEMO.sets}</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, letterSpacing: "-0.03em", textShadow: "0 0 24px rgba(198,255,61,.35)" }}>{fmtKg(weight)} кг</div>
            <div style={{ fontSize: 13, color: C.muted }}>цель {DEMO.lo}–{DEMO.hi} повторов до отказа</div>
          </div>
          <div className="relative mt-4 rounded-[20px] overflow-hidden" style={{ aspectRatio: "3 / 2", background: "#111", border: `1px solid ${C.line}` }}>
            <img src="/exercises/inclineBench/0.jpg" alt="Жим на наклонной скамье: штанга вверху" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <img src="/exercises/inclineBench/1.jpg" alt="" aria-hidden="true" className={`absolute inset-0 w-full h-full object-cover ${visible ? "demo-photo" : ""}`} style={{ "--cycle": `${cycle}s`, opacity: 0 }} loading="lazy" />
            <div className="absolute left-3 bottom-3 top-3 rounded-full overflow-hidden" style={{ width: 8, background: "rgba(0,0,0,.45)" }}>
              <div className={`absolute left-0 right-0 bottom-0 top-0 ${visible ? "demo-bar" : ""}`} style={{ "--cycle": `${cycle}s`, background: C.grad, transformOrigin: "bottom" }} />
            </div>
            <div className="absolute right-3 bottom-3 rounded-full px-3 py-1 font-semibold" style={{ fontSize: 13, background: "rgba(8,9,11,.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} aria-live="polite">{tempoWord}</div>
          </div>
          <div className="text-center mt-2" style={{ fontSize: 12.5, color: C.muted }}>Темп: вниз {DEMO.down} с, пауза, вверх {DEMO.up} с</div>
          <div style={{ fontSize: 12.5, color: C.muted }} className="mt-4 mb-2">Сколько получилось</div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3" onClick={touch}>
            <DemoStepper value={reps} onChange={setReps} unit="повт." label="повторы" />
            <DemoStepper value={weight} onChange={setWeight} unit="кг" step={DEMO.step} label="вес" />
          </div>
          <div className="mt-5 flex flex-col"><Btn onClick={finishSet} primary big>Готово</Btn></div>
        </div>
      )}

      {phase === "rest" && (
        <div key={`rest-${set}`} className="demo-in text-center">
          <div className="relative mx-auto mt-2" style={{ width: 136, height: 136 }}>
            <svg width="136" height="136" viewBox="0 0 136 136" aria-hidden="true">
              <circle cx="68" cy="68" r={r} stroke="rgba(255,255,255,.08)" strokeWidth="9" fill="none" />
              <circle cx="68" cy="68" r={r} stroke={C.a} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / DEMO.rest)} transform="rotate(-90 68 68)" style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40 }}>{left}</div>
          </div>
          <div className="mt-3" style={{ fontSize: 14 }}>Отдых перед подходом {set} из {DEMO.sets}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>В демо 15 секунд, в приложении — по цели: для набора мышц 1,5 минуты</div>
          <div className="mt-5 flex flex-col"><Btn onClick={() => setPhase("set")} big>Пропустить отдых</Btn></div>
        </div>
      )}

      {phase === "done" && (
        <div className="demo-in">
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}>Упражнение готово</div>
          <div className="flex flex-col gap-2 mt-4">
            {log.map((l, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${C.line}` }}>
                <span style={{ color: C.muted, fontSize: 14 }}>Подход {i + 1}</span>
                <span className="font-semibold">{fmtKg(l.weight)} кг × {l.reps}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(198,255,61,.08)", border: "1px solid rgba(198,255,61,.25)" }}>
            {levelUp ? (
              <>
                <div className="font-semibold" style={{ color: C.a }}>В следующий раз: {fmtKg(lastWeight + DEMO.step)} кг</div>
                <div className="mt-1" style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>Во всех подходах ты дошёл до {DEMO.hi} повторов — RITM сам добавит {fmtKg(DEMO.step)} кг, а цель по повторам вернётся к {DEMO.lo}.</div>
              </>
            ) : (
              <>
                <div className="font-semibold" style={{ color: C.a }}>В следующий раз: {fmtKg(lastWeight)} кг, не меньше {Math.max(DEMO.lo, minReps)} повторов</div>
                <div className="mt-1" style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>Когда во всех подходах дойдёшь до {DEMO.hi} повторов, RITM сам добавит {fmtKg(DEMO.step)} кг.</div>
              </>
            )}
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Btn href="/app" primary big>Собрать свой план <ArrowRight size={18} /></Btn>
            <Btn onClick={restart} big>Ещё раз</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function InstallCard({ icon: Icon, title, children }) {
  return (
    <div className="glass rounded-[26px] p-6 flex flex-col lift reveal">
      <div className="flex items-center gap-3 mb-5">
        <span className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}` }}><Icon size={20} color={C.a} /></span>
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Steps({ items }) {
  return (
    <ol className="flex flex-col gap-3 flex-1">
      {items.map(([I, text], i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="rounded-full flex items-center justify-center flex-shrink-0 font-bold" style={{ width: 26, height: 26, background: C.grad, color: C.on, fontSize: 12.5 }}>{i + 1}</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.45, paddingTop: 3 }} className="flex-1">{text}</span>
          {I && <I size={17} color={C.muted} style={{ marginTop: 4 }} />}
        </li>
      ))}
    </ol>
  );
}

// Мобильное меню: на весь экран, пункты выезжают из размытия по очереди
function MobileMenu({ open, onClose, nav }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  return (
    <div className={`m-menu fixed inset-0 md:hidden ${open ? "open" : ""}`} style={{ zIndex: 60 }} aria-hidden={!open} onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(8,9,11,0.86)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }} />
      <nav className="relative h-full flex flex-col px-6 pt-24 pb-10" onClick={(e) => e.stopPropagation()}>
        {nav.map(([href, label], i) => (
          <a key={href} href={href} onClick={onClose} tabIndex={open ? 0 : -1} className="m-item py-3" style={{ "--i": i, color: "#fff", textDecoration: "none", fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, letterSpacing: "-0.04em" }}>{label}</a>
        ))}
        <div className="m-item mt-auto flex flex-col gap-3" style={{ "--i": nav.length }}>
          <Btn href="/app" primary big tabIndex={open ? 0 : -1}>Открыть RITM <ArrowRight size={18} /></Btn>
          <Btn href="#install" big onClick={onClose} tabIndex={open ? 0 : -1}><Smartphone size={18} /> Установить на телефон</Btn>
        </div>
      </nav>
    </div>
  );
}

export default function Landing() {
  const inst = useInstall();
  const [bot, setBot] = useState(null);
  const [installMsg, setInstallMsg] = useState("");
  const [menu, setMenu] = useState(false);
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const heroRef = useRef(null);
  // Липкий первый экран включаем, только если он целиком помещается в окно — иначе низ был бы не виден
  const [stick, setStick] = useState(true);
  useEffect(() => {
    document.title = "RITM — тренировки, питание и привычки";
    fetch("/api/config").then((r) => (r.ok ? r.json() : null)).then((d) => d?.bot && setBot(d.bot)).catch(() => {});
  }, []);
  // Блоки появляются плавно, когда до них доходит прокрутка (у соседних карточек — с небольшой задержкой)
  useEffect(() => {
    const els = [...document.querySelectorAll(".reveal")];
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  // Прокрутка первого экрана: --p (0→1) — пока первый экран «держится», --d (0→1) — следующие полэкрана,
  // за которые фоновый знак приглушается. Переменные ставятся на корень страницы, без перерисовки React.
  useEffect(() => {
    const root = rootRef.current, stage = stageRef.current, hero = heroRef.current;
    if (!root || !stage || !hero) return undefined;
    const still = reducedMotion();
    let raf = 0;
    // Высоту экрана берём «маленькую» (100svh — при развёрнутой панели Safari): она не меняется, когда
    // панель адреса сворачивается и разворачивается при прокрутке. Раньше бралась window.innerHeight —
    // на iPhone режим «первый экран держится» от этого включался и выключался прямо во время прокрутки,
    // высота блока прыгала на полэкрана, и страницу отбрасывало вверх.
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const screenH = () => probe.offsetHeight || window.innerHeight;
    // hero-content масштабируется прокруткой, но offsetHeight считает без transform — это нам и нужно.
    // Решаем один раз и пересчитываем только при смене ширины (поворот, окно на компьютере) и после загрузки шрифтов.
    const measure = () => setStick(hero.offsetHeight <= screenH() - 64);
    let lastW = window.innerWidth;
    const update = () => {
      raf = 0;
      const vh = screenH();
      const run = Math.max(1, stage.offsetHeight - (vh - 64));
      const top = 64 - stage.getBoundingClientRect().top;
      const p = still ? 1 : Math.min(1, Math.max(0, top / run));
      const d = still ? 1 : Math.min(1, Math.max(0, (top - run * 0.7) / (vh * 0.5)));
      root.style.setProperty("--p", p.toFixed(4));
      root.style.setProperty("--d", d.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onResize = () => {
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; measure(); }
      onScroll();
    };
    measure(); update();
    document.fonts?.ready?.then(() => { measure(); onScroll(); }).catch(() => {});
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf); probe.remove();
    };
  }, []);
  // Цели Метрики для кнопок лендинга — одним обработчиком на всю страницу, без правок каждой кнопки
  const onLandingClick = (e) => {
    const a = e.target.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (href === "/app") goal("landing_open_app");
    else if (href === "#install") goal("landing_install_section");
    else if (href.startsWith("https://t.me/") && !href.includes("telegra.ph")) goal("landing_open_telegram");
  };
  const install = async () => {
    goal("landing_install_prompt");
    const r = await inst.prompt();
    if (r === "accepted") setInstallMsg("Готово! RITM появится среди приложений.");
  };
  const nav = [["#features", "Возможности"], ["#demo", "Попробовать"], ["#progress", "Прогресс"], ["#pricing", "Цены"], ["#install", "Установка"], ["#faq", "Вопросы"]];

  return (
    <div ref={rootRef} onClick={onLandingClick} className="landing min-h-screen text-white" style={{ background: C.bg, fontFamily: BODY, "--ritm-accent": C.a, "--p": 0, "--d": 0 }}>
      <style>{`
        html { scroll-behavior: smooth }
        a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid ${C.a}; outline-offset: 3px; border-radius: 12px }
        details > summary { list-style: none } details > summary::-webkit-details-marker { display: none }
        details[open] .faq-chev { transform: rotate(180deg) }
        @keyframes heroIn { from { opacity: 0; transform: translateY(18px); filter: blur(10px) } to { opacity: 1; transform: none; filter: none } }
        @keyframes phoneFloat { 0%,100% { transform: translateY(0) rotate(-1deg) } 50% { transform: translateY(-12px) rotate(.5deg) } }
        @keyframes ringFill { from { stroke-dashoffset: var(--c) } }
        @keyframes glowPulse { 0%,100% { opacity: .28 } 50% { opacity: .42 } }
        @keyframes shine { to { background-position: 200% center } }
        .phone-float { animation: phoneFloat 6s ease-in-out infinite }
        .shine { background: linear-gradient(100deg,#D4FF5C 0%,#9BF26A 25%,#38E0C8 50%,#9BF26A 75%,#D4FF5C 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: shine 6s linear infinite }

        /* Появление из размытия */
        .reveal { opacity: 0; transform: translateY(26px); filter: blur(10px); transition: opacity .8s ease, transform .9s cubic-bezier(.2,.8,.2,1), filter .8s ease }
        .reveal.in { opacity: 1; transform: none; filter: none }
        .reveal-d1 { transition-delay: .06s } .reveal-d2 { transition-delay: .12s } .reveal-d3 { transition-delay: .18s }
        .words .w { display: inline-block; opacity: 0; filter: blur(12px); transform: translateY(.35em); transition: opacity .7s ease, filter .7s ease, transform .8s cubic-bezier(.2,.8,.2,1); transition-delay: calc(var(--i) * 70ms + .1s) }
        .reveal.in .words .w, .words.in .w { opacity: 1; filter: none; transform: none }
        .lift { transition: transform .3s cubic-bezier(.2,.8,.2,1), border-color .3s ease, box-shadow .3s ease, opacity .8s ease, filter .8s ease }
        .lift.reveal:not(.in) { transform: translateY(26px) }
        @media (hover: hover) { .lift.in:hover { transform: translateY(-4px); border-color: rgba(198,255,61,0.28) !important; box-shadow: 0 18px 40px rgba(0,0,0,.4) } }

        /* Стеклянные карточки поверх фонового знака */
        .glass { background: rgba(16,17,20,0.58); border: 1px solid ${C.line}; backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%) }

        /* Первый экран: держится, пока снизу поднимаются «горы» из столбиков, а текст уходит в размытие */
        .hero-content { opacity: calc(1 - var(--p) * 1.6); transform: translateY(calc(var(--p) * -70px)) scale(calc(1 - var(--p) * .07)); filter: blur(calc(var(--p) * 12px)); will-change: transform, opacity, filter }
        .ridge { position: absolute; left: -2%; width: 104%; bottom: 0; will-change: transform }
        .ridge-1 { height: 62%; transform: translateY(calc((1 - var(--p)) * 58%)) }
        .ridge-2 { height: 52%; transform: translateY(calc((1 - var(--p)) * 72%)) }
        .ridge-3 { height: 40%; transform: translateY(calc((1 - var(--p)) * 92%)) }

        /* Фоновый знак: столбики растут по очереди, потом знак приглушается и уходит в фон */
        .bg-mark-inner { transform: translateX(-50%) translateY(calc(var(--d) * -6vh)) scale(calc(.82 + var(--p) * .18 + var(--d) * .12)); opacity: calc(min(1, var(--p) * 6) * (1 - var(--d) * .84)); filter: blur(calc(var(--d) * 2px)); transform-origin: bottom center; will-change: transform, opacity }
        .bg-glow { opacity: calc(.12 + var(--p) * .26) }
        .bg-bar { transform-origin: bottom; transform: scaleY(clamp(.1, calc(.1 + (var(--p) * 1.35 - var(--i) * .1) * .9), 1)) }

        /* График «прорисовывается» */
        .chart-line { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1.6s cubic-bezier(.45,.05,.2,1) }
        .chart-fill { opacity: 0; transition: opacity 1s ease }
        .chart-peak { opacity: 0; transform: translateY(6px) scale(.6); transition: opacity .5s ease, transform .6s cubic-bezier(.34,1.56,.64,1) }
        .drawn .chart-line { stroke-dashoffset: 0 } .drawn .chart-fill { opacity: 1 } .drawn .chart-peak { opacity: 1; transform: none }

        /* Карточка с полосой слева, которая «дорисовывается» при появлении */
        .accent-bar { transform: scaleY(0); transform-origin: top; transition: transform 1.2s cubic-bezier(.2,.8,.2,1) .25s }
        .in > .accent-bar { transform: scaleY(1) }

        /* Демо тренировки: фото «внизу» проявляется на опускании, полоса темпа синхронно опускается */
        @keyframes demoPhoto { 0% { opacity: 0 } 60% { opacity: 1 } 80% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes demoBar { 0% { transform: scaleY(1) } 60% { transform: scaleY(.18) } 80% { transform: scaleY(.18) } 100% { transform: scaleY(1) } }
        @keyframes demoTick { from { opacity: 0; transform: translateY(40%) } to { opacity: 1; transform: none } }
        .demo-photo { animation: demoPhoto var(--cycle) linear infinite }
        .demo-bar { animation: demoBar var(--cycle) linear infinite }
        .demo-tick { display: inline-block; animation: demoTick .25s cubic-bezier(.2,.8,.2,1) both }
        .demo-in { animation: heroIn .45s ease-out both }

        /* Мобильное меню */
        .m-menu { visibility: hidden; opacity: 0; transition: opacity .3s ease, visibility 0s .3s }
        .m-menu.open { visibility: visible; opacity: 1; transition: opacity .3s ease }
        .m-item { opacity: 0; transform: translateY(18px); filter: blur(8px); transition: opacity .5s ease, transform .6s cubic-bezier(.2,.8,.2,1), filter .5s ease }
        .m-menu.open .m-item { opacity: 1; transform: none; filter: none; transition-delay: calc(var(--i) * 55ms + 80ms) }
        .burger span { display: block; width: 20px; height: 2px; border-radius: 2px; background: #fff; transition: transform .35s cubic-bezier(.2,.8,.2,1), opacity .2s }
        .burger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg) } .burger.open span:nth-child(2) { opacity: 0 } .burger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg) }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important }
          html { scroll-behavior: auto }
          .reveal, .words .w, .m-item { opacity: 1; transform: none; filter: none }
          .chart-line { stroke-dashoffset: 0 } .chart-fill, .chart-peak { opacity: 1; transform: none } .accent-bar { transform: none }
        }
      `}</style>

      {/* Шапка */}
      <header className="sticky top-0" style={{ zIndex: 70, background: "rgba(8,9,11,0.72)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${C.line}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <a href="/" aria-label="RITM" style={{ color: "#fff", textDecoration: "none" }}><Wordmark size={18} /></a>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className="px-3 py-2 rounded-xl hover:bg-white/5 transition-colors" style={{ color: "rgba(255,255,255,.72)", fontSize: 14, textDecoration: "none" }}>{label}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href="#install" className="hidden sm:inline-flex px-3 py-2 rounded-xl hover:bg-white/5" style={{ color: "rgba(255,255,255,.8)", fontSize: 14, textDecoration: "none" }}>Скачать</a>
            <Btn href="/app" primary>Открыть RITM</Btn>
            <button onClick={() => setMenu((v) => !v)} aria-label={menu ? "Закрыть меню" : "Меню"} aria-expanded={menu}
              className={`burger md:hidden flex flex-col items-center justify-center gap-1 rounded-xl ${menu ? "open" : ""}`} style={{ width: 42, height: 42, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}` }}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={menu} onClose={() => setMenu(false)} nav={nav} />

      <BgMark />

      <main>
        {/* Первый экран: держится на месте, пока снизу поднимаются «горы» из столбиков ритма */}
        <section ref={stageRef} className="relative" style={{ height: stick ? "calc(100svh - 64px + 75svh)" : "auto", zIndex: 1 }}>
          <div className={`${stick ? "sticky" : "relative"} overflow-hidden flex items-center`} style={{ top: stick ? 64 : 0, minHeight: stick ? "calc(100svh - 64px)" : "auto", paddingBottom: stick ? 0 : 160 }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(60% 50% at 15% 0%, rgba(198,255,61,0.14) 0%, rgba(0,0,0,0) 60%), radial-gradient(50% 45% at 95% 60%, rgba(56,224,200,0.10) 0%, rgba(0,0,0,0) 60%)" }} />
            <div ref={heroRef} className="hero-content relative w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-14 pb-10 sm:pb-28 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-center">
              <div style={{ animation: PRERENDERED ? "none" : "heroIn .8s ease-out both" }}>
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full px-3 py-1.5 mb-6" style={{ background: C.card, border: `1px solid ${C.line}`, fontSize: 12.5, color: "rgba(255,255,255,.8)" }}>
                  <span className="rounded-full" style={{ width: 7, height: 7, background: C.a }} /> Сайт · Android · iPhone · Telegram
                </div>
                <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(34px, 6.4vw, 72px)", letterSpacing: "-0.05em", lineHeight: 0.98 }}>
                  Тренировки, питание и привычки —{" "}
                  <span className="shine">в&nbsp;одном ритме</span>
                </h1>
                <p className="mt-5 sm:mt-6 max-w-xl" style={{ color: C.muted, fontSize: "clamp(16px, 2.2vw, 18px)", lineHeight: 1.55 }}>
                  Программа силовых и бега под твою цель, калории по фото еды, задачи, привычки и прогресс. Ответь на анкету за минуту — RITM сам соберёт план и норму калорий.
                </p>
                <div className="mt-7 sm:mt-8 flex flex-wrap gap-3">
                  <Btn href="/app" primary big>Открыть RITM <ArrowRight size={18} /></Btn>
                  <Btn href="#install" big><Smartphone size={18} /> Установить на телефон</Btn>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ fontSize: 13.5, color: C.muted }}>
                  {bot && !inTelegram() && (
                    <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white" style={{ color: "inherit", textDecoration: "none" }}>
                      <Send size={15} /> Открыть в Telegram
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1.5"><Check size={15} color={C.a} /> Бесплатно, без карты</span>
                  <span className="inline-flex items-center gap-1.5"><Check size={15} color={C.a} /> Без App Store и Google Play</span>
                </div>
              </div>
              <div className="hidden lg:block" style={{ animation: PRERENDERED ? "none" : "heroIn 1s .15s ease-out both" }}><PhoneMock /></div>
            </div>
            {/* Три слоя «гор»: дальний светлее, ближний сливается с фоном следующего блока */}
            <Ridge className="ridge ridge-1" bars={30} seed={1} peak={0.95} fill="rgba(56,224,200,0.10)" cap="rgba(56,224,200,0.22)" />
            <Ridge className="ridge ridge-2" bars={22} seed={2.3} peak={0.85} fill="#0F1A15" cap="rgba(198,255,61,0.22)" />
            <Ridge className="ridge ridge-3" bars={16} seed={4.1} peak={0.75} fill={C.bg} cap="rgba(198,255,61,0.10)" />
            <div className="absolute left-0 right-0 bottom-0" style={{ height: 2, background: C.bg }} />
          </div>
        </section>

        {/* Всё, что ниже первого экрана, идёт поверх фонового знака */}
        <div className="relative" style={{ zIndex: 3 }}>
          {/* Макет телефона на узких экранах — отдельным блоком, чтобы первый экран помещался целиком */}
          <section className="lg:hidden px-4 pt-6 pb-16 reveal"><PhoneMock /></section>

          {/* Факты — только то, что реально есть в приложении. Цифры «пробегают», как на табло */}
          <section className="glass" style={{ borderLeft: 0, borderRight: 0 }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
              {[["50", "упражнений, у 46 — фото техники"], ["6", "готовых программ"], ["16", "разделов приложения"], ["1", "аккаунт на всех устройствах"]].map(([n, l], i) => (
                <div key={l} className={`reveal reveal-d${(i % 3) + 1}`}>
                  <div className="shine" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(40px, 6vw, 56px)", letterSpacing: "-0.04em", lineHeight: 1.05, display: "inline-block" }}><CountUp value={n} duration={1600} /></div>
                  <div style={{ color: C.muted, fontSize: 14 }}>{l}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Возможности */}
          <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-24 scroll-mt-16">
            <SectionTitle kicker="Возможности" title="Всё для режима — в одном приложении" sub="Всё, что есть в Mini App в Telegram, работает и на сайте, и в приложении на телефоне. Включай только нужные разделы — остальные можно скрыть." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map(([Icon, title, text], i) => (
                <div key={title} className={`glass rounded-[24px] p-6 lift reveal reveal-d${(i % 3) + 1}`}>
                  <span className="rounded-2xl inline-flex items-center justify-center mb-5" style={{ width: 46, height: 46, background: "rgba(198,255,61,0.08)", border: "1px solid rgba(198,255,61,0.2)" }}><Icon size={21} color={C.a} /></span>
                  <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em" }}>{title}</h3>
                  <p className="mt-2" style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.55 }}>{text}</p>
                </div>
              ))}
            </div>
            <div className="glass mt-4 rounded-[24px] p-6 reveal flex flex-wrap items-center gap-x-8 gap-y-3">
              {[[ScanBarcode, "Сканер штрихкодов"], [Timer, "Таймер отдыха и гид по тренировке"], [Droplets, "Вода стаканчиками"], [Wind, "Дыхательные практики"], [Target, "Челленджи"], [Sparkles, "ИИ-разбор недели"], [Palette, "Темы и свой цвет"]].map(([I, t]) => (
                <span key={t} className="inline-flex items-center gap-2" style={{ fontSize: 14.5 }}><I size={17} color={C.a} /> {t}</span>
              ))}
            </div>
          </section>

          {/* Как начать — карточка с полосой слева */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
            <div className="glass rounded-[28px] p-7 sm:p-10 relative overflow-hidden reveal grid lg:grid-cols-2 gap-8 items-start">
              <span className="accent-bar absolute left-0 top-0 bottom-0" style={{ width: 4, background: C.grad }} />
              <div>
                <h2 className="words" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(26px, 3.6vw, 38px)", letterSpacing: "-0.04em", lineHeight: 1.08 }}><Words text="Тренируйся 2–4 раза в неделю" /></h2>
                <p className="mt-4" style={{ color: C.muted, fontSize: 16, lineHeight: 1.6 }}>Ответь на анкету за минуту — RITM соберёт программу под твою цель и место, где ты занимаешься. Вес и повторы растут сами, гид ведёт по подходам с таймером отдыха.</p>
                <div className="mt-6"><Btn href="/app" primary>Собрать свой план <ArrowRight size={17} /></Btn></div>
              </div>
              <ul className="flex flex-col gap-4">
                {[[Dumbbell, "Зал", "штанга, гантели и тренажёры"], [Smartphone, "Дом", "без зала и без железа"], [Target, "Гиря", "вся программа с одной гирей"], [Footprints, "Бег", "3–4 пробежки в неделю с пульсовыми зонами"]].map(([I, t, s], i) => (
                  <li key={t} className="flex items-start gap-3 reveal" style={{ transitionDelay: `${0.15 + i * 0.08}s` }}>
                    <span className="rounded-full flex-shrink-0 flex items-center justify-center" style={{ width: 30, height: 30, background: "rgba(198,255,61,0.1)", border: "1px solid rgba(198,255,61,.25)" }}><I size={15} color={C.a} /></span>
                    <span style={{ fontSize: 15, lineHeight: 1.45, paddingTop: 4 }}><b className="font-semibold">{t}</b> <span style={{ color: C.muted }}>— {s}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Живое демо гида по тренировке */}
          <section id="demo" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-16">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-center">
              <SectionTitle kicker="Попробуй" title="Один подход — прямо здесь" sub="Так гид ведёт по тренировке: темп повтора, отметка повторов и веса, таймер отдыха. После трёх подходов увидишь, какой вес RITM поставит в следующий раз." />
              <WorkoutDemo />
            </div>
          </section>

          {/* Прогресс — графики «прорисовываются», как профиль маршрута */}
          <section id="progress" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-16">
            <SectionTitle kicker="Прогресс" title="Каждый подход — точка на графике" sub="Вес на штанге, километры и шаги складываются в графики и личные рекорды. Ниже — пример: у тебя будут свои цифры." />
            <div className="grid md:grid-cols-3 gap-4">
              <ProgressCard tag="Силовые · 12 недель" title="Жим лёжа" sub="Рабочий вес, кг" peakLabel="55 кг" data={[40, 40, 42.5, 42.5, 45, 45, 47.5, 47.5, 50, 50, 52.5, 55]} stats={[["+15", "кг к весу"], ["12", "недель"]]} />
              <ProgressCard tag="Бег · 10 недель" title="Километры" sub="Объём бега за неделю, км" peakLabel="21 км" data={[6, 8, 8, 10, 9, 12, 14, 13, 17, 21]} stats={[["21", "км в неделю"], ["10", "недель"]]} delay={120} />
              <ProgressCard tag="Здоровье · 14 дней" title="Шаги" sub="Шагов за день" peakLabel="12 480" data={[6200, 7400, 5800, 8100, 9300, 7600, 10200, 8800, 9600, 11200, 8400, 12480, 9800, 10600]} stats={[["9200", "в среднем"], ["14", "дней"]]} delay={240} />
            </div>
          </section>

          {/* Один аккаунт */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
            <div className="rounded-[32px] p-8 sm:p-12 reveal grid lg:grid-cols-2 gap-10 items-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(198,255,61,0.09), rgba(56,224,200,0.05)), rgba(12,13,15,.6)", border: "1px solid rgba(198,255,61,0.18)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
              <div>
                <SectionTitle kicker="Синхронизация" title="Один аккаунт — везде" sub="Входишь через Telegram — и видишь те же тренировки, питание, задачи и Pro на телефоне, компьютере и в Mini App. Начал тренировку на телефоне — посмотрел прогресс на ноутбуке." />
                <div className="flex flex-col gap-3 -mt-4">
                  {[[Cloud, "Данные сохраняются в аккаунте и подтягиваются на любом устройстве"], [ShieldCheck, "Вход без паролей — подтверждение кнопкой в Telegram"], [Crown, "Pro, купленная где угодно, работает везде"]].map(([I, t]) => (
                    <div key={t} className="flex items-center gap-3" style={{ fontSize: 15 }}><I size={18} color={C.a} className="flex-shrink-0" /> {t}</div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[[Send, "Telegram", "Mini App"], [Monitor, "Компьютер", "Сайт"], [Smartphone, "Телефон", "Приложение"]].map(([I, t, s], i) => (
                  <div key={t} className={`rounded-[22px] p-3 sm:p-5 text-center lift reveal reveal-d${i + 1}`} style={{ background: "rgba(8,9,11,0.6)", border: `1px solid ${C.line}` }}>
                    <I size={26} color={C.a} className="mx-auto" />
                    <div className="mt-3 font-semibold" style={{ fontSize: "clamp(12.5px, 3.4vw, 14.5px)" }}>{t}</div>
                    <div style={{ fontSize: 12.5, color: C.muted }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Цены */}
          <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-16">
            <SectionTitle kicker="Цены" title="Бесплатно — навсегда. Pro — когда захочешь больше" sub="Все разделы доступны бесплатно. Pro снимает лимиты на ИИ и открывает полную статистику и беговой план." />
            <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4">
              <div className="glass rounded-[28px] p-5 sm:p-8 reveal">
                <div className="grid items-center mb-4" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.9fr", gap: 8 }}>
                  <span />
                  <span className="text-center" style={{ fontSize: 13, color: C.muted }}>Бесплатно</span>
                  <span className="text-center font-bold" style={{ fontSize: 13, color: C.a }}>Pro</span>
                </div>
                <div className="flex flex-col">
                  {PRO_COMPARISON_ROWS.map(([label, free, pro]) => (
                    <div key={label} className="grid items-center py-3" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.9fr", gap: 8, borderTop: `1px solid ${C.line}` }}>
                      <span className="text-[14px] sm:text-[15px]">{label}</span>
                      <span className="text-center text-[13px] sm:text-[14px]" style={{ color: C.muted }}>{free}</span>
                      <span className="text-center font-semibold text-[13px] sm:text-[14px]" style={{ color: C.a }}>{pro}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="glass rounded-[28px] p-7 lift reveal reveal-d1">
                  <div style={{ color: C.muted, fontSize: 14 }}>Месяц</div>
                  <div className="mt-1" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, letterSpacing: "-0.04em" }}><CountUp value={`${RUB_PRICE.month} ₽`} scramble={false} /></div>
                  <div style={{ color: C.muted, fontSize: 14 }}>30 дней Pro</div>
                </div>
                <div className="rounded-[28px] p-7 relative overflow-hidden lift reveal reveal-d2" style={{ background: "linear-gradient(135deg, rgba(198,255,61,0.12), rgba(56,224,200,0.07)), rgba(12,13,15,.6)", border: "1px solid rgba(198,255,61,0.3)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
                  <span className="accent-bar absolute left-0 top-0 bottom-0" style={{ width: 4, background: C.grad }} />
                  {YEAR_SAVINGS_PCT > 0 && <span className="absolute rounded-full font-bold" style={{ top: 18, right: 18, fontSize: 12.5, padding: "4px 10px", background: C.grad, color: C.on }}>−{YEAR_SAVINGS_PCT}%</span>}
                  <div style={{ color: C.muted, fontSize: 14 }}>Год</div>
                  <div className="mt-1" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, letterSpacing: "-0.04em" }}><CountUp value={`${RUB_PRICE.year} ₽`} scramble={false} /></div>
                  <div style={{ color: C.muted, fontSize: 14 }}>{Math.round(RUB_PRICE.year / 12)} ₽ в месяц</div>
                </div>
                <Btn href="/app" primary big>Начать бесплатно <ArrowRight size={18} /></Btn>
                <p className="text-center" style={{ fontSize: 13, color: C.muted }}>Оплата по СБП. Без автосписаний — продлеваешь сам. <a href={LEGAL_LINKS.offerUrl} style={{ color: "inherit" }}>Условия оферты</a></p>
              </div>
            </div>
          </section>

          {/* Установка */}
          <section id="install" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-16">
            <SectionTitle kicker="Установка" title="Поставь RITM на телефон" sub="Без магазинов приложений: RITM ставится прямо с сайта, открывается на весь экран со своей иконкой и работает даже без интернета." />
            <div className="grid md:grid-cols-3 gap-4">
              <InstallCard icon={Smartphone} title="Android">
                <Steps items={[[null, "Открой этот сайт в Chrome"], [Download, "Нажми «Установить» ниже или в меню ⋮ браузера"], [Check, "RITM появится среди приложений"]]} />
                <div className="mt-6 flex flex-col gap-2">
                  {inst.installed ? (
                    <div className="inline-flex items-center gap-2 font-semibold" style={{ color: C.a }}><Check size={18} /> Уже установлено</div>
                  ) : inst.canPrompt ? (
                    <Btn onClick={install} primary><Download size={17} /> Установить RITM</Btn>
                  ) : (
                    <Btn href="/app"><ArrowRight size={17} /> Открыть веб-версию</Btn>
                  )}
                  {ANDROID_APK_URL && <Btn href={ANDROID_APK_URL} download><Download size={17} /> Скачать APK</Btn>}
                  {installMsg && <span style={{ fontSize: 13, color: C.a }}>{installMsg}</span>}
                </div>
              </InstallCard>
              <InstallCard icon={Smartphone} title="iPhone">
                <Steps items={[[null, "Открой этот сайт в Safari"], [Share, "Нажми «Поделиться» внизу экрана"], [SquarePlus, "Выбери «На экран „Домой“» → «Добавить»"]]} />
                <p className="mt-6" style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Если сайт открыт внутри Telegram или Instagram, сначала нажми «Открыть в Safari» — во встроенных браузерах этого пункта нет.</p>
              </InstallCard>
              <InstallCard icon={Monitor} title="Компьютер">
                <Steps items={[[null, "Открой сайт в Chrome, Edge или Яндекс Браузере"], [Download, "Нажми значок установки в адресной строке"], [Check, "RITM откроется в отдельном окне"]]} />
                <div className="mt-6">
                  {inst.canPrompt && !inst.android ? <Btn onClick={install} primary><Download size={17} /> Установить</Btn> : <Btn href="/app"><ArrowRight size={17} /> Открыть в браузере</Btn>}
                </div>
              </InstallCard>
            </div>
          </section>

          {/* Вопросы */}
          <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-16">
            <SectionTitle kicker="Вопросы" title="Частые вопросы" />
            <div className="flex flex-col gap-3">
              {FAQ.map(([q, a]) => (
                <details key={q} className="glass rounded-[22px] group reveal">
                  <summary className="cursor-pointer px-6 py-5 flex items-center gap-4 font-semibold" style={{ fontSize: 16 }}>
                    <span className="flex-1">{q}</span>
                    <ChevronDown size={18} className="faq-chev flex-shrink-0 transition-transform" color={C.muted} />
                  </summary>
                  <p className="px-6 pb-5 -mt-1" style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Призыв */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
            <div className="glass rounded-[32px] px-6 py-14 text-center relative overflow-hidden reveal">
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(50% 80% at 50% 120%, rgba(198,255,61,0.18) 0%, rgba(0,0,0,0) 70%)" }} />
              <div className="relative">
                <Mark size={36} />
                <h2 className="mt-6 words" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(28px, 4.5vw, 46px)", letterSpacing: "-0.04em", lineHeight: 1.05 }}><Words text="Найди свой ритм сегодня" /></h2>
                <p className="mt-4 mx-auto max-w-lg" style={{ color: C.muted, fontSize: 17 }}>Анкета на минуту — и у тебя готовы программа, беговой план и норма калорий.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Btn href="/app" primary big>Открыть RITM <ArrowRight size={18} /></Btn>
                  <Btn href="#install" big><Smartphone size={18} /> Установить</Btn>
                </div>
              </div>
            </div>
          </section>

          <footer style={{ borderTop: `1px solid ${C.line}`, background: "rgba(8,9,11,0.82)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
              <div className="reveal">
                <Wordmark size={20} />
                <p className="mt-4 max-w-md" style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>Тренировки, питание, задачи и привычки в одном приложении. Сайт, Android, iPhone и Mini App в Telegram — один аккаунт.</p>
              </div>
              <nav className="reveal reveal-d1 flex flex-col gap-2.5" style={{ fontSize: 14 }}>
                <div className="font-semibold mb-1" style={{ fontSize: 13 }}>Разделы</div>
                {nav.map(([href, label]) => <a key={href} href={href} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{label}</a>)}
              </nav>
              <nav className="reveal reveal-d2 flex flex-col gap-2.5" style={{ fontSize: 14 }}>
                <div className="font-semibold mb-1" style={{ fontSize: 13 }}>Документы</div>
                {[[LEGAL_LINKS.offerUrl, "Публичная оферта"], [LEGAL_LINKS.termsUrl, "Пользовательское соглашение"], [LEGAL_LINKS.privacyUrl, "Политика конфиденциальности"], [LEGAL_LINKS.consentUrl, "Согласие на обработку данных"]].map(([href, label]) => (
                  <a key={href} href={href} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{label}</a>
                ))}
                <a href={`mailto:${LEGAL_LINKS.email}`} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{LEGAL_LINKS.email}</a>
                <a href={LEGAL_LINKS.supportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>Поддержка {LEGAL_LINKS.support}</a>
              </nav>
            </div>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center" style={{ borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
              Программа носит рекомендательный характер и не заменяет консультацию врача или тренера.
              <div className="mt-2">{LEGAL_LINKS.owner}, {LEGAL_LINKS.status}, ИНН {LEGAL_LINKS.inn}</div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
