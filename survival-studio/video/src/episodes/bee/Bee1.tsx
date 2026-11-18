import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/bee1.words.json";
import { useFonts } from "../../useFonts";
import { Bee, Bluebell, Burst, BZZ, Clover, Dandelion, GRISHA, Honeycomb, Jar, Puddle, QUEEN, Sky, SONYA, Tulip, WORKER, ZHUZH } from "../../scenes/Bee";
import { idxIn, merge, ramp, wordAt } from "../svet/shared";

/*
 * «Пчёлки». Серия 1 «Медовый переполох» — весёлый мульт (LESSONS Б30).
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const BEE1_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => { const out = WORDS.map((w) => ({ ...w })); merge(out, "шестьдесят", 2, "60 000"); merge(out, "двести", 1, "200"); return out; })();
const ACC: [string, number, "yellow" | "red"][] = [
  ["утра.", 1, "yellow"], ["пустые!»", 1, "red"], ["быстрый.", 1, "yellow"], ["обчистили.", 1, "red"], ["сад.", 1, "yellow"], ["клевера!»", 1, "yellow"],
  ["колокольчике.", 1, "red"], ["нектара.", 1, "yellow"], ["ложки!", 1, "red"], ["больше.", 1, "yellow"], ["тружениц!", 1, "yellow"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

const tQueen = W("королева"), tEmpty = W("пустые!»"), tSixty = W("шестьдесят"), tGasp = W("ахнули"), tTask = W("задание"), t200 = W("двести"),
  tTeam = W("он"), tGrisha = W("гриша"), tSonya = W("сонная"), tBzz = W("навигатор"), tDand = W("первый"), tEmpty2 = W("пусто:"), tTulip = W("второй"),
  tSnore = W("храпит"), tDance = W("и", 3), tThere = W("туда!"), tClover = W("клевера!»"), tCollect = W("пчёлы"), tStuck = W("гриша", 2), tPull = W("вся"),
  tPop = W("чпок!"), tLand = W("лужу"), tEve = W("к"), tKnow = W("знаешь,"), t12 = W("двенадцатую"), tAward = W("королева", 2), tBelt = W("грише"),
  tCta = W("ты", 2), tLike = W("лайк,"), tSub = W("подписывайся"), tNo = W("обижай");

type Scene = "hook" | "queen" | "crowd" | "zhuzh" | "team" | "dand" | "tulip" | "dance" | "collect" | "stuck" | "pull" | "evening" | "award" | "cta";
const SCENES: [number, Scene][] = [
  [0, "hook"], [tQueen - 0.1, "queen"], [tSixty - 0.1, "crowd"], [tTask - 0.1, "zhuzh"], [tTeam - 0.1, "team"], [tDand - 0.1, "dand"], [tTulip - 0.1, "tulip"],
  [tDance - 0.1, "dance"], [tCollect - 0.1, "collect"], [tStuck - 0.2, "stuck"], [tPull - 0.1, "pull"], [tEve - 0.1, "evening"], [tAward - 0.1, "award"], [tCta - 0.1, "cta"],
];
const sceneAt = (t: number) => { let cur: Scene = "hook", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };

const Title: React.FC<{ k: number; top?: number; size?: number; color?: string; children: React.ReactNode }> = ({ k, top = 320, size = 76, color = "#FFFFFF", children }) => k > 0 ? (
  <div style={{ position: "absolute", left: 40, right: 140, top, textAlign: "center", transform: `scale(${0.6 + 0.4 * Math.min(1, k * 1.5)}) rotate(-3deg)`, opacity: Math.min(1, k * 2),
    fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 1.0, color, WebkitTextStroke: "3px #2A1E14", textShadow: "0 6px 0 #2A1E14" }}>{children}</div>
) : null;

export const Bee1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const pop = (a: number) => Math.min(1, Math.max(0, (t - a) / 0.25));
  const wipe = Math.max(0, 1 - f / 0.12);
  const zoom = 1 + 0.03 * f;
  return (
    <AbsoluteFill style={{ backgroundColor: "#FFD86B", overflow: "hidden" }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(540 960) scale(${zoom}) translate(-540 -960)`}>
          {/* 1. Хук: улей, 6:00, будильник */}
          {s === "hook" && (<>
            <Honeycomb frame={frame} />
            <g transform={`translate(540 640) rotate(${Math.sin(frame * 1.5) * 6})`}>
              <circle r={190} fill="#FFFFFF" stroke="#E5484D" strokeWidth={22} />
              <text x={0} y={40} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={130} fill="#2A1E14">6:00</text>
              <circle cx={-130} cy={-170} r={50} fill="#E5484D" /><circle cx={130} cy={-170} r={50} fill="#E5484D" />
            </g>
            <Bee x={540} y={1020} s={1.5} look={ZHUZH} frame={frame} expr={t < 1.5 ? "sleep" : "wow"} wings={t < 1.5 ? 0 : 1} />
          </>)}
          {/* 2. Королева с рупором; пустые банки */}
          {s === "queen" && (<>
            <Honeycomb frame={frame} />
            <rect x={150} y={1150} width={780} height={60} rx={20} fill="#B86E0A" stroke="#2A1E14" strokeWidth={5} />
            <Bee x={460} y={1000} s={1.5} look={QUEEN} frame={frame} expr={t >= tEmpty - 0.3 ? "wow" : "grin"} hold="megaphone" armR={-40} />
            {[0, 1, 2].map((i) => <path key={i} d={`M 760 ${780 + i * 40} q 40 -20 80 0`} stroke="#FFFFFF" strokeWidth={8} fill="none" opacity={(Math.sin(frame / 3 + i) + 1) / 2} />)}
            {[0, 1, 2, 3].map((i) => <Jar key={i} x={240 + i * 200} y={1560} s={1} fill={0} shake={t >= tEmpty - 0.2 ? 1 : 0} frame={frame + i * 7} />)}
            <Burst x={540} y={1300} k={ramp(t, tEmpty, 0.8)} text="ПУСТО!" />
          </>)}
          {/* 3. 60 000 пчёл ахнули */}
          {s === "crowd" && (<>
            <Honeycomb frame={frame} dark={0.15} />
            {Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (
              <Bee key={`${r}${c}`} x={140 + c * 200 + (r % 2) * 90} y={620 + r * 230} s={0.62 + r * 0.06} look={WORKER} frame={frame + r * 11 + c * 7}
                expr={t >= tGasp - 0.1 ? "o" : "smile"} squash={t >= tGasp ? 0.3 : 0} tilt={t >= tGasp ? -8 : 0} />
            )))}
          </>)}
          {/* 4. Жужик — самый быстрый */}
          {s === "zhuzh" && (<>
            <Sky frame={frame} tone="dawn" />
            {Array.from({ length: 14 }, (_, i) => <rect key={i} x={((frame * 40 + i * 160) % 1400) - 300} y={500 + i * 70} width={260} height={10} rx={5} fill="#FFFFFF" opacity={0.6} />)}
            <Bee x={540} y={1000} s={2.2} look={ZHUZH} frame={frame} expr="grin" wings={3} tilt={-6} />
          </>)}
          {/* 5. Команда */}
          {s === "team" && (<>
            <Sky frame={frame} />
            <Bee x={190} y={1000} s={1.45} look={ZHUZH} frame={frame} expr="grin" />
            {t >= tGrisha - 0.3 && <Bee x={520} y={1000 - 80 * (1 - pop(tGrisha - 0.3))} s={1.45 * (0.5 + 0.5 * pop(tGrisha - 0.3))} look={GRISHA} frame={frame} expr="smile" />}
            {t >= tSonya - 0.3 && <Bee x={860} y={1030} s={1.45 * (0.5 + 0.5 * pop(tSonya - 0.3))} look={SONYA} frame={frame} expr="sleep" tilt={10} />}
            {t >= tSonya && [0, 1].map((i) => { const p = ((frame / 30 + i / 2) % 1); return <text key={i} x={820 + p * 60} y={920 - p * 120} fontFamily="Inter Display" fontWeight={900} fontSize={50} fill="#FFFFFF" stroke="#2A1E14" strokeWidth={3} paintOrder="stroke" opacity={1 - p}>Z</text>; })}
            {t >= tBzz - 0.3 && <Bee x={520 + Math.sin(frame / 4) * 40} y={1500} s={1.45 * (0.5 + 0.5 * pop(tBzz - 0.3))} look={BZZ} frame={frame} expr="grin" tilt={Math.sin(frame / 3) * 18} />}
          </>)}
          {/* 6. Одуванчик — пусто */}
          {s === "dand" && (<>
            <Sky frame={frame} />
            <Dandelion x={600} y={1560} s={1.6} frame={frame} blow={ramp(t, tEmpty2, 2)} />
            <Bee x={230} y={900} s={1.3} look={ZHUZH} frame={frame} expr={t >= tEmpty2 ? "worry" : "grin"} />
            <Bee x={300} y={1450} s={1.2} look={GRISHA} frame={frame} expr={t >= tEmpty2 ? "worry" : "smile"} />
            <Burst x={600} y={700} k={ramp(t, tEmpty2, 0.9)} text="ПУСТО" color="#C9D2E0" />
          </>)}
          {/* 7. Тюльпан с храпящим жуком */}
          {s === "tulip" && (<>
            <Sky frame={frame} />
            <Tulip x={560} y={1620} s={1.6} frame={frame} snore={t >= W("жук") - 0.2 ? 1 : 0} />
            <Bee x={200 - 60 * ramp(t, tSnore, 0.4)} y={900} s={1.3} look={ZHUZH} frame={frame} expr={t >= tSnore ? "o" : "smile"} />
            <Bee x={880 + 60 * ramp(t, tSnore, 0.4)} y={1000} s={1.3} look={SONYA} frame={frame} expr={t >= tSnore ? "wow" : "sleep"} flip />
          </>)}
          {/* 8. Танец-восьмёрка */}
          {s === "dance" && (t < tClover - 0.1 ? (<>
            <Sky frame={frame} />
            {(() => { const a = (t - tDance) * 3.2; const px = 540 + Math.sin(a) * 260, py = 1050 + Math.sin(a * 2) * 160;
              return <>
                <path d={Array.from({ length: 80 }, (_, i) => { const b = (i / 79) * Math.PI * 2; return `${i ? "L" : "M"} ${540 + Math.sin(b) * 260} ${1050 + Math.sin(b * 2) * 160}`; }).join(" ")}
                  stroke="#FFFFFF" strokeWidth={14} fill="none" strokeDasharray="22 18" strokeDashoffset={-frame * 4} opacity={0.85} />
                <Bee x={px} y={py} s={1.1} look={BZZ} frame={frame} expr="grin" tilt={Math.cos(a) * 25} />
              </>; })()}
            {t >= tThere && <path d="M 300 650 L 820 650 L 820 590 L 960 700 L 820 810 L 820 750 L 300 750 Z" fill="#E5484D" stroke="#2A1E14" strokeWidth={8} transform={`translate(${Math.sin(frame / 2) * 10} 0)`} />}
            <Burst x={560} y={480} k={ramp(t, tThere, 0.9)} text="ТУДА!" />
          </>) : (<>
            <Sky frame={frame} /><Clover frame={frame} n={60} />
          </>))}
          {/* 9. Сбор нектара со скоростью света */}
          {s === "collect" && (<>
            <Sky frame={frame} /><Clover frame={frame} n={60} />
            {[ZHUZH, BZZ, SONYA].map((L, i) => {
              const p = ((t * 1.6 + i * 0.33) % 1); const x = 100 + p * 880, y = 1350 + Math.sin(p * 12 + i) * 120 - i * 120;
              return <g key={i}>{[1, 2, 3].map((j) => <rect key={j} x={x - 60 - j * 70} y={y - 6 + j * 4} width={60} height={8} rx={4} fill="#FFFFFF" opacity={0.6 - j * 0.15} />)}
                <Bee x={x} y={y} s={1.05} look={L} frame={frame} expr="grin" hold="basket" fill={Math.min(1, (t - tCollect) / 2.5)} wings={3} /></g>;
            })}
            <Bee x={540} y={900} s={0.9} look={GRISHA} frame={frame} expr="grin" squash={0.2} />
          </>)}
          {/* 10. Гриша застрял в колокольчике */}
          {(s === "stuck" || (s === "pull" && t < tPop)) && (<>
            <Sky frame={frame} />
            <Bluebell x={400} y={1720} s={1.4} frame={frame} wiggle={1} stuck />
            {s === "pull" && [ZHUZH, BZZ, SONYA].map((L, i) => (
              <Bee key={i} x={700 + i * 140 + Math.sin(frame / 3) * 14} y={1450 + i * 40} s={1.0} look={L} frame={frame} expr="worry" tilt={-14 + Math.sin(frame / 3) * 6} flip />
            ))}
            {s === "pull" && <path d={`M 640 1240 Q 700 ${1260 + Math.sin(frame / 3) * 10} 980 1330`} stroke="#C98A3E" strokeWidth={10} fill="none" />}
            {s === "stuck" && <Burst x={600} y={560} k={ramp(t, W("застрял"), 0.9)} text="ЗАСТРЯЛ!" />}
          </>)}
          {/* 11. Чпок! — полёт в лужу нектара */}
          {s === "pull" && t >= tPop && (<>
            <Sky frame={frame} />
            <Puddle x={700} y={1640} k={t >= tLand ? Math.min(1, (t - tLand) / 0.3 + 0.5) : 0.6} frame={frame} />
            {(() => { const k = Math.min(1, (t - tPop) / (tLand - tPop)); const x = 320 + 380 * k, y = 900 - Math.sin(Math.PI * k) * 400 + 680 * k;
              return <Bee x={x} y={y} s={1.0} look={GRISHA} frame={frame} expr={t >= tLand ? "grin" : "wow"} tilt={k * 720} squash={t >= tLand ? 0.4 : 0} bob={false} />; })()}
            <Burst x={360} y={760} k={ramp(t, tPop, 0.9)} text="ЧПОК!" />
          </>)}
          {/* 12. Вечер: корзинки полные, факт 1/12 */}
          {s === "evening" && (<>
            <Sky frame={frame} tone="sunset" />
            {[ZHUZH, GRISHA, SONYA, BZZ].map((L, i) => <Bee key={i} x={160 + i * 250} y={1450 + Math.sin(i) * 60} s={1.05} look={L} frame={frame + i * 9} expr="grin" hold="basket" fill={1} />)}
            {t >= tKnow && <g transform={`translate(540 ${700 - 20 * Math.sin(frame / 8)}) scale(${0.6 + 0.4 * pop(tKnow)})`}>
              <rect x={-330} y={-200} width={660} height={360} rx={40} fill="#FFFFFF" stroke="#2A1E14" strokeWidth={8} />
              <ellipse cx={-120} cy={0} rx={110} ry={60} fill="#C9D2E0" stroke="#2A1E14" strokeWidth={6} /><rect x={-20} y={-12} width={190} height={24} rx={12} fill="#C9D2E0" stroke="#2A1E14" strokeWidth={6} />
              <path d="M -120 0 L -120 -60 A 110 60 0 0 1 -15 -18 Z" fill="#FFB81A" opacity={ramp(t, t12, 0.4)} />
              <text x={140} y={-80} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={110} fill="#E5484D" opacity={ramp(t, t12, 0.3)}>1/12</text>
              <text x={0} y={120} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={40} fill="#2A1E14">ЛОЖКИ ЗА ВСЮ ЖИЗНЬ</text>
            </g>}
          </>)}
          {/* 13. Награда */}
          {s === "award" && (<>
            <Honeycomb frame={frame} />
            <Bee x={680} y={1000} s={1.4} look={QUEEN} frame={frame} expr="grin" hold={t < tBelt ? "medal" : null} flip armR={-60} />
            <Bee x={300} y={1100} s={1.1} look={ZHUZH} frame={frame} expr="proud" hold={t >= W("соту,") ? "medal" : null} />
            {t >= tBelt && <Bee x={300} y={1500} s={1.0} look={GRISHA} frame={frame} expr="grin" squash={-0.1} />}
            <Burst x={720} y={1460} k={ramp(t, W("больше."), 0.9)} text="XXL" />
          </>)}
          {/* 14. Лайк и подписка */}
          {s === "cta" && (<>
            <Sky frame={frame} />
            {[ZHUZH, GRISHA, SONYA, BZZ].map((L, i) => <Bee key={i} x={160 + i * 250} y={1450 + Math.sin(frame / 5 + i) * 20} s={1.05} look={L} frame={frame + i * 9} expr="grin" armR={-140 + Math.sin(frame / 3 + i) * 30} />)}
            {t >= tLike && <g transform={`translate(540 760) scale(${(0.5 + 0.5 * pop(tLike)) * (1 + 0.06 * Math.sin(frame / 3))})`}>
              <path d="M 0 80 C -200 -40 -140 -200 0 -100 C 140 -200 200 -40 0 80 Z" fill="#E5484D" stroke="#2A1E14" strokeWidth={10} />
              <text x={0} y={-6} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={64} fill="#FFFFFF">ЛАЙК</text>
            </g>}
          </>)}
        </g>
      </svg>
      {/* надписи */}
      {s === "hook" && <Title k={ramp(t, 0.1, 0.3)} top={240} size={84}>ЧТО ТВОРИТСЯ<br />В УЛЬЕ В 6:00?</Title>}
      {s === "queen" && t < tEmpty - 0.3 && <Title k={ramp(t, W("через") - 0.1, 0.3)} top={300} size={60}>«МЕДОВЫЙ ПРАЗДНИК<br />ЧЕРЕЗ НЕДЕЛЮ!»</Title>}
      {s === "crowd" && <Title k={ramp(t, tSixty, 0.3)} top={280} size={120} color="#FFE066">60 000</Title>}
      {s === "zhuzh" && <Title k={ramp(t, W("жужик"), 0.3)} top={300} size={80} color="#FFE066">ЖУЖИК</Title>}
      {s === "zhuzh" && t >= t200 && <Title k={ramp(t, t200, 0.3)} top={1480} size={64}>200 ВЗМАХОВ/СЕК</Title>}
      {s === "team" && <div style={{ position: "absolute", left: 0, right: 0, top: 300 }}>
        {[["ЖУЖИК", 120, 0], ["ГРИША", 390, tGrisha], ["СОНЯ", 660, tSonya]].map(([n, x, a]) => t >= (a as number) && (
          <div key={n as string} style={{ position: "absolute", left: x as number, width: 180, textAlign: "center", padding: "8px 0", borderRadius: 16, background: "#FFFFFF", border: "5px solid #2A1E14",
            fontFamily: "Inter Display", fontWeight: 900, fontSize: 36, color: "#2A1E14", transform: `scale(${0.6 + 0.4 * pop(a as number)})` }}>{n}</div>
        ))}
        {t >= tBzz && <div style={{ position: "absolute", left: 390, top: 900, width: 180, textAlign: "center", padding: "8px 0", borderRadius: 16, background: "#FFFFFF", border: "5px solid #2A1E14",
          fontFamily: "Inter Display", fontWeight: 900, fontSize: 36, color: "#2A1E14", transform: `scale(${0.6 + 0.4 * pop(tBzz)})` }}>БЗЗ</div>}
      </div>}
      {s === "cta" && t >= tSub && <div style={{ position: "absolute", left: 190, width: 700, top: 1000, textAlign: "center", padding: "22px 0", borderRadius: 30, background: "#E5484D", border: "8px solid #2A1E14",
        fontFamily: "Inter Display", fontWeight: 900, fontSize: 64, color: "#FFFFFF", transform: `scale(${(0.6 + 0.4 * pop(tSub)) * (1 + 0.04 * Math.sin(frame / 2))})` }}>ПОДПИШИСЬ</div>}
      {s === "cta" && <Title k={ramp(t, tNo, 0.3)} top={300} size={58} color="#FFE066">НЕ ОБИЖАЙ<br />МАЛЕНЬКИХ ТРУЖЕНИЦ!</Title>}
      <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: 0.7 * wipe }} />
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#FFF4C2" />
      {withAudio && <Audio src={staticFile("audio/bee1_mix.wav")} />}
    </AbsoluteFill>
  );
};
