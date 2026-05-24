import { Battle, Dex } from '@pkmn/sim'

// ── Lookup species par numéro Pokédex (construit une fois au chargement) ──────
const _speciesByNum = new Map()
try {
  for (const [id, data] of Object.entries(Dex.data.Species)) {
    if (data.num > 0 && !_speciesByNum.has(data.num)) {
      _speciesByNum.set(data.num, Dex.species.get(id))
    }
  }
} catch {}

function getSpecies(pk) {
  if (pk.species_name_en) {
    const s = Dex.species.get(pk.species_name_en)
    if (s?.exists) return s
  }
  if (pk.species_id) {
    const s = _speciesByNum.get(pk.species_id)
    if (s?.exists) return s
  }
  throw new Error(`Espèce introuvable: ${pk.species_name_en || pk.species_name || '#' + pk.species_id}`)
}

// Tableau des natures pour convertir l'index entier (ancien format Firebase) en nom
const NATURE_NAMES = [
  'Hardy','Lonely','Brave','Adamant','Naughty',
  'Bold','Docile','Relaxed','Impish','Lax',
  'Timid','Hasty','Serious','Jolly','Naive',
  'Modest','Mild','Quiet','Bashful','Rash',
  'Calm','Gentle','Sassy','Careful','Quirky',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function toShowdownSet(pk) {
  const species = getSpecies(pk)

  // nature peut être un entier (ancien format) ou un string (nouveau format)
  const nature = typeof pk.nature === 'string'
    ? pk.nature
    : (NATURE_NAMES[pk.nature] || 'Hardy')

  return {
    name:    pk.nickname || species.name,
    species: species.name,
    item:    pk.held_item || '',
    ability: pk.ability   || species.abilities['0'] || 'Trace',
    moves:   (pk.moves?.length ? pk.moves : ['Struggle']).filter(Boolean),
    nature,
    evs:     pk.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs:     pk.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level:   pk.level || 50,
    gender:  '',
  }
}

function parsePokemonId(str) {
  const m = str.match(/^(p[12])[ab]: (.+)$/)
  return m ? { side: m[1], name: m[2] } : { side: 'p1', name: str }
}

function parseHp(str) {
  if (!str || str === '0 fnt') return { hp: 0, maxhp: 0 }
  const [cur, max] = str.split('/').map(Number)
  return { hp: cur || 0, maxhp: max || cur || 0 }
}

// ── ShowdownBattle ────────────────────────────────────────────────────────────

export class ShowdownBattle {
  constructor(team1, team2) {
    this._team1  = team1
    this._team2  = team2
    this.p1Name  = team1.name
    this.p2Name  = team2.name
    this.over    = false
    this.winner  = null
    this.turn    = 0
    this._lines      = []
    this._p1Request  = null
    this._p2Request  = null
    this._prevHp     = { p1: 0, p2: 0 }

    this._initBattle()
  }

  _initBattle() {
    this._battle = new Battle({
      formatid:      'gen8customgame',
      send:          (type, data) => this._onSend(type, data),
      strictChoices: false,
    })
    this._battle.setPlayer('p1', {
      name: this.p1Name,
      team: this._team1.pokemon.map(toShowdownSet),
    })
    this._battle.setPlayer('p2', {
      name: this.p2Name,
      team: this._team2.pokemon.map(toShowdownSet),
    })
    this._battle.sendUpdates()

    // gen8customgame envoie d'abord un teamPreview, puis éventuellement un forceSwitch
    if (this._p1Request?.teamPreview) {
      this._lines = []
      this._battle.choose('p1', 'team 123456')
      this._battle.choose('p2', 'team 123456')
      this._battle.sendUpdates()
    }

    if (this._p1Request?.forceSwitch || this._p2Request?.forceSwitch) {
      this._lines = []
      if (this._p1Request?.forceSwitch) this._battle.choose('p1', 'switch 1')
      if (this._p2Request?.forceSwitch) this._battle.choose('p2', 'switch 1')
      this._battle.sendUpdates()
    }

    this._lines = []
    this.turn   = this._battle.turn
  }

  _onSend(type, data) {
    if (Array.isArray(data)) data = data.join('\n')
    if (typeof data !== 'string') return

    if (type === 'sideupdate') {
      const nl   = data.indexOf('\n')
      const side = nl >= 0 ? data.slice(0, nl) : data
      const rest = nl >= 0 ? data.slice(nl + 1) : ''
      for (const line of rest.split('\n')) {
        if (line.startsWith('|request|')) {
          const req = JSON.parse(line.slice('|request|'.length))
          if (side === 'p1') this._p1Request = req
          else               this._p2Request = req
        }
      }
    } else if (type === 'update') {
      for (const line of data.split('\n')) {
        if (line) this._lines.push(line)
      }
    }
  }

  _snapshotHp() {
    const b = this._battle
    this._prevHp = {
      p1: b.p1.active[0]?.hp ?? 0,
      p2: b.p2.active[0]?.hp ?? 0,
    }
  }

  _aiMove() {
    const moves = this._p2Request?.active?.[0]?.moves || []
    const idx   = moves.findIndex(m => !m.disabled && m.pp > 0)
    return Math.max(0, idx)
  }

  // Dans le protocole Showdown, p.fainted n'existe pas — le K.O. est encodé dans p.condition ("0 fnt")
  _isAvailable(p) {
    return !p.active && p.condition !== '0 fnt' && !p.condition?.endsWith(' fnt')
  }

  // Auto-switch IA (p2 seulement)
  _resolveP2Forced() {
    for (let i = 0; i < 12; i++) {
      const p2f = this._p2Request?.forceSwitch?.[0]
      if (!p2f) break
      const idx = this._p2Request.side.pokemon.findIndex(p => this._isAvailable(p))
      if (idx >= 0) {
        this._battle.choose('p2', `switch ${idx + 1}`)
        this._battle.sendUpdates()
      } else {
        this._p2Request = null
        break
      }
    }
  }

  _checkWin() {
    const winLine = this._lines.find(l => l.startsWith('|win|'))
    if (winLine) {
      this.over   = true
      const w     = winLine.slice('|win|'.length)
      this.winner = w === this.p1Name ? 'p1' : 'p2'
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  get p1NeedsSwitch() { return !!(this._p1Request?.forceSwitch?.[0]) }
  get p2NeedsSwitch() { return !!(this._p2Request?.forceSwitch?.[0]) }

  // autoP2 = false en multijoueur : P2 choisit son switch lui-même
  choose(p1MoveIdx, p2MoveIdx = null, autoP2 = true) {
    if (this.over) return []
    this._snapshotHp()
    this._lines = []

    const p2Idx = p2MoveIdx !== null ? p2MoveIdx : this._aiMove()
    this._battle.choose('p1', `move ${p1MoveIdx + 1}`)
    this._battle.choose('p2', `move ${p2Idx + 1}`)
    this._battle.sendUpdates()
    if (autoP2) this._resolveP2Forced()

    this.turn = this._battle.turn
    this._checkWin()
    return this._parseLines([...this._lines])
  }

  chooseSwitch(teamIdx, autoP2 = true) {
    if (this.over || !this.p1NeedsSwitch) return []
    this._lines = []

    this._battle.choose('p1', `switch ${teamIdx + 1}`)
    this._battle.sendUpdates()
    if (autoP2) this._resolveP2Forced()

    this.turn = this._battle.turn
    this._checkWin()
    return this._parseLines([...this._lines])
  }

  chooseP2Switch(teamIdx) {
    if (this.over || !this.p2NeedsSwitch) return []
    this._lines = []

    this._battle.choose('p2', `switch ${teamIdx + 1}`)
    this._battle.sendUpdates()

    this.turn = this._battle.turn
    this._checkWin()
    return this._parseLines([...this._lines])
  }

  _parseLines(lines) {
    const events   = []
    let pendingEff = 1
    const trackHp  = { ...this._prevHp }

    for (const line of lines) {
      if (!line.startsWith('|')) continue
      const parts = line.slice(1).split('|')
      const cmd   = parts[0]

      switch (cmd) {
        case 'move': {
          const who = parsePokemonId(parts[1])
          events.push({ type: 'move', side: who.side, pokemon: who.name, move: parts[2] })
          pendingEff = 1
          break
        }
        case '-supereffective': pendingEff = 2;   break
        case '-resisted':       pendingEff = 0.5; break
        case '-immune':         pendingEff = 0;   break

        case '-miss': {
          const who = parsePokemonId(parts[1])
          events.push({ type: 'miss', side: who.side, pokemon: who.name })
          break
        }
        case '-crit':
          events.push({ type: 'crit' })
          break

        case '-damage': {
          const who  = parsePokemonId(parts[1])
          const { hp, maxhp } = parseHp(parts[2])
          const prev   = trackHp[who.side]
          const damage = Math.max(0, prev - hp)
          trackHp[who.side] = hp
          events.push({ type: 'damage', side: who.side, pokemon: who.name,
            damage, hp, maxhp, effectiveness: pendingEff })
          pendingEff = 1
          break
        }
        case '-heal': {
          const who = parsePokemonId(parts[1])
          const { hp, maxhp } = parseHp(parts[2])
          trackHp[who.side] = hp
          events.push({ type: 'heal', side: who.side, pokemon: who.name, hp, maxhp })
          break
        }
        case 'faint': {
          const who = parsePokemonId(parts[1])
          events.push({ type: 'faint', side: who.side, pokemon: who.name })
          break
        }
        case 'switch':
        case 'drag': {
          const who      = parsePokemonId(parts[1])
          const specName = parts[2]?.split(',')[0]?.trim() || ''
          const specData = Dex.species.get(specName)
          const { hp, maxhp } = parseHp(parts[3])
          trackHp[who.side] = hp
          events.push({ type: 'switch', side: who.side, pokemon: who.name,
            species_id: specData.num || 0, hp, maxhp })
          break
        }
        case '-status': {
          const who = parsePokemonId(parts[1])
          events.push({ type: 'status', side: who.side, pokemon: who.name, status: parts[2] })
          break
        }
        case '-curestatus': {
          const who = parsePokemonId(parts[1])
          events.push({ type: 'curestatus', side: who.side, pokemon: who.name })
          break
        }
        case '-weather': {
          const w = parts[1]
          events.push({ type: 'weather', weather: (!w || w === 'none') ? null : w })
          break
        }
      }
    }

    return events
  }

  _mapMoves(req) {
    const moves = req?.active?.[0]?.moves || []
    return moves.map(m => ({ name: m.move, id: m.id, pp: m.pp, maxpp: m.maxpp, disabled: !!m.disabled }))
  }

  get p1Moves() { return this._mapMoves(this._p1Request) }
  get p2Moves() { return this._mapMoves(this._p2Request) }

  getState() {
    const b = this._battle

    const mapPoke = (poke, side) => ({
      name:       poke.name,
      species:    poke.species.id,
      species_id: poke.species.num || Dex.species.get(poke.species.id)?.num || 0,
      hp:         poke.hp,
      maxhp:      poke.maxhp,
      status:     poke.status || '',
      level:      poke.level,
      types:      poke.types || [],
      fainted:    poke.fainted,
      isActive:   side.active[0] === poke,
    })

    return {
      p1:      { active: b.p1.active[0] ? mapPoke(b.p1.active[0], b.p1) : null, team: b.p1.pokemon.map(p => mapPoke(p, b.p1)) },
      p2:      { active: b.p2.active[0] ? mapPoke(b.p2.active[0], b.p2) : null, team: b.p2.pokemon.map(p => mapPoke(p, b.p2)) },
      turn:    b.turn,
      weather: b.field.weather || null,
    }
  }

  reset() {
    this.over   = false
    this.winner = null
    this.turn   = 0
    this._lines     = []
    this._p1Request = null
    this._p2Request = null
    this._initBattle()
  }
}
