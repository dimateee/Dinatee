import React from "react";
import { AbsoluteFill } from "remotion";
import { useFonts } from "../../useFonts";
import { NightCity, Shelter } from "../../scenes/Bunker";
const Bg: React.FC<{ ep: number; thumb?: boolean }> = ({ ep, thumb }) => ep === 1
  ? <NightCity frame={60} boom={2.2} glow={0.6} zoom={thumb ? 1 : 1.05} />
  : ep === 2 ? <Shelter frame={40} radio={1} cam={{ x: thumb ? 460 : 470, y: thumb ? 760 : 980, z: thumb ? 1.1 : 1.25 }} />
  : <Shelter frame={40} radio={1} hero={false} standAtDoor doorOpen={1} cam={{ x: thumb ? 300 : 280, y: thumb ? 760 : 980, z: thumb ? 1.1 : 1.3 }} />;

/* Обложки серии «Бункер»: гриб над городом + крупный заголовок; ≤ 8 слов, правый низ свободен. */
const Title: React.FC<{ n: number; l1: string; l2: string; plate: string; size: number; ps: number; align: "center" | "flex-start" }> = ({ n, l1, l2, plate, size, ps, align }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: Math.round(size * 0.06) }}>
    <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: Math.round(size * 0.32), letterSpacing: 8, color: "#FF6B5E" }}>БУНКЕР · СЕРИЯ {n}</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FFFFFF", textShadow: "0 4px 18px rgba(0,0,0,.7)" }}>{l1}</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FF3B30", textShadow: "0 0 18px rgba(255,59,48,.65), 0 0 40px rgba(255,59,48,.35)" }}>{l2}</div>
    <div style={{ marginTop: Math.round(size * 0.22), transform: "rotate(-2.5deg)", background: "#FFD43B", padding: `${Math.round(ps * 0.28)}px ${Math.round(ps * 0.4)}px`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: ps, lineHeight: 1, color: "#000", whiteSpace: "nowrap" }}>{plate}</div>
    </div>
  </div>
);
export const BUNKER_COVERS = {
  1: { l1: "ПЕРВЫЕ", l2: "15 МИНУТ", plate: "5 ПРАВИЛ ВЫЖИВАНИЯ" },
  2: { l1: "ДВЕ НЕДЕЛИ", l2: "В ПОДВАЛЕ", plate: "НЕ ВЫХОДИ РАНЬШЕ" },
  3: { l1: "КОГДА МОЖНО", l2: "ВЫЙТИ", plate: "И МИФ ПРО ЙОД" },
} as const;
export const BunkerCover: React.FC<{ variant: "cover" | "thumb"; ep: 1 | 2 | 3 }> = ({ variant, ep }) => {
  useFonts();
  const c = BUNKER_COVERS[ep];
  if (variant === "cover") return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      <Bg ep={ep} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center" }}>
        <Title n={ep} l1={c.l1} l2={c.l2} plate={c.plate} size={128} ps={50} align="center" />
      </div>
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 470, top: -140, width: 1080, height: 1920, transform: "scale(0.75)", transformOrigin: "0 0" }}>
        <Bg ep={ep} thumb />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(7,9,13,.92) 0%, rgba(7,9,13,.6) 45%, rgba(7,9,13,0) 70%)" }} />
      <div style={{ position: "absolute", left: 64, top: 110 }}><Title n={ep} l1={c.l1} l2={c.l2} plate={c.plate} size={104} ps={42} align="flex-start" /></div>
    </AbsoluteFill>
  );
};

/* Финальная заставка серии: три обложки и «Подпишись». */
export const BunkerEndCard: React.FC<{ f: number }> = ({ f }) => {
  const k = (s: number) => Math.min(1, Math.max(0, (f - s) / 10));
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: k(0) }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, letterSpacing: 12, color: "#FF6B5E" }}>СЕРИАЛ</div>
        <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 150, lineHeight: 1, color: "#FFFFFF", letterSpacing: 6, textShadow: "0 0 30px rgba(255,59,48,.45)" }}>БУНКЕР</div>
      </div>
      {[1, 2, 3].map((ep, i) => (
        <div key={ep} style={{ position: "absolute", left: 60 + i * 330, top: 470, width: 300, height: 533, overflow: "hidden", borderRadius: 18,
          border: `4px solid ${ep === 3 ? "#FF3B30" : "#3A4560"}`, opacity: k(6 + i * 6), transform: `translateY(${Math.round((1 - k(6 + i * 6)) * 40)}px)` }}>
          <div style={{ width: 1080, height: 1920, transform: "scale(0.2778)", transformOrigin: "0 0" }}>
            <BunkerCover variant="cover" ep={ep as 1 | 2 | 3} />
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1060, display: "flex", justifyContent: "center", opacity: k(30) }}>
        <div style={{ transform: `rotate(-2deg) scale(${0.9 + 0.1 * k(30)})`, background: "#FFD43B", padding: "18px 40px", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          fontFamily: "Inter Display", fontWeight: 900, fontSize: 64, lineHeight: 1, color: "#000" }}>ПОДПИШИСЬ</div>
      </div>
    </AbsoluteFill>
  );
};
