import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { RigTest } from "./sheets/RigTest";
import { CharacterSheet } from "./sheets/CharacterSheet";
import { CycleTest } from "./sheets/CycleTest";
import { TestFrame } from "./sheets/TestFrames";
import { KaraokeTest } from "./sheets/KaraokeTest";
import { EPISODE_FRAMES, PropuskEpisode } from "./episodes/propusk/Episode";
import { Cover } from "./episodes/propusk/Cover";
import { RigTest2 } from "./series66/RigTest2";
import { CastSheet, Frame66, Test15 } from "./series66/Sheets66";
import { Cycles66 } from "./series66/Cycles66";
import { Ep66_1, Ep66_2 } from "./series66/Episodes66";
import { EP1 } from "./series66/ep1";
import { EP2 } from "./series66/ep2";
import { epFrames } from "./series66/engine";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition id="RigTest" component={RigTest} durationInFrames={1} fps={30} width={1500} height={900} />
      <Composition id="CharacterSheet" component={CharacterSheet} durationInFrames={1} fps={30} width={2400} height={1500} />
      <Composition id="HeroWalk" component={CycleTest} defaultProps={{ kind: "heroWalk" as const }} durationInFrames={96} fps={30} width={1080} height={600} />
      <Composition id="HeroRun" component={CycleTest} defaultProps={{ kind: "heroRun" as const }} durationInFrames={64} fps={30} width={1080} height={600} />
      <Composition id="DogWalk" component={CycleTest} defaultProps={{ kind: "dogWalk" as const }} durationInFrames={96} fps={30} width={1080} height={600} />
      <Composition id="FrameRegime" component={TestFrame} defaultProps={{ variant: "regime" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="FrameSryv" component={TestFrame} defaultProps={{ variant: "sryv" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="KaraokeTest" component={KaraokeTest} durationInFrames={150} fps={30} width={1080} height={1920} />
      <Composition id="Propusk" component={PropuskEpisode} durationInFrames={EPISODE_FRAMES} fps={30} width={1080} height={1920} />
      <Composition id="PropuskCover" component={Cover} defaultProps={{ variant: "cover" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="PropuskThumb" component={Cover} defaultProps={{ variant: "thumb" as const }} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="RigTest2" component={RigTest2} durationInFrames={1} fps={30} width={1600} height={900} />
      <Composition id="CastSheet" component={CastSheet} durationInFrames={1} fps={30} width={2400} height={2000} />
      <Composition id="Test15" component={Test15} durationInFrames={450} fps={30} width={1080} height={1920} />
      <Composition id="F66-yard" component={Frame66} defaultProps={{ v: "yard" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="F66-interior" component={Frame66} defaultProps={{ v: "interior" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="F66-night" component={Frame66} defaultProps={{ v: "night" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="F66-fog" component={Frame66} defaultProps={{ v: "fog" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="F66-winter" component={Frame66} defaultProps={{ v: "winter" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="F66-howto" component={Frame66} defaultProps={{ v: "howto" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="F66-ritm" component={Frame66} defaultProps={{ v: "ritm" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="F66-notebook" component={Frame66} defaultProps={{ v: "notebook" as const }} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="Walk66Man" component={Cycles66} defaultProps={{ who: "man" as const }} durationInFrames={72} fps={30} width={1080} height={720} />
      <Composition id="Walk66Dog" component={Cycles66} defaultProps={{ who: "dog" as const }} durationInFrames={72} fps={30} width={1080} height={720} />
      <Composition id="Ep66-1" component={Ep66_1} defaultProps={{ withAudio: false }} durationInFrames={epFrames(EP1)} fps={30} width={1080} height={1920} />
      <Composition id="Ep66-2" component={Ep66_2} defaultProps={{ withAudio: false }} durationInFrames={epFrames(EP2)} fps={30} width={1080} height={1920} />
    </>
  );
};
