const TYPE_COLORS = {
  normal:   '#A8A878',
  fire:     '#F08030',
  water:    '#6890F0',
  electric: '#F8D030',
  grass:    '#78C850',
  ice:      '#98D8D8',
  fighting: '#C03028',
  poison:   '#A040A0',
  ground:   '#E0C068',
  flying:   '#A890F0',
  psychic:  '#F85888',
  bug:      '#A8B820',
  rock:     '#B8A038',
  ghost:    '#705898',
  dragon:   '#7038F8',
  dark:     '#705848',
  steel:    '#B8B8D0',
  fairy:    '#EE99AC',
}

const TYPE_NAMES_FR = {
  normal:   'Normal',
  fire:     'Feu',
  water:    'Eau',
  electric: 'Électrik',
  grass:    'Plante',
  ice:      'Glace',
  fighting: 'Combat',
  poison:   'Poison',
  ground:   'Sol',
  flying:   'Vol',
  psychic:  'Psy',
  bug:      'Insecte',
  rock:     'Roche',
  ghost:    'Spectre',
  dragon:   'Dragon',
  dark:     'Ténèbres',
  steel:    'Acier',
  fairy:    'Fée',
}

export function getTypeColor(type) {
  return TYPE_COLORS[type] ?? '#888'
}

export function getTypeName(type) {
  return TYPE_NAMES_FR[type] ?? type
}

export default function TypeBadge({ type, size = 'md', multiplier }) {
  const bg = getTypeColor(type)
  const isDark = ['electric', 'ice', 'normal', 'steel', 'ground', 'flying'].includes(type)

  return (
    <span
      className={`type-badge type-badge--${size}`}
      style={{ backgroundColor: bg, color: isDark ? '#333' : '#fff' }}
    >
      {getTypeName(type)}
      {multiplier != null && <span className="type-badge__mult">×{multiplier}</span>}
    </span>
  )
}
