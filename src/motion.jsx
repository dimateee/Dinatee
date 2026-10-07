// Общие «живые» эффекты для лендинга и приложения: счётчики, появление при прокрутке,
// прогресс прокрутки блока. Без сторонних библиотек — только IntersectionObserver и requestAnimationFrame.
import { useEffect, useRef, useState } from "react";

export const reducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

// Срабатывает один раз, когда элемент впервые показался на экране
export function useInView(ref, { rootMargin = "0px 0px -10% 0px", threshold = 0.15 } = {}) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (!("IntersectionObserver" in window)) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin, threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, rootMargin, threshold]);
  return seen;
}

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Число «пробегает» от 0 до значения: первые доли секунды цифры мелькают, как табло, затем
// плавно доезжают до итога. Нечисловые значения показываются как есть.
export function CountUp({ value, duration = 1400, scramble = true, start = true, format }) {
  const str = String(value ?? "");
  const m = str.match(/^(\D*?)(-?\d(?:[\d\s]*\d)?(?:[.,]\d+)?)(.*)$/);
  const target = m ? parseFloat(m[2].replace(/\s/g, "").replace(",", ".")) : NaN;
  const decimals = m && /[.,](\d+)/.test(m[2]) ? m[2].split(/[.,]/)[1].length : 0;
  const ref = useRef(null);
  const inView = useInView(ref, { threshold: 0.3 });
  const [shown, setShown] = useState(null);
  const done = useRef(false);
  const cur = useRef(0);

  // Первый показ — «табло» от нуля; дальше, если значение меняется (например, +2,5 кг), цифры
  // коротко доезжают от старого числа к новому
  useEffect(() => {
    if (!m || !Number.isFinite(target) || !start || !inView) return undefined;
    if (reducedMotion()) { cur.current = target; setShown(target); return undefined; }
    const first = !done.current;
    done.current = true;
    const from = first ? 0 : cur.current;
    if (from === target) { setShown(target); return undefined; }
    const dur = first ? duration : Math.min(550, duration);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      let v = from + (target - from) * easeOutExpo(t);
      if (first && scramble && t < 0.28 && Math.abs(target) >= 10) v = Math.random() * Math.abs(target) * 1.2;
      if (t >= 1) v = target;
      cur.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, start, target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m || !Number.isFinite(target)) return <span ref={ref}>{str}</span>;
  // При отрисовке на сервере (готовый HTML для поисковиков) — сразу итоговое число, а не «0»
  const num = shown === null ? (typeof window === "undefined" ? target : 0) : shown;
  const fixed = decimals ? num.toFixed(decimals).replace(".", m[2].includes(",") ? "," : ".") : Math.round(num);
  const text = format ? format(num) : (Math.abs(target) >= 10000 ? Number(fixed).toLocaleString("ru-RU") : fixed);
  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }} aria-label={str}>
      <span aria-hidden="true">{m[1]}{text}{m[3]}</span>
    </span>
  );
}

// Прогресс прокрутки блока: 0 — верх блока у верха экрана, 1 — блок прокручен на `distance` пикселей
// (по умолчанию на высоту экрана). Значение кладётся CSS-переменной --p на сам блок —
// так анимация идёт без перерисовки React на каждый кадр.
export function useScrollVar(ref, { distance, varName = "--p" } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reducedMotion()) { el.style.setProperty(varName, "0"); return undefined; }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const d = distance || window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / d));
      el.style.setProperty(varName, p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [ref, distance, varName]);
}

// Появление при прокрутке для элементов, которые уже есть в разметке: всё, что ниже первого экрана,
// прячется и проявляется из размытия, когда до него доходит прокрутка. То, что видно сразу, не трогаем.
let sharedIO = null;
function getIO() {
  if (sharedIO || typeof window === "undefined" || !("IntersectionObserver" in window)) return sharedIO;
  sharedIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("ritm-rv-in"); sharedIO.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  return sharedIO;
}
export function observeReveal(el) {
  if (!el || reducedMotion()) return () => {};
  const io = getIO();
  if (!io) return () => {};
  const r = el.getBoundingClientRect();
  const below = r.top > window.innerHeight || r.left > window.innerWidth;
  if (!below) return () => {};
  el.classList.add("ritm-rv");
  io.observe(el);
  return () => io.unobserve(el);
}
