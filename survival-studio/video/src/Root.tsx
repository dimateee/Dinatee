import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { RigTest } from "./sheets/RigTest";
import { CharacterSheet } from "./sheets/CharacterSheet";
import { CycleTest } from "./sheets/CycleTest";
import { TestFrame } from "./sheets/TestFrames";
import { KaraokeTest } from "./sheets/KaraokeTest";
import { EPISODE_FRAMES, PropuskEpisode } from "./episodes/propusk/Episode";
import { Cover } from "./episodes/propusk/Cover";

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
    </>
  );
};
