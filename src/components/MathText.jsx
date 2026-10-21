/* Текст с формулами: всё между $...$ рисуется через KaTeX */
import { memo, useMemo } from "react";
import katex from "katex";

function render(text) {
  return String(text)
    .split(/(\$[^$]+\$)/g)
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
        return katex.renderToString(part.slice(1, -1), { throwOnError: false, output: "html" });
      }
      return part.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    })
    .join("");
}

export const MathText = memo(function MathText({ text, className, as: Tag = "span" }) {
  const html = useMemo(() => render(text), [text]);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
