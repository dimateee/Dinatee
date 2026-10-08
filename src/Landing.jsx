// Главная страница сайта RITM: что умеет приложение, демо тренировки, цены, установка.
// Само приложение живёт по адресу /app (src/App.jsx) — лендинг его не подгружает.
//
// Дизайн-система — design-system/ritm/MASTER.md (собрана скиллом ui-ux-pro-max и подогнана под бренд):
// тёмный OLED-фон, неоновый лайм RITM как акцент, узкий спортивный шрифт заголовков (Sofia Sans Extra
// Condensed — с кириллицей), сетка «bento» с карточками разного размера, волна появления карточек.
// Анимации — на CSS: лендинг приходит готовым HTML (scripts/prerender.mjs), анимации играют сразу,
// а React «оживляет» страницу без перерисовки — поэтому в первой отрисовке нет ничего зависящего от window.
import { useEffect, useId, useRef, useState } from "react";
import {
  Dumbbell, Footprints, Apple, Activity, CalendarDays, Mic, TrendingUp, BookOpen, Target,
  Camera, ScanBarcode, Timer, Smartphone, Monitor, Share, SquarePlus, Check, Flame,
  Download, Send, ArrowRight, ChevronDown, Wind, Sparkles, MessageCircle,
  Users, Sunrise, Droplets, Palette, Minus, Plus, LogIn, Trophy,
} from "lucide-react";
import { useInstall, ANDROID_APK_URL, inTelegram } from "./web.js";
import { RUB_PRICE, YEAR_SAVINGS_PCT, PRO_COMPARISON_ROWS, LEGAL_LINKS } from "./plans.js";
import { CountUp, useInView, reducedMotion } from "./motion.jsx";
import { goal } from "./analytics.js";

// Токены цвета — те же, что в design-system/ritm/MASTER.md
const C = {
  bg: "#050607",
  surface: "#0C0E10",
  card: "#111316",
  line: "rgba(255,255,255,0.08)",
  fg: "#F5F7F2",
  muted: "#A1A7A0",
  a: "#C6FF3D",
  b: "#38E0C8",
  grad: "linear-gradient(135deg,#D4FF5C 0%,#9BF26A 45%,#38E0C8 100%)",
  on: "#0A0B0D",
};
const DISPLAY = "'Sofia Sans Extra Condensed', 'Arial Narrow', sans-serif";
const BODY = "'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif";

// Фоновые видео лежат на самом сайте (public/video). MP4 — для iPhone/Safari/Chrome, WebM — для браузеров без H.264.
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


function Mark({ size = 22, color }) {
  const bars = [0.55, 1, 0.72, 0.38];
  return (
    <span className="inline-flex items-end" aria-hidden="true" style={{ height: size, gap: size * 0.12 }}>
      {bars.map((h, i) => <span key={i} style={{ width: size * 0.17, height: size * h, borderRadius: size, background: color || C.grad }} />)}
    </span>
  );
}
function Wordmark({ size = 20 }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.45 }}>
      <Mark size={size} />
      <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: size * 1.25, letterSpacing: "0.06em", lineHeight: 1 }}>RITM</span>
    </span>
  );
}

// Кнопки: главная — лаймовая «таблетка», вторая — контурная
function Btn({ href, onClick, children, primary, big, dark, ...rest }) {
  const look = primary ? "btn-primary" : dark ? "btn-dark" : "btn-ghost";
  const cls = `btn ${look} inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap ${big ? "px-6 text-[16px]" : "px-5 text-[15px]"}`;
  const style = { minHeight: big ? 54 : 46, textDecoration: "none" };
  if (href) return <a href={href} onClick={onClick} className={cls} style={style} {...rest}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls} style={style} {...rest}>{children}</button>;
}

const Kicker = ({ children, center }) => (
  <div className={`inline-flex items-center gap-2 mb-5 text-[13px] font-semibold uppercase ${center ? "justify-center" : ""}`} style={{ color: C.a, letterSpacing: "0.14em" }}>
    <span className="rounded-full" style={{ width: 6, height: 6, background: C.a }} />{children}
  </div>
);

