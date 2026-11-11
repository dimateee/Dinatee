import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { fontsReady } from "./fonts";

/** Блокирует рендер кадра, пока не загружены шрифты канала. */
export const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    fontsReady.then(() => continueRender(handle));
  }, [handle]);
};
