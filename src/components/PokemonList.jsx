import { useState } from 'react'

const PAGE_SIZE = 30

function padId(id) {
  return String(id).padStart(4, '0')
}

export default function PokemonList({ allNames = [], selectedId, onSelect }) {
  const [page, setPage] = useState(0)

  if (allNames.length === 0) {
    return (
      <div className="pokemon-list__loading">
        <div className="spinner" />
        <p>Chargement...</p>
      </div>
    )
  }

  const totalPages = Math.ceil(allNames.length / PAGE_SIZE)
  const items = allNames.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="pokemon-list">
      <div className="pokemon-list__rows">
        {items.map(p => (
          <button
            key={p.id}
            className={`list-row${p.id === selectedId ? ' list-row--active' : ''}`}
            onClick={() => onSelect(p.name)}
          >
            <img
              className="list-row__sprite"
              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`}
              alt={p.nameFr ?? p.name}
              loading="lazy"
            />
            <span className="list-row__id">#{padId(p.id)}</span>
            <span className="list-row__name">{p.nameFr ?? p.name}</span>
          </button>
        ))}
      </div>

      <div className="pokemon-list__pagination">
        <button
          className="btn-page"
          onClick={() => setPage(p => p - 1)}
          disabled={page === 0}
        >←</button>
        <span className="pokemon-list__page-info">{page + 1} / {totalPages}</span>
        <button
          className="btn-page"
          onClick={() => setPage(p => p + 1)}
          disabled={page >= totalPages - 1}
        >→</button>
      </div>
    </div>
  )
}
