/* Рисунки к заданиям: фигуры на клетках, графики прямых, парабола из задания 22 */

function GridFigure({ pts, w, h }) {
  const c = 30, pad = 6;
  const W = w * c + pad * 2, H = h * c + pad * 2;
  const X = (x) => pad + x * c, Y = (y) => pad + (h - y) * c;
  const lines = [];
  for (let i = 0; i <= w; i++) lines.push(<line key={`v${i}`} x1={X(i)} y1={Y(0)} x2={X(i)} y2={Y(h)} />);
  for (let j = 0; j <= h; j++) lines.push(<line key={`h${j}`} x1={X(0)} y1={Y(j)} x2={X(w)} y2={Y(j)} />);
  return (
    <svg className="svg-fig" viewBox={`0 0 ${W} ${H}`}>
      <g stroke="var(--line)" strokeWidth="1.2">{lines}</g>
      <polygon points={pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")} fill="color-mix(in srgb, var(--primary) 18%, transparent)" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={X(x)} cy={Y(y)} r="4" fill="var(--primary)" />)}
    </svg>
  );
}

function LineGraph({ k, b, label }) {
  const S = 120, u = 12, o = S / 2;
  const X = (x) => o + x * u, Y = (y) => o - y * u;
  const x1 = -5, x2 = 5;
  return (
    <div className="card" style={{ padding: 6, textAlign: "center" }}>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ width: "100%" }}>
        <defs><clipPath id={`c${label}`}><rect x="0" y="0" width={S} height={S} /></clipPath></defs>
        <g stroke="var(--line)" strokeWidth="0.8">
          {[-4, -3, -2, -1, 1, 2, 3, 4].map((i) => <line key={`v${i}`} x1={X(i)} y1="0" x2={X(i)} y2={S} />)}
          {[-4, -3, -2, -1, 1, 2, 3, 4].map((i) => <line key={`h${i}`} x1="0" y1={Y(i)} x2={S} y2={Y(i)} />)}
        </g>
        <g stroke="var(--muted)" strokeWidth="1.5">
          <line x1="0" y1={o} x2={S} y2={o} /><line x1={o} y1="0" x2={o} y2={S} />
        </g>
        <text x={S - 8} y={o - 4} fontSize="9" fill="var(--muted)">x</text>
        <text x={o + 4} y="9" fontSize="9" fill="var(--muted)">y</text>
        <line clipPath={`url(#c${label})`} x1={X(x1)} y1={Y(k * x1 + b)} x2={X(x2)} y2={Y(k * x2 + b)} stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <b>{label}</b>
    </div>
  );
}

function Parabola22() {
  const S = 220, u = 20, ox = 110, oy = 40;
  const X = (x) => ox + x * u, Y = (y) => oy - y * u;
  const pts = [];
  for (let x = -3.2; x <= 3.2; x += 0.1) pts.push(`${X(x)},${Y(-x * x - 4)}`);
  return (
    <svg className="svg-fig" viewBox={`0 0 ${S} ${S}`}>
      <g stroke="var(--muted)" strokeWidth="1.2">
        <line x1="0" y1={oy} x2={S} y2={oy} /><line x1={ox} y1="0" x2={ox} y2={S} />
      </g>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--primary)" strokeWidth="3" />
      <line x1="0" y1={Y(-4)} x2={S} y2={Y(-4)} stroke="var(--good)" strokeDasharray="6 4" strokeWidth="2" />
      <line x1="0" y1={Y(-5)} x2={S} y2={Y(-5)} stroke="var(--fire)" strokeDasharray="6 4" strokeWidth="2" />
      <circle cx={X(1)} cy={Y(-5)} r="5" fill="var(--card)" stroke="var(--primary)" strokeWidth="2.5" />
      <circle cx={X(0)} cy={Y(-4)} r="4" fill="var(--primary)" />
      <text x={X(0) + 6} y={Y(-4) - 6} fontSize="11" fill="var(--ink)">(0; −4)</text>
      <text x={X(1) + 8} y={Y(-5) + 14} fontSize="11" fill="var(--ink)">(1; −5)</text>
      <text x={S - 30} y={Y(-4) - 4} fontSize="11" fill="var(--good)">y = −4</text>
      <text x={S - 30} y={Y(-5) + 14} fontSize="11" fill="var(--fire)">y = −5</text>
    </svg>
  );
}

export function Figure({ fig }) {
  if (!fig) return null;
  if (fig.type === "grid") return <GridFigure {...fig} />;
  if (fig.type === "lines") return <div className="fig-lines">{fig.lines.map((l, i) => <LineGraph key={i} {...l} label={"АБВ"[i]} />)}</div>;
  if (fig.type === "parabola22") return <Parabola22 />;
  return null;
}
