import React from "react";
import { AbsoluteFill } from "remotion";
import { useFonts } from "../../useFonts";
import { PodvalState, PodvalWorld } from "../../scenes/Podval";

/* Обложка 1080×1920 и превью 1280×720: подвал с жильцами + «ПОДВАЛ НА ВОСЬМЕРЫХ» + «15 МИНУТ ДО УДАРА». Правый низ свободен. */
const ST: PodvalState = { siren: 0.4, film: 1, tape: 1, bags: 1, oilcloth: 1, buckets: 1, pots: 1, bath: 1, radio: 1, zinaJar: true };
const ST2: PodvalState = { film: 1, tape: 1, bags: 1, oilcloth: 1, buckets: 1, pots: 1, bath: 1, toilet: 1, doorClosed: 1, power: 0, torches: 1, neighbor: 1, pipeGlow: 1, groundDust: 1 };
const EP = {
  1: { tag: "СЕРИЯ 1", l1: "ПОДВАЛ", l2: "НА ВОСЬМЕРЫХ", plate: "15 МИНУТ ДО УДАРА", st: ST, cam: { x: 960, y: 640, z: 0.82 }, tcam: { x: 1100, y: 900, z: 0.95 } },
  2: { tag: "СЕРИЯ 2 · ВЫ РЕШИЛИ", l1: "«ЗАКРЫТО»", l2: "А ЗА СТЕНОЙ — ДЕТИ", plate: "ДЕЛИМСЯ ВОДОЙ?", st: ST2, cam: { x: 120, y: 640, z: 0.85 }, tcam: { x: 60, y: 900, z: 0.95 } },
} as const;
const Title: React.FC<{ size: number; plate: number; align: "center" | "flex-start"; ep: 1 | 2 }> = ({ size, plate, align, ep }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: Math.round(size * 0.06) }}>
    <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: Math.round(size * 0.3), letterSpacing: 8, color: "#FF6B5E" }}>{EP[ep].tag}</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FFFFFF", textShadow: "0 4px 18px rgba(0,0,0,.8)" }}>{EP[ep].l1}</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FF3B30", textShadow: "0 0 18px rgba(255,59,48,.65), 0 0 40px rgba(255,59,48,.35)" }}>{EP[ep].l2}</div>
    <div style={{ marginTop: Math.round(size * 0.22), transform: "rotate(-2.5deg)", background: "#FFD43B", padding: `${Math.round(plate * 0.28)}px ${Math.round(plate * 0.4)}px`,
      borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: plate, lineHeight: 1, color: "#000", whiteSpace: "nowrap" }}>{EP[ep].plate}</div>
    </div>
  </div>
);
export const PodvalCover: React.FC<{ variant: "cover" | "thumb"; ep?: 1 | 2 }> = ({ variant, ep = 1 }) => {
  const e = EP[ep];
  useFonts();
  if (variant === "cover") return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      <PodvalWorld frame={40} cam={e.cam} st={e.st} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 980, height: 940, background: "linear-gradient(180deg, rgba(7,9,13,0) 0%, rgba(7,9,13,.85) 30%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1060, display: "flex", justifyContent: "center" }}><Title size={ep === 2 ? 82 : 124} plate={52} align="center" ep={ep} /></div>
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 300, top: -190, width: 1080, height: 1920, transform: "scale(0.92)", transformOrigin: "0 0" }}>
        <PodvalWorld frame={40} cam={e.tcam} st={e.st} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(7,9,13,.95) 0%, rgba(7,9,13,.7) 42%, rgba(7,9,13,0) 70%)" }} />
      <div style={{ position: "absolute", left: 64, top: 120 }}><Title size={ep === 2 ? 76 : 100} plate={44} align="flex-start" ep={ep} /></div>
    </AbsoluteFill>
  );
};
