import { getTypeData } from '../api/pokeapi'

export async function computeWeaknesses(types) {
  const multipliers = {}

  for (const { type } of types) {
    const data = await getTypeData(type.name)
    const rel = data.damage_relations

    for (const t of rel.double_damage_from) {
      multipliers[t.name] = (multipliers[t.name] ?? 1) * 2
    }
    for (const t of rel.half_damage_from) {
      multipliers[t.name] = (multipliers[t.name] ?? 1) * 0.5
    }
    for (const t of rel.no_damage_from) {
      multipliers[t.name] = 0
    }
  }

  const weaknesses = {}
  const resistances = {}
  const immunities = {}

  for (const [type, mult] of Object.entries(multipliers)) {
    if (mult === 0) immunities[type] = 0
    else if (mult > 1) weaknesses[type] = mult
    else if (mult < 1) resistances[type] = mult
  }

  return { weaknesses, resistances, immunities }
}
