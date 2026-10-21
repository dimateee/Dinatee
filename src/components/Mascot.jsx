/* Совёнок Огуша — подбадривает и подсказывает */
import { motion } from "framer-motion";

export function Mascot({ say, mood = "happy", size = 64 }) {
  const face = { happy: "🦉", wow: "🤩", sad: "🥺", think: "🤔", party: "🥳" }[mood] || "🦉";
  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      <motion.span
        className="mascot"
        style={{ fontSize: size }}
        animate={{ y: [0, -6, 0], rotate: [0, -4, 4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {face}
      </motion.span>
      {say && (
        <motion.div className="bubble grow" initial={{ opacity: 0, x: -8, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ delay: 0.15 }}>
          {say}
        </motion.div>
      )}
    </div>
  );
}
