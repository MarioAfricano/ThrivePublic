import { Sector } from 'recharts'

// ── Sector activo do Pie (donut de Alocação) ───────────────────
// Substitui o sector activo por um ligeiramente maior para destacar a
// categoria sob o cursor. Função pura (JSX puro), sem estado.
export default function renderActiveShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}
