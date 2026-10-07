// Отрисовка лендинга в HTML при сборке (см. scripts/prerender.mjs): поисковики и превью ссылок
// получают готовый текст страницы, а не пустой <div id="root">.
import { renderToString } from "react-dom/server";
import Landing from "./Landing.jsx";

export const render = () => renderToString(<Landing />);
