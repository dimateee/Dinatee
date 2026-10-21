/* Цифровая клавиатура — как в игре: крупные кнопки, не закрывает задание системной клавиатурой */
import { Delete } from "lucide-react";
import { haptic } from "../lib/telegram.js";

export function Keypad({ value, onChange, allowSign = true, allowComma = true }) {
  const press = (k) => {
    haptic.tap();
    if (k === "del") return onChange(value.slice(0, -1));
    if (k === "-") return onChange(value.startsWith("-") ? value.slice(1) : `-${value}`);
    if (k === ",") { if (!value.includes(",")) onChange((value === "" || value === "-" ? `${value}0` : value) + ","); return; }
    if (value.replace(/[-,]/g, "").length >= 9) return;
    onChange(value + k);
  };
  const keys = ["1", "2", "3", "del", "4", "5", "6", allowSign ? "-" : "", "7", "8", "9", allowComma ? "," : "", "0"];
  return (
    <div className="keypad">
      {keys.map((k, i) =>
        k === "" ? <div key={i} /> : (
          <button key={i} className={`key ${["del", "-", ","].includes(k) ? "fn" : ""}`} style={k === "0" ? { gridColumn: "1 / -1" } : undefined} onClick={() => press(k)} aria-label={k === "del" ? "Стереть" : k}>
            {k === "del" ? <Delete size={22} /> : k === "-" ? "±" : k}
          </button>
        ),
      )}
    </div>
  );
}
