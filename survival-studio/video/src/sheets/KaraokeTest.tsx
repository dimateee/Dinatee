import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../captions/Karaoke";
import data from "../captions/propusk.words.json";
import { RoomNight } from "../scenes/Rooms";
import { Leader, Plate, ServiceLabel } from "../ui/Hud";
import { Grain } from "../ui/Grain";
import { useFonts } from "../useFonts";

const words = (data as { words: Word[] }).words;
const KONEC = words.findIndex((w) => w.word.toLowerCase().startsWith("конец"));

// 5-секундный тест: крючок ролика на ночной сцене, живая камера, караоке по words.json.
export const KaraokeTest: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);
  const cam = { zoom: interpolate(frame, [0, 150], [1, 1.04]), x: interpolate(frame, [0, 150], [0, -14]), y: 0 };
  const plateIn = interpolate(frame, [36, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const leaderIn = interpolate(frame, [42, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1118" }}>
      <Audio src={staticFile("audio/propusk_voice.wav")} />
      <RoomNight frame={frame} cam={cam} />
      <ServiceLabel x={64} y={110} text="ДЕНЬ 4 — 01:47" />
      {plateIn > 0 && <Leader from={[200, 380]} to={[200, 860]} kind="bad" progress={leaderIn} />}
      <Plate x={64} y={240} kind="bad" icon="warn" title="Срыв" sub="день 4" opacity={plateIn} scale={0.94 + 0.06 * plateIn} />
      <Karaoke words={words} accents={{ [KONEC]: "red" }} />
      <Grain />
    </AbsoluteFill>
  );
};