// Заголовок раздела: узкий шрифт, верхний регистр, «сбалансированные» строки (text-wrap: balance)
const SectionTitle = ({ kicker, title, sub, center }) => (
  <div className={`mb-12 reveal ${center ? "text-center mx-auto" : ""}`} style={{ maxWidth: 820 }}>
    {kicker && <Kicker center={center}>{kicker}</Kicker>}
    <h2 className="display" style={{ fontSize: "clamp(42px, 6.4vw, 84px)" }}>{title}</h2>
    {sub && <p className={`mt-5 ${center ? "mx-auto" : ""}`} style={{ color: C.muted, fontSize: 18, lineHeight: 1.6, maxWidth: 640 }}>{sub}</p>}
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


// Телефон на первом экране — настоящий экран гида по тренировке из приложения (подход, вес, темп, повторы)
function PhoneWorkout() {
  return (
    <div className="phone relative mx-auto" style={{ width: 300, maxWidth: "100%" }} aria-hidden="true">
      <div className="absolute rounded-full" style={{ inset: "14% 4% 10%", background: C.grad, filter: "blur(70px)", opacity: 0.32 }} />
      <div className="relative rounded-[46px] p-[10px]" style={{ background: "linear-gradient(160deg,#2a2c31,#0d0e10)", boxShadow: "0 40px 100px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.08)" }}>
        <div className="rounded-[37px] overflow-hidden relative px-5 pt-12 pb-5" style={{ background: "radial-gradient(110% 50% at 0% -8%, rgba(198,255,61,0.16) 0%, rgba(0,0,0,0) 55%), #08090B", height: 600 }}>
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: 10, width: 92, height: 26, background: "#000" }} />
          <div style={{ fontSize: 10.5, color: C.muted }}>Тренировка · упражнение 2 из 6</div>
          <div className="font-semibold" style={{ fontSize: 15.5, lineHeight: 1.25 }}>Жим на наклонной скамье</div>
          <div className="flex gap-1 mt-3">
            {[1, 2, 0, 0, 0, 0].map((s, i) => <span key={i} className="flex-1 rounded-full" style={{ height: 3, background: s ? C.grad : "rgba(255,255,255,.12)" }} />)}
          </div>
          <div className="text-center mt-5" style={{ fontSize: 11, color: C.muted }}>Подход 2 из 5</div>
          <div className="text-center" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: 1.05, textShadow: "0 0 24px rgba(198,255,61,.35)" }}>40 кг</div>
          <div className="text-center" style={{ fontSize: 11, color: C.muted }}>цель 8+ повторов до отказа</div>
          <div className="rounded-2xl mt-4 p-2.5" style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${C.line}` }}>
            <div className="relative rounded-xl overflow-hidden" style={{ height: 112, background: "#17181b" }}>
              <div className="tempo-fill absolute left-0 right-0 bottom-0 top-0" style={{ background: C.grad, transformOrigin: "bottom" }} />
            </div>
            <div className="text-center mt-1.5" style={{ fontSize: 9.5, color: C.muted }}>Темп: вниз 2 с, пауза, вверх 2 с</div>
          </div>
          <div style={{ fontSize: 10.5, color: C.muted }} className="mt-3 mb-2">Сколько получилось</div>
          {[["8", "повт."], ["40", "кг"]].map(([v, u]) => (
            <div key={u} className="flex items-center gap-3 mb-2">
              <span className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, border: `1px solid ${C.line}` }}><Minus size={12} /></span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, minWidth: 30, textAlign: "center" }}>{v}</span>
              <span className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, border: `1px solid ${C.line}` }}><Plus size={12} /></span>
              <span style={{ fontSize: 10.5, color: C.muted }}>{u}</span>
            </div>
          ))}
          <div className="absolute left-5 right-5 bottom-5 rounded-2xl text-center font-semibold py-3" style={{ background: C.grad, color: C.on, fontSize: 14 }}>Готово</div>
        </div>
      </div>
    </div>
  );
}

// Бегущая строка-лента — «энергия» блочного стиля
const TICKER = ["Силовые", "Бег", "Калории по фото", "Привычки", "Друзья и чат", "Зарядка", "Прогресс", "Голосовой помощник"];
function Ticker() {
  const row = TICKER.map((t) => (
    <span key={t} className="inline-flex items-center gap-6 pr-6">
      <span>{t}</span><span aria-hidden="true" className="rounded-full" style={{ width: 10, height: 10, background: C.on }} />
    </span>
  ));
  return (
    <div className="overflow-hidden" style={{ background: C.a, color: C.on }}>
      <p className="sr-only">{TICKER.join(", ")}</p>
      <div className="ticker flex w-max py-3.5" aria-hidden="true" style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "clamp(22px, 3vw, 34px)", textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1 }}>
        <div className="flex">{row}</div><div className="flex">{row}</div>
      </div>
    </div>
  );
}

// Карточки «bento»: у каждой одна мысль и маленькая «живая» иллюстрация из интерфейса
function BentoCard({ icon: Icon, title, text, className = "", children, i = 0 }) {
  return (
    <div className={`bento reveal-pop flex flex-col p-6 ${className}`} style={{ "--i": i }}>
      <div className="flex items-center gap-3">
        <span className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(198,255,61,0.1)", border: "1px solid rgba(198,255,61,0.22)" }}><Icon size={19} color={C.a} /></span>
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.01em" }}>{title}</h3>
      </div>
      <p className="mt-3" style={{ color: C.muted, fontSize: 15, lineHeight: 1.55, maxWidth: "46ch" }}>{text}</p>
      {children && <div className="mt-auto pt-5">{children}</div>}
    </div>
  );
}
const MiniWorkout = () => (
  <div className="flex flex-col gap-2" aria-hidden="true">
    <div className="rounded-2xl p-4 mb-1" style={{ background: "linear-gradient(135deg, rgba(198,255,61,.12), rgba(56,224,200,.05))", border: "1px solid rgba(198,255,61,.25)" }}>
      <div className="flex items-baseline justify-between">
        <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 30, textTransform: "uppercase", lineHeight: 1 }}>Тренировка A</span>
        <span className="text-[13px]" style={{ color: C.muted }}>5 упражнений · 45 мин</span>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,.1)" }}><div className="h-full rounded-full" style={{ width: "40%", background: C.grad }} /></div>
        <span className="text-[12px] font-semibold" style={{ color: C.a }}>2 из 5</span>
      </div>
    </div>
    {[["Присед со штангой", "4 × 8", "60 кг", 1], ["Жим на наклонной", "4 × 8", "40 кг", 1], ["Тяга в наклоне", "3 × 10", "45 кг", 0], ["Румынская тяга", "3 × 10", "50 кг", 0], ["Планка", "3 × 45 с", "свой вес", 0]].map(([n, s, w, done]) => (
      <div key={n} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${C.line}` }}>
        <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, background: done ? C.grad : "transparent", border: done ? "none" : "1.5px solid rgba(255,255,255,.25)", color: C.on }}>{done ? <Check size={13} strokeWidth={3} /> : null}</span>
        <span className="flex-1 text-[14px] truncate">{n}</span>
        <span className="text-[13px]" style={{ color: C.muted }}>{s}</span>
        <span className="text-[13px] font-semibold" style={{ minWidth: 58, textAlign: "right" }}>{w}</span>
      </div>
    ))}
  </div>
);
const MiniMacros = () => (
  <div className="flex items-center gap-5" aria-hidden="true">
    <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
      <svg width="92" height="92" viewBox="0 0 92 92"><circle cx="46" cy="46" r="38" stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none" />
        <circle cx="46" cy="46" r="38" stroke={C.a} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 * 0.31} transform="rotate(-90 46 46)" /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, lineHeight: 1 }}>1 480</span><span style={{ fontSize: 10, color: C.muted }}>из 2 150</span></div>
    </div>
    <div className="flex-1 flex flex-col gap-2.5">
      {[["Белок", 96, 130, C.a], ["Жиры", 48, 70, C.b], ["Углеводы", 160, 250, "#FF8A3D"]].map(([n, v, max, col]) => (
        <div key={n}>
          <div className="flex justify-between text-[12px]"><span>{n}</span><span style={{ color: C.muted }}>{v} / {max} г</span></div>
          <div className="rounded-full mt-1 overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,.08)" }}><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: col }} /></div>
        </div>
      ))}
    </div>
  </div>
);
const MiniZones = () => (
  <div className="flex gap-1.5" aria-hidden="true">
    {["Z1", "Z2", "Z3", "Z4", "Z5"].map((z, i) => (
      <span key={z} className="flex-1 rounded-lg text-center py-2 text-[12px] font-semibold" style={{ background: i === 1 ? C.a : "rgba(255,255,255,.05)", color: i === 1 ? C.on : C.muted, border: i === 1 ? "none" : `1px solid ${C.line}` }}>{z}</span>
    ))}
  </div>
);
const MiniStreak = () => (
  <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }} aria-hidden="true">
    {Array.from({ length: 21 }, (_, i) => {
      const on = [0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19].includes(i);
      return <span key={i} className="rounded-md" style={{ aspectRatio: "1", background: on ? (i > 13 ? C.a : "rgba(198,255,61,.45)") : "rgba(255,255,255,.06)" }} />;
    })}
  </div>
);
const MiniSpark = () => (
  <div className="flex items-end gap-4" aria-hidden="true">
    <svg viewBox="0 0 240 70" className="flex-1" style={{ height: 70 }} preserveAspectRatio="none">
      <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.a} stopOpacity=".3" /><stop offset="100%" stopColor={C.a} stopOpacity="0" /></linearGradient></defs>
      <path d="M0,62 C30,60 40,52 60,50 S95,44 115,40 S150,30 170,26 S210,14 240,6 L240,70 L0,70 Z" fill="url(#spk)" />
      <path d="M0,62 C30,60 40,52 60,50 S95,44 115,40 S150,30 170,26 S210,14 240,6" fill="none" stroke={C.a} strokeWidth="2.5" />
    </svg>
    <div className="text-right flex-shrink-0">
      <div className="inline-flex items-center gap-1 text-[12px]" style={{ color: C.a }}><Trophy size={13} /> рекорд</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>55 кг</div>
    </div>
  </div>
);
const MiniChat = () => (
  <div className="flex flex-col gap-2" aria-hidden="true">
    <div className="self-start rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px]" style={{ background: "rgba(255,255,255,.07)" }}>Завтра в 7:00 бег?</div>
    <div className="self-end rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] font-medium" style={{ background: C.a, color: C.on }}>Да! 5 км в зоне 2</div>
  </div>
);
const MiniVoice = () => (
  <div className="flex items-center gap-1 h-10" aria-hidden="true">
    {[0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.95, 0.65, 0.8, 0.45, 0.7, 0.55].map((h, i) => (
      <span key={i} className="voice-bar flex-1 rounded-full" style={{ height: `${h * 100}%`, background: i % 3 === 0 ? C.b : C.a, "--i": i }} />
    ))}
  </div>
);

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
      <h3 className="mt-3" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, textTransform: "uppercase", lineHeight: 1 }}>{title}</h3>
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


