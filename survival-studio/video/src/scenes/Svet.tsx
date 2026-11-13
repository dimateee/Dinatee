import React from "react";
import { random } from "remotion";
import { ARTYOM, Hero, heroHandL, HeroPose, NEUTRAL } from "../rig/Hero";
import { Dog, dogSit } from "../rig/Dog";
import { POSES } from "../rig/poses";
import { GroundShadow, RimDefs } from "../rig/shared";
import { SRYV } from "../style/palette";
import { LOOKS } from "./Podval";

/*
 * «Оно идёт на свет». Ночь, весь город без света. Сцены:
 *  CityBlackout — горизонт, окна гаснут волной;  WindowView — окно квартиры, дом напротив;
 *  Tower — дом в разрезе: 5 этажей, слева квартиры, справа подъезд; 5-й этаж — Артём и Луна, 4-й — соседка с ребёнком.
 *  PhoneUI — крупно телефон (оповещение / сообщение).
 */
const NIGHT = "#06080D";

/* ---------------- Город гаснет ---------------- */
export const CityBlackout: React.FC<{ frame: number; off: number; zoom?: number }> = ({ frame, off, zoom = 1 }) => {
  // off 0..1 — волна отключения слева направо
  const B = [[-40, 700, 170], [120, 560, 150], [260, 760, 200], [450, 480, 140], [580, 640, 170], [740, 520, 160], [890, 690, 210]];
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(540 1100) scale(${zoom}) translate(-540 -1100)`}>
        <rect x={-200} y={-200} width={1480} height={2400} fill={NIGHT} />
        {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={random(`st${i}`) * 1080} cy={random(`sty${i}`) * 600} r={1.6} fill="#C9D2E0" opacity={0.25 + 0.5 * random(`sto${i}`)} />)}
        <circle cx={820} cy={300} r={46} fill="#C9D2E0" opacity={0.18} />
        {B.map(([x, top, w], i) => (
          <g key={i}>
            <rect x={x} y={top} width={w} height={1300 - top} fill="#0E121A" />
            {Array.from({ length: 14 }, (_, r) => Array.from({ length: 4 }, (_, c) => {
              const wx = x + 16 + c * ((w - 32) / 4), wy = top + 26 + r * 44;
              const lit = random(`cw${i}-${r}-${c}`) < 0.6;
              const offAt = (wx + 40) / 1200 + (random(`co${i}${r}${c}`) - 0.5) * 0.12;
              return lit && off < offAt ? <rect key={`${r}${c}`} x={wx} y={wy} width={18} height={24} fill={SRYV.lamp} opacity={0.8} /> : null;
            }))}
          </g>
        ))}
        <rect x={-200} y={1300} width={1480} height={900} fill="#05070B" />
        {/* фонари на улице тоже гаснут */}
        {[100, 400, 700, 1000].map((x, i) => (
          <g key={x}>
            <rect x={x - 4} y={1150} width={8} height={150} fill="#1A1F28" />
            {off < (x + 40) / 1200 && <circle cx={x} cy={1146} r={60} fill={SRYV.lamp} opacity={0.18} />}
            {off < (x + 40) / 1200 && <circle cx={x} cy={1146} r={10} fill="#FFE2A8" />}
          </g>
        ))}
      </g>
    </svg>
  );
};

/* ---------------- Окно и дом напротив ---------------- */
export const WindowView: React.FC<{ frame: number; flash?: number; curtains?: number; zoom?: number; lunaGrowl?: number; hero?: boolean }> = ({
  frame, flash = 0, curtains = 0, zoom = 1, lunaGrowl = 0, hero = true,
}) => {
  const WX = 180, WY = 300, WW = 720, WH = 760;
  const cur = Math.min(1, curtains);
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimWin" side={1} color="#7F95B8" strength={0.7} width={4} />
      <defs><clipPath id="winC"><rect x={WX} y={WY} width={WW} height={WH} /></clipPath>
        <radialGradient id="flashG"><stop offset="0" stopColor="#FFF3D6" stopOpacity={0.9} /><stop offset="1" stopColor="#FFF3D6" stopOpacity={0} /></radialGradient></defs>
      <g transform={`translate(540 1000) scale(${zoom}) translate(-540 -1000)`}>
        <rect x={-200} y={-200} width={1480} height={2400} fill="#0B0E14" />
        {/* дом напротив за окном */}
        <g clipPath="url(#winC)">
          <rect x={WX} y={WY} width={WW} height={WH} fill={NIGHT} />
          <rect x={WX + 60} y={WY + 120} width={WW - 120} height={WH} fill="#121722" />
          {Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
            const x = WX + 100 + c * 110, y = WY + 160 + r * 110;
            const target = r === 2 && c === 3;
            return (
              <g key={`${r}${c}`}>
                <rect x={x} y={y} width={60} height={70} fill="#0A0D13" stroke="#1C2230" strokeWidth={4} />
                {target && flash > 0 && <>
                  <rect x={x} y={y} width={60} height={70} fill="#FFE9B0" opacity={0.85 * flash} />
                  <circle cx={x + 30} cy={y + 35} r={70} fill="url(#flashG)" opacity={flash} />
                </>}
              </g>
            );
          }))}
        </g>
        {/* рама */}
        <rect x={WX} y={WY} width={WW} height={WH} fill="none" stroke="#1A1F28" strokeWidth={24} />
        <line x1={WX + WW / 2} x2={WX + WW / 2} y1={WY} y2={WY + WH} stroke="#1A1F28" strokeWidth={16} />
        <rect x={WX - 30} y={WY + WH} width={WW + 60} height={26} fill="#1A1F28" />
        {/* шторы — съезжаются */}
        <rect x={WX - 60} y={WY - 40} width={(WW / 2 + 60) * (0.18 + 0.82 * cur)} height={WH + 80} fill="#3A2E4A" opacity={0.96} />
        <rect x={WX + WW + 60 - (WW / 2 + 60) * (0.18 + 0.82 * cur)} y={WY - 40} width={(WW / 2 + 60) * (0.18 + 0.82 * cur)} height={WH + 80} fill="#3A2E4A" opacity={0.96} />
        <rect x={WX - 80} y={WY - 50} width={WW + 160} height={16} rx={6} fill="#2B3241" />
        {/* Артём и Луна у окна (силуэты) */}
        {hero && (
          <g transform="translate(330 1460) scale(1.9)">
            <Hero pose={{ ...NEUTRAL, torso: 2 + Math.sin(frame / 18), head: -6, armL: { sh: -58, el: -84, wr: 0 }, holdL: "phone", phoneGlow: 0.2,
              expr: { brow: -0.2, browTilt: 0.8, mouth: "flat", blink: frame % 90 < 3 ? 1 : 0 } }} look={ARTYOM} rimFilter="rimWin" />
          </g>
        )}
        <g transform={`translate(760 1460) scale(-2.1 2.1)`}>
          <Dog pose={{ ...dogSit(frame, 3, false), head: lunaGrowl > 0 ? 6 + Math.sin(frame / 2) * 2 : 0, earL: lunaGrowl > 0 ? -18 : 0, earR: lunaGrowl > 0 ? -18 : 0 }} rimFilter="rimWin" />
        </g>
        <rect x={-200} y={1460} width={1480} height={600} fill="#07090D" />
      </g>
    </svg>
  );
};

/* ---------------- Дом в разрезе ---------------- */
export const FH = 300;              // высота этажа (мир)
export const floorY = (n: number) => 1500 - (n - 1) * FH; // низ этажа n
const S = 0.8;
export type TowerState = {
  dim?: number;          // яркость экрана телефона 0..1
  towel?: number;        // полотенце под дверью 0..1
  curtains?: number;     // шторы 0..1
  torch?: number;        // фонарик 0..1 (вниз, прикрыт ладонью)
  lunaGrowl?: number;
  steps?: number;        // шаги по лестнице: 0 — нет, 1..5 — этаж (дробное — между)
  feet?: number;         // ноги у двери 5-го этажа
  childCry?: number;     // плач ребёнка на 4-м
  heroPose?: "phone" | "kneel" | "torch" | "stand" | "freeze";
};
export type Cam = { x: number; y: number; z: number };
export const lerpCam = (a: Cam, b: Cam, k: number): Cam => { const e = Math.min(1, Math.max(0, k)); const s = e * e * (3 - 2 * e); return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: a.z + (b.z - a.z) * s }; };
export const towerScreen = (cam: Cam, x: number, y: number) => ({ x: 540 + (x - cam.x) * cam.z, y: 760 + (y - cam.y) * cam.z });

const Flat: React.FC<{ n: number; dark?: boolean; children?: React.ReactNode }> = ({ n, dark = true, children }) => {
  const y = floorY(n);
  return (
    <g>
      <rect x={40} y={y - FH} width={760} height={FH} fill={dark ? "#10141C" : "#161B26"} />
      <rect x={40} y={y - 12} width={760} height={12} fill="#0A0D13" />
      {/* окно слева */}
      <rect x={70} y={y - FH + 50} width={150} height={170} fill={NIGHT} stroke="#1A1F28" strokeWidth={10} />
      {children}
    </g>
  );
};

export const Tower: React.FC<{ frame: number; cam: Cam; st: TowerState }> = ({ frame, cam, st }) => {
  const s = (v?: number) => v ?? 0;
  const T = `translate(540 760) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  const y5 = floorY(5), y4 = floorY(4);
  // поза Артёма
  const base: HeroPose = { ...NEUTRAL, torso: 2 + Math.sin(frame / 18), head: 2 * Math.sin(frame / 27), expr: { brow: -0.2, browTilt: 0.8, mouth: "flat", blink: frame % 90 < 3 ? 1 : 0 } };
  const pose: HeroPose =
    st.heroPose === "phone" ? { ...base, head: 14, armL: { sh: -58, el: -84, wr: 0 }, holdL: "phone", phoneGlow: 0.2 + 0.8 * s(st.dim) } :
    st.heroPose === "kneel" ? { ...POSES.laces.pose, expr: base.expr } :
    st.heroPose === "torch" ? { ...base, head: 20, armL: { sh: -40, el: -20, wr: 0 }, armR: { sh: -50, el: -30, wr: 0 } } :
    st.heroPose === "freeze" ? { ...base, torso: -2, head: -4, expr: { brow: 0.6, browTilt: 1, mouth: "o", blink: 0 } } : base;
  const heroX = st.heroPose === "kneel" ? 690 : 520;
  const hand = heroHandL(pose);
  const torchAt = { x: heroX + hand.x * S, y: y5 + hand.y * S };
  // шаги: позиция на лестнице
  const stepFloor = s(st.steps);
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimT" side={-1} color="#7F95B8" strength={0.7} width={4} />
      <defs><linearGradient id="torchB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF3D0" stopOpacity={0.55} /><stop offset="1" stopColor="#FFF3D0" stopOpacity={0} /></linearGradient></defs>
      <g transform={T}>
        <rect x={-600} y={-1200} width={2400} height={3400} fill={NIGHT} />
        {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={-600 + random(`ts${i}`) * 2400} cy={-1200 + random(`tsy${i}`) * 1000} r={1.6} fill="#C9D2E0" opacity={0.4} />)}
        {/* корпус дома */}
        <rect x={20} y={floorY(5) - FH - 20} width={1160} height={5 * FH + 40} fill="#1A1F28" />
        {[1, 2, 3].map((n) => (
          <Flat key={n} n={n}>
            <rect x={300} y={floorY(n) - 90} width={160} height={78} fill="#161B26" />
            <rect x={560} y={floorY(n) - 150} width={120} height={138} fill="#141822" />
          </Flat>
        ))}
        {/* 4-й этаж: соседка с ребёнком */}
        <Flat n={4}>
          <rect x={300} y={y4 - 80} width={220} height={68} rx={8} fill="#1E2535" />
          <g transform={`translate(420 ${y4 - 12}) scale(${S})`}>
            <GroundShadow w={120} opacity={0.4} color="#000" />
            <Hero pose={{ ...NEUTRAL, torso: 10, head: 18, armL: { sh: -40, el: -70, wr: 0 }, holdL: "phone", phoneGlow: 0.3,
              expr: { brow: -0.3, browTilt: 1, mouth: "sad", blink: frame % 80 < 3 ? 1 : 0 } }} look={LOOKS.guest} rimFilter="rimT" />
          </g>
          <g transform={`translate(330 ${y4 - 12}) scale(${S * 0.68})`}>
            <Hero pose={{ ...NEUTRAL, torso: 6 + 3 * Math.sin(frame / 4) * s(st.childCry), head: 10,
              expr: { brow: -0.6, browTilt: 1, mouth: s(st.childCry) > 0 ? "open" : "sad", blink: s(st.childCry) > 0 ? 1 : 0 } }} look={LOOKS.kidA} rimFilter="rimT" />
          </g>
        </Flat>
        {/* 5-й этаж: Артём и Луна */}
        <Flat n={5} dark={false}>
          {/* шторы на окне */}
          <rect x={60} y={y5 - FH + 40} width={(170 / 2) * (0.25 + 0.75 * s(st.curtains))} height={190} fill="#3A2E4A" />
          <rect x={230 - (170 / 2) * (0.25 + 0.75 * s(st.curtains))} y={y5 - FH + 40} width={(170 / 2) * (0.25 + 0.75 * s(st.curtains))} height={190} fill="#3A2E4A" />
          {/* кровать */}
          <rect x={250} y={y5 - 70} width={200} height={58} rx={8} fill="#2B3241" />
          <rect x={250} y={y5 - 90} width={60} height={24} rx={8} fill="#C9D2E0" opacity={0.5} />
          {/* дверь на площадку */}
          <rect x={760} y={y5 - 230} width={40} height={218} fill="#2B3241" stroke="#0A0D13" strokeWidth={4} />
          {s(st.towel) > 0 && <rect x={724} y={y5 - 26} width={76 * s(st.towel)} height={14} rx={6} fill="#C0567A" />}
          <g transform={`translate(${heroX} ${y5 - 12}) scale(${S})`}>
            <GroundShadow w={120} opacity={0.4} color="#000" />
            <Hero pose={pose} look={ARTYOM} rimFilter="rimT" />
          </g>
          <g transform={`translate(${s(st.lunaGrowl) > 0 ? 200 : 620} ${y5 - 12}) scale(${s(st.lunaGrowl) > 0 ? -0.9 : 0.9} 0.9)`}>
            <GroundShadow w={150} opacity={0.4} color="#000" />
            <Dog pose={{ ...dogSit(frame, 3, false), earL: s(st.lunaGrowl) > 0 ? -20 : 0, earR: s(st.lunaGrowl) > 0 ? -20 : 0 }} rimFilter="rimT" />
          </g>
        </Flat>
        {/* подъезд: пролёты-зигзаг и номера этажей */}
        <rect x={800} y={floorY(5) - FH} width={380} height={5 * FH} fill="#0D1118" />
        {[1, 2, 3, 4, 5].map((n) => {
          const y = floorY(n);
          const lit = stepFloor > 0 && Math.abs(stepFloor - n) < 0.5;
          return (
            <g key={n}>
              <rect x={800} y={y - 12} width={380} height={12} fill="#1A1F28" />
              {n < 5 && <path d={`M 840 ${y - 12} L 1140 ${y - 12 - FH / 2} L 1140 ${y - 4 - FH / 2} L 840 ${y - 4} Z`} fill="#1E2430" />}
              {n < 5 && <path d={`M 1140 ${y - 12 - FH / 2} L 840 ${y - 12 - FH} L 840 ${y - 4 - FH} L 1140 ${y - 4 - FH / 2} Z`} fill="#1E2430" />}
              <rect x={1100} y={y - 210} width={52} height={52} rx={6} fill={lit ? "#E8C547" : "#1A1F28"} opacity={lit ? 0.9 : 1} />
              <text x={1126} y={y - 172} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={34} fill={lit ? "#0A0D13" : "#3A4560"}>{n}</text>
            </g>
          );
        })}
        {/* шаги: светящиеся следы, поднимаются */}
        {stepFloor > 0 && Array.from({ length: 6 }, (_, k) => {
          const ph = stepFloor - k * 0.12;
          if (ph < 1) return null;
          const fy = floorY(Math.floor(ph)) - (ph % 1) * FH;
          const fx = (ph % 1) < 0.5 ? 840 + (ph % 1) * 2 * 300 : 1140 - ((ph % 1) - 0.5) * 2 * 300;
          return <ellipse key={k} cx={fx + (k % 2 ? 10 : -10)} cy={fy - 16} rx={12} ry={6} fill="#C9D2E0" opacity={0.6 * (1 - k / 6)} />;
        })}
        {/* ноги у двери — силуэт за дверью на площадке */}
        {s(st.feet) > 0 && (
          <g opacity={s(st.feet)}>
            <rect x={812} y={y5 - 120} width={22} height={108} rx={8} fill="#05070B" />
            <rect x={838} y={y5 - 120} width={22} height={108} rx={8} fill="#05070B" />
            <rect x={804} y={y5 - 22} width={34} height={12} rx={4} fill="#05070B" />
            <rect x={834} y={y5 - 22} width={34} height={12} rx={4} fill="#05070B" />
          </g>
        )}
        <rect x={20} y={floorY(1)} width={1160} height={600} fill="#07090D" />
      </g>
      {/* фонарик: вниз, ладонью прикрыт */}
      {s(st.torch) > 0 && (() => {
        const p = towerScreen(cam, torchAt.x, torchAt.y);
        const z = cam.z;
        return <path d={`M ${p.x} ${p.y} L ${p.x - 40 * z} ${p.y + 120 * z} L ${p.x + 40 * z} ${p.y + 120 * z} Z`} fill="url(#torchB)" opacity={0.6 * s(st.torch)} />;
      })()}
    </svg>
  );
};

