import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Karaoke } from "../../captions/Karaoke";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { EASE } from "./parts";
import { SHOT_COMPONENTS } from "./Shots";
import { at, CAPTION_ACCENTS, captionWords, FPS, Shot, SHOTS, TOTAL_SEC } from "./timeline";

export const EPISODE_FRAMES = Math.round(TOTAL_SEC * FPS);
const CW = captionWords();
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const ACCENTS: Record<number, "yellow" | "red"> = Object.fromEntries(
  CAPTION_ACCENTS.map((a) => {
    const i = CW.findIndex((w) => w.start >= a.after - 0.05 && norm(w.word) === norm(a.word));
    if (i < 0) throw new Error(`Акцент не найден: ${a.word}`);
    return [i, a.color];
  }),
);

/** Вход плана: смена крупности, вытеснение маской, «свет загорается», «экран гаснет». */
const Enter: React.FC<{ type: Shot["enter"]; children: React.ReactNode }> = ({ type, children }) => {
  const f = useCurrentFrame();
  if (type === "scale") {
    const s = interpolate(f, [0, 6], [1.06, 1], { extrapolateRight: "clamp", easing: EASE });
    return <AbsoluteFill style={{ transform: `scale(${s})` }}>{children}</AbsoluteFill>;
  }
  if (type === "wipe") {
    const k = interpolate(f, [0, 7], [25, 100], { extrapolateRight: "clamp", easing: EASE }); // с 25%: ни одного пустого кадра
    return <AbsoluteFill style={{ backgroundColor: "#F6F2E7" }}><AbsoluteFill style={{ clipPath: `inset(0 0 ${Math.round(100 - k)}% 0)` }}>{children}</AbsoluteFill></AbsoluteFill>;
  }
  if (type === "lightOn" || type === "darkOut") {
    const o = type === "lightOn" ? interpolate(f, [0, 10], [1, 0], { extrapolateRight: "clamp" }) : interpolate(f, [0, 3, 9], [0.95, 0.95, 0], { extrapolateRight: "clamp" });
    return <AbsoluteFill>{children}<AbsoluteFill style={{ backgroundColor: "#07090D", opacity: o }} /></AbsoluteFill>;
  }
  return <AbsoluteFill>{children}</AbsoluteFill>;
};

const ShotSeq: React.FC<{ shot: Shot }> = ({ shot }) => {
  const C = SHOT_COMPONENTS[shot.id];
  const f = useCurrentFrame();
  const dur = Math.round((shot.to - shot.from) * FPS);
  return <Enter type={shot.enter}><C f={f} dur={dur} shot={shot} /></Enter>;
};

const SFX: { file: string; at: number; volume: number }[] = [
  { file: "sfx/alarm.wav", at: 4.92, volume: 0.32 },
  { file: "sfx/snap.wav", at: at("сломал.", 15.8), volume: 0.45 },
  { file: "sfx/beep.wav", at: 49.56, volume: 0.3 },
  { file: "sfx/tick.wav", at: 66.2, volume: 0.35 },
];

export const PropuskEpisode: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1118" }}>
      {SHOTS.map((s) => {
        const from = Math.round(s.from * FPS), to = Math.round(s.to * FPS);
        return <Sequence key={s.id} from={from} durationInFrames={to - from} name={`План ${s.id}`}><ShotSeq shot={s} /></Sequence>;
      })}
      <Karaoke words={CW} accents={ACCENTS} />
      <Grain />
      <Audio src={staticFile("audio/propusk_voice.wav")} />
      {SFX.map((s) => (
        <Sequence key={s.file} from={Math.round(s.at * FPS)}><Audio src={staticFile(s.file)} volume={s.volume} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
