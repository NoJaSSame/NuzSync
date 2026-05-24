const ITEMS_FR = {
  'fire-stone':       'Pierre Feu',
  'water-stone':      'Pierre Eau',
  'thunder-stone':    'Pierre Foudre',
  'leaf-stone':       'Pierre Plante',
  'moon-stone':       'Pierre Lune',
  'sun-stone':        'Pierre Soleil',
  'shiny-stone':      'Pierre Éclat',
  'dusk-stone':       'Pierre Nuit',
  'dawn-stone':       'Pierre Aube',
  'oval-stone':       'Pierre Ovale',
  'ice-stone':        'Pierre Glace',
  'kings-rock':       'Roc du Roi',
  'metal-coat':       'Enro. Métal',
  'upgrade':          'Augmenteur',
  'dragon-scale':     'Écaille Draco',
  'deep-sea-tooth':   'Dent Mer-Prof.',
  'deep-sea-scale':   'Écaille Mer-Prof.',
  'linking-cord':     'Cordlien',
  'razor-claw':       'Griffe Rasoir',
  'razor-fang':       'Croc Rasoir',
  'electirizer':      'Électiriseur',
  'magmarizer':       'Magmariseur',
  'protector':        'Protecteur',
  'dubious-disc':     'Disque Étrange',
  'reaper-cloth':     'Tissu Faucheur',
  'prism-scale':      'Écaille Prisme',
  'whipped-dream':    'Rêve Fouetté',
  'sachet':           'Sachet Parfumé',
  'chipped-pot':      'Théière Ébréchée',
  'cracked-pot':      'Théière Fêlée',
  'galarica-cuff':    'Manchette Galari',
  'galarica-wreath':  'Couronne Galari',
  'peat-block':       'Bloc Tourbe',
  'auspicious-armor': 'Armure Propice',
  'malicious-armor':  'Armure Maléfique',
  'syrupy-apple':     'Pomme Sirupeuse',
}

export function getSpeciesId(url) {
  return parseInt(url.split('/').filter(Boolean).pop(), 10)
}

export function getEvolutionLabel(details) {
  if (!details?.length) return null
  const d = details[0]
  const parts = []

  if (d.min_level) {
    parts.push(`Niv. ${d.min_level}`)
  } else if (d.trigger?.name === 'level-up') {
    parts.push('Montée niv.')
  }

  if (d.trigger?.name === 'trade') parts.push('Échange')

  if (d.trigger?.name === 'use-item' && d.item) {
    parts.push(ITEMS_FR[d.item.name] ?? d.item.name)
  }

  if (d.held_item) {
    parts.push(ITEMS_FR[d.held_item.name] ?? d.held_item.name)
  }

  if (d.min_happiness) parts.push('Bonheur')
  if (d.min_affection) parts.push('Affection')
  if (d.time_of_day === 'day') parts.push('Jour')
  if (d.time_of_day === 'night') parts.push('Nuit')
  if (d.known_move) parts.push(`Capacité: ${d.known_move.name}`)
  if (d.gender === 1) parts.push('Femelle')
  if (d.gender === 2) parts.push('Mâle')

  return parts.length ? parts.join(' + ') : null
}
