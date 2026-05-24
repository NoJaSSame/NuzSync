import TypeBadge from './TypeBadge'
import StatBar from './StatBar'
import WeaknessGrid from './WeaknessGrid'
import EvolutionChain from './EvolutionChain'
import MovesTable from './MovesTable'

function padId(id) {
  return String(id).padStart(4, '0')
}

export default function PokemonCard({ pokemon, typeData, speciesData, evolutionData, frenchNamesById, loading, onSelect }) {
  if (loading) {
    return (
      <div className="pokemon-card pokemon-card--loading">
        <div className="spinner" />
        <p>Chargement...</p>
      </div>
    )
  }

  if (!pokemon) return null

  const sprite =
    pokemon.sprites?.other?.['official-artwork']?.front_default ||
    pokemon.sprites?.other?.dream_world?.front_default ||
    pokemon.sprites?.front_default

  const { weaknesses = {}, resistances = {}, immunities = {} } = typeData ?? {}
  const nameFr = speciesData?.nameFr

  return (
    <div className="pokemon-card">
      <div className="pokemon-card__header">
        <span className="pokemon-card__id">#{padId(pokemon.id)}</span>
        <div className="pokemon-card__names">
          <h2 className="pokemon-card__name">{nameFr ?? pokemon.name}</h2>
          {nameFr && <span className="pokemon-card__name-en">{pokemon.name}</span>}
        </div>
        <div className="pokemon-card__types">
          {pokemon.types.map(({ type }) => (
            <TypeBadge key={type.name} type={type.name} size="lg" />
          ))}
        </div>
      </div>

      <div className="pokemon-card__body">
        <div className="pokemon-card__sprite-col">
          {sprite && (
            <img
              className="pokemon-card__sprite"
              src={sprite}
              alt={nameFr ?? pokemon.name}
            />
          )}
          <div className="pokemon-card__meta">
            <span>Taille : {(pokemon.height / 10).toFixed(1)} m</span>
            <span>Poids : {(pokemon.weight / 10).toFixed(1)} kg</span>
          </div>
        </div>

        <div className="pokemon-card__info-col">
          <section className="pokemon-card__section">
            <h3 className="pokemon-card__section-title">Stats de base</h3>
            {pokemon.stats.map(({ stat, base_stat }) => (
              <StatBar key={stat.name} name={stat.name} value={base_stat} />
            ))}
          </section>

          <WeaknessGrid
            weaknesses={weaknesses}
            resistances={resistances}
            immunities={immunities}
          />
        </div>
      </div>

      <EvolutionChain
        evolutionData={evolutionData}
        frenchNamesById={frenchNamesById}
        onSelect={onSelect}
      />

      <MovesTable moves={pokemon.moves} />
    </div>
  )
}
