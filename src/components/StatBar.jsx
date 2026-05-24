const STAT_LABELS = {
  hp:               'PV',
  attack:           'Attaque',
  defense:          'Défense',
  'special-attack': 'Att. Spé.',
  'special-defense': 'Déf. Spé.',
  speed:            'Vitesse',
}

function statColor(value) {
  if (value >= 120) return '#4caf50'
  if (value >= 80)  return '#8bc34a'
  if (value >= 50)  return '#ffc107'
  return '#f44336'
}

export default function StatBar({ name, value }) {
  const label = STAT_LABELS[name] ?? name
  const pct = Math.min((value / 255) * 100, 100)
  const color = statColor(value)

  return (
    <div className="stat-bar">
      <span className="stat-bar__label">{label}</span>
      <span className="stat-bar__value">{value}</span>
      <div className="stat-bar__track">
        <div
          className="stat-bar__fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
