import { EpisodeView } from "./engine";
import { EP1 } from "./ep1";
import { EP2 } from "./ep2";
export const Ep66_1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => <EpisodeView ep={EP1} withAudio={withAudio} />;
export const Ep66_2: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => <EpisodeView ep={EP2} withAudio={withAudio} />;
