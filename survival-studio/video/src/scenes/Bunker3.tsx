import React from "react";
import { random } from "remotion";
import { Hero, HeroPose, NEUTRAL } from "../rig/Hero";
import { Dog, dogSit } from "../rig/Dog";
import { GroundShadow, RimDefs } from "../rig/shared";
import { SRYV } from "../style/palette";

/*
 * Сцены серии 3: двор днём после двух недель (серо, пыль, обломки), карта маршрута, миф про йод.
 * Земля y = 930 — персонажи выше субтитров.
 */
const FL = 930, S = 1.7;
const DUST = "#A9A093";

/** Двор днём. mode: exit — Артём вышел из подъезда, Луна рядом; look — стоит слева у огорода; knock — стучит в дверь соседей. */
export const DayYard: React.FC<{ frame: number; mode?: "exit" | "look" | "knock"; debrisMark?: number; gardenMark?: number; zoom?: number }> = ({
  frame, mode = "exit", debrisMark = 0, gardenMark = 0, zoom = 1,
}) => {
  const DOOR = 800;
  const idle: HeroPose = { ...NEUTRAL, torso: 1 + Math.sin(frame / 18), head: Math.sin(frame / 27) * 1.5, expr: { brow: -0.1, browTilt: 0.4, mouth: "flat", blink: frame % 80 < 3 ? 1 : 0 } };
  const knockPh = (frame % 16) / 16;
  const knock: HeroPose = { ...idle, armL: { sh: -112 + 10 * Math.sin(knockPh * Math.PI * 2), el: -40, wr: 0 } };
  const heroX = mode === "exit" ? 660 : mode === "look" ? 330 : 690;
  const flip = mode === "exit";
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimDay" side={-1} color="#F2EEE6" strength={0.6} width={4} />
      <defs><filter id="hazeBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={30} /></filter></defs>
      <g transform={`translate(540 ${FL}) scale(${zoom}) translate(-540 ${-FL})`}>
        {/* пасмурное небо в дымке */}
        <rect x={-300} y={-300} width={1680} height={FL + 300} fill="#7E7A75" />
        <ellipse cx={300} cy={300} rx={700} ry={200} fill="#9A958F" opacity={0.6} filter="url(#hazeBlur)" />
        {/* дальние дома */}
        {[[-40, 520, 180], [150, 600, 160], [300, 470, 150], [470, 560, 140]].map(([x, top, w], i) => (
          <g key={i}>
            <rect x={x} y={top} width={w} height={FL - top} fill="#6A6560" />
            {Array.from({ length: 5 }, (_, r) => <rect key={r} x={x + 24} y={top + 30 + r * 60} width={w - 48} height={26} fill="#57534F" />)}
          </g>
        ))}
        <rect x={-300} y={420} width={1680} height={FL - 420} fill="#8C877F" opacity={0.28} />
        {/* кирпичный дом с подъездом */}
        <rect x={600} y={240} width={520} height={FL - 240} fill="#6A4A40" />
        {Array.from({ length: 34 }, (_, r) => <line key={r} x1={600} x2={1120} y1={252 + r * 20} y2={252 + r * 20} stroke="#5A3D34" strokeWidth={3} />)}
        {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => (
          <g key={`${r}${c}`}>
            <rect x={640 + c * 150} y={280 + r * 130} width={80} height={80} fill="#2E2A28" stroke="#4A3530" strokeWidth={6} />
            {(r + c) % 3 === 0 && <path d={`M ${650 + c * 150} ${290 + r * 130} l 30 40 l 20 -20 l 20 50`} stroke="#8C877F" strokeWidth={3} fill="none" />}
          </g>
        )))}
        <rect x={600} y={232} width={520} height={10} fill={DUST} />
        <rect x={DOOR - 70} y={FL - 210} width={140} height={210} fill="#2E2A28" stroke="#4A3530" strokeWidth={8} />
        <rect x={DOOR - 90} y={FL - 230} width={180} height={20} fill="#4A3530" />
        <rect x={DOOR - 90} y={FL - 236} width={180} height={8} fill={DUST} />
        {/* земля в пыли */}
        <rect x={-300} y={FL} width={1680} height={1200} fill="#4E4A46" />
        <rect x={-300} y={FL} width={1680} height={14} fill={DUST} />
        {Array.from({ length: 40 }, (_, i) => <ellipse key={i} cx={random(`gd${i}`) * 1080} cy={FL + 30 + random(`gdy${i}`) * 120} rx={30 + random(`gdr${i}`) * 50} ry={6} fill={DUST} opacity={0.5} />)}
        {/* огород с ботвой в пыли */}
        <g>
          <rect x={20} y={FL - 30} width={230} height={30} fill="#5E4A36" />
          {[50, 100, 150, 200].map((x) => (
            <g key={x}>
              <path d={`M ${x} ${FL - 30} q -14 -40 -4 -64 M ${x} ${FL - 30} q 14 -36 20 -56 M ${x} ${FL - 30} q 0 -40 0 -70`} stroke="#6E7A4A" strokeWidth={7} fill="none" strokeLinecap="round" />
              <circle cx={x - 4} cy={FL - 94} r={5} fill={DUST} /><circle cx={x + 20} cy={FL - 86} r={5} fill={DUST} />
            </g>
          ))}
          {gardenMark > 0 && <g opacity={gardenMark} stroke={SRYV.fail} strokeWidth={12} strokeLinecap="round"><line x1={30} y1={FL - 120} x2={240} y2={FL + 10} /><line x1={240} y1={FL - 120} x2={30} y2={FL + 10} /></g>}
        </g>
        {/* бочка с открытой водой */}
        <g transform={`translate(${mode === "look" ? 520 : 290} ${FL})`}>
          <rect x={-40} y={-110} width={80} height={110} rx={8} fill="#3E5A6E" stroke="#2A3E4E" strokeWidth={4} />
          <ellipse cx={0} cy={-110} rx={40} ry={9} fill="#7FA6BD" />
          <ellipse cx={0} cy={-110} rx={30} ry={5} fill={DUST} opacity={0.7} />
          {gardenMark > 0 && <g opacity={gardenMark} stroke={SRYV.fail} strokeWidth={10} strokeLinecap="round"><line x1={-50} y1={-130} x2={50} y2={8} /><line x1={50} y1={-130} x2={-50} y2={8} /></g>}
        </g>
        {/* обломки и кучи пыли */}
        <g transform={`translate(${mode === "look" ? 760 : 470} ${FL})`}>
          <path d="M -90 0 L -60 -40 L -20 -52 L 10 -30 L 50 -58 L 90 0 Z" fill="#7A726A" />
          <path d="M -70 -20 L -40 -60 L -30 -24 Z M 20 -40 L 60 -80 L 66 -36 Z" fill="#5A534C" />
          <path d="M -90 0 Q 0 -30 90 0" fill={DUST} />
          {debrisMark > 0 && <ellipse cx={0} cy={-30} rx={120} ry={66} fill="none" stroke={SRYV.fail} strokeWidth={8} strokeDasharray="18 12" opacity={debrisMark} />}
        </g>
        {/* стук в дверь */}
        {mode === "knock" && knockPh < 0.35 && [0, 1].map((i) => (
          <path key={i} d={`M ${DOOR - 86 - i * 16} ${FL - 160} q -10 20 0 40`} stroke="#F2EEE6" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.9 - i * 0.3} />
        ))}
        {/* Артём и Луна */}
        <g transform={`translate(${heroX} ${FL}) scale(${flip ? -S : S} ${S})`}>
          <GroundShadow w={120} opacity={0.35} color="#000" />
          <Hero pose={mode === "knock" ? knock : idle} outfit="casual" rimFilter="rimDay" />
        </g>
        {mode !== "knock" && (
          <g transform={`translate(${mode === "exit" ? 540 : 470} ${FL}) scale(${mode === "exit" ? -1.7 : 1.7} 1.7)`}>
            <GroundShadow w={150} opacity={0.35} color="#000" />
            <Dog pose={dogSit(frame, 9, false)} rimFilter="rimDay" />
          </g>
        )}
      </g>
      {/* пыль в воздухе */}
      {Array.from({ length: 50 }, (_, i) => {
        const x = random(`ax${i}`) * 1080 + Math.sin(frame / 40 + i) * 20;
        const y = ((random(`ay${i}`) * 1900 + frame * 0.6) % 1900);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="#E4DED4" opacity={0.35} />;
      })}
    </svg>
  );
};

