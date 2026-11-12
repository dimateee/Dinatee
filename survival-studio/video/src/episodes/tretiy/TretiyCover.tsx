import React from "react";
import { AbsoluteFill } from "remotion";
import { useFonts } from "../../useFonts";
import { Calendar, SchemaBg } from "../propusk/parts";

/* Обложка 1080×1920 и превью 1280×720: календарь с треснувшим 3-м днём + крючок. ≤ 8 слов, правый низ свободен. */
const CELLS = [
  { state: "green" as const, at: 0 }, { state: "green" as const, at: 0 }, { state: "miss" as const, at: 0 },
  { state: "empty" as const, at: 0 }, { state: "empty" as const, at: 0 }, { state: "empty" as const, at: 0 }, { state: "empty" as const, at: 0 },
];
const Title: React.FC<{ size: number; plate: number; align: "center" | "flex-start" }> = ({ size, plate, align }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: Math.round(size * 0.06) }}>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FFFFFF", textShadow: "0 4px 18px rgba(0,0,0,.6)" }}>БРОСАЕШЬ</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FF3B30", textShadow: "0 0 18px rgba(255,59,48,.65), 0 0 40px rgba(255,59,48,.35)" }}>НА 3-Й ДЕНЬ?</div>
    <div style={{ marginTop: Math.round(size * 0.24), transform: "rotate(-2.5deg)", background: "#FFD43B", padding: `${Math.round(plate * 0.28)}px ${Math.round(plate * 0.4)}px`,
      borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: plate, lineHeight: 1, color: "#000", whiteSpace: "nowrap" }}>ДЕЛО НЕ В ЛЕНИ</div>
    </div>
  </div>
);

export const TretiyCover: React.FC<{ variant: "cover" | "thumb" }> = ({ variant }) => {
  useFonts();
  if (variant === "cover") return (
    <AbsoluteFill style={{ backgroundColor: "#0E1118" }}>
      <SchemaBg pal="S" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center" }}><Title size={118} plate={52} align="center" /></div>
      <Calendar f={100} pal="S" chainUpTo={2} cells={CELLS} y={960} size={130} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1118", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 64, top: 120 }}><Title size={96} plate={44} align="flex-start" /></div>
      <div style={{ position: "absolute", left: 790, top: 140, width: 1080, height: 1920, transform: "scale(0.42)", transformOrigin: "0 0" }}>
        <Calendar f={100} pal="S" chainUpTo={2} cells={CELLS.slice(0, 3)} y={420} size={260} labels />
      </div>
    </AbsoluteFill>
  );
};
