import React from "react";
import { AbsoluteFill } from "remotion";
import { useFonts } from "../../useFonts";
import { PodvalWorld } from "../../scenes/Podval";

/* Обложка 1080×1920 и превью 1280×720: подвал с жильцами + «ПОДВАЛ НА ВОСЬМЕРЫХ» + «15 МИНУТ ДО УДАРА». Правый низ свободен. */
const ST = { siren: 0.4, film: 1, tape: 1, bags: 1, oilcloth: 1, buckets: 1, pots: 1, bath: 1, radio: 1, zinaJar: true };
const Title: React.FC<{ size: number; plate: number; align: "center" | "flex-start" }> = ({ size, plate, align }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: Math.round(size * 0.06) }}>
    <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: Math.round(size * 0.3), letterSpacing: 8, color: "#FF6B5E" }}>СЕРИЯ 1</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FFFFFF", textShadow: "0 4px 18px rgba(0,0,0,.8)" }}>ПОДВАЛ</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FF3B30", textShadow: "0 0 18px rgba(255,59,48,.65), 0 0 40px rgba(255,59,48,.35)" }}>НА ВОСЬМЕРЫХ</div>
    <div style={{ marginTop: Math.round(size * 0.22), transform: "rotate(-2.5deg)", background: "#FFD43B", padding: `${Math.round(plate * 0.28)}px ${Math.round(plate * 0.4)}px`,
      borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: plate, lineHeight: 1, color: "#000", whiteSpace: "nowrap" }}>15 МИНУТ ДО УДАРА</div>
    </div>
  </div>
);
export const PodvalCover: React.FC<{ variant: "cover" | "thumb" }> = ({ variant }) => {
  useFonts();
  if (variant === "cover") return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      <PodvalWorld frame={40} cam={{ x: 960, y: 640, z: 0.82 }} st={ST} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 980, height: 940, background: "linear-gradient(180deg, rgba(7,9,13,0) 0%, rgba(7,9,13,.85) 30%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1060, display: "flex", justifyContent: "center" }}><Title size={124} plate={52} align="center" /></div>
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 300, top: -190, width: 1080, height: 1920, transform: "scale(0.92)", transformOrigin: "0 0" }}>
        <PodvalWorld frame={40} cam={{ x: 1100, y: 900, z: 0.95 }} st={ST} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(7,9,13,.95) 0%, rgba(7,9,13,.7) 42%, rgba(7,9,13,0) 70%)" }} />
      <div style={{ position: "absolute", left: 64, top: 120 }}><Title size={100} plate={44} align="flex-start" /></div>
    </AbsoluteFill>
  );
};
