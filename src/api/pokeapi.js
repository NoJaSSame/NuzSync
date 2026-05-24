const BASE = 'https://pokeapi.co/api/v2'

export async function getPokemon(nameOrId) {
  const res = await fetch(`${BASE}/pokemon/${String(nameOrId).toLowerCase()}`)
  if (!res.ok) throw new Error(`Pokémon "${nameOrId}" introuvable`)
  return res.json()
}

export async function getTypeData(typeName) {
  const res = await fetch(`${BASE}/type/${typeName}`)
  if (!res.ok) throw new Error(`Type "${typeName}" introuvable`)
  return res.json()
}

export async function getAllPokemonNames() {
  const res = await fetch(`${BASE}/pokemon?limit=10000&offset=0`)
  if (!res.ok) throw new Error('Erreur lors du chargement des noms')
  const data = await res.json()
  return data.results.map(p => ({
    name: p.name,
    id: parseInt(p.url.split('/').filter(Boolean).pop(), 10),
  }))
}

export async function getSpecies(nameOrId) {
  const res = await fetch(`${BASE}/pokemon-species/${String(nameOrId).toLowerCase()}`)
  if (!res.ok) throw new Error(`Espèce "${nameOrId}" introuvable`)
  const data = await res.json()
  const nameFr = data.names.find(n => n.language.name === 'fr')?.name ?? null
  return { ...data, nameFr }
}

export async function getEvolutionChain(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Chaîne d'évolution introuvable`)
  return res.json()
}

export async function getAllFrenchNames() {
  try {
    const res = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ pokemon_v2_pokemonspeciesname(where: {language_id: {_eq: 5}}) { name pokemon_species_id } }',
      }),
    })
    if (!res.ok) return []
    const { data } = await res.json()
    return data?.pokemon_v2_pokemonspeciesname ?? []
  } catch {
    return []
  }
}

export async function listPokemon(offset = 0, limit = 20) {
  const res = await fetch(`${BASE}/pokemon?limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new Error('Erreur lors du chargement de la liste')
  const data = await res.json()
  return { results: data.results, count: data.count }
}

export async function getPokemonByUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Erreur lors du chargement du Pokémon')
  return res.json()
}

const moveCache = new Map()

export async function getMoveData(name) {
  if (moveCache.has(name)) return moveCache.get(name)
  const res = await fetch(`${BASE}/move/${name}`)
  if (!res.ok) throw new Error(`Move "${name}" introuvable`)
  const data = await res.json()
  moveCache.set(name, data)
  return data
}
