import { colorTextoLegible } from '../utils/color';

export default function AreaChip({ area }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        marginRight: 4,
        marginBottom: 4,
        background: area.color,
        color: colorTextoLegible(area.color),
      }}
    >
      {area.name}
    </span>
  );
}