// Живое демо гида по тренировке: три подхода жима на наклонной скамье с темпом, отдыхом и итогом.
// Правило роста веса то же, что в приложении (progressFor в App.jsx, «двойная прогрессия»):
// если во всех подходах дошёл до верхней границы диапазона — в следующий раз вес +2,5 кг,
// иначе цель — повторить или превзойти худший подход.
const DEMO = { name: "Жим штанги на наклонной скамье", weight: 40, sets: 3, lo: 8, hi: 12, step: 2.5, down: 3, pause: 1, up: 1, rest: 15 };
const fmtKg = (v) => String(v).replace(".", ",");

function DemoStepper({ value, onChange, unit, step = 1, min = 0, label }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label={`Меньше: ${label}`} className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, border: `1px solid ${C.line}`, color: "#fff" }}><Minus size={16} /></button>
      <span className="text-center overflow-hidden" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, minWidth: 54 }}><span key={value} className="demo-tick">{fmtKg(value)}</span></span>
      <button onClick={() => onChange(value + step)} aria-label={`Больше: ${label}`} className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, border: `1px solid ${C.line}`, color: "#fff" }}><Plus size={16} /></button>
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
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, textTransform: "uppercase", lineHeight: 1 }}>{title}</h3>
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


// Мобильное меню: на весь экран, пункты выезжают по очереди
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
      <div className="absolute inset-0" style={{ background: "rgba(5,6,7,0.94)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }} />
      <nav className="relative h-full flex flex-col px-6 pt-24 pb-10" onClick={(e) => e.stopPropagation()} aria-label="Меню">
        {nav.map(([href, label], i) => (
          <a key={href} href={href} onClick={onClose} tabIndex={open ? 0 : -1} className="m-item py-2" style={{ "--i": i, color: C.fg, textDecoration: "none", fontFamily: DISPLAY, fontWeight: 900, fontSize: 46, textTransform: "uppercase", lineHeight: 1 }}>{label}</a>
        ))}
        <div className="m-item mt-auto flex flex-col gap-3" style={{ "--i": nav.length }}>
          <Btn href="/app?start=1" primary big tabIndex={open ? 0 : -1}>Начать бесплатно <ArrowRight size={18} /></Btn>
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


export default function Landing() {
  const inst = useInstall();
  const [bot, setBot] = useState(null);
  const [installMsg, setInstallMsg] = useState("");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    document.title = "RITM — тренировки, питание и привычки";
    fetch("/api/config").then((r) => (r.ok ? r.json() : null)).then((d) => d?.bot && setBot(d.bot)).catch(() => {});
  }, []);
  // Блоки появляются, когда до них доходит прокрутка (класс in ставится один раз)
  useEffect(() => {
    const els = [...document.querySelectorAll(".reveal, .reveal-pop")];
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
  const bentoTitles = new Set(["Силовые под твою цель", "Калории по фото", "Беговой план", "Прогресс и награды", "Друзья и чат", "Голосовой помощник", "Календарь и задачи"]);
  const restFeatures = FEATURES.filter(([, t]) => !bentoTitles.has(t));
  const feat = Object.fromEntries(FEATURES.map(([, t, text]) => [t, text]));

  return (
    <div onClick={onLandingClick} className="landing min-h-screen" style={{ background: C.bg, color: C.fg, fontFamily: BODY }}>
      <StructuredData />
      {/* dangerouslySetInnerHTML, а не текст: иначе при сборке готового HTML React экранирует «>» в селекторах
          как &gt; — правило ломается, и текст стилей не совпадает при оживлении страницы */}
      <style dangerouslySetInnerHTML={{ __html: `
        html { scroll-behavior: smooth }
        .landing ::selection { background: ${C.a}; color: ${C.on} }
        .landing a:focus-visible, .landing button:focus-visible, .landing summary:focus-visible { outline: 2px solid ${C.a}; outline-offset: 3px; border-radius: 14px }
        .landing button, .landing summary, .landing a { cursor: pointer }
        .display { font-family: ${DISPLAY}; font-weight: 900; text-transform: uppercase; line-height: .9; letter-spacing: -0.005em; text-wrap: balance }
        .accent { color: ${C.a} }
        details > summary { list-style: none } details > summary::-webkit-details-marker { display: none }
        details[open] .faq-chev { transform: rotate(180deg) }

        /* Кнопки: смена состояния 150–250 мс, видимый фокус, касание не меньше 44 px */
        .btn { transition: transform .2s cubic-bezier(.34,1.56,.64,1), background-color .2s ease, box-shadow .25s ease, border-color .2s ease }
        .btn:active { transform: scale(.97) }
        .btn-primary { background: ${C.a}; color: ${C.on}; box-shadow: 0 10px 34px rgba(198,255,61,.28) }
        .btn-dark { background: ${C.on}; color: #fff }
        .btn-ghost { color: ${C.fg}; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.03) }
        @media (hover: hover) {
          .btn-primary:hover { background: #D4FF5C; box-shadow: 0 14px 44px rgba(198,255,61,.42); transform: translateY(-2px) }
          .btn-ghost:hover { border-color: rgba(198,255,61,.55); background: rgba(198,255,61,.06) }
          .btn-dark:hover { transform: translateY(-2px) }
          .bento.in:hover { transform: scale(1.02); border-color: rgba(198,255,61,.28) }
          .lift.in:hover { transform: translateY(-4px); border-color: rgba(198,255,61,.28) }
          .nav-link:hover { color: #fff; background: rgba(255,255,255,.06) }
        }

        /* Карточки */
        .surface { background: ${C.card}; border: 1px solid ${C.line} }
        .bento { background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.01)), ${C.card}; border: 1px solid ${C.line}; border-radius: 24px; transition: transform .25s ease, border-color .25s ease }
        .glass { background: rgba(17,19,22,.72); border: 1px solid ${C.line}; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px) }

        /* Первый экран: появление на CSS — играет сразу из готового HTML */
        @keyframes rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        .rise { animation: rise .7s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0s) }
        @keyframes phoneIn { from { opacity: 0; transform: translateY(40px) rotate(2deg) scale(.96) } to { opacity: 1; transform: none } }
        .phone-in { animation: phoneIn 1s .25s cubic-bezier(.2,.8,.2,1) both }
        @keyframes floaty { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        .float-a { animation: floaty 6s ease-in-out infinite } .float-b { animation: floaty 7s 1.2s ease-in-out infinite }
        @keyframes tempo { 0% { transform: scaleY(1) } 45% { transform: scaleY(.2) } 55% { transform: scaleY(.2) } 100% { transform: scaleY(1) } }
        .tempo-fill { animation: tempo 4.5s ease-in-out infinite }
        @keyframes ticker { to { transform: translateX(-50%) } }
        .ticker { animation: ticker 28s linear infinite }
        @keyframes voice { 0%,100% { transform: scaleY(.45) } 50% { transform: scaleY(1) } }
        .voice-bar { transform-origin: center; animation: voice 1.1s ease-in-out infinite; animation-delay: calc(var(--i) * 90ms) }
        .video-poster { transition: opacity .6s ease }

        /* Появление при прокрутке: блоки — снизу вверх; карточки — «волной» с лёгким пружинным перелётом */
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .8s cubic-bezier(.2,.8,.2,1) }
        .reveal.in { opacity: 1; transform: none }
        .reveal-pop { opacity: 0; transform: translateY(16px) scale(.92); transition: opacity .45s ease, transform .45s cubic-bezier(.34,1.56,.64,1), border-color .25s ease; transition-delay: calc(var(--i, 0) * 60ms) }
        .reveal-pop.in { opacity: 1; transform: none }
        .reveal-pop.in:hover { transition-delay: 0s }
        .lift { transition: transform .25s ease, border-color .25s ease, opacity .7s ease }
        .reveal-d1 { transition-delay: .06s } .reveal-d2 { transition-delay: .12s } .reveal-d3 { transition-delay: .18s }

        /* График «прорисовывается» */
        .chart-line { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1.6s cubic-bezier(.45,.05,.2,1) }
        .chart-fill { opacity: 0; transition: opacity 1s ease }
        .chart-peak { opacity: 0; transform: translateY(6px) scale(.6); transition: opacity .5s ease, transform .6s cubic-bezier(.34,1.56,.64,1) }
        .drawn .chart-line { stroke-dashoffset: 0 } .drawn .chart-fill { opacity: 1 } .drawn .chart-peak { opacity: 1; transform: none }
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
        .m-item { opacity: 0; transform: translateY(18px); transition: opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1) }
        .m-menu.open .m-item { opacity: 1; transform: none; transition-delay: calc(var(--i) * 50ms + 60ms) }
        .burger span { display: block; width: 18px; height: 2px; border-radius: 2px; background: #fff; transition: transform .3s cubic-bezier(.2,.8,.2,1), opacity .2s }
        .burger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg) } .burger.open span:nth-child(2) { opacity: 0 } .burger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg) }

        /* Bento-сетка: 4 → 2 → 1 колонки */
        .bento-grid { display: grid; gap: 16px; grid-template-columns: 1fr }
        @media (min-width: 768px) { .bento-grid { grid-template-columns: repeat(2, 1fr) } .b-wide { grid-column: span 2 } }
        @media (min-width: 1024px) { .bento-grid { grid-template-columns: repeat(4, 1fr) } .b-big { grid-column: span 2; grid-row: span 2 } .b-wide { grid-column: span 2 } }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important }
          html { scroll-behavior: auto }
          .reveal, .reveal-pop, .m-item, .rise, .phone-in { opacity: 1 !important; transform: none !important }
          .chart-line { stroke-dashoffset: 0 } .chart-fill, .chart-peak { opacity: 1; transform: none } .accent-bar { transform: none }
        }
      ` }} />

      {/* Шапка */}
      <header className="fixed top-0 inset-x-0" style={{ zIndex: 70, background: "rgba(5,6,7,0.72)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${C.line}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <a href="/" aria-label="RITM — на главную" style={{ color: C.fg, textDecoration: "none" }}><Wordmark size={18} /></a>
          <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Разделы">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className="nav-link px-3 py-2 rounded-xl text-[14px] font-medium transition-colors" style={{ color: "rgba(255,255,255,.75)", textDecoration: "none" }}>{label}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href="/app" className="nav-link hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[14px] font-medium" style={{ color: "rgba(255,255,255,.8)", textDecoration: "none" }}><LogIn size={16} /> Войти</a>
            <Btn href="/app?start=1" primary>Начать бесплатно</Btn>
            <button onClick={() => setMenu((v) => !v)} aria-label={menu ? "Закрыть меню" : "Меню"} aria-expanded={menu}
              className={`burger md:hidden flex flex-col items-center justify-center gap-1 rounded-xl ${menu ? "open" : ""}`} style={{ width: 44, height: 44, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}` }}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={menu} onClose={() => setMenu(false)} nav={[...nav, ["#install", "Установка"]]} />

      <main>
        {/* 1. Первый экран: сообщение + настоящий экран тренировки */}
        <section className="relative overflow-hidden" style={{ background: C.bg }}>
          <FadingVideo priority src={VIDEO.hero.src} poster={VIDEO.hero.poster} className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top" style={{ width: "120%", height: "100%", maxWidth: "none", zIndex: 0, filter: "brightness(.55)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, background: "radial-gradient(60% 55% at 85% 45%, rgba(198,255,61,0.14) 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(5,6,7,0) 55%, #050607 100%)" }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16 lg:pb-24 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center" style={{ zIndex: 2 }}>
            <div>
              <div className="rise inline-flex flex-wrap items-center gap-2 rounded-full px-3.5 py-1.5 mb-7 text-[13px]" style={{ "--d": ".05s", background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, color: "rgba(255,255,255,.85)" }}>
                <span className="rounded-full" style={{ width: 7, height: 7, background: C.a, boxShadow: `0 0 10px ${C.a}` }} /> Сайт · Android · iPhone · Telegram
              </div>
              <h1 className="display rise" style={{ "--d": ".12s", fontSize: "clamp(54px, 8.4vw, 124px)", lineHeight: 0.86 }}>
                Тренировки, питание и&nbsp;привычки&nbsp;— <span className="accent">в&nbsp;одном ритме</span>
              </h1>
              <p className="rise mt-7" style={{ "--d": ".24s", color: "rgba(245,247,242,.78)", fontSize: "clamp(16px, 1.7vw, 19px)", lineHeight: 1.6, maxWidth: 560 }}>
                Программа силовых и бега под твою цель, калории по фото еды, задачи и привычки. Ответь на анкету за минуту — RITM сам соберёт план и норму калорий.
              </p>
              <div className="rise mt-8 flex flex-wrap gap-3" style={{ "--d": ".34s" }}>
                <Btn href="/app?start=1" primary big>Начать бесплатно <ArrowRight size={18} /></Btn>
                <Btn href="#demo" big>Попробовать подход</Btn>
              </div>
              <div className="rise mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]" style={{ "--d": ".42s", color: C.muted }}>
                <span className="inline-flex items-center gap-1.5"><Check size={16} color={C.a} /> Бесплатно, без карты</span>
                <span className="inline-flex items-center gap-1.5"><Check size={16} color={C.a} /> Без App Store и Google Play</span>
                {bot && !inTelegram() && (
                  <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "inherit", textDecoration: "none" }}><Send size={15} /> Открыть в Telegram</a>
                )}
              </div>
            </div>
            <div className="relative phone-in">
              <PhoneWorkout />
              <div className="float-a glass hidden sm:flex absolute items-center gap-3 rounded-2xl px-4 py-3" style={{ left: "-2%", top: "18%" }} aria-hidden="true">
                <span className="rounded-xl flex items-center justify-center" style={{ width: 34, height: 34, background: "rgba(198,255,61,.12)" }}><TrendingUp size={17} color={C.a} /></span>
                <span><span className="block text-[11px]" style={{ color: C.muted }}>В следующий раз</span><span className="block font-semibold text-[15px]">+2,5 кг к весу</span></span>
              </div>
              <div className="float-b glass hidden sm:flex absolute items-center gap-3 rounded-2xl px-4 py-3" style={{ right: "-2%", bottom: "16%" }} aria-hidden="true">
                <span className="rounded-xl flex items-center justify-center" style={{ width: 34, height: 34, background: "rgba(255,138,61,.14)" }}><Flame size={17} color="#FF8A3D" /></span>
                <span><span className="block text-[11px]" style={{ color: C.muted }}>Серия</span><span className="block font-semibold text-[15px]">12 дней подряд</span></span>
              </div>
            </div>
          </div>
        </section>

        <Ticker />

        {/* 2. Цифры — только то, что реально есть в приложении */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {[["50", "упражнений, у 46 — фото техники"], ["6", "готовых программ: зал, дом, гиря"], ["16", "разделов приложения"], ["1", "аккаунт на всех устройствах"]].map(([n, l], i) => (
            <div key={l} className={`reveal reveal-d${(i % 3) + 1}`} style={{ borderLeft: `2px solid ${i === 0 ? C.a : C.line}`, paddingLeft: 18 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "clamp(64px, 8vw, 104px)", lineHeight: 0.9 }}><CountUp value={n} duration={1500} /></div>
              <div className="mt-2" style={{ color: C.muted, fontSize: 15, lineHeight: 1.45, maxWidth: 220 }}>{l}</div>
            </div>
          ))}
        </section>

        {/* 3. Возможности — сетка bento */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-20">
          <SectionTitle kicker="Возможности" title={<>Всё для режима&nbsp;— <span className="accent">в&nbsp;одном приложении</span></>} sub="Всё, что есть в Mini App в Telegram, работает и на сайте, и в приложении на телефоне. Включай только нужные разделы — остальные можно скрыть." />
          <div className="bento-grid">
            <BentoCard i={0} className="b-big" icon={Dumbbell} title="Силовые под цель" text={feat["Силовые под твою цель"]}><MiniWorkout /></BentoCard>
            <BentoCard i={1} className="b-wide" icon={Camera} title="Калории по фото" text={feat["Калории по фото"]}><MiniMacros /></BentoCard>
            <BentoCard i={2} icon={Footprints} title="Бег" text={feat["Беговой план"]}><MiniZones /></BentoCard>
            <BentoCard i={3} icon={CalendarDays} title="Привычки" text="Задачник с приоритетами и повторами плюс трекер привычек с сериями дней."><MiniStreak /></BentoCard>
            <BentoCard i={4} className="b-wide" icon={TrendingUp} title="Прогресс и рекорды" text={feat["Прогресс и награды"]}><MiniSpark /></BentoCard>
            <BentoCard i={5} icon={Users} title="Друзья и чат" text="Добавляй друзей, переписывайся и планируй совместные тренировки."><MiniChat /></BentoCard>
            <BentoCard i={6} icon={Mic} title="Голос" text="Спроси голосом «что съесть, чтобы добрать белок» — помощник учтёт твою неделю."><MiniVoice /></BentoCard>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 reveal">
            {[...restFeatures.map(([I, t]) => [I, t]), [ScanBarcode, "Сканер штрихкодов"], [Timer, "Таймер отдыха"], [Droplets, "Вода стаканчиками"], [Wind, "Дыхание"], [Target, "Челленджи"], [Sparkles, "ИИ-разбор недели"], [Palette, "Темы и свой цвет"]].map(([I, t]) => (
              <span key={t} className="surface rounded-full inline-flex items-center gap-2 px-4 py-2.5 text-[14px]"><I size={16} color={C.a} /> {t}</span>
            ))}
          </div>
        </section>

        {/* 4. Заявление на видео со «столбами света» */}
        <section className="relative overflow-hidden" style={{ background: "#000" }}>
          <FadingVideo src={VIDEO.capabilities.src} poster={VIDEO.capabilities.poster} className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0, filter: "brightness(.6)" }} />
          <div className="absolute inset-0" style={{ zIndex: 1, background: "linear-gradient(180deg, #050607 0%, rgba(5,6,7,.15) 30%, rgba(5,6,7,.15) 70%, #050607 100%)" }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-28 sm:py-36 text-center" style={{ zIndex: 2 }}>
            <div className="reveal">
              <Kicker center>Двойная прогрессия</Kicker>
              <h2 className="display mx-auto" style={{ fontSize: "clamp(52px, 9vw, 132px)", maxWidth: "12ch" }}>Сильнее <span className="accent">с&nbsp;каждой неделей</span></h2>
              <p className="mt-6 mx-auto" style={{ color: "rgba(245,247,242,.82)", fontSize: 18, lineHeight: 1.6, maxWidth: 600 }}>Дошёл до верхней границы повторов во всех подходах — в следующий раз RITM сам добавит 2,5 кг. Не дошёл — цель повторить свой результат.</p>
              <div className="mt-8"><Btn href="/app?start=1" primary big>Собрать свой план <ArrowRight size={18} /></Btn></div>
            </div>
          </div>
        </section>

        {/* 5. Демо гида по тренировке */}
        <section id="demo" className="max-w-7xl mx-auto px-4 sm:px-6 py-24 scroll-mt-20">
          {/* minmax(0, …): колонки могут сжиматься уже длинного названия упражнения в демо */}
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-10 lg:gap-14 items-center">
            <SectionTitle kicker="Попробуй" title={<>Один подход&nbsp;— <span className="accent">прямо здесь</span></>} sub="Так гид ведёт по тренировке: темп повтора, отметка повторов и веса, таймер отдыха. После трёх подходов увидишь, какой вес RITM поставит в следующий раз." />
            <WorkoutDemo />
          </div>
        </section>

        {/* 6. Как начать — три шага */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
          <SectionTitle kicker="Как начать" title={<>Три шага <span className="accent">до&nbsp;первой тренировки</span></>} />
          <div className="grid md:grid-cols-3 gap-4">
            {[["01", "Анкета за минуту", "Цель, опыт, где тренируешься и сколько раз в неделю — без регистрации."], ["02", "План под тебя", "Программа на 2–4 дня для зала, дома или с гирей, беговой план и норма калорий."], ["03", "Гид ведёт по подходам", "Темп, таймер отдыха и фото техники. Вес и повторы растут сами."]].map(([n, t, s], i) => (
              <div key={n} className="bento reveal-pop p-7" style={{ "--i": i }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, lineHeight: 1, color: i === 0 ? C.a : "rgba(255,255,255,.18)" }}>{n}</div>
                <h3 className="mt-4" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, textTransform: "uppercase", lineHeight: 1 }}>{t}</h3>
                <p className="mt-3" style={{ color: C.muted, fontSize: 15, lineHeight: 1.55 }}>{s}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 reveal">
            {[[Dumbbell, "Зал"], [Smartphone, "Дом"], [Target, "Гиря"], [Footprints, "Бег с пульсовыми зонами"], [Sunrise, "Зарядка"]].map(([I, t]) => (
              <span key={t} className="surface rounded-full inline-flex items-center gap-2 px-4 py-2.5 text-[14px]"><I size={16} color={C.a} /> {t}</span>
            ))}
            <Btn href="/app?start=1" primary>Собрать свой план <ArrowRight size={16} /></Btn>
          </div>
        </section>

        {/* 7. Прогресс — графики «прорисовываются» */}
        <section id="progress" className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-20">
          <SectionTitle kicker="Прогресс" title={<>Каждый подход&nbsp;— <span className="accent">точка на&nbsp;графике</span></>} sub="Вес на штанге, километры и шаги складываются в графики и личные рекорды. Ниже — пример: у тебя будут свои цифры." />
          <div className="grid md:grid-cols-3 gap-4">
            <ProgressCard tag="Силовые · 12 недель" title="Жим лёжа" sub="Рабочий вес, кг" peakLabel="55 кг" data={[40, 40, 42.5, 42.5, 45, 45, 47.5, 47.5, 50, 50, 52.5, 55]} stats={[["+15", "кг к весу"], ["12", "недель"]]} />
            <ProgressCard tag="Бег · 10 недель" title="Километры" sub="Объём бега за неделю, км" peakLabel="21 км" data={[6, 8, 8, 10, 9, 12, 14, 13, 17, 21]} stats={[["21", "км в неделю"], ["10", "недель"]]} delay={120} />
            <ProgressCard tag="Здоровье · 14 дней" title="Шаги" sub="Шагов за день" peakLabel="12 480" data={[6200, 7400, 5800, 8100, 9300, 7600, 10200, 8800, 9600, 11200, 8400, 12480, 9800, 10600]} stats={[["9200", "в среднем"], ["14", "дней"]]} delay={240} />
          </div>
        </section>

        {/* 8. Цены */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-20">
          <SectionTitle kicker="Цены" title={<>Бесплатно навсегда. <span className="accent">Pro&nbsp;— когда захочешь больше</span></>} sub="Все разделы доступны бесплатно. Pro снимает лимиты на ИИ и открывает полную статистику и беговой план." />
          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4">
            <div className="surface rounded-[28px] p-5 sm:p-8 reveal">
              <div className="grid items-center mb-3" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.9fr", gap: 8 }}>
                <span />
                <span className="text-center text-[13px]" style={{ color: C.muted }}>Бесплатно</span>
                <span className="text-center text-[13px] font-semibold" style={{ color: C.a }}>Pro</span>
              </div>
              {PRO_COMPARISON_ROWS.map(([label, free, pro]) => (
                <div key={label} className="grid items-center py-3" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.9fr", gap: 8, borderTop: `1px solid ${C.line}` }}>
                  <span className="text-[14px] sm:text-[15px]">{label}</span>
                  <span className="text-center text-[13px] sm:text-[14px]" style={{ color: C.muted }}>{free}</span>
                  <span className="text-center font-semibold text-[13px] sm:text-[14px]" style={{ color: C.a }}>{pro}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <div className="surface rounded-[28px] p-7 lift reveal reveal-d1">
                <div className="text-[14px]" style={{ color: C.muted }}>Месяц</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, lineHeight: 1 }}><CountUp value={`${RUB_PRICE.month} ₽`} scramble={false} /></div>
                <div className="text-[14px]" style={{ color: C.muted }}>30 дней Pro</div>
              </div>
              <div className="rounded-[28px] p-7 relative overflow-hidden lift reveal reveal-d2" style={{ background: "linear-gradient(135deg, rgba(198,255,61,0.14), rgba(56,224,200,0.06)), #111316", border: "1px solid rgba(198,255,61,0.45)" }}>
                {YEAR_SAVINGS_PCT > 0 && <span className="absolute rounded-full font-bold text-[13px]" style={{ top: 18, right: 18, padding: "5px 12px", background: C.a, color: C.on }}>Выгоднее на {YEAR_SAVINGS_PCT}%</span>}
                <div className="text-[14px]" style={{ color: C.muted }}>Год</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, lineHeight: 1 }}><CountUp value={`${RUB_PRICE.year} ₽`} scramble={false} /></div>
                <div className="text-[14px]" style={{ color: C.muted }}>{Math.round(RUB_PRICE.year / 12)} ₽ в месяц</div>
              </div>
              <Btn href="/app?start=1" primary big>Начать бесплатно <ArrowRight size={18} /></Btn>
              <p className="text-center text-[13px]" style={{ color: C.muted }}>Оплата по СБП. Без автосписаний — продлеваешь сам. <a href={LEGAL_LINKS.offerUrl} style={{ color: "inherit" }}>Условия оферты</a></p>
            </div>
          </div>
        </section>

        {/* 9. Установка */}
        <section id="install" className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-20">
          <SectionTitle kicker="Установка" title={<>Поставь RITM <span className="accent">на&nbsp;телефон</span></>} sub="Без магазинов приложений: RITM ставится прямо с сайта, открывается на весь экран со своей иконкой и работает даже без интернета." />
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
                {installMsg && <span className="text-[13px]" style={{ color: C.a }}>{installMsg}</span>}
              </div>
            </InstallCard>
            <InstallCard icon={Smartphone} title="iPhone">
              <Steps items={[[null, "Открой этот сайт в Safari"], [Share, "Нажми «Поделиться» внизу экрана"], [SquarePlus, "Выбери «На экран „Домой“» → «Добавить»"]]} />
              <p className="mt-6 text-[13px]" style={{ color: C.muted, lineHeight: 1.5 }}>Если сайт открыт внутри Telegram или Instagram, сначала нажми «Открыть в Safari» — во встроенных браузерах этого пункта нет.</p>
            </InstallCard>
            <InstallCard icon={Monitor} title="Компьютер">
              <Steps items={[[null, "Открой сайт в Chrome, Edge или Яндекс Браузере"], [Download, "Нажми значок установки в адресной строке"], [Check, "RITM откроется в отдельном окне"]]} />
              <div className="mt-6">
                {inst.canPrompt && !inst.android ? <Btn onClick={install} primary><Download size={17} /> Установить</Btn> : <Btn href="/app"><ArrowRight size={17} /> Открыть в браузере</Btn>}
              </div>
            </InstallCard>
          </div>
        </section>

        {/* 10. Вопросы */}
        <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-20">
          <SectionTitle kicker="Вопросы" title="Частые вопросы" />
          <div className="flex flex-col gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="surface rounded-[20px] group reveal">
                <summary className="px-6 py-5 flex items-center gap-4 font-semibold text-[16px]" style={{ minHeight: 56 }}>
                  <span className="flex-1">{q}</span>
                  <ChevronDown size={18} className="faq-chev flex-shrink-0 transition-transform" color={C.muted} />
                </summary>
                <p className="px-6 pb-5 -mt-1 text-[15px]" style={{ color: C.muted, lineHeight: 1.65 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 11. Призыв — лаймовый блок */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
          <div className="rounded-[32px] px-6 py-16 sm:py-20 text-center relative overflow-hidden reveal" style={{ background: C.a, color: C.on }}>
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: "radial-gradient(60% 90% at 50% 120%, rgba(56,224,200,0.55) 0%, rgba(0,0,0,0) 70%)" }} />
            <div className="relative">
              <Mark size={36} color={C.on} />
              <h2 className="display mt-6 mx-auto" style={{ fontSize: "clamp(52px, 8.5vw, 120px)", maxWidth: "12ch" }}>Найди свой ритм сегодня</h2>
              <p className="mt-5 mx-auto text-[18px]" style={{ maxWidth: 520, color: "rgba(10,11,13,.75)", lineHeight: 1.55 }}>Анкета на минуту — и у тебя готовы программа, беговой план и норма калорий.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Btn href="/app?start=1" dark big>Начать бесплатно <ArrowRight size={18} /></Btn>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: `1px solid ${C.line}`, background: C.surface }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark size={20} />
            <p className="mt-4 max-w-md text-[14px]" style={{ color: C.muted, lineHeight: 1.6 }}>Тренировки, питание, задачи и привычки в одном приложении. Сайт, Android, iPhone и Mini App в Telegram — один аккаунт.</p>
          </div>
          <nav className="flex flex-col gap-2.5 text-[14px]" aria-label="Разделы сайта">
            <div className="font-semibold mb-1 text-[13px]">Разделы</div>
            {[...nav, ["#install", "Установка"]].map(([href, label]) => <a key={href} href={href} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{label}</a>)}
          </nav>
          <nav className="flex flex-col gap-2.5 text-[14px]" aria-label="Документы">
            <div className="font-semibold mb-1 text-[13px]">Документы</div>
            {[[LEGAL_LINKS.offerUrl, "Публичная оферта"], [LEGAL_LINKS.termsUrl, "Пользовательское соглашение"], [LEGAL_LINKS.privacyUrl, "Политика конфиденциальности"], [LEGAL_LINKS.consentUrl, "Согласие на обработку данных"]].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{label}</a>
            ))}
            <a href={`mailto:${LEGAL_LINKS.email}`} className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>{LEGAL_LINKS.email}</a>
            <a href={LEGAL_LINKS.supportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" style={{ color: C.muted, textDecoration: "none" }}>Поддержка {LEGAL_LINKS.support}</a>
          </nav>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-[13px]" style={{ borderTop: `1px solid ${C.line}`, color: C.muted, lineHeight: 1.5 }}>
          Программа носит рекомендательный характер и не заменяет консультацию врача или тренера.
          <div className="mt-2">{LEGAL_LINKS.owner}, {LEGAL_LINKS.status}, ИНН {LEGAL_LINKS.inn}</div>
        </div>
      </footer>
    </div>
  );
}
