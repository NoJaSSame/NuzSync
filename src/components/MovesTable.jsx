import { useState, useEffect } from 'react'
import { getMoveData } from '../api/pokeapi'
import TypeBadge from './TypeBadge'

const CATEGORY_FR = {
  physical: 'Physique',
  special: 'Spécial',
  status: 'Statut',
}

const VERSION_PRIORITY = [
  'scarlet-violet', 'sword-shield', 'sun-moon', 'ultra-sun-ultra-moon',
  'x-y', 'omega-ruby-alpha-sapphire', 'black-2-white-2', 'black-white',
  'heartgold-soulsilver', 'platinum', 'diamond-pearl',
  'firered-leafgreen', 'emerald', 'ruby-sapphire',
  'crystal', 'gold-silver', 'red-blue', 'yellow',
]

function getBestDetail(details, method) {
  const matching = details.filter(d => d.move_learn_method.name === method)
  if (!matching.length) return null
  for (const v of VERSION_PRIORITY) {
    const found = matching.find(d => d.version_group.name === v)
    if (found) return found
  }
  return matching[0]
}

function getNameFr(names) {
  return names?.find(n => n.language.name === 'fr')?.name ?? null
}

function sortMoves(moves, key, dir) {
  return [...moves].sort((a, b) => {
    let va = a[key]
    let vb = b[key]
    if (key === 'power') {
      va = va ?? -1
      vb = vb ?? -1
    } else if (key === 'level') {
      va = va === 0 ? 1 : va
      vb = vb === 0 ? 1 : vb
    } else {
      va = (va ?? '').toString()
      vb = (vb ?? '').toString()
      return dir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
    }
    return dir === 'asc' ? va - vb : vb - va
  })
}

function SortableHeader({ label, sortKey, current, dir, onSort }) {
  const active = current === sortKey
  const arrow = active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''
  return (
    <th
      className={`moves-table__th--sortable${active ? ' moves-table__th--active' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      {label}{arrow}
    </th>
  )
}

function MoveRow({ move, showLevel }) {
  const power = move.category === 'status' || move.power === null ? '—' : move.power
  return (
    <tr>
      {showLevel && (
        <td className="moves-table__level">{move.level === 0 ? 1 : move.level}</td>
      )}
      <td className="moves-table__name">{move.name}</td>
      <td><TypeBadge type={move.type} size="md" /></td>
      <td className="moves-table__category">{CATEGORY_FR[move.category] ?? move.category}</td>
      <td className="moves-table__power">{power}</td>
    </tr>
  )
}

function SortableTable({ moves, showLevel, defaultKey }) {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortMoves(moves, sortKey, sortDir)

  return (
    <table className="moves-table">
      <thead>
        <tr>
          {showLevel && (
            <SortableHeader label="Niv." sortKey="level" current={sortKey} dir={sortDir} onSort={handleSort} />
          )}
          <SortableHeader label="Capacité" sortKey="name"     current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortableHeader label="Type"     sortKey="type"     current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortableHeader label="Catégorie" sortKey="category" current={sortKey} dir={sortDir} onSort={handleSort} />
          <SortableHeader label="Puissance" sortKey="power"   current={sortKey} dir={sortDir} onSort={handleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((m, i) => <MoveRow key={i} move={m} showLevel={showLevel} />)}
      </tbody>
    </table>
  )
}

export default function MovesTable({ moves }) {
  const [levelMoves, setLevelMoves] = useState([])
  const [tmMoves, setTmMoves]       = useState([])
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    if (!moves?.length) return
    let cancelled = false
    setLoading(true)
    setLevelMoves([])
    setTmMoves([])

    async function load() {
      const levelUpMap = new Map()
      const tmSet = new Set()

      for (const m of moves) {
        const lvlDetail = getBestDetail(m.version_group_details, 'level-up')
        if (lvlDetail) levelUpMap.set(m.move.name, lvlDetail.level_learned_at)

        const tmDetail = getBestDetail(m.version_group_details, 'machine')
        if (tmDetail) tmSet.add(m.move.name)
      }

      const allNames = [...new Set([...levelUpMap.keys(), ...tmSet])]
      const results = await Promise.allSettled(allNames.map(getMoveData))
      if (cancelled) return

      const moveMap = {}
      for (let i = 0; i < allNames.length; i++) {
        if (results[i].status === 'fulfilled') moveMap[allNames[i]] = results[i].value
      }

      function format(name, level = null) {
        const data = moveMap[name]
        if (!data) return null
        return {
          name: getNameFr(data.names) ?? data.name,
          type: data.type.name,
          category: data.damage_class.name,
          power: data.power,
          level,
        }
      }

      const fmtLevel = [...levelUpMap.entries()]
        .map(([name, lvl]) => format(name, lvl))
        .filter(Boolean)
        .sort((a, b) => a.level - b.level)

      const fmtTm = [...tmSet]
        .map(name => format(name))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

      if (!cancelled) {
        setLevelMoves(fmtLevel)
        setTmMoves(fmtTm)
        setLoading(false)
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [moves])

  if (loading) {
    return (
      <div className="moves-loading">
        <div className="spinner" />
        <p>Chargement des capacités...</p>
      </div>
    )
  }

  if (!levelMoves.length && !tmMoves.length) return null

  return (
    <div className="moves-section">
      {levelMoves.length > 0 && (
        <div className="moves-table-wrap">
          <h3 className="pokemon-card__section-title">Capacités par niveau</h3>
          <SortableTable moves={levelMoves} showLevel defaultKey="level" />
        </div>
      )}

      {tmMoves.length > 0 && (
        <div className="moves-table-wrap">
          <h3 className="pokemon-card__section-title">Capacités par CT</h3>
          <SortableTable moves={tmMoves} showLevel={false} defaultKey="name" />
        </div>
      )}
    </div>
  )
}
