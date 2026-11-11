import {
  AbsoluteFill,
  Composition,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useEffect, useState } from "react";
import { fontsReady } from "./fonts";

// Проверка студии: 3 секунды, белый «РАБОТАЕТ» шрифтом Inter Display Black на тёмном фоне.
export const MyComposition = () => (
  <Composition
    id="Check"
    component={CheckText}
    durationInFrames={90}
    fps={30}
    width={1080}
    height={1920}
  />
);

const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    fontsReady.then(() => continueRender(handle));
  }, [handle]);
};

export const CheckText: React.FC<{ family?: string }> = ({ family = "Inter Display" }) => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16 } });
  const scale = interpolate(s, [0, 1], [0.94, 1]);
  return (
    <AbsoluteFill
      style={{ backgroundColor: "#0B0F1A", justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          fontFamily: family,
          fontWeight: 900,
          fontSize: 150,
          lineHeight: 1,
          color: "#FFFFFF",
          opacity: s,
          transform: `scale(${scale})`,
          textShadow: "0 3px 14px rgba(0,0,0,.7)",
        }}
      >
        РАБОТАЕТ
      </div>
    </AbsoluteFill>
  );
};
