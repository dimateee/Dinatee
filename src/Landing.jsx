// Главная страница сайта RITM: что умеет приложение, демо тренировки, цены, установка.
// Само приложение живёт по адресу /app (src/App.jsx) — лендинг его не подгружает.
// Оформление — «кинематографичное»: фоновые видео с плавной склейкой петли (FadingVideo), «жидкое стекло»
// (.liquid-glass), курсивные заголовки с засечками и появление слов из размытия. Анимации сделаны на CSS,
// без Framer Motion: лендинг приходит готовым HTML (scripts/prerender.mjs), и CSS-анимации играют сразу,
// ещё до загрузки скриптов, а React потом «оживляет» страницу, не перерисовывая её.
import { useEffect, useId, useRef, useState } from "react";
import {
  Dumbbell, Footprints, Apple, Activity, CalendarDays, Mic, TrendingUp, BookOpen, Target,
  Camera, ScanBarcode, Timer, Smartphone, Monitor, Share, SquarePlus, Check,
  Download, Send, ArrowRight, ChevronDown, Wind, Sparkles,
  Users, Sunrise, Droplets, Palette, Minus, Plus, LogIn,
} from "lucide-react";
import { useInstall, ANDROID_APK_URL, inTelegram } from "./web.js";
import { RUB_PRICE, YEAR_SAVINGS_PCT, PRO_COMPARISON_ROWS, LEGAL_LINKS } from "./plans.js";
import { CountUp, useInView, reducedMotion } from "./motion.jsx";
import { goal } from "./analytics.js";

// Палитра лендинга — только белый на чёрном; контраст дают «стеклянные» элементы поверх видео.
// Зелёный фирменный градиент остаётся в самом приложении.
const C = {
  bg: "#000",
  card: "rgba(255,255,255,0.04)",
  line: "rgba(255,255,255,0.12)",
  a: "#FFFFFF",
  b: "#FFFFFF",
  grad: "#FFFFFF",
  on: "#000",
  muted: "rgba(255,255,255,0.68)",
};
// Заголовки — курсив с засечками. Instrument Serif из исходного макета не умеет кириллицу,
// поэтому взят близкий по пропорциям Noto Serif Display (src/fonts.css, файлы — в public/fonts).
const SERIF = "'Noto Serif Display', 'Times New Roman', serif";
const DISPLAY = SERIF;
const BODY = "'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif";

// Фоновые видео лежат на самом сайте (public/video): не зависят от чужих серверов и открываются
// там же, где открывается сайт. Постер — первый кадр, он виден сразу и остаётся, если видео не грузим.
// Два формата: MP4 (H.264) — для iPhone, Safari и Chrome; WebM (VP9) — для браузеров без H.264.
const VIDEO = {
  hero: { src: { mp4: "/video/hero.mp4", webm: "/video/hero.webm" }, poster: "/video/hero.jpg" },
  capabilities: { src: { mp4: "/video/capabilities.mp4", webm: "/video/capabilities.webm" }, poster: "/video/capabilities.jpg" },
};
const pickSource = (v, src) => {
  if (typeof src === "string") return src;
  return v.canPlayType('video/mp4; codecs="avc1.4D401F"') || !v.canPlayType('video/webm; codecs="vp9"') ? src.mp4 : src.webm;
};

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


function Mark({ size = 22, color = "#fff" }) {
  const bars = [0.55, 1, 0.72, 0.38];
  return (
    <span className="inline-flex items-end" aria-hidden="true" style={{ height: size, gap: size * 0.12 }}>
      {bars.map((h, i) => <span key={i} style={{ width: size * 0.17, height: size * h, borderRadius: size, background: color }} />)}
    </span>
  );
}

const ArrowUpRight = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7" /><path d="M7 7h10v10" />
  </svg>
);
const PlayIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4" /></svg>
);

