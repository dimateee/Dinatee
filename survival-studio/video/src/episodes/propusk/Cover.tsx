import React from "react";
import { AbsoluteFill } from "remotion";
import { Hero } from "../../rig/Hero";
import { Bed } from "../../rig/props";
import { RimDefs } from "../../rig/shared";
import { SRYV } from "../../style/palette";
import { useFonts } from "../../useFonts";
import { POSES } from "../../rig/poses";

/*
 * Обложка (1080×1920) и превью (1280×720) по разделу ОБЛОЖКА:
 * герой крупно слева; фон — та же ночная сцена, справа размыт и затемнён;
 * текст справа: 2 строки белым, ключевое слово красным #FF3B30 со свечением,
 * жёлтая плашка #FFD43B с чёрным текстом, наклон 2–3°; ≤ 8 слов; правый нижний угол свободен.
 */
const pose = {
  ...POSES.sitDesk.pose,
  torso: 10, head: 16,
  armL: { sh: -40, el: -100, wr: 18 }, armR: { sh: -20, el: -40, wr: 0 },
  holdL: "phone" as const, phoneGlow: 1,
  expr: { brow: -0.2, browTilt: 1, mouth: "flat" as const, blink: 0 },
};

const Room: React.FC<{ w: number; h: number; floor: number }> = ({ w, h, floor }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0 }}>
    <rect width={w} height={floor} fill={SRYV.bg1} />
    <rect y={floor} width={w} height={h - floor} fill={SRYV.bg0} />
    {/* окно с ночным городом справа */}
    <rect x={w * 0.55} y={floor * 0.18} width={w * 0.36} height={floor * 0.5} fill={SRYV.bg0} stroke="#0A0D13" strokeWidth={14} />
    {Array.from({ length: 12 }, (_, i) => (
      <rect key={i} x={w * 0.57 + ((i * 53) % (w * 0.32))} y={floor * 0.4 + ((i * 37) % (floor * 0.24))} width={16} height={22} fill={SRYV.lamp} opacity={0.7} />
    ))}
    {/* полоска света из-под двери */}
    <rect x={w * 0.78} y={floor - 8} width={w * 0.22} height={8} fill={SRYV.lamp} />
  </svg>
);

const Glow: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => (
  <div style={{
    position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: "50%",
    background: `radial-gradient(circle, ${SRYV.screen}88 0%, ${SRYV.screen}00 70%)`, mixBlendMode: "screen",
  }} />
);

const Title: React.FC<{ x: number; y: number; w: number; size: number; plate: number }> = ({ x, y, w, size, plate }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: Math.round(size * 0.06) }}>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FFFFFF", textShadow: "0 4px 18px rgba(0,0,0,.6)" }}>ТЫ НЕ</div>
    <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 0.95, color: "#FF3B30", textShadow: "0 0 18px rgba(255,59,48,.65), 0 0 40px rgba(255,59,48,.35)" }}>ЛЕНИВЫЙ</div>
    <div style={{
      marginTop: Math.round(size * 0.22), transform: "rotate(-2.5deg)", transformOrigin: "0 50%",
      background: "#FFD43B", padding: `${Math.round(plate * 0.28)}px ${Math.round(plate * 0.4)}px`, borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,.4)",
    }}>
      <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: plate, lineHeight: 1, color: "#000000", whiteSpace: "nowrap" }}>1 ПРОПУСК ≠ КОНЕЦ</div>
    </div>
  </div>
);

export const Cover: React.FC<{ variant: "cover" | "thumb" }> = ({ variant }) => {
  useFonts();
  const W = variant === "cover" ? 1080 : 1280, H = variant === "cover" ? 1920 : 720;
  const floor = variant === "cover" ? 1360 : 640;
  const s = variant === "cover" ? 2.35 : 1.55; // масштаб героя
  const heroX = variant === "cover" ? 210 : 270;
  const scene = (
    <>
      <Room w={W} h={H} floor={floor} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RimDefs id="rimC" side={1} color={SRYV.screen} strength={0.9} width={4} />
        <g transform={`translate(${heroX - 40 * s} ${floor}) scale(${s})`}><Bed w={240} /></g>
        <g transform={`translate(${heroX} ${floor}) scale(${s})`}>
          <Hero pose={{ ...pose, y: -72 }} outfit="casual" rimFilter="rimC" />
        </g>
      </svg>
    </>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: SRYV.bg0, overflow: "hidden" }}>
      {scene}
      <div style={{ position: "absolute", inset: 0, background: "#26324D", mixBlendMode: "multiply", opacity: 0.45 }} />
      <Glow cx={heroX + 120 * s * 0.6} cy={floor - 200 * s} r={variant === "cover" ? 520 : 260} />
      {/* правая половина: та же сцена, заранее размытая копия + затемнение */}
      <div style={{ position: "absolute", left: W / 2, top: 0, width: W / 2, height: H, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -W / 2, top: 0, width: W, height: H, filter: "blur(18px)" }}>{scene}</div>
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,10,16,0.62)" }} />
      </div>
      {variant === "cover"
        ? <Title x={576} y={470} w={480} size={88} plate={38} />
        : <Title x={680} y={150} w={560} size={112} plate={46} />}
    </AbsoluteFill>
  );
};
