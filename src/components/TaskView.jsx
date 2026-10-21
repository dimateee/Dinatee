/* Одно задание: условие, рисунок, варианты ответа или клавиатура */
import { motion } from "framer-motion";
import { MathText } from "./MathText.jsx";
import { Figure } from "./Figure.jsx";
import { Keypad } from "./Keypad.jsx";
import { haptic } from "../lib/telegram.js";

export function TaskView({ task, input, setInput, status, big = false }) {
  const locked = status === "ok" || status === "no";
  const isChoice = task.kind === "choice";
  const digitsOnly = task.kind === "digits" || task.kind === "set";

  return (
    <div className="col">
      <MathText as="div" className={`task-q ${big ? "big" : ""}`} text={task.q} />
      {task.code && <pre className="code">{task.code}</pre>}
      {task.hint && <MathText as="div" className="muted small center" text={task.hint} />}
      <Figure fig={task.fig} />
      {task.legend && (
        <div className="legend card">
          {task.legend.map((l, i) => <MathText key={i} as="div" text={l} />)}
        </div>
      )}

      {isChoice ? (
        <div className="col gap-s mt-s">
          {task.options.map((o, i) => {
            const n = String(i + 1);
            const cls = locked
              ? n === task.answer ? "ok" : n === input ? "no" : ""
              : n === input ? "sel" : "";
            return (
              <motion.button
                key={i}
                className={`option ${cls}`}
                whileTap={{ scale: 0.98 }}
                onClick={() => { if (!locked) { haptic.select(); setInput(n); } }}
              >
                <span className="option-num">{n}</span>
                <MathText text={o} />
              </motion.button>
            );
          })}
        </div>
      ) : (
        <>
          <motion.div
            className={`answer-box ${status === "ok" ? "ok" : status === "no" ? "no" : "focus"}`}
            animate={status === "no" ? { x: [0, -10, 10, -6, 6, 0] } : status === "ok" ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            {input || <span className="muted" style={{ fontSize: 18, fontWeight: 700 }}>Ответ</span>}
            {!locked && <span className="caret" />}
          </motion.div>
          {!locked && <Keypad value={input} onChange={setInput} allowSign={!digitsOnly} allowComma={!digitsOnly} />}
        </>
      )}
    </div>
  );
}

export function Steps({ steps }) {
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <motion.div key={i} className="step" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
          <span className="step-n">{i + 1}</span>
          <MathText as="div" className="grow" text={s} />
        </motion.div>
      ))}
    </div>
  );
}