// Кнопки: главная — белая «таблетка», вторая — жидкое стекло
function Btn({ href, onClick, children, primary, big, strong, ...rest }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-transform active:scale-[.97] ${
    primary ? "bg-white text-black" : strong ? "liquid-glass-strong text-white" : "liquid-glass text-white"} ${big ? "px-6 py-3.5 text-[15px]" : "px-4 py-2 text-sm"}`;
  if (href) return <a href={href} onClick={onClick} className={cls} style={{ textDecoration: "none" }} {...rest}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls} {...rest}>{children}</button>;
}

// Слова появляются по одному: размытие → полупрозрачно чуть выше → на месте (как BlurText в исходном макете).
// На первом экране анимация идёт сразу, ниже — когда блок с классом reveal доходит до экрана.
function BlurText({ text, as: Tag = "p", className = "", style, delay = 0 }) {
  // Тире не должно начинать строку — привязываем его к предыдущему слову неразрывным пробелом
  const words = String(text).replace(/ ([—–])/g, "\u00A0$1").split(" ");
  return (
    <Tag className={`blur-text ${className}`} style={style}>
      {words.map((w, i) => (
        <span key={i} className="bw" style={{ "--i": i, "--d": `${delay}ms` }}>{w}</span>
      ))}
    </Tag>
  );
}

const Kicker = ({ children }) => <div className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.8)", fontFamily: BODY }}>// {children}</div>;

const SectionTitle = ({ kicker, title, sub }) => (
  <div className="max-w-3xl mb-12 reveal reveal-words">
    {kicker && <Kicker>{kicker}</Kicker>}
    <BlurText as="h2" text={title} className="font-heading" style={{ fontSize: "clamp(40px, 7vw, 76px)", lineHeight: 0.95, letterSpacing: "-0.035em" }} />
    {sub && <p className="mt-5 max-w-2xl" style={{ color: C.muted, fontSize: 17, lineHeight: 1.55, fontWeight: 300 }}>{sub}</p>}
  </div>
);

// Фоновое видео с плавной склейкой петли — по спецификации исходного макета: прозрачность меняется
// через requestAnimationFrame (без CSS-переходов), каждое затухание продолжает с текущего значения.
// Петля своя: за 0,55 с до конца — затухание, после конца — пауза 100 мс, перемотка и проявление.
// Сверх макета: видео не грузится до прокрутки к нему (lazy), ставится на паузу вне экрана,
// а при «Экономии трафика», медленной сети и «Уменьшении движения» остаётся только постер.
const FADE_MS = 500, FADE_OUT_LEAD = 0.55;
function FadingVideo({ src, poster, className = "", style, posterAlt = "", priority = false }) {
  const videoRef = useRef(null);
  const posterRef = useRef(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const conn = navigator.connection;
    if (reducedMotion() || conn?.saveData || /2g$/.test(conn?.effectiveType || "")) return undefined;
    let raf = 0, timer = 0, fadingOut = false, loaded = false, playing = false;
    const fadeTo = (target, duration = FADE_MS) => {
      cancelAnimationFrame(raf);
      const from = parseFloat(v.style.opacity || "0") || 0;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / duration);
        v.style.opacity = String(from + (target - from) * k);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const start = () => {
      v.style.opacity = "0";
      v.play().then(() => {
        playing = true;
        fadeTo(1);
        if (posterRef.current) posterRef.current.style.opacity = "0";
      }).catch(() => { /* автозапуск запрещён (например, режим энергосбережения) — остаётся постер */ });
    };
    const onLoaded = () => start();
    const onTime = () => {
      const left = v.duration - v.currentTime;
      if (!fadingOut && left > 0 && left <= FADE_OUT_LEAD) { fadingOut = true; fadeTo(0); }
    };
    const onEnded = () => {
      v.style.opacity = "0";
      clearTimeout(timer);
      timer = setTimeout(() => { v.currentTime = 0; v.play().catch(() => {}); fadingOut = false; fadeTo(1); }, 100);
    };
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.addEventListener("loadeddata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    const io = "IntersectionObserver" in window ? new IntersectionObserver(([en]) => {
      if (en.isIntersecting) {
        if (!loaded) { loaded = true; v.src = pickSource(v, src); v.load(); }
        else if (playing && v.paused && !v.ended) v.play().catch(() => {});
      } else if (playing && !v.paused) v.pause();
    }, { rootMargin: "200px 0px" }) : null;
    if (io) io.observe(v); else { loaded = true; v.src = pickSource(v, src); v.load(); }
    return () => {
      cancelAnimationFrame(raf); clearTimeout(timer); io?.disconnect();
      v.removeEventListener("loadeddata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [src?.mp4 || src]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <img ref={posterRef} src={poster} alt={posterAlt} aria-hidden={posterAlt ? undefined : "true"} className={`${className} video-poster`} style={style} decoding="async" fetchpriority={priority ? "high" : undefined} loading={priority ? undefined : "lazy"} />
      <video ref={videoRef} className={className} style={{ ...style, opacity: 0 }} autoPlay muted playsInline preload="auto" disablePictureInPicture aria-hidden="true" tabIndex={-1} />
    </>
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
            <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor={C.b} /></linearGradient>
          </defs>
          <path d={`${line} L${W - padX},${H} L${padX},${H} Z`} fill={`url(#f${id})`} className="chart-fill" style={{ transitionDelay: `${delay + 700}ms` }} />
          <path d={line} fill="none" stroke={`url(#s${id})`} strokeWidth="2.4" strokeLinecap="round" pathLength="1" className="chart-line" style={{ transitionDelay: `${delay + 150}ms` }} />
          <line x1={padX} x2={W - padX} y1={H - 1} y2={H - 1} stroke="rgba(255,255,255,.1)" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="chart-peak absolute" style={{ left: `${(px / W) * 100}%`, top: py, transitionDelay: `${delay + 1100}ms` }}>
          <span className="absolute rounded-full" style={{ width: 10, height: 10, left: -5, top: -5, background: C.a, boxShadow: `0 0 0 4px rgba(255,255,255,.18), 0 0 18px ${C.a}` }} />
          <span className="absolute whitespace-nowrap font-semibold" style={{ bottom: 10, left: px / W > 0.7 ? "auto" : -8, right: px / W > 0.7 ? -8 : "auto", fontSize: 11.5, color: C.a }}>▲ {peakLabel}</span>
        </div>
      </div>
      <div className="mt-5 inline-flex rounded-full px-2.5 py-1 font-semibold" style={{ fontSize: 11, background: "rgba(255,255,255,.1)", color: C.a, border: "1px solid rgba(255,255,255,.22)" }}>{tag}</div>
      <h3 className="mt-3" style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400, fontSize: 20, letterSpacing: "-0.02em" }}>{title}</h3>
      <div style={{ color: C.muted, fontSize: 13.5 }}>{sub}</div>
      <div className="mt-4 flex gap-8">
        {stats.map(([n, l]) => (
          <div key={l}>
            <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400, fontSize: 26, letterSpacing: "-0.03em" }}><CountUp value={n} start={on} /></div>
            <div style={{ color: C.muted, fontSize: 12 }}>{l}</div>
          </div>
        ))}
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
      <span className="text-center overflow-hidden" style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400, fontSize: 24, minWidth: 54 }}><span key={value} className="demo-tick">{fmtKg(value)}</span></span>
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
    <div ref={ref} className="glass rounded-[28px] p-5 sm:p-7 reveal min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div style={{ fontSize: 12.5, color: C.muted }}>Демо · упражнение 1 из 1</div>
          <div className="font-semibold truncate" style={{ fontSize: 17 }}>{DEMO.name}</div>
        </div>
        <span className="rounded-full px-2.5 py-1 font-semibold flex-shrink-0" style={{ fontSize: 11, background: "rgba(255,255,255,.1)", color: C.a, border: "1px solid rgba(255,255,255,.22)" }}>пример</span>
      </div>
      <div className="flex gap-1 my-4">
        {Array.from({ length: DEMO.sets }, (_, i) => (
          <span key={i} className="flex-1 rounded-full" style={{ height: 4, background: i < log.length ? "#fff" : i === log.length && phase !== "done" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)", transition: "background .4s" }} />
        ))}
      </div>

      {phase === "set" && (
        <div key={`set-${set}`} className="demo-in">
          <div className="text-center">
            <div style={{ fontSize: 13, color: C.muted }}>Подход {set} из {DEMO.sets}</div>
            <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400, fontSize: 40, letterSpacing: "-0.03em", textShadow: "0 0 24px rgba(255,255,255,.35)" }}>{fmtKg(weight)} кг</div>
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
            <div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400, fontSize: 40 }}>{left}</div>
          </div>
          <div className="mt-3" style={{ fontSize: 14 }}>Отдых перед подходом {set} из {DEMO.sets}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>В демо 15 секунд, в приложении — по цели: для набора мышц 1,5 минуты</div>
          <div className="mt-5 flex flex-col"><Btn onClick={() => setPhase("set")} big>Пропустить отдых</Btn></div>
        </div>
      )}

      {phase === "done" && (
        <div className="demo-in">
          <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400, fontSize: 26, letterSpacing: "-0.03em" }}>Упражнение готово</div>
          <div className="flex flex-col gap-2 mt-4">
            {log.map((l, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${C.line}` }}>
                <span style={{ color: C.muted, fontSize: 14 }}>Подход {i + 1}</span>
                <span className="font-semibold">{fmtKg(l.weight)} кг × {l.reps}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.25)" }}>
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
            <Btn href="/app?start=1" primary big>Собрать свой план <ArrowRight size={18} /></Btn>
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
        <h3 style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400, fontSize: 20, letterSpacing: "-0.02em" }}>{title}</h3>
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
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }} />
      <nav className="relative h-full flex flex-col px-6 pt-28 pb-10" onClick={(e) => e.stopPropagation()}>
        {nav.map(([href, label], i) => (
          <a key={href} href={href} onClick={onClose} tabIndex={open ? 0 : -1} className="m-item py-2.5 font-heading" style={{ "--i": i, color: "#fff", textDecoration: "none", fontSize: 40, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{label}</a>
        ))}
        <div className="m-item mt-auto flex flex-col gap-3" style={{ "--i": nav.length }}>
          <Btn href="/app?start=1" primary big tabIndex={open ? 0 : -1}>Начать бесплатно <ArrowUpRight className="h-5 w-5" /></Btn>
          <Btn href="/app" big tabIndex={open ? 0 : -1}><LogIn size={17} /> Войти в RITM</Btn>
        </div>
      </nav>
    </div>
  );
}

// Структурированные данные для поисковиков (schema.org): что это за приложение, на чём работает,
// сколько стоит Pro — и вопросы-ответы из раздела «Частые вопросы» (Яндекс и Google умеют показывать
// их прямо в выдаче). Попадают в готовый HTML при сборке (scripts/prerender.mjs). Только реальные
// данные — без выдуманных рейтингов и отзывов.
function StructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "RITM",
      description: "Программа силовых и бега под цель, калории по фото еды, задачи, привычки, друзья и прогресс. Сайт, Android, iPhone и Telegram Mini App — один аккаунт.",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web, Android, iOS, Telegram",
      inLanguage: "ru",
      offers: [
        { "@type": "Offer", name: "Бесплатно", price: "0", priceCurrency: "RUB" },
        { "@type": "Offer", name: "RITM Pro — месяц", price: String(RUB_PRICE.month), priceCurrency: "RUB" },
        { "@type": "Offer", name: "RITM Pro — год", price: String(RUB_PRICE.year), priceCurrency: "RUB" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  // < экранируется, чтобы текст ответов не мог закрыть тег <script>
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}


// Три главные возможности — карточки на втором видео (как «Capabilities» в макете)
const CAPABILITIES = [
  [Dumbbell, "Силовые под цель", ["2–4 дня в неделю", "Зал · дом · гиря", "Вес растёт сам", "Фото техники"],
    "Программа под твою цель и место. Гид ведёт по подходам с таймером отдыха, а вес и повторы растут сами."],
  [Camera, "Калории по фото", ["Фото тарелки", "Штрихкод", "КБЖУ и вода", "Рецепты"],
    "Сфотографируй еду — ИИ разберёт её на продукты с весом и КБЖУ. Норма считается из анкеты."],
  [TrendingUp, "Прогресс и привычки", ["Графики", "Личные рекорды", "Серии дней", "ИИ-разбор недели"],
    "Задачи, привычки и прогресс в одном месте: видно, как растут веса, километры и дисциплина."],
];
const CAP_TITLES = new Set(["Силовые под твою цель", "Калории по фото", "Прогресс и награды"]);

export default function Landing() {
  const inst = useInstall();
  const [bot, setBot] = useState(null);
  const [installMsg, setInstallMsg] = useState("");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    document.title = "RITM — тренировки, питание и привычки";
    fetch("/api/config").then((r) => (r.ok ? r.json() : null)).then((d) => d?.bot && setBot(d.bot)).catch(() => {});
  }, []);
  // Блоки появляются плавно, когда до них доходит прокрутка
  useEffect(() => {
    const els = [...document.querySelectorAll(".reveal")];
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  // Цели Метрики для кнопок лендинга — одним обработчиком на всю страницу
  const onLandingClick = (e) => {
    const a = e.target.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    // /app?start=1 — «Начать»: сразу анкета; /app — для тех, кто уже пользуется (там можно войти)
    if (href === "/app?start=1") goal("landing_start");
    else if (href === "/app") goal("landing_open_app");
    else if (href === "#install") goal("landing_install_section");
    else if (href.startsWith("https://t.me/") && !href.includes("telegra.ph")) goal("landing_open_telegram");
  };
  const install = async () => {
    goal("landing_install_prompt");
    const r = await inst.prompt();
    if (r === "accepted") setInstallMsg("Готово! RITM появится среди приложений.");
  };
  const nav = [["#features", "Возможности"], ["#demo", "Попробовать"], ["#progress", "Прогресс"], ["#pricing", "Цены"], ["#faq", "Вопросы"]];
  const otherFeatures = FEATURES.filter(([, title]) => !CAP_TITLES.has(title));

  return (
    <div onClick={onLandingClick} className="landing min-h-screen text-white" style={{ background: C.bg, fontFamily: BODY }}>
      <StructuredData />
      {/* dangerouslySetInnerHTML, а не текст: иначе при сборке готового HTML React экранирует «>» в селекторах
          как &gt; — правило ломается, и текст стилей не совпадает при оживлении страницы */}
      <style dangerouslySetInnerHTML={{ __html: `
        html { scroll-behavior: smooth }
        .landing a:focus-visible, .landing button:focus-visible, .landing summary:focus-visible { outline: 2px solid #fff; outline-offset: 3px; border-radius: 14px }
        .font-heading { font-family: ${SERIF}; font-style: italic; font-weight: 400 }
        details > summary { list-style: none } details > summary::-webkit-details-marker { display: none }
        details[open] .faq-chev { transform: rotate(180deg) }

        /* Жидкое стекло — как в исходном макете */
        .liquid-glass { background: rgba(255,255,255,0.01); background-blend-mode: luminosity; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border: none; box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); position: relative; overflow: hidden }
        .liquid-glass::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px; background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none }
        .liquid-glass-strong { background: rgba(255,255,255,0.01); background-blend-mode: luminosity; backdrop-filter: blur(50px); -webkit-backdrop-filter: blur(50px); border: none; box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15); position: relative; overflow: hidden }
        .liquid-glass-strong::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px; background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.2) 80%, rgba(255,255,255,0.5) 100%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none }
        /* Стекло для содержательных карточек ниже первых экранов: чуть плотнее, чтобы текст читался */
        .glass { background: rgba(255,255,255,0.035); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); position: relative }
        .glass::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.2px; background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 22%, rgba(255,255,255,0) 45%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.1) 82%, rgba(255,255,255,0.3) 100%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none }

        /* Первый экран: элементы проявляются из размытия с задержками (как motion-анимации макета) */
        @keyframes rise { from { opacity: 0; filter: blur(10px); transform: translateY(20px) } to { opacity: 1; filter: none; transform: none } }
        .rise { animation: rise .9s ease-out both; animation-delay: var(--d, 0s) }
        @keyframes blurWord {
          0% { opacity: 0; filter: blur(10px); transform: translateY(50px) }
          50% { opacity: .5; filter: blur(5px); transform: translateY(-5px) }
          100% { opacity: 1; filter: none; transform: none }
        }
        .blur-text { display: flex; flex-wrap: wrap; row-gap: .1em }
        .bw { display: inline-block; margin-right: .28em; animation: blurWord .7s ease-out both; animation-delay: calc(var(--i) * 100ms + var(--d, 0ms)) }
        .reveal .bw { animation-play-state: paused }
        .reveal.in .bw { animation-play-state: running }
        .video-poster { transition: opacity .6s ease }
        /* Мягкая тень у букв — чтобы белый текст читался и на ярких местах видео (без затемнения самого видео) */
        .hero-shadow { text-shadow: 0 2px 24px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.35) }

        /* Появление блоков при прокрутке */
        .reveal { opacity: 0; transform: translateY(26px); filter: blur(10px); transition: opacity .8s ease, transform .9s cubic-bezier(.2,.8,.2,1), filter .8s ease }
        .reveal.in { opacity: 1; transform: none; filter: none }
        .reveal.reveal-words { opacity: 1; transform: none; filter: none }
        .reveal-d1 { transition-delay: .06s } .reveal-d2 { transition-delay: .12s } .reveal-d3 { transition-delay: .18s }
        .lift { transition: transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease, opacity .8s ease, filter .8s ease }
        .lift.reveal:not(.in) { transform: translateY(26px) }
        @media (hover: hover) { .lift.in:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,.5) } }

        /* График «прорисовывается» */
        .chart-line { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1.6s cubic-bezier(.45,.05,.2,1) }
        .chart-fill { opacity: 0; transition: opacity 1s ease }
        .chart-peak { opacity: 0; transform: translateY(6px) scale(.6); transition: opacity .5s ease, transform .6s cubic-bezier(.34,1.56,.64,1) }
        .drawn .chart-line { stroke-dashoffset: 0 } .drawn .chart-fill { opacity: 1 } .drawn .chart-peak { opacity: 1; transform: none }

        /* Карточка с полосой слева, которая «дорисовывается» при появлении */
        .accent-bar { transform: scaleY(0); transform-origin: top; transition: transform 1.2s cubic-bezier(.2,.8,.2,1) .25s }
        .in > .accent-bar { transform: scaleY(1) }

        /* Демо тренировки */
        @keyframes demoPhoto { 0% { opacity: 0 } 60% { opacity: 1 } 80% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes demoBar { 0% { transform: scaleY(1) } 60% { transform: scaleY(.18) } 80% { transform: scaleY(.18) } 100% { transform: scaleY(1) } }
        @keyframes demoTick { from { opacity: 0; transform: translateY(40%) } to { opacity: 1; transform: none } }
        .demo-photo { animation: demoPhoto var(--cycle) linear infinite }
        .demo-bar { animation: demoBar var(--cycle) linear infinite }
        .demo-tick { display: inline-block; animation: demoTick .25s cubic-bezier(.2,.8,.2,1) both }
        .demo-in { animation: rise .45s ease-out both }

        /* Мобильное меню */
        .m-menu { visibility: hidden; opacity: 0; transition: opacity .3s ease, visibility 0s .3s }
        .m-menu.open { visibility: visible; opacity: 1; transition: opacity .3s ease }
        .m-item { opacity: 0; transform: translateY(18px); filter: blur(8px); transition: opacity .5s ease, transform .6s cubic-bezier(.2,.8,.2,1), filter .5s ease }
        .m-menu.open .m-item { opacity: 1; transform: none; filter: none; transition-delay: calc(var(--i) * 55ms + 80ms) }
        .burger span { display: block; width: 18px; height: 1.6px; border-radius: 2px; background: #fff; transition: transform .35s cubic-bezier(.2,.8,.2,1), opacity .2s }
        .burger.open span:nth-child(1) { transform: translateY(5.6px) rotate(45deg) } .burger.open span:nth-child(2) { opacity: 0 } .burger.open span:nth-child(3) { transform: translateY(-5.6px) rotate(-45deg) }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important }
          html { scroll-behavior: auto }
          .reveal, .m-item, .rise, .bw { opacity: 1 !important; transform: none !important; filter: none !important }
          .chart-line { stroke-dashoffset: 0 } .chart-fill, .chart-peak { opacity: 1; transform: none } .accent-bar { transform: none }
        }
      ` }} />

      {/* Навигация: круг со знаком, «стеклянная» таблетка со ссылками и белой кнопкой, справа — вход */}
      <header className="fixed top-4 inset-x-0 px-4 sm:px-8 lg:px-16 flex items-center justify-between" style={{ zIndex: 70 }}>
        <a href="/" aria-label="RITM — на главную" className="liquid-glass rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48 }}><Mark size={20} /></a>
        <nav className="liquid-glass rounded-full hidden md:flex items-center px-1.5 py-1.5" aria-label="Разделы">
          {nav.map(([href, label]) => (
            <a key={href} href={href} className="px-3 py-2 text-sm font-medium rounded-full hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.9)", textDecoration: "none" }}>{label}</a>
          ))}
          <a href="/app?start=1" className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-2 text-sm font-medium whitespace-nowrap" style={{ textDecoration: "none" }}>
            Начать бесплатно <ArrowUpRight className="h-4 w-4" />
          </a>
        </nav>
        <a href="/app" aria-label="Войти в RITM" title="Войти в RITM" className="liquid-glass rounded-full hidden md:flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, color: "#fff" }}><LogIn size={18} /></a>
        <button onClick={() => setMenu((v) => !v)} aria-label={menu ? "Закрыть меню" : "Меню"} aria-expanded={menu}
          className={`burger liquid-glass md:hidden flex flex-col items-center justify-center gap-1 rounded-full flex-shrink-0 ${menu ? "open" : ""}`} style={{ width: 48, height: 48 }}>
          <span /><span /><span />
        </button>
      </header>
      <MobileMenu open={menu} onClose={() => setMenu(false)} nav={[...nav, ["#install", "Установка"]]} />

      <main>
        {/* 1. Первый экран на видео */}
        <section className="relative overflow-hidden flex flex-col" style={{ minHeight: "100svh", background: "#000", zIndex: 2 }}>
          <FadingVideo priority src={VIDEO.hero.src} poster={VIDEO.hero.poster} className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top" style={{ width: "120%", height: "120%", maxWidth: "none", zIndex: 0 }} />
          <div className="relative flex flex-col flex-1" style={{ zIndex: 10 }}>
            <div className="flex-1 flex flex-col items-center justify-center text-center pt-28 md:pt-24 pb-8 px-4">
              <a href="#demo" className="rise liquid-glass rounded-full inline-flex items-center gap-2.5 p-1 pr-3" style={{ "--d": ".4s", textDecoration: "none", color: "#fff" }}>
                <span className="bg-white text-black rounded-full px-3 py-1 text-xs font-semibold">Новое</span>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>Подход с гидом — прямо на сайте</span>
              </a>
              <BlurText as="h1" text="Тренировки, питание и привычки в одном ритме" className="font-heading hero-shadow mt-6 max-w-[68rem] justify-center"
                style={{ fontSize: "clamp(44px, 9.5vw, 76px)", lineHeight: 0.95, letterSpacing: "-0.045em" }} />
              <p className="rise hero-shadow mt-5 max-w-2xl" style={{ "--d": ".8s", fontSize: "clamp(15px, 2.2vw, 17px)", lineHeight: 1.45, fontWeight: 300, color: "#fff" }}>
                Программа силовых и бега под твою цель, калории по фото еды, задачи и привычки. Ответь на анкету за минуту — RITM сам соберёт план и норму калорий.
              </p>
              <div className="rise flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-7" style={{ "--d": "1.1s" }}>
                <Btn href="/app?start=1" strong big>Начать бесплатно <ArrowUpRight className="h-5 w-5" /></Btn>
                <a href="#demo" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "#fff", textDecoration: "none" }}><PlayIcon /> Попробовать подход</a>
              </div>
              <div className="rise flex items-stretch justify-center gap-3 sm:gap-4 mt-9" style={{ "--d": "1.3s" }}>
                {[[Dumbbell, "50", "упражнений, у 46 — фото техники"], [CalendarDays, "6", "готовых программ: зал, дом, гиря"]].map(([I, n, l]) => (
                  <div key={l} className="liquid-glass text-left p-5" style={{ width: "min(220px, calc(50vw - 22px))", borderRadius: "1.25rem" }}>
                    <I size={26} strokeWidth={1.5} color="#fff" />
                    <div className="font-heading mt-4" style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>{n}</div>
                    <div className="mt-2 text-xs" style={{ fontWeight: 300, lineHeight: 1.35 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs rise" style={{ "--d": "1.35s", color: "rgba(255,255,255,0.75)" }}>
                <span className="inline-flex items-center gap-1.5"><Check size={14} /> Бесплатно, без карты</span>
                <span className="inline-flex items-center gap-1.5"><Check size={14} /> Без App Store и Google Play</span>
                {bot && !inTelegram() && (
                  <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "inherit", textDecoration: "none" }}><Send size={14} /> Открыть в Telegram</a>
                )}
              </div>
            </div>
            {/* Вместо «партнёров» макета — реальные платформы: один аккаунт везде */}
            <div className="rise flex flex-col items-center gap-4 pb-8 px-4" style={{ "--d": "1.4s" }}>
              <span className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium">Один аккаунт — везде, где тебе удобно</span>
              <div className="flex flex-wrap items-center justify-center gap-x-10 md:gap-x-16 gap-y-1">
                {["Telegram", "iPhone", "Android", "Компьютер"].map((n) => (
                  <span key={n} className="font-heading" style={{ fontSize: "clamp(22px, 3vw, 30px)", letterSpacing: "-0.02em" }}>{n}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Возможности на втором видео */}
        <section id="features" className="relative overflow-hidden scroll-mt-4" style={{ minHeight: "100svh", background: "#000", zIndex: 2 }}>
          <FadingVideo src={VIDEO.capabilities.src} poster={VIDEO.capabilities.poster} className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} />
          <div className="relative px-5 sm:px-8 md:px-16 lg:px-20 pt-28 pb-10 flex flex-col" style={{ zIndex: 10, minHeight: "100svh" }}>
            <div className="mb-auto reveal reveal-words">
              <Kicker>Возможности</Kicker>
              <h2 className="font-heading" style={{ fontSize: "clamp(48px, 9vw, 96px)", lineHeight: 0.92, letterSpacing: "-0.04em" }}>
                <BlurText as="span" text="Режим," /><BlurText as="span" text="который работает" delay={100} />
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mt-14">
              {CAPABILITIES.map(([Icon, title, tags, text], i) => (
                <div key={title} className={`liquid-glass p-6 flex flex-col reveal reveal-d${i + 1}`} style={{ borderRadius: "1.25rem", minHeight: 320 }}>
                  <div className="flex items-start justify-between gap-4">
                    <span className="liquid-glass flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: "0.75rem" }}><Icon size={22} color="#fff" /></span>
                    <div className="flex flex-wrap justify-end gap-1.5" style={{ maxWidth: "75%" }}>
                      {tags.map((t) => <span key={t} className="liquid-glass rounded-full px-3 py-1 whitespace-nowrap" style={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}>{t}</span>)}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <div className="mt-8">
                    <h3 className="font-heading" style={{ fontSize: "clamp(30px, 3.4vw, 38px)", lineHeight: 1, letterSpacing: "-0.02em" }}>{title}</h3>
                    <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.9)", fontWeight: 300, lineHeight: 1.45, maxWidth: "38ch" }}>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ниже — на тёмном фоне со светом из первого кадра, чтобы стекло было видно */}
        <div className="relative">
          <img src="/video/backdrop.jpg" alt="" aria-hidden="true" className="fixed inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 0, opacity: 0.6 }} loading="lazy" decoding="async" />
          <div className="relative" style={{ zIndex: 1 }}>
            {/* Остальные разделы приложения */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-24">
              <SectionTitle kicker="Всё в одном приложении" title="И ещё много всего" sub="Всё, что есть в Mini App в Telegram, работает на сайте и в приложении на телефоне. Включай только нужные разделы — остальные можно скрыть." />
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {otherFeatures.map(([Icon, title, text], i) => (
                  <div key={title} className={`glass p-6 lift reveal reveal-d${(i % 3) + 1}`} style={{ borderRadius: "1.25rem" }}>
                    <span className="liquid-glass inline-flex items-center justify-center mb-6" style={{ width: 44, height: 44, borderRadius: "0.75rem" }}><Icon size={20} color="#fff" /></span>
                    <h3 className="font-heading" style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{title}</h3>
                    <p className="mt-2" style={{ color: C.muted, fontSize: 14, lineHeight: 1.55 }}>{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 reveal">
                {[[ScanBarcode, "Сканер штрихкодов"], [Timer, "Таймер отдыха"], [Droplets, "Вода стаканчиками"], [Wind, "Дыхательные практики"], [Target, "Челленджи"], [Sparkles, "ИИ-разбор недели"], [Palette, "Темы и свой цвет"]].map(([I, t]) => (
                  <span key={t} className="liquid-glass rounded-full inline-flex items-center gap-2 px-3.5 py-2 text-sm"><I size={15} /> {t}</span>
                ))}
              </div>
            </section>

            {/* Как начать — карточка с полосой слева */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
              <div className="glass p-7 sm:p-10 relative overflow-hidden reveal grid lg:grid-cols-2 gap-8 items-start" style={{ borderRadius: "1.75rem" }}>
                <span className="accent-bar absolute left-0 top-0 bottom-0" style={{ width: 3, background: "#fff" }} />
                <div>
                  <Kicker>Как начать</Kicker>
                  <h2 className="font-heading" style={{ fontSize: "clamp(34px, 4.6vw, 52px)", lineHeight: 0.98, letterSpacing: "-0.03em" }}>Тренируйся 2–4 раза в неделю</h2>
                  <p className="mt-4" style={{ color: C.muted, fontSize: 16, lineHeight: 1.6 }}>Ответь на анкету за минуту — RITM соберёт программу под твою цель и место, где ты занимаешься. Вес и повторы растут сами, гид ведёт по подходам с таймером отдыха.</p>
                  <div className="mt-6"><Btn href="/app?start=1" primary>Собрать свой план <ArrowUpRight className="h-4 w-4" /></Btn></div>
                </div>
                <ul className="flex flex-col gap-4">
                  {[[Dumbbell, "Зал", "штанга, гантели и тренажёры"], [Smartphone, "Дом", "без зала и без железа"], [Target, "Гиря", "вся программа с одной гирей"], [Footprints, "Бег", "3–4 пробежки в неделю с пульсовыми зонами"]].map(([I, t, s], i) => (
                    <li key={t} className="flex items-start gap-3 reveal" style={{ transitionDelay: `${0.15 + i * 0.08}s` }}>
                      <span className="liquid-glass rounded-full flex-shrink-0 flex items-center justify-center" style={{ width: 34, height: 34 }}><I size={15} color="#fff" /></span>
                      <span style={{ fontSize: 15, lineHeight: 1.45, paddingTop: 6 }}><b className="font-semibold">{t}</b> <span style={{ color: C.muted }}>— {s}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Живое демо гида по тренировке */}
            <section id="demo" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-24">
              {/* minmax(0, …): колонки могут сжиматься уже длинного названия упражнения в демо —
                  без этого на телефоне блок был шире экрана и страница съезжала вбок */}
              <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 lg:gap-12 items-center">
                <SectionTitle kicker="Попробуй" title="Один подход — прямо здесь" sub="Так гид ведёт по тренировке: темп повтора, отметка повторов и веса, таймер отдыха. После трёх подходов увидишь, какой вес RITM поставит в следующий раз." />
                <WorkoutDemo />
              </div>
            </section>

            {/* Прогресс — графики «прорисовываются» */}
            <section id="progress" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-24">
              <SectionTitle kicker="Прогресс" title="Каждый подход — точка на графике" sub="Вес на штанге, километры и шаги складываются в графики и личные рекорды. Ниже — пример: у тебя будут свои цифры." />
              <div className="grid md:grid-cols-3 gap-4">
                <ProgressCard tag="Силовые · 12 недель" title="Жим лёжа" sub="Рабочий вес, кг" peakLabel="55 кг" data={[40, 40, 42.5, 42.5, 45, 45, 47.5, 47.5, 50, 50, 52.5, 55]} stats={[["+15", "кг к весу"], ["12", "недель"]]} />
                <ProgressCard tag="Бег · 10 недель" title="Километры" sub="Объём бега за неделю, км" peakLabel="21 км" data={[6, 8, 8, 10, 9, 12, 14, 13, 17, 21]} stats={[["21", "км в неделю"], ["10", "недель"]]} delay={120} />
                <ProgressCard tag="Здоровье · 14 дней" title="Шаги" sub="Шагов за день" peakLabel="12 480" data={[6200, 7400, 5800, 8100, 9300, 7600, 10200, 8800, 9600, 11200, 8400, 12480, 9800, 10600]} stats={[["9200", "в среднем"], ["14", "дней"]]} delay={240} />
              </div>
            </section>

            {/* Цены */}
            <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-24">
              <SectionTitle kicker="Цены" title="Бесплатно навсегда. Pro — когда захочешь больше" sub="Все разделы доступны бесплатно. Pro снимает лимиты на ИИ и открывает полную статистику и беговой план." />
              <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4">
                <div className="glass p-5 sm:p-8 reveal" style={{ borderRadius: "1.5rem" }}>
                  <div className="grid items-center mb-4" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.9fr", gap: 8 }}>
                    <span />
                    <span className="text-center" style={{ fontSize: 13, color: C.muted }}>Бесплатно</span>
                    <span className="text-center font-semibold" style={{ fontSize: 13 }}>Pro</span>
                  </div>
                  <div className="flex flex-col">
                    {PRO_COMPARISON_ROWS.map(([label, free, pro]) => (
                      <div key={label} className="grid items-center py-3" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.9fr", gap: 8, borderTop: `1px solid ${C.line}` }}>
                        <span className="text-[14px] sm:text-[15px]">{label}</span>
                        <span className="text-center text-[13px] sm:text-[14px]" style={{ color: C.muted }}>{free}</span>
                        <span className="text-center font-semibold text-[13px] sm:text-[14px]">{pro}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="glass p-7 lift reveal reveal-d1" style={{ borderRadius: "1.5rem" }}>
                    <div style={{ color: C.muted, fontSize: 14 }}>Месяц</div>
                    <div className="font-heading mt-1" style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: "-0.03em" }}><CountUp value={`${RUB_PRICE.month} ₽`} scramble={false} /></div>
                    <div style={{ color: C.muted, fontSize: 14 }}>30 дней Pro</div>
                  </div>
                  <div className="liquid-glass-strong p-7 relative lift reveal reveal-d2" style={{ borderRadius: "1.5rem", background: "rgba(255,255,255,0.06)" }}>
                    <span className="accent-bar absolute left-0 top-0 bottom-0" style={{ width: 3, background: "#fff" }} />
                    {YEAR_SAVINGS_PCT > 0 && <span className="absolute rounded-full font-semibold bg-white text-black" style={{ top: 18, right: 18, fontSize: 12.5, padding: "4px 10px" }}>−{YEAR_SAVINGS_PCT}%</span>}
                    <div style={{ color: C.muted, fontSize: 14 }}>Год</div>
                    <div className="font-heading mt-1" style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: "-0.03em" }}><CountUp value={`${RUB_PRICE.year} ₽`} scramble={false} /></div>
                    <div style={{ color: C.muted, fontSize: 14 }}>{Math.round(RUB_PRICE.year / 12)} ₽ в месяц</div>
                  </div>
                  <Btn href="/app?start=1" primary big>Начать бесплатно <ArrowUpRight className="h-5 w-5" /></Btn>
                  <p className="text-center" style={{ fontSize: 13, color: C.muted }}>Оплата по СБП. Без автосписаний — продлеваешь сам. <a href={LEGAL_LINKS.offerUrl} style={{ color: "inherit" }}>Условия оферты</a></p>
                </div>
              </div>
            </section>

            {/* Установка */}
            <section id="install" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-24">
              <SectionTitle kicker="Установка" title="Поставь RITM на телефон" sub="Без магазинов приложений: RITM ставится прямо с сайта, открывается на весь экран со своей иконкой и работает даже без интернета." />
              <div className="grid md:grid-cols-3 gap-4">
                <InstallCard icon={Smartphone} title="Android">
                  <Steps items={[[null, "Открой этот сайт в Chrome"], [Download, "Нажми «Установить» ниже или в меню ⋮ браузера"], [Check, "RITM появится среди приложений"]]} />
                  <div className="mt-6 flex flex-col gap-2">
                    {inst.installed ? (
                      <div className="inline-flex items-center gap-2 font-semibold"><Check size={18} /> Уже установлено</div>
                    ) : inst.canPrompt ? (
                      <Btn onClick={install} primary><Download size={17} /> Установить RITM</Btn>
                    ) : (
                      <Btn href="/app"><ArrowRight size={17} /> Открыть веб-версию</Btn>
                    )}
                    {ANDROID_APK_URL && <Btn href={ANDROID_APK_URL} download><Download size={17} /> Скачать APK</Btn>}
                    {installMsg && <span style={{ fontSize: 13 }}>{installMsg}</span>}
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
            <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-24">
              <SectionTitle kicker="Вопросы" title="Частые вопросы" />
              <div className="flex flex-col gap-3">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="glass group reveal" style={{ borderRadius: "1.25rem" }}>
                    <summary className="cursor-pointer px-6 py-5 flex items-center gap-4 font-medium" style={{ fontSize: 16 }}>
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
              <div className="liquid-glass-strong px-6 py-16 text-center relative overflow-hidden reveal" style={{ borderRadius: "2rem" }}>
                <Mark size={34} />
                <BlurText as="h2" text="Найди свой ритм сегодня" className="font-heading mt-6 justify-center" style={{ fontSize: "clamp(40px, 6.5vw, 72px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} />
                <p className="mt-4 mx-auto max-w-lg" style={{ color: C.muted, fontSize: 17, fontWeight: 300 }}>Анкета на минуту — и у тебя готовы программа, беговой план и норма калорий.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Btn href="/app?start=1" primary big>Начать бесплатно <ArrowUpRight className="h-5 w-5" /></Btn>
                  <Btn href="#install" big><Smartphone size={18} /> Установить</Btn>
                </div>
              </div>
            </section>

            <footer style={{ borderTop: `1px solid ${C.line}`, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
              <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
                <div className="reveal">
                  <span className="inline-flex items-center gap-3"><Mark size={18} /><span className="font-heading" style={{ fontSize: 28, letterSpacing: "-0.02em" }}>RITM</span></span>
                  <p className="mt-4 max-w-md" style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>Тренировки, питание, задачи и привычки в одном приложении. Сайт, Android, iPhone и Mini App в Telegram — один аккаунт.</p>
                </div>
                <nav className="reveal reveal-d1 flex flex-col gap-2.5" style={{ fontSize: 14 }} aria-label="Разделы сайта">
                  <div className="font-semibold mb-1" style={{ fontSize: 13 }}>Разделы</div>
                  {[...nav, ["#install", "Установка"]].map(([href, label]) => <a key={href} href={href} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{label}</a>)}
                </nav>
                <nav className="reveal reveal-d2 flex flex-col gap-2.5" style={{ fontSize: 14 }} aria-label="Документы">
                  <div className="font-semibold mb-1" style={{ fontSize: 13 }}>Документы</div>
                  {[[LEGAL_LINKS.offerUrl, "Публичная оферта"], [LEGAL_LINKS.termsUrl, "Пользовательское соглашение"], [LEGAL_LINKS.privacyUrl, "Политика конфиденциальности"], [LEGAL_LINKS.consentUrl, "Согласие на обработку данных"]].map(([href, label]) => (
                    <a key={href} href={href} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{label}</a>
                  ))}
                  <a href={`mailto:${LEGAL_LINKS.email}`} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{LEGAL_LINKS.email}</a>
                  <a href={LEGAL_LINKS.supportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>Поддержка {LEGAL_LINKS.support}</a>
                </nav>
              </div>
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center" style={{ borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>
                Программа носит рекомендательный характер и не заменяет консультацию врача или тренера.
                <div className="mt-2">{LEGAL_LINKS.owner}, {LEGAL_LINKS.status}, ИНН {LEGAL_LINKS.inn}</div>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
