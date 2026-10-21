/* Совёнок Огуша — подбадривает и подсказывает */

export function Mascot({ say, mood = "happy", size = 64 }) {
  const face = { happy: "🦉", wow: "🤩", sad: "🥺", think: "🤔", party: "🥳" }[mood] || "🦉";
  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      <span className="mascot" style={{ fontSize: size }}>{face}</span>
      {say && <div key={say} className="bubble grow anim-in">{say}</div>}
    </div>
  );
}