/* ---------------- Телефон крупно ---------------- */
export const PhoneUI: React.FC<{ mode: "alert" | "neighbor" | "brightness"; k: number; battery: number; bright?: number; time: string }> = ({ mode, k, battery, bright = 1, time }) => (
  <div style={{ position: "absolute", left: 250, top: 330, width: 580, height: 980, opacity: k, transform: `translateY(${Math.round((1 - k) * 60)}px)`,
    borderRadius: 64, background: "#0B0D12", border: "14px solid #1E222B", boxShadow: "0 30px 80px rgba(0,0,0,.7)", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, background: mode === "alert" ? "#2A0C10" : "#10141C", opacity: 0.25 + 0.75 * bright }} />
    <div style={{ position: "absolute", left: 40, right: 40, top: 26, display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#C9D2E0", opacity: 0.4 + 0.6 * bright }}>
      <span>{time}</span><span>{battery}%</span>
    </div>
    {mode === "alert" && (
      <div style={{ position: "absolute", left: 30, right: 30, top: 160, padding: "28px 30px", borderRadius: 26, background: `rgba(229,57,53,${0.25 + 0.6 * bright})`, border: "3px solid #FF6B5E" }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 26, letterSpacing: 3, color: "#FFD2CC" }}>ЭКСТРЕННОЕ ОПОВЕЩЕНИЕ</div>
        <div style={{ marginTop: 18, fontFamily: "Inter Display", fontWeight: 900, fontSize: 52, lineHeight: 1.05, color: "#FFFFFF" }}>Не включайте свет.<br />Оно идёт на свет.</div>
      </div>
    )}
    {mode === "neighbor" && (
      <div style={{ position: "absolute", left: 30, right: 30, top: 180, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 26, color: "#9AA6BA" }}>Соседка · 4 этаж</div>
        <div style={{ padding: "24px 28px", borderRadius: "28px 28px 28px 8px", background: "#2B3241", fontFamily: "Inter Display", fontWeight: 900, fontSize: 46, lineHeight: 1.1, color: "#FFFFFF" }}>
          Ребёнок плачет.<br />Можно я зажгу свечу?</div>
      </div>
    )}
    {mode === "brightness" && (
      <div style={{ position: "absolute", left: 50, right: 50, top: 220, display: "flex", flexDirection: "column", gap: 26, alignItems: "center" }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#C9D2E0", letterSpacing: 3 }}>ЯРКОСТЬ</div>
        <div style={{ width: "100%", height: 34, borderRadius: 17, background: "#2B3241", overflow: "hidden" }}>
          <div style={{ width: `${Math.round(100 * bright)}%`, height: "100%", background: "#E8C547" }} />
        </div>
        <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 90, color: "#FFFFFF" }}>{Math.round(100 * bright)}%</div>
      </div>
    )}
  </div>
);