/** Карта маршрута: от подвала к пункту помощи в обход зоны пыли. */
export const RouteMap: React.FC<{ f: number; at: number; y?: number }> = ({ f, at, y = 300 }) => {
  const k = Math.min(1, Math.max(0, (f - at) / 8));
  const d = Math.min(1, Math.max(0, (f - at - 6) / 30));
  const route = "M 120 440 L 120 300 L 330 300 L 330 140 L 700 140 L 700 90";
  const LEN = 140 + 210 + 160 + 370 + 50;
  return (
    <div style={{ position: "absolute", left: 110, top: y, width: 860, height: 560, opacity: k, transform: `scale(${0.95 + 0.05 * k})`, borderRadius: 26,
      background: "#0E1118", border: "4px solid #3A4560", boxShadow: "0 10px 40px rgba(0,0,0,.5)", overflow: "hidden" }}>
      <svg width={860} height={560} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`${r}${c}`} x={30 + c * 170} y={30 + r * 135} width={120} height={90} rx={8} fill="#1A1F28" />))}
        <path d="M 430 200 L 640 230 L 700 400 L 470 470 Z" fill={SRYV.fail} opacity={0.22} />
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={440 + i * 30} y1={210} x2={400 + i * 30} y2={470} stroke={SRYV.fail} strokeWidth={3} opacity={0.35} />)}
        <path d={route} stroke={SRYV.progress} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${LEN * d} ${LEN}`} />
        <circle cx={120} cy={440} r={18} fill={SRYV.lamp} />
        <circle cx={700} cy={90} r={22} fill={SRYV.progress} opacity={d > 0.95 ? 1 : 0.3} />
        <path d="M 700 78 v 24 M 688 90 h 24" stroke="#0E1118" strokeWidth={6} />
      </svg>
      <div style={{ position: "absolute", left: 60, top: 476, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: SRYV.lamp }}>ПОДВАЛ</div>
      <div style={{ position: "absolute", left: 470, top: 340, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#FF8A80" }}>ПЫЛЬ</div>
      <div style={{ position: "absolute", left: 470, top: 40, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: SRYV.progress }}>ПУНКТ ПОМОЩИ</div>
    </div>
  );
};

/** Миф про йод: флакон йодной настойки — перечёркнут; таблетки йодистого калия и щитовидка. */
export const IodineCard: React.FC<{ f: number; xAt: number; kiAt: number; thyAt: number }> = ({ f, xAt, kiAt, thyAt }) => {
  const ap = (s: number, len = 8) => Math.min(1, Math.max(0, (f - s) / len));
  const kx = ap(xAt), kk = ap(kiAt), kt = ap(thyAt);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {/* флакон йода */}
      <g transform="translate(280 640)">
        <rect x={-34} y={-270} width={68} height={60} rx={8} fill="#3A2A20" />
        <path d="M -90 -200 Q -90 -220 -60 -220 L 60 -220 Q 90 -220 90 -200 L 90 60 Q 90 80 70 80 L -70 80 Q -90 80 -90 60 Z" fill="#6E3B1E" stroke="#3A1E0E" strokeWidth={6} />
        <rect x={-70} y={-130} width={140} height={120} rx={8} fill="#F2EEE6" />
        <text x={0} y={-62} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={46} fill="#3A1E0E">ЙОД</text>
        <text x={0} y={-24} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={26} fill="#6E3B1E">5%</text>
        <g opacity={kx} stroke={SRYV.fail} strokeWidth={18} strokeLinecap="round">
          <line x1={-130 * kx} y1={-260 * kx} x2={130 * kx} y2={100 * kx} />
          <line x1={130 * kx} y1={-260 * kx} x2={-130 * kx} y2={100 * kx} />
        </g>
      </g>
      {/* блистер йодистого калия */}
      <g transform="translate(780 560)" opacity={kk}>
        <rect x={-130} y={-150} width={260} height={220} rx={20} fill="#C9D2E0" stroke="#8A97AA" strokeWidth={5} />
        {[0, 1, 2].map((r) => [0, 1].map((c) => <circle key={`${r}${c}`} cx={-56 + c * 112} cy={-104 + r * 64} r={24} fill="#FFFFFF" stroke="#8A97AA" strokeWidth={4} />))}
        <text x={0} y={60} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={30} fill="#3A4560">KI</text>
      </g>
      {/* щитовидка */}
      <g transform="translate(780 860)" opacity={kt}>
        <path d="M 0 -10 C -20 -60 -110 -70 -110 0 C -110 60 -40 70 0 30 C 40 70 110 60 110 0 C 110 -70 20 -60 0 -10 Z" fill={SRYV.progress} opacity={0.85} />
        <rect x={-16} y={-40} width={32} height={80} rx={14} fill="#1F7A4A" opacity={0.6} />
        <text x={0} y={92} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={30} fill={SRYV.progress}>ЩИТОВИДКА</text>
      </g>
    </svg>
  );
};
