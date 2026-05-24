import { getSpeciesId, getEvolutionLabel } from '../utils/evolutionUtils'

function EvoNode({ node, frenchNamesById, onSelect }) {
  const id = getSpeciesId(node.species.url)
  const nameFr = frenchNamesById[id] || node.species.name
  const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

  return (
    <div className="evo-node">
      <button className="evo-pokemon" onClick={() => onSelect(node.species.name)}>
        <img className="evo-sprite" src={sprite} alt={nameFr} loading="lazy" />
        <span className="evo-name">{nameFr}</span>
      </button>

      {node.evolves_to.length > 0 && (
        <div className="evo-branches">
          {node.evolves_to.map(evo => {
            const label = getEvolutionLabel(evo.evolution_details)
            return (
              <div key={evo.species.name} className="evo-branch">
                <div className="evo-arrow">
                  {label && <span className="evo-condition">{label}</span>}
                  <span className="evo-arrow-icon">→</span>
                </div>
                <EvoNode node={evo} frenchNamesById={frenchNamesById} onSelect={onSelect} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function EvolutionChain({ evolutionData, frenchNamesById = {}, onSelect }) {
  if (!evolutionData) return null

  const hasEvolutions =
    evolutionData.chain.evolves_to.length > 0 ||
    checkDeepEvolutions(evolutionData.chain)

  if (!hasEvolutions) return null

  return (
    <section className="evolution-chain">
      <h3 className="pokemon-card__section-title">Évolutions</h3>
      <div className="evolution-chain__tree">
        <EvoNode node={evolutionData.chain} frenchNamesById={frenchNamesById} onSelect={onSelect} />
      </div>
    </section>
  )
}

function checkDeepEvolutions(node) {
  return node.evolves_to.some(
    evo => evo.evolves_to.length > 0 || checkDeepEvolutions(evo)
  )
}
