import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Film } from "./Film";
import { ChapterTitle, SeriesTitle, ToBeContinued } from "./Inserts";
import { useFonts } from "../useFonts";
import { ARTYOM_AUTUMN, Outfit, Person, Pose2 } from "../rig2/Person";
import { Collie } from "../rig2/Collie";
import { DogPose } from "../rig/Dog";

/*
 * Движок эпизода серии «66 ДНЕЙ». Время планов задаётся по голосу (секунды voice_final.wav);
 * после холодного открытия (до coldEnd) вставляется титул 3 с, в конце — хвост «Продолжение следует».
 * Переходы: "black" — затемнение через чёрное (между главами), "dissolve" — наплыв 0,6 с, "cut" — склейка.
 */
export const FPS = 30;
export const TITLE_SEC = 3;
export const TAIL_SEC = 4;

export type Ctx = { f: number; dur: number; lf: (voiceSec: number) => number; frame: number };
export type ShotDef = {
  from: number; to: number; // секунды голоса
  chapter?: string; enter?: "cut" | "dissolve" | "black"; exitBlack?: boolean;
  render: (c: Ctx) => React.ReactNode;
};
export type EpisodeDef = { id: string; title: string; sub: string; coldEnd: number; voiceEnd: number; audio: string; shots: ShotDef[] };

/** Перевод времени голоса во время эпизода (секунды). */
export const epSec = (ep: EpisodeDef, t: number) => (t >= ep.coldEnd - 1e-6 ? t + TITLE_SEC : t);
export const epFrames = (ep: EpisodeDef) => Math.round((ep.voiceEnd + TITLE_SEC + TAIL_SEC) * FPS);
const DISSOLVE = 18, BLACK = 18;

const ShotView: React.FC<{ ep: EpisodeDef; s: ShotDef; start: number; dur: number; lead: number }> = ({ ep, s, start, dur, lead }) => {
  const fr = useCurrentFrame(); // кадр внутри Sequence (с учётом наплыва lead)
  const f = fr - lead;
  const lf = (t: number) => Math.round(epSec(ep, t) * FPS) - start;
  const fadeIn = s.enter === "dissolve" ? interpolate(fr, [0, DISSOLVE], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const blackIn = s.enter === "black" ? interpolate(f, [0, BLACK], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const blackOut = s.exitBlack ? interpolate(f, [dur - BLACK, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      {s.render({ f, dur, lf, frame: start + f })}
      {s.chapter && <ChapterTitle f={f - 8} text={s.chapter} />}
      <AbsoluteFill style={{ background: "#000", opacity: Math.max(blackIn, blackOut) }} />
    </AbsoluteFill>
  );
};

export const EpisodeView: React.FC<{ ep: EpisodeDef; withAudio?: boolean }> = ({ ep, withAudio = true }) => {
  useFonts();
  const total = epFrames(ep);
  const titleFrom = Math.round(ep.coldEnd * FPS), titleDur = TITLE_SEC * FPS;
  const tailFrom = Math.round((ep.voiceEnd + TITLE_SEC) * FPS);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Film>
        <AbsoluteFill>
          {ep.shots.map((s, i) => {
            const start = Math.round(epSec(ep, s.from) * FPS);
            const last = i === ep.shots.length - 1;
            const end = last ? total : Math.round(epSec(ep, s.to) * FPS);
            const lead = s.enter === "dissolve" ? DISSOLVE : 0;
            return (
              <Sequence key={i} from={start - lead} durationInFrames={end - start + lead} name={`План ${i + 1}${s.chapter ? " · " + s.chapter : ""}`}>
                <ShotView ep={ep} s={s} start={start} dur={end - start} lead={lead} />
              </Sequence>
            );
          })}
          <Sequence from={tailFrom} durationInFrames={total - tailFrom} name="Продолжение следует"><TailView /></Sequence>
        </AbsoluteFill>
      </Film>
      {/* титул серии — чёрный экран поверх плёнки (чёрный кадр без зерна) */}
      <Sequence from={titleFrom} durationInFrames={titleDur} name="Титул"><TitleView ep={ep} dur={titleDur} /></Sequence>
      {withAudio && <Audio src={staticFile(ep.audio)} />}
    </AbsoluteFill>
  );
};
const TitleView: React.FC<{ ep: EpisodeDef; dur: number }> = ({ ep, dur }) => { const f = useCurrentFrame(); return <SeriesTitle f={f} dur={dur} title={ep.title} sub={ep.sub} />; };
const TailView: React.FC = () => { const f = useCurrentFrame(); return <ToBeContinued f={f} />; };

/* ---------- помощники для планов ---------- */
export const Hero: React.FC<{ x: number; y: number; s: number; pose: Pose2; o?: Outfit; flip?: boolean }> = ({ x, y, s, pose, o = ARTYOM_AUTUMN, flip }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}><Person pose={pose} o={o} /></g>
);
export const Luna: React.FC<{ x: number; y: number; s: number; pose: DogPose; flip?: boolean; leash?: boolean; collar?: boolean; bandage?: boolean }> = ({ x, y, s, pose, flip, leash, collar, bandage }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}><Collie pose={pose} leashInMouth={leash} collar={collar} bandage={bandage} /></g>
);
/** Медленный наезд: zoom от 1 до 1 + amount за план. */
export const push = (c: Ctx, amount = 0.05, x = 0, base = 1) => ({ zoom: base * (1 + amount * Math.min(1, c.f / Math.max(1, c.dur))), x });
/** Табурет под сидящим героем (s — масштаб героя). */
export const Stool: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-30} y={-68} width={52} height={10} rx={3} fill="#5E4535" />
    <rect x={-26} y={-58} width={8} height={58} fill="#5E4535" /><rect x={10} y={-58} width={8} height={58} fill="#5E4535" />
  </g>
);
/** Пар изо рта на морозе: облачка от точки (x, y) в кадре. */
export const Breath: React.FC<{ x: number; y: number; frame: number }> = ({ x, y, frame }) => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    {[0, 1, 2].map((i) => {
      const t = ((frame + i * 25) % 75) / 75;
      return <circle key={i} cx={x + 30 * t} cy={y - 50 * t} r={10 + 26 * t} fill="#EAEAF6" opacity={0.5 * (1 - t) * (t > 0.05 ? 1 : t * 20)} />;
    })}
  </svg>
);
