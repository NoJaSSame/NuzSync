import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, onDisconnect, remove } from 'firebase/database'
import { ShowdownBattle } from '../showdown-battle.js'
import { Dex } from '@pkmn/sim'
import { FIREBASE_CONFIG, PLAYER_COLORS } from '../constants.js'
import './BattleTab.css'

const SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const sleep  = ms => new Promise(r => setTimeout(r, ms))

// ── Mock players (dev / test) ─────────────────────────────────────────────────
const MOCK_PLAYERS = {
  Jason: {
    team: [
      { species_id: 815, species_name_en: 'Cinderace',   nickname: 'Ember',    level: 52, nature: 'Jolly',   ability: 'Libero',      held_item: '',
        moves: ['Pyro Ball', 'High Jump Kick', 'U-turn', 'Iron Head'],
        evs: { hp:0, atk:252, def:0, spa:0, spd:4, spe:252 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 823, species_name_en: 'Corviknight', nickname: 'Valkyrie', level: 48, nature: 'Impish',  ability: 'Pressure',    held_item: '',
        moves: ['Brave Bird', 'Iron Head', 'Body Press', 'Roost'],
        evs: { hp:252, atk:0, def:252, spa:0, spd:4, spe:0 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 849, species_name_en: 'Toxtricity',  nickname: 'Voltage',  level: 45, nature: 'Modest',  ability: 'Punk Rock',   held_item: '',
        moves: ['Overdrive', 'Sludge Bomb', 'Boomburst', 'Volt Switch'],
        evs: { hp:4, atk:0, def:0, spa:252, spd:0, spe:252 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 847, species_name_en: 'Barraskewda', nickname: 'Speedo',   level: 44, nature: 'Jolly',   ability: 'Swift Swim',  held_item: '',
        moves: ['Liquidation', 'Close Combat', 'Crunch', 'Psychic Fangs'],
        evs: { hp:0, atk:252, def:0, spa:0, spd:4, spe:252 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 861, species_name_en: 'Grimmsnarl',  nickname: 'Barbe',    level: 46, nature: 'Adamant', ability: 'Prankster',   held_item: '',
        moves: ['Spirit Break', 'Darkest Lariat', 'Sucker Punch', 'Bulk Up'],
        evs: { hp:252, atk:252, def:0, spa:0, spd:4, spe:0 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 839, species_name_en: 'Coalossal',   nickname: 'Charbon',  level: 43, nature: 'Brave',   ability: 'Steam Engine', held_item: '',
        moves: ['Stone Edge', 'Flamethrower', 'Body Press', 'Stealth Rock'],
        evs: { hp:252, atk:0, def:252, spa:4, spd:0, spe:0 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
    ],
  },
  Ami: {
    team: [
      { species_id: 887, species_name_en: 'Dragapult',   nickname: 'Phantom',   level: 50, nature: 'Timid',   ability: 'Clear Body',    held_item: '',
        moves: ['Draco Meteor', 'Shadow Ball', 'Thunderbolt', 'U-turn'],
        evs: { hp:0, atk:0, def:0, spa:252, spd:4, spe:252 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 681, species_name_en: 'Aegislash',   nickname: 'Excalibur', level: 47, nature: 'Quiet',   ability: 'Stance Change', held_item: '',
        moves: ['Shadow Ball', 'Sacred Sword', 'Iron Head', 'Flash Cannon'],
        evs: { hp:252, atk:0, def:0, spa:252, spd:4, spe:0 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:0 } },
      { species_id: 836, species_name_en: 'Boltund',     nickname: 'Éclair',    level: 45, nature: 'Jolly',   ability: 'Strong Jaw',    held_item: '',
        moves: ['Wild Charge', 'Play Rough', 'Ice Fang', 'Psychic Fangs'],
        evs: { hp:0, atk:252, def:0, spa:0, spd:4, spe:252 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 862, species_name_en: 'Obstagoon',   nickname: 'Punk',      level: 44, nature: 'Adamant', ability: 'Guts',          held_item: '',
        moves: ['Night Slash', 'Close Combat', 'Facade', 'Obstruct'],
        evs: { hp:0, atk:252, def:4, spa:0, spd:0, spe:252 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 844, species_name_en: 'Sandaconda',  nickname: 'Sandy',     level: 43, nature: 'Impish',  ability: 'Sand Spit',     held_item: '',
        moves: ['Earthquake', 'Rock Slide', 'Body Press', 'Coil'],
        evs: { hp:252, atk:0, def:252, spa:0, spd:4, spe:0 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
      { species_id: 818, species_name_en: 'Inteleon',    nickname: 'Agent',     level: 51, nature: 'Timid',   ability: 'Torrent',       held_item: '',
        moves: ['Snipe Shot', 'Ice Beam', 'Air Slash', 'U-turn'],
        evs: { hp:0, atk:0, def:0, spa:252, spd:4, spe:252 }, ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 } },
    ],
  },
}

function toArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  return Object.values(val)
}

function statusLabel(s) {
  return { brn: 'BRL', par: 'PAR', slp: 'SOM', frz: 'GEL', psn: 'EMP', tox: 'EMP' }[s] || s.toUpperCase()
}

const TYPE_COLORS = {
  Normal: '#9099A1', Fire: '#FF9D55', Water: '#5090D3', Electric: '#F4D23C',
  Grass: '#63BC5A', Ice: '#73CEC0', Fighting: '#CE406A', Poison: '#B567CE',
  Ground: '#D97845', Flying: '#89AAE3', Psychic: '#FA7179', Bug: '#91C12F',
  Rock: '#C5B78C', Ghost: '#5269AC', Dragon: '#0A6DC4', Dark: '#5A5465',
  Steel: '#5A8EA2', Fairy: '#EC8FE6',
}

const TYPE_FR = {
  Normal:'Normal', Fire:'Feu', Water:'Eau', Electric:'Électrik',
  Grass:'Plante', Ice:'Glace', Fighting:'Combat', Poison:'Poison',
  Ground:'Sol', Flying:'Vol', Psychic:'Psy', Bug:'Insecte',
  Rock:'Roche', Ghost:'Spectre', Dragon:'Dragon', Dark:'Ténèbres',
  Steel:'Acier', Fairy:'Fée',
}

const WEATHER_FR = {
  SunnyDay:  { label: 'Soleil',  icon: '☀️' },
  RainDance: { label: 'Pluie',   icon: '🌧️' },
  Sandstorm: { label: 'Tempête de sable', icon: '🌪️' },
  Hail:      { label: 'Grêle',   icon: '🌨️' },
}

const STATUS_COLOR = { brn:'#f97316', par:'#eab308', slp:'#94a3b8', frz:'#38bdf8', psn:'#a855f7', tox:'#9333ea' }

// Traduction des attaques EN → FR (fallback : nom anglais)
const MOVE_FR = {
  // Normal
  'Tackle':'Charge','Scratch':'Griffe','Quick Attack':'Vive-Attaque',
  'Extreme Speed':'Vitesse Extrême','Body Slam':'Plaquage','Double-Edge':'Damocles',
  'Hyper Voice':'Chant Canon','Boomburst':'Ultracri','Facade':'Façade','Return':'Retour',
  'Last Resort':'Dernier Recours','Endeavor':'Retour de Force','Protect':'Abri',
  'Rest':'Repos','Sleep Talk':'Blabla Dodo','Substitute':'Clonage','Baton Pass':'Relais',
  'Snore':'Ronflement','Growl':'Rugissement','Tail Whip':'Mimi-Queue',
  'Double Team':'Jackpot','Harden':'Armure','Swagger':'Fanfarade',
  // Feu
  'Flamethrower':'Lance-Flamme','Fire Blast':'Déflagration','Heat Wave':'Canicule',
  'Overheat':'Surchauffe','Flare Blitz':'Éclate-Flamme','Pyro Ball':'Balle Pyro',
  'Flame Charge':'Charge de Flamme','Will-O-Wisp':'Feu Follet','Fire Spin':'Ronde de Feu',
  'Burn Up':'Brûle-Tout','Fire Punch':'Poing de Feu','Ember':'Flammèche',
  'Flame Wheel':'Roue de Feu','Sunny Day':'Zénith','Mystical Fire':'Feu Mystique',
  // Eau
  'Surf':'Surf','Hydro Pump':'Hydrocanon','Scald':'Bouillante','Liquidation':'Aqua Choc',
  'Waterfall':'Cascade','Aqua Jet':'Aqua-Jet','Snipe Shot':'Tir Embusqué',
  'Fishious Rend':'Crocs Sauvages','Water Pulse':'Aqua-Anneau','Rain Dance':'Danse Pluie',
  'Water Gun':'Pistolet à O','Dive':'Plongeon','Brine':'Saumure','Muddy Water':'Eau Boueuse',
  // Électrik
  'Thunderbolt':'Fatal-Foudre','Thunder':'Tonnerre','Wild Charge':'Plaquage Électrik',
  'Volt Switch':'Tourne-Éclair','Thunder Wave':'Onde de Choc','Overdrive':'Overdrive',
  'Rising Voltage':'Électrovolt','Thunder Punch':'Poing Éclair','Spark':'Étincelle',
  'Nuzzle':'Papotage','Discharge':'Décharge','Charge Beam':'Onde Chargée',
  // Plante
  'Energy Ball':'Phytobombe','Giga Drain':'Méga-Sangsue','Leaf Blade':'Tranche-Herbe',
  'Wood Hammer':'Marteau Bois','Power Whip':'Fouet Liane','Leech Seed':'Vampigraine',
  'Leaf Storm':'Tornade Verte','Petal Blizzard':'Pétale-Blizzard',
  'Bullet Seed':'Graine Feu','Razor Leaf':'Tranche',
  // Glace
  'Ice Beam':'Laser Glace','Blizzard':'Blizzard','Ice Fang':'Crocs Glace',
  'Avalanche':'Avalanche','Triple Axel':'Axe Multiple','Freeze-Dry':'Surgélation',
  'Ice Punch':'Poing Glace','Icicle Crash':'Stalacto-Choc','Hail':'Grêle',
  'Aurora Veil':'Voile Aurore','Ice Shard':'Éclat de Glace',
  // Combat
  'Close Combat':'Mêlée','High Jump Kick':'Saut de Pied','Superpower':'Surpuissance',
  'Drain Punch':'Poing Vampire','Mach Punch':'Poing Mach','Body Press':'Tamponne',
  'Sacred Sword':'Lame Sacrée','Bulk Up':'Gonflage','Aura Sphere':'Sphère Aura',
  'Low Kick':'Balayage','Low Sweep':'Balayage Rapide','Brick Break':'Brise-Poings',
  'Counter':'Riposte',
  // Poison
  'Sludge Bomb':'Bombe Beurk','Sludge Wave':'Déferlante Boue','Poison Jab':'Dard-Venin',
  'Toxic':'Toxik','Venoshock':'Venin Choc','Acid':'Acide',
  // Sol
  'Earthquake':'Séisme','Earth Power':'Telluriforce','Bulldoze':'Bélier',
  'High Horsepower':'Fendoir','Dig':'Tunnel','Sand Attack':'Jet de Sable',
  'Mud Shot':'Boue-Gicle',
  // Vol
  'Brave Bird':'Oiseau Téméraire','Hurricane':'Ouragan','Air Slash':'Tranche-Air',
  'Roost':'Soin','Acrobatics':'Acrobatie','Fly':'Vol','Wing Attack':'Cru-Aile',
  'Aerial Ace':'Coupe-Vent','Tailwind':'Vent Arrière',
  // Psy
  'Psychic':'Psyko','Psyshock':'Choc Mental','Trick':'Ruse','Calm Mind':'Plénitude',
  'Future Sight':'Sens du Futur','Extrasensory':'Sens Extra',
  'Expanding Force':'Force Expansive','Trick Room':'Salle Inverse','Hypnosis':'Hypnose',
  'Psycho Cut':'Tranche Psy','Psychic Fangs':'Crocs Psy',
  // Insecte
  'U-turn':'Demi-Tour','X-Scissor':'Cisailles','Bug Buzz':'Fréquence Hexapode',
  'Lunge':'Ruée','First Impression':'Première Impression',
  // Roche
  'Stone Edge':'Lame de Roc','Rock Slide':'Éboulement','Stealth Rock':'Roc Fatal',
  'Rock Blast':'Lance-Roc','Head Smash':'Tête de Roc','Power Gem':'Gemme Éclat',
  'Ancient Power':'Pouvoir Ancien','Rock Tomb':'Tomb-Roc',
  // Spectre
  "Shadow Ball":"Ball'Ombre",'Phantom Force':'Force Spectrale','Hex':'Maléfik',
  'Shadow Claw':'Griffe Fantôme','Shadow Sneak':'Ombre Portée',
  'Spirit Shackle':'Spectrochoc','Poltergeist':'Poltergeist','Lick':'Léchage',
  'Night Shade':'Ombre Nocturne',
  // Dragon
  'Draco Meteor':'Draco-Météore','Dragon Claw':'Draco-Griffe','Outrage':'Colère',
  'Dragon Dance':'Danse Draco','Dragon Breath':'Dracosouffle','Dragon Pulse':'Dracochoc',
  'Dragon Rush':'Dracocharge','Scale Shot':'Tir Écaille',
  // Ténèbres
  'Crunch':'Mâchouille','Night Slash':'Tranche-Nuit','Sucker Punch':'Coup Bas',
  'Darkest Lariat':'Lasso Ténèbres','Knock Off':'Jackpot','Foul Play':'Mauvaise Tête',
  'Dark Pulse':'Pulsion Noire','Snarl':'Aboi','Bite':'Morsure',
  'Nasty Plot':'Machination','Beat Up':'Traquenard',
  // Acier
  'Iron Head':'Tête de Fer','Flash Cannon':'Canon Magnet','Meteor Mash':'Poing Météore',
  'Iron Defense':'Pouvoir Acier','Bullet Punch':'Poing Rapide',
  "Steel Beam":"Rayon d'Acier",'Gyro Ball':'Toupie','Iron Tail':'Queue de Fer',
  'Smart Strike':'Lame Précise',
  // Fée
  'Play Rough':'Câlin Brutal','Moonblast':'Éclat Lunaire','Spirit Break':'Fracas Spirituel',
  'Dazzling Gleam':'Éclat Magique','Misty Terrain':'Terrain Féerique',
  'Moonlight':'Clair de Lune','Charm':'Minouchat',
  // Statuts divers
  'Swords Dance':'Danse Lames','Coil':'Enroulement','Obstruct':'Obstruction',
  'Spikes':'Picots','Toxic Spikes':'Pics Vénin','Reflect':'Miroir',
  'Light Screen':'Mur Lumière','Sandstorm':'Tempête de Sable','Weather Ball':'Balle Météo',
  'Grassy Terrain':'Terrain Herbeux','Electric Terrain':'Terrain Électrique',
  'Psychic Terrain':'Terrain Psychique','Recover':'Soin','Soft-Boiled':'Éclate-Œuf',
  'Wish':'Souhait','Struggle':'Lutte',
}

const moveFr = name => MOVE_FR[name] || name

// ── HP bar ────────────────────────────────────────────────────────────────────

function HpBar({ hp, maxhp }) {
  const pct = maxhp > 0 ? Math.max(0, Math.min(100, hp / maxhp * 100)) : 0
  const cls  = pct > 50 ? 'bt-hp-fill--high' : pct > 20 ? 'bt-hp-fill--mid' : 'bt-hp-fill--low'
  return (
    <div className="bt-hp-wrap">
      <div className="bt-hp-bar">
        <div className={`bt-hp-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="bt-hp-text">{Math.max(0, hp)} / {maxhp} PV</span>
    </div>
  )
}

// ── Info card (overlay dans l'arène) ─────────────────────────────────────────

function InfoCard({ side, poke, team, name, frenchNamesById = {} }) {
  if (!poke) return null
  const speciesFr = frenchNamesById[poke.species_id] || poke.species
  return (
    <div className={`bt-info-card bt-info-card--${side}`}>
      <div className="bt-info-trainer">{name}</div>
      <div className="bt-info-nick">
        {poke.name}
        {poke.status && (
          <span className="bt-status-badge" style={{ background: `${STATUS_COLOR[poke.status]}22`, color: STATUS_COLOR[poke.status], border: `1px solid ${STATUS_COLOR[poke.status]}55` }}>
            {statusLabel(poke.status)}
          </span>
        )}
      </div>
      <div className="bt-info-meta">{speciesFr} · Niv. {poke.level}</div>
      <HpBar hp={poke.hp} maxhp={poke.maxhp} />
      <div className="bt-team-row">
        {team.map((p, i) => (
          <div key={i} className={`bt-team-dot${p.isActive && !p.fainted ? ' bt-team-dot--active' : ''}${p.fainted ? ' bt-team-dot--fainted' : ''}`}>
            <img src={`${SPRITE}/${p.species_id}.png`} alt={p.name} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Move button ───────────────────────────────────────────────────────────────

const CAT_LABEL = { Physical: 'Phy', Special: 'Spé', Status: 'Sta' }
const CAT_COLOR = { Physical: '#f97316', Special: '#818cf8', Status: '#6b7280' }

function MoveBtn({ move, onClick, disabled }) {
  const dexMove  = Dex.moves.get(move.name)
  const type     = dexMove?.type     || 'Normal'
  const power    = dexMove?.basePower ?? 0
  const category = dexMove?.category  || 'Status'
  const clr      = TYPE_COLORS[type] || '#9099A1'
  const ppRatio  = move.maxpp > 0 ? move.pp / move.maxpp : 1
  const ppCls    = ppRatio <= 0.25 ? 'bt-move-pp--low' : ppRatio <= 0.5 ? 'bt-move-pp--mid' : ''

  return (
    <button
      className="bt-move-btn"
      style={{ '--type-clr': clr }}
      onClick={onClick}
      disabled={disabled || move.disabled || move.pp === 0}
    >
      <span className="bt-move-name">{moveFr(move.name)}</span>
      <span className="bt-move-meta">
        {TYPE_FR[type] || type}
        <span className="bt-move-cat" style={{ color: CAT_COLOR[category] }}>
          {CAT_LABEL[category]}
        </span>
        {power > 0 ? <span className="bt-move-power">{power}</span> : null}
        <span className={`bt-move-pp ${ppCls}`}>{move.pp}/{move.maxpp} PP</span>
      </span>
    </button>
  )
}

// Convertit les events Showdown en entrées de log (sans délai, pour Firebase)
function eventsToLog(events, prevLog, turn, p1Name, p2Name) {
  const STATUS_LABELS = { brn: 'est brûlé', par: 'est paralysé', slp: "s'est endormi", frz: 'est gelé', psn: 'est empoisonné', tox: 'est gravement empoisonné' }
  const entries = [...prevLog, { cls: 'bt-log--turn', text: `Tour ${turn}` }]
  for (const ev of events) {
    switch (ev.type) {
      case 'move':    entries.push({ cls: ev.side === 'p1' ? 'bt-log--p1' : 'bt-log--p2', text: `▶ ${ev.pokemon} utilise ${moveFr(ev.move)} !` }); break
      case 'miss':    entries.push({ cls: 'bt-log--resist', text: '  → Raté !' }); break
      case 'crit':    entries.push({ cls: 'bt-log--super',  text: '  → Coup critique !' }); break
      case 'faint':   entries.push({ cls: 'bt-log--faint',  text: `✕ ${ev.pokemon} est K.O. !` }); break
      case 'switch':  entries.push({ cls: 'bt-log--switch', text: `↪ ${ev.side === 'p1' ? p1Name : p2Name} envoie ${ev.pokemon} !` }); break
      case 'heal':    entries.push({ cls: 'bt-log--switch', text: `  → ${ev.pokemon} récupère des PV.` }); break
      case 'curestatus': entries.push({ cls: 'bt-log--switch', text: `  ✓ ${ev.pokemon} est guéri de son statut.` }); break
      case 'status':  entries.push({ cls: 'bt-log--faint',  text: `  ⚡ ${ev.pokemon} ${STATUS_LABELS[ev.status] || ev.status} !` }); break
      case 'damage':
        if (ev.effectiveness === 0)       entries.push({ cls: 'bt-log--immune', text: `  → Ça n'affecte pas ${ev.pokemon}…` })
        else if (ev.effectiveness >= 2)   entries.push({ cls: 'bt-log--super',  text: `  → C'est super efficace ! ${ev.pokemon} perd ${ev.damage} PV !` })
        else if (ev.effectiveness < 1)    entries.push({ cls: 'bt-log--resist', text: `  → Ce n'est pas très efficace… ${ev.pokemon} perd ${ev.damage} PV.` })
        else entries.push({ cls: ev.side === 'p2' ? 'bt-log--p1' : 'bt-log--p2', text: `  → ${ev.pokemon} perd ${ev.damage} PV.` })
        break
      default: break
    }
  }
  return entries
}

// ── BattleTab ─────────────────────────────────────────────────────────────────

export default function BattleTab({ activeCode, myPseudo, battleConfig, frenchNamesById = {}, onBattleEnd }) {
  const fbDb = useMemo(() => {
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
    return getDatabase(app)
  }, [])

  const [players,       setPlayers]       = useState({})
  const [p1Key,         setP1Key]         = useState(null)
  const [p2Key,         setP2Key]         = useState(null)
  const [mode,          setMode]          = useState('local')  // 'local' | 'online'
  const [myRole,        setMyRole]        = useState(null)     // 'p1' | 'p2'
  const [fbBattle,      setFbBattle]      = useState(null)     // état Firebase (mode online)
  const [waitingOpp,    setWaitingOpp]    = useState(false)
  const [timeLeft,      setTimeLeft]      = useState(null)     // timer tour (60→0)
  const [lastMoves,     setLastMoves]     = useState(null)     // {p1, p2} dernier tour
  const [eventsId,      setEventsId]      = useState(0)        // pour détecter nouveaux events P2
  const [uiState,       setUiState]       = useState(null)
  const [p1Moves,       setP1Moves]       = useState([])
  const [log,           setLog]           = useState([])
  const [animating,     setAnimating]     = useState(false)
  const [switchOptions, setSwitchOptions] = useState([])
  const [result,        setResult]        = useState(null)
  const [battleErr,     setBattleErr]     = useState(null)
  const [oppLeft,       setOppLeft]       = useState(false)  // adversaire déconnecté
  const [weather,       setWeather]       = useState(null)

  const battleRef    = useRef(null)
  const logEndRef    = useRef(null)
  const resolvingRef = useRef(false)
  const timerRef     = useRef(null)
  const autoStartRef = useRef(false)
  const onBattleEndRef = useRef(onBattleEnd)
  useEffect(() => { onBattleEndRef.current = onBattleEnd }, [onBattleEnd])

  // Charger les joueurs de la session depuis Firebase
  useEffect(() => {
    if (!activeCode) return
    const unsub = onValue(ref(fbDb, `sessions/${activeCode}/players`), snap => {
      const val = snap.val() || {}
      setPlayers(val)
      if (myPseudo && val[myPseudo] && !p1Key) setP1Key(myPseudo)
    })
    return unsub
  }, [activeCode]) // eslint-disable-line

  // Auto-join P2 : si un combat existe dans Firebase et qu'on n'est pas l'hôte,
  // rejoindre automatiquement comme P2 sans rien sélectionner
  const myRoleRef = useRef(myRole)
  useEffect(() => { myRoleRef.current = myRole }, [myRole])

  useEffect(() => {
    if (!activeCode) return
    const battleDbRef = ref(fbDb, `sessions/${activeCode}/battle`)
    return onValue(battleDbRef, snap => {
      const data = snap.val()
      if (myRoleRef.current) return // déjà assigné (hôte ou déjà P2)
      if (!data?.state || !data?.phase || data.phase === 'cancelled' || data.phase === 'over') return
      // Un combat est en cours lancé par quelqu'un d'autre → rejoindre comme P2
      setMode('online')
      setMyRole('p2')
      setP1Key(data.p1_name)
      setP2Key(data.p2_name)
    })
  }, [activeCode, fbDb]) // eslint-disable-line

  // Configurer + auto-démarrer depuis un défi (challenge flow)
  useEffect(() => {
    if (!battleConfig) return
    const { p1Pseudo, p2Pseudo, myRole: role } = battleConfig
    setMode('online')
    setP1Key(p1Pseudo)
    setP2Key(p2Pseudo)
    setMyRole(role)
    myRoleRef.current = role
    if (role === 'p1') autoStartRef.current = true
  }, [battleConfig])

  // Auto-start P1 dès que les équipes sont disponibles
  useEffect(() => {
    if (!autoStartRef.current || !p1Key || !p2Key) return
    const hasTeam = pseudo => toArray(effectivePlayers[pseudo]?.team).some(p => p?.species_id && !p.is_empty)
    if (!hasTeam(p1Key) || !hasTeam(p2Key)) return
    autoStartRef.current = false
    startBattle()
  }, [p1Key, p2Key, effectivePlayers]) // eslint-disable-line

  // Abonnement Firebase pour le mode online
  useEffect(() => {
    if (!activeCode || mode !== 'online') return
    const battleDbRef = ref(fbDb, `sessions/${activeCode}/battle`)
    return onValue(battleDbRef, snap => {
      const data = snap.val()
      setFbBattle(data)
      if (!data) return

      if (myRole === 'p2') {
        // Première sync P2 : enregistrer la présence
        if (data.state && !data.presence?.p2) {
          const presRef = ref(fbDb, `sessions/${activeCode}/battle/presence/p2`)
          set(presRef, true)
          onDisconnect(presRef).remove()
        }
        if (data.state) { setUiState(data.state); setWeather(data.state.weather ?? null) }
        // Animations P2 : rejouer les events quand events_id change
        if (data.events && data.events_id !== undefined) {
          setEventsId(prev => {
            if (data.events_id !== prev) {
              // Rejouer en async hors du setState
              setTimeout(async () => {
                setLog(data.log_before || [])
                await new Promise(r => setTimeout(r, 50))
                // processEvents sera appelé via l'effet eventsId ci-dessous
              }, 0)
            }
            return data.events_id
          })
        }
        if (data.log && !data.events) setLog(data.log)
        if (data.phase === 'picking' || data.phase === 'p2_switching') setWaitingOpp(false)
        if (data.phase === 'p1_switching') setWaitingOpp(true)
        if (data.winner) {
          const isP1Win = data.winner === 'p1'
          const winTeam = isP1Win ? data.state?.p1?.team : data.state?.p2?.team
          setTimeout(() => setResult({
            winName:   isP1Win ? data.p1_name : data.p2_name,
            loseName:  isP1Win ? data.p2_name : data.p1_name,
            turn:      data.turn,
            survivors: (winTeam || []).filter(p => !p.fainted).length,
          }), 700)
        }
        // Adversaire (P1) déconnecté
        if (data.presence && !data.presence.p1) setOppLeft(true)
      }

      // Annulation (les deux joueurs)
      if (data.phase === 'cancelled') {
        clearInterval(timerRef.current)
        battleRef.current    = null
        resolvingRef.current = false
        autoStartRef.current = false
        setUiState(null)
        setP1Moves([])
        setSwitchOptions([])
        setLog([])
        setResult(null)
        setAnimating(false)
        setWaitingOpp(false)
        setTimeLeft(null)
        setLastMoves(null)
        setOppLeft(false)
        setFbBattle(null)
        // P2 revient au tracker automatiquement (P1 gère lui-même dans abandonBattle)
        if (myRole === 'p2') {
          setMyRole(null)
          myRoleRef.current = null
          onBattleEndRef.current?.()
        }
      }
    })
  }, [activeCode, mode, myRole, fbDb]) // eslint-disable-line

  // P1 surveille la présence de P2
  useEffect(() => {
    if (!activeCode || mode !== 'online' || myRole !== 'p1' || !uiState) return
    const presRef = ref(fbDb, `sessions/${activeCode}/battle/presence/p2`)
    return onValue(presRef, snap => {
      if (snap.val() === null) setOppLeft(true)
      else setOppLeft(false)
    })
  }, [activeCode, mode, myRole, fbDb, !!uiState]) // eslint-disable-line

  // P2 : rejouer les animations quand events_id change
  useEffect(() => {
    if (mode !== 'online' || myRole !== 'p2' || !fbBattle?.events) return
    ;(async () => {
      setAnimating(true)
      setLog(fbBattle.log_before || [])
      await processEvents(fbBattle.events)
      setLog(fbBattle.log)
      setAnimating(false)
    })()
  }, [eventsId]) // eslint-disable-line

  // Hôte (P1) : résoudre quand les deux moves sont soumis
  useEffect(() => {
    if (mode !== 'online' || myRole !== 'p1') return
    if (!fbBattle || fbBattle.phase !== 'picking') return
    if (fbBattle.p1_move == null || fbBattle.p2_move == null) return
    if (resolvingRef.current) return
    resolvingRef.current = true
    hostResolveTurn(fbBattle.p1_move, fbBattle.p2_move)
  }, [fbBattle]) // eslint-disable-line

  // Hôte (P1) : résoudre le switch P2 quand P2 l'a soumis
  useEffect(() => {
    if (mode !== 'online' || myRole !== 'p1') return
    if (!fbBattle || fbBattle.phase !== 'p2_switching') return
    if (fbBattle.p2_switch == null) return
    if (resolvingRef.current) return
    resolvingRef.current = true
    hostResolveP2Switch(fbBattle.p2_switch)
  }, [fbBattle]) // eslint-disable-line

  // Timer : démarrer/arrêter selon la phase
  useEffect(() => {
    if (mode !== 'online' || !fbBattle) return
    clearInterval(timerRef.current)
    if (fbBattle.phase === 'picking' && !fbBattle.winner) {
      setTimeLeft(60)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            if (myRole === 'p1') hostTimeoutMove()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setTimeLeft(null)
    }
    return () => clearInterval(timerRef.current)
  }, [fbBattle?.phase, fbBattle?.turn]) // eslint-disable-line

  // Scroll log vers le bas
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // Toujours proposer les mocks en plus des vrais joueurs (pour tester)
  const effectivePlayers = useMemo(() => {
    const merged = { ...players }
    for (const [k, v] of Object.entries(MOCK_PLAYERS)) {
      if (!(k in merged)) merged[k] = v
    }
    return merged
  }, [players])

  const playerList = Object.keys(effectivePlayers)

  // ── Démarrer le combat ─────────────────────────────────────────────────────

  async function startBattle() {
    if (!p1Key || !p2Key || p1Key === p2Key) return
    const rawTeam = side => toArray(effectivePlayers[side]?.team)
      .filter(p => p?.species_id && !p.is_empty)
      .slice(0, 6)
    const team1 = { name: p1Key, pokemon: rawTeam(p1Key) }
    const team2 = { name: p2Key, pokemon: rawTeam(p2Key) }
    if (!team1.pokemon.length || !team2.pokemon.length) return

    setBattleErr(null)
    // En mode online manuel (sans battleConfig), le lanceur est P1
    if (mode === 'online' && !myRole) {
      setMyRole('p1')
      myRoleRef.current = 'p1'
    }
    const initLog = [{ cls: 'bt-log--info', text: '⚔️ Le duel commence ! Choisissez votre attaque.' }]

    if (mode === 'local' || mode === 'online') {
      try {
        const b = new ShowdownBattle(team1, team2)
        battleRef.current = b
        const state = b.getState()
        setUiState(state)
        setP1Moves(b.p1Moves)
        setLog(initLog)
        setResult(null)
        setAnimating(false)
        setWaitingOpp(false)

        if (mode === 'online') {
          await set(ref(fbDb, `sessions/${activeCode}/battle`), {
            phase:    'picking',
            turn:     b.turn,
            p1_name:  p1Key,
            p2_name:  p2Key,
            p1_move:  null,
            p2_move:  null,
            p2_moves: b.p2Moves,
            state,
            log:      initLog,
            winner:   null,
          })
          // Présence P1 : supprimée automatiquement si déconnexion
          const presRef = ref(fbDb, `sessions/${activeCode}/battle/presence/p1`)
          await set(presRef, true)
          onDisconnect(presRef).remove()
        }
      } catch (e) {
        console.error('[BattleTab] Erreur init battle:', e)
        setBattleErr(e.message)
      }
    }
    // P2 (client) : le combat démarre dès que Firebase se met à jour (via l'abonnement)
  }

  async function resetBattle() {
    clearInterval(timerRef.current)
    battleRef.current    = null
    resolvingRef.current = false
    autoStartRef.current = false
    setUiState(null)
    setP1Moves([])
    setSwitchOptions([])
    setLog([])
    setResult(null)
    setAnimating(false)
    setWaitingOpp(false)
    setTimeLeft(null)
    setLastMoves(null)
    setOppLeft(false)
    setMyRole(null)
    myRoleRef.current = null
    setWeather(null)
    if (mode === 'online') {
      await set(ref(fbDb, `sessions/${activeCode}/battle`), null)
      setFbBattle(null)
    }
    onBattleEndRef.current?.()
  }

  // Abandon : prévenir l'adversaire puis nettoyer
  async function abandonBattle() {
    clearInterval(timerRef.current)
    if (mode === 'online') {
      await set(ref(fbDb, `sessions/${activeCode}/battle/phase`), 'cancelled')
      // Petite pause pour que l'adversaire reçoive l'update avant suppression
      await new Promise(r => setTimeout(r, 800))
      await set(ref(fbDb, `sessions/${activeCode}/battle`), null)
      setFbBattle(null)
    }
    battleRef.current    = null
    resolvingRef.current = false
    setUiState(null)
    setP1Moves([])
    setSwitchOptions([])
    setLog([])
    setResult(null)
    setAnimating(false)
    setWaitingOpp(false)
    setTimeLeft(null)
    setLastMoves(null)
    setOppLeft(false)
    setMyRole(null)
    myRoleRef.current = null
    autoStartRef.current = false
    setWeather(null)
    onBattleEndRef.current?.()
  }

  // ── Traitement des événements de combat ───────────────────────────────────

  const processEvents = useCallback(async (events) => {
    for (const ev of events) {
      switch (ev.type) {
        case 'move':
          setLog(prev => [...prev, { cls: ev.side === 'p1' ? 'bt-log--p1' : 'bt-log--p2', text: `▶ ${ev.pokemon} utilise ${moveFr(ev.move)} !` }])
          await sleep(500)
          break
        case 'miss':
          setLog(prev => [...prev, { cls: 'bt-log--resist', text: '  → Raté !' }])
          await sleep(400)
          break
        case 'crit':
          setLog(prev => [...prev, { cls: 'bt-log--super', text: '  → Coup critique !' }])
          await sleep(300)
          break
        case 'damage':
          if (ev.effectiveness === 0) {
            setLog(prev => [...prev, { cls: 'bt-log--immune', text: `  → Ça n'affecte pas ${ev.pokemon}…` }])
          } else if (ev.effectiveness >= 2) {
            setLog(prev => [...prev, { cls: 'bt-log--super', text: `  → C'est super efficace ! ${ev.pokemon} perd ${ev.damage} PV !` }])
          } else if (ev.effectiveness < 1) {
            setLog(prev => [...prev, { cls: 'bt-log--resist', text: `  → Ce n'est pas très efficace… ${ev.pokemon} perd ${ev.damage} PV.` }])
          } else {
            setLog(prev => [...prev, { cls: ev.side === 'p2' ? 'bt-log--p1' : 'bt-log--p2', text: `  → ${ev.pokemon} perd ${ev.damage} PV.` }])
          }
          setUiState(battleRef.current?.getState())
          await sleep(450)
          break
        case 'heal':
          setLog(prev => [...prev, { cls: 'bt-log--switch', text: `  → ${ev.pokemon} récupère des PV.` }])
          setUiState(battleRef.current?.getState())
          await sleep(400)
          break
        case 'faint':
          setLog(prev => [...prev, { cls: 'bt-log--faint', text: `✕ ${ev.pokemon} est K.O. !` }])
          setUiState(battleRef.current?.getState())
          await sleep(700)
          break
        case 'switch':
          setLog(prev => [...prev, { cls: 'bt-log--switch', text: `↪ ${ev.side === 'p1' ? p1Key : p2Key} envoie ${ev.pokemon} !` }])
          setUiState(battleRef.current?.getState())
          await sleep(600)
          break
        case 'status': {
          const labels = { brn: 'est brûlé', par: 'est paralysé', slp: "s'est endormi", frz: 'est gelé', psn: 'est empoisonné', tox: 'est gravement empoisonné' }
          setLog(prev => [...prev, { cls: 'bt-log--faint', text: `  ⚡ ${ev.pokemon} ${labels[ev.status] || ev.status} !` }])
          await sleep(400)
          break
        }
        case 'curestatus':
          setLog(prev => [...prev, { cls: 'bt-log--switch', text: `  ✓ ${ev.pokemon} est guéri de son statut.` }])
          await sleep(300)
          break
        case 'weather':
          setWeather(ev.weather)
          if (ev.weather && WEATHER_FR[ev.weather]) {
            setLog(prev => [...prev, { cls: 'bt-log--info', text: `  ${WEATHER_FR[ev.weather].icon} ${WEATHER_FR[ev.weather].label} !` }])
          } else if (!ev.weather) {
            setLog(prev => [...prev, { cls: 'bt-log--info', text: '  Le temps redevient normal.' }])
          }
          await sleep(300)
          break
        default: break
      }
    }
  }, [p1Key, p2Key])

  const applyPostTurn = useCallback((battle) => {
    setUiState(battle.getState())
    if (battle.over) {
      const finalState = battle.getState()
      const isP1       = battle.winner === 'p1'
      const winTeam    = isP1 ? finalState.p1.team : finalState.p2.team
      setTimeout(() => setResult({
        winName:   isP1 ? p1Key : p2Key,
        loseName:  isP1 ? p2Key : p1Key,
        turn:      battle.turn,
        survivors: winTeam.filter(p => !p.fainted).length,
      }), 700)
    } else if (battle.p1NeedsSwitch) {
      // Le joueur doit choisir quel Pokémon envoyer
      const state = battle.getState()
      setSwitchOptions(state.p1.team
        .map((p, i) => ({ ...p, teamIdx: i }))
        .filter(p => !p.fainted && !p.isActive)
      )
    } else {
      setP1Moves(battle.p1Moves)
    }
  }, [p1Key, p2Key])

  // ── Helpers hôte ──────────────────────────────────────────────────────────

  // Écrit l'état après résolution et détermine la prochaine phase
  async function hostWriteState(battle, events, prevLog, prevFbBattle, extraFields = {}) {
    const newState  = battle.getState()
    const logBefore = prevLog
    const newLog    = eventsToLog(events, prevLog, prevFbBattle?.turn ?? battle.turn, p1Key, p2Key)
    const evId      = (prevFbBattle?.events_id ?? 0) + 1

    setUiState(newState)
    setLog(newLog)

    // lastMoves : trouver les attaques utilisées ce tour
    const p1Move = events.find(e => e.type === 'move' && e.side === 'p1')
    const p2Move = events.find(e => e.type === 'move' && e.side === 'p2')
    if (p1Move || p2Move) setLastMoves({ p1: p1Move?.move || null, p2: p2Move?.move || null })

    const base = {
      state: newState, log: newLog, log_before: logBefore,
      events, events_id: evId,
      turn: battle.turn, p1_move: null, p2_move: null, p2_switch: null,
    }

    if (battle.over) {
      await set(ref(fbDb, `sessions/${activeCode}/battle`), { ...prevFbBattle, ...base, phase: 'over', winner: battle.winner })
      // Sauvegarder dans l'historique
      const winnerName = battle.winner === 'p1' ? p1Key : p2Key
      const loserName  = battle.winner === 'p1' ? p2Key : p1Key
      const survivors  = newState[battle.winner].team.filter(p => !p.fainted).length
      await set(ref(fbDb, `sessions/${activeCode}/battle_history/${Date.now()}`), {
        date: Date.now(), winner: winnerName, loser: loserName,
        turns: battle.turn, survivors,
      })
      applyPostTurn(battle)
    } else if (battle.p1NeedsSwitch && battle.p2NeedsSwitch) {
      // Les deux doivent switcher : P1 d'abord
      const p2SwitchOpts = newState.p2.team.map((p, i) => ({ ...p, teamIdx: i })).filter(p => !p.fainted && !p.isActive)
      await set(ref(fbDb, `sessions/${activeCode}/battle`), { ...prevFbBattle, ...base, phase: 'p1_switching', p2_moves: battle.p2Moves, p2_switch_options: p2SwitchOpts })
      setSwitchOptions(newState.p1.team.map((p, i) => ({ ...p, teamIdx: i })).filter(p => !p.fainted && !p.isActive))
    } else if (battle.p1NeedsSwitch) {
      await set(ref(fbDb, `sessions/${activeCode}/battle`), { ...prevFbBattle, ...base, phase: 'p1_switching', p2_moves: battle.p2Moves })
      setSwitchOptions(newState.p1.team.map((p, i) => ({ ...p, teamIdx: i })).filter(p => !p.fainted && !p.isActive))
    } else if (battle.p2NeedsSwitch) {
      const p2SwitchOpts = newState.p2.team.map((p, i) => ({ ...p, teamIdx: i })).filter(p => !p.fainted && !p.isActive)
      await set(ref(fbDb, `sessions/${activeCode}/battle`), { ...prevFbBattle, ...base, phase: 'p2_switching', p2_moves: battle.p2Moves, p2_switch_options: p2SwitchOpts })
    } else {
      await set(ref(fbDb, `sessions/${activeCode}/battle`), { ...prevFbBattle, ...base, phase: 'picking', p2_moves: battle.p2Moves })
      setP1Moves(battle.p1Moves)
    }
  }

  async function hostResolveTurn(p1MoveIdx, p2MoveIdx) {
    const battle = battleRef.current
    if (!battle || battle.over) { resolvingRef.current = false; return }

    setAnimating(true)
    setWaitingOpp(false)
    setP1Moves([])

    const prevLog = fbBattle?.log || []
    const events  = battle.choose(p1MoveIdx, p2MoveIdx, false) // autoP2=false
    await processEvents(events)
    await hostWriteState(battle, events, prevLog, fbBattle)

    setAnimating(false)
    resolvingRef.current = false
  }

  async function hostResolveP2Switch(teamIdx) {
    const battle = battleRef.current
    if (!battle || !battle.p2NeedsSwitch) { resolvingRef.current = false; return }

    setAnimating(true)
    const prevLog = fbBattle?.log || []
    const events  = battle.chooseP2Switch(teamIdx)
    await processEvents(events)
    await hostWriteState(battle, events, prevLog, fbBattle)

    setAnimating(false)
    resolvingRef.current = false
  }

  // Timeout : l'hôte joue un move aléatoire pour le joueur en retard
  async function hostTimeoutMove() {
    if (!fbBattle || fbBattle.phase !== 'picking') return
    const battle = battleRef.current
    if (!battle) return
    const p1 = fbBattle.p1_move != null ? fbBattle.p1_move : 0
    const p2 = fbBattle.p2_move != null ? fbBattle.p2_move : 0
    if (!resolvingRef.current) {
      resolvingRef.current = true
      await hostResolveTurn(p1, p2)
    }
  }

  // ── Choisir une attaque ────────────────────────────────────────────────────

  const onChooseMove = useCallback(async (moveIdx) => {
    if (animating) return

    if (mode === 'online') {
      // P1 : écrire dans Firebase et attendre P2
      if (myRole === 'p1') {
        setP1Moves([])
        setWaitingOpp(true)
        await set(ref(fbDb, `sessions/${activeCode}/battle/p1_move`), moveIdx)
      }
      // P2 : écrire dans Firebase et attendre P1
      if (myRole === 'p2') {
        setWaitingOpp(true)
        await set(ref(fbDb, `sessions/${activeCode}/battle/p2_move`), moveIdx)
      }
      return
    }

    // Mode local (inchangé)
    const battle = battleRef.current
    if (!battle || battle.over) return
    setAnimating(true)
    setP1Moves([])
    setSwitchOptions([])
    setLog(prev => [...prev, { cls: 'bt-log--turn', text: `Tour ${battle.turn + 1}` }])
    const events = battle.choose(moveIdx)
    await processEvents(events)
    applyPostTurn(battle)
    setAnimating(false)
  }, [animating, mode, myRole, activeCode, fbDb, processEvents, applyPostTurn])

  // ── Choisir un Pokémon à envoyer ──────────────────────────────────────────

  const onChooseSwitch = useCallback(async (teamIdx) => {
    const battle = battleRef.current
    if (!battle || !battle.p1NeedsSwitch || animating) return
    setAnimating(true)
    setSwitchOptions([])

    const prevLog = [...log]
    const events  = battle.chooseSwitch(teamIdx, mode === 'local') // autoP2 seulement en local
    await processEvents(events)

    if (mode === 'online') {
      await hostWriteState(battle, events, prevLog, fbBattle)
    } else {
      applyPostTurn(battle)
    }

    setAnimating(false)
  }, [animating, mode, fbBattle, log, activeCode, fbDb, p1Key, p2Key, processEvents, applyPostTurn]) // eslint-disable-line

  // P2 (client) : soumettre son choix de switch
  const onChooseP2Switch = useCallback(async (teamIdx) => {
    if (animating || mode !== 'online' || myRole !== 'p2') return
    setWaitingOpp(true)
    await set(ref(fbDb, `sessions/${activeCode}/battle/p2_switch`), teamIdx)
  }, [animating, mode, myRole, activeCode, fbDb])

  // ── Pas de session ─────────────────────────────────────────────────────────

  if (!activeCode) {
    return (
      <div className="bt-empty">
        <p>Rejoins une session pour pouvoir combattre.</p>
      </div>
    )
  }

  // (toujours ≥ 2 grâce aux mocks, donc ce cas n'arrive plus en dev)

  // ── Sélection des joueurs ──────────────────────────────────────────────────

  if (!uiState) {
    // Challenge flow : le combat se configure automatiquement
    if (battleConfig) {
      return (
        <div className="bt-setup">
          <div className="spinner" />
          <h2 className="bt-setup-title">⚔ Duel en cours…</h2>
          <p className="bt-setup-hint">
            {battleConfig.myRole === 'p1'
              ? 'Chargement des équipes…'
              : `En attente que ${battleConfig.p1Pseudo} lance le combat…`}
          </p>
        </div>
      )
    }

    const canStart = p1Key && p2Key && p1Key !== p2Key
    return (
      <div className="bt-setup">
        <h2 className="bt-setup-title">Nouveau combat</h2>

        {/* Mode toggle */}
        <div className="bt-setup-mode">
          {['local', 'online'].map(m => (
            <button
              key={m}
              className={`bt-setup-mode-btn${mode === m ? ' bt-setup-mode-btn--active' : ''}`}
              onClick={() => { setMode(m); setMyRole(null) }}
            >
              {m === 'local' ? 'Solo (IA)' : 'Multijoueur'}
            </button>
          ))}
        </div>

        <div className="bt-setup-players">
          {[{ label: 'Joueur 1 (toi)', value: p1Key, set: setP1Key, exclude: p2Key },
            { label: 'Joueur 2 (adversaire)', value: p2Key, set: setP2Key, exclude: p1Key }]
            .map(({ label, value, set: setter, exclude }) => (
              <div key={label} className="bt-setup-col">
                <span className="bt-setup-label">{label}</span>
                <div className="bt-setup-options">
                  {playerList.map(p => (
                    <button
                      key={p}
                      className={`bt-setup-option${value === p ? ' bt-setup-option--selected' : ''}${exclude === p ? ' bt-setup-option--disabled' : ''}`}
                      onClick={() => exclude !== p && setter(p)}
                      disabled={exclude === p}
                    >
                      <img
                        src={`${SPRITE}/${toArray(effectivePlayers[p]?.team).find(pk => pk?.species_id)?.species_id || 0}.png`}
                        className="bt-setup-avatar"
                        alt=""
                      />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {mode === 'online' && (
          <p className="bt-setup-hint">
            Lance le combat — ton adversaire rejoindra automatiquement sur son appareil.
          </p>
        )}

        <button
          className="bt-setup-start"
          onClick={startBattle}
          disabled={!canStart}
        >
          Lancer le combat
        </button>

        {battleErr && (
          <div className="bt-setup-error">
            ⚠ {battleErr}
            <br />
            <small>Lance une synchronisation de la save pour mettre à jour les données.</small>
          </div>
        )}
      </div>
    )
  }

  // ── Arène de combat ────────────────────────────────────────────────────────

  const { p1, p2 } = uiState


  return (
    <div className="bt-root">
      {/* ── Arène ── */}
      <div className="bt-arena">
        {/* Sprite + terrain adversaire */}
        {p2.active && (
          <>
            <div className="bt-terrain bt-terrain--opp" />
            <img
              src={`${SPRITE}/${p2.active.species_id}.png`}
              alt={p2.active.name}
              className={`bt-sprite-arena bt-sprite-arena--opp${p2.active.fainted ? ' bt-sprite-arena--fainted' : ''}`}
            />
          </>
        )}

        {/* Sprite + terrain joueur */}
        {p1.active && (
          <>
            <div className="bt-terrain bt-terrain--player" />
            <img
              src={`${SPRITE}/${p1.active.species_id}.png`}
              alt={p1.active.name}
              className={`bt-sprite-arena bt-sprite-arena--player${p1.active.fainted ? ' bt-sprite-arena--fainted' : ''}`}
            />
          </>
        )}

        {/* Cartes d'info (overlay verre) */}
        <InfoCard side="opp"    poke={p2.active} team={p2.team} name={p2Key} frenchNamesById={frenchNamesById} />
        <InfoCard side="player" poke={p1.active} team={p1.team} name={p1Key} frenchNamesById={frenchNamesById} />

        {/* Header : météo + tour + indicateur online */}
        <div className="bt-arena-header">
          {weather && WEATHER_FR[weather] && (
            <div className="bt-weather-badge">{WEATHER_FR[weather].icon} {WEATHER_FR[weather].label}</div>
          )}
          <div className="bt-turn-pill">{battleRef.current?.over ? 'Terminé' : `Tour ${uiState.turn}`}</div>
          {mode === 'online' && !result && (
            <div className={`bt-turn-indicator${waitingOpp || animating ? ' bt-turn-indicator--wait' : ' bt-turn-indicator--mine'}`}>
              {waitingOpp || animating ? 'En attente…' : '⚡ À toi !'}
            </div>
          )}
        </div>

        {/* Abandon (online only) */}
        {mode === 'online' && !result && (
          <button className="bt-abandon-btn" onClick={abandonBattle}>Abandonner</button>
        )}
      </div>

      {/* ── Zone basse : attaques | log ── */}
      <div className="bt-bottom">
        <div className="bt-moves-col">
          {/* Timer */}
          {mode === 'online' && timeLeft !== null && !result && (
            <div className="bt-timer">
              <div
                className={`bt-timer-bar${timeLeft <= 10 ? ' bt-timer-bar--low' : timeLeft <= 20 ? ' bt-timer-bar--mid' : ''}`}
                style={{ width: `${(timeLeft / 60) * 100}%` }}
              />
              <span className="bt-timer-text">{timeLeft}s</span>
            </div>
          )}

          {/* Banner dernier tour */}
          {lastMoves && !animating && !result && (lastMoves.p1 || lastMoves.p2) && (
            <div className="bt-last-moves">
              {lastMoves.p1 && <span className="bt-last-move bt-last-move--p1">{p1Key} : {moveFr(lastMoves.p1)}</span>}
              {lastMoves.p2 && <span className="bt-last-move bt-last-move--p2">{p2Key} : {moveFr(lastMoves.p2)}</span>}
            </div>
          )}

          {/* Attaques P1 (local ou hôte online) */}
          {!result && !waitingOpp && p1Moves.length > 0 && (mode === 'local' || myRole === 'p1') && (
            <div className="bt-move-panel">
              <div className="bt-move-label">Attaque de {p1Key}</div>
              <div className="bt-move-grid">
                {p1Moves.map((move, i) => (
                  <MoveBtn key={i} move={move} onClick={() => onChooseMove(i)} disabled={animating} />
                ))}
              </div>
            </div>
          )}

          {/* Attaques P2 (client online) */}
          {!result && !waitingOpp && mode === 'online' && myRole === 'p2' && fbBattle?.phase === 'picking' && (
            <div className="bt-move-panel">
              <div className="bt-move-label">Attaque de {p2Key}</div>
              <div className="bt-move-grid">
                {(fbBattle?.p2_moves || []).map((move, i) => (
                  <MoveBtn key={i} move={move} onClick={() => onChooseMove(i)} disabled={animating || waitingOpp} />
                ))}
              </div>
            </div>
          )}

          {/* Switch P1 */}
          {!result && switchOptions.length > 0 && (mode === 'local' || myRole === 'p1') && (
            <div className="bt-switch-panel">
              <div className="bt-switch-label">Quel Pokémon envoyer ?</div>
              <div className="bt-switch-grid">
                {switchOptions.map(p => (
                  <button key={p.teamIdx} className="bt-switch-btn" onClick={() => onChooseSwitch(p.teamIdx)} disabled={animating}>
                    <img src={`${SPRITE}/${p.species_id}.png`} alt={p.name} />
                    <div>
                      <div className="bt-switch-name">{p.name}</div>
                      <div className="bt-switch-meta">Niv. {p.level} · {Math.max(0, p.hp)}/{p.maxhp} PV</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Switch P2 (client online) */}
          {!result && mode === 'online' && myRole === 'p2' && fbBattle?.phase === 'p2_switching' && !waitingOpp && (
            <div className="bt-switch-panel">
              <div className="bt-switch-label">Quel Pokémon envoyer ?</div>
              <div className="bt-switch-grid">
                {(fbBattle?.p2_switch_options || []).map(p => (
                  <button key={p.teamIdx} className="bt-switch-btn" onClick={() => onChooseP2Switch(p.teamIdx)} disabled={animating}>
                    <img src={`${SPRITE}/${p.species_id}.png`} alt={p.name} />
                    <div>
                      <div className="bt-switch-name">{p.name}</div>
                      <div className="bt-switch-meta">Niv. {p.level} · {Math.max(0, p.hp)}/{p.maxhp} PV</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* États d'attente */}
          {!result && waitingOpp && !animating && (
            <div className="bt-move-panel bt-move-panel--waiting">
              <span className="bt-waiting">En attente de l'adversaire…</span>
            </div>
          )}
          {!result && mode === 'online' && myRole === 'p2' && fbBattle?.phase === 'p1_switching' && !waitingOpp && (
            <div className="bt-move-panel bt-move-panel--waiting">
              <span className="bt-waiting">{p1Key} choisit son Pokémon…</span>
            </div>
          )}
          {animating && !result && (
            <div className="bt-move-panel bt-move-panel--waiting">
              <span className="bt-waiting">Combat en cours…</span>
            </div>
          )}
        </div>

        <div className="bt-log-col">
          <div className="bt-log-scroll">
            {log.map((entry, i) => (
              <div key={i} className={`bt-log-line ${entry.cls}`}>{entry.text}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* ── Overlay adversaire déconnecté ── */}
      {oppLeft && !result && (
        <div className="bt-result-overlay">
          <div className="bt-result-box">
            <div className="bt-result-trophy">⚠️</div>
            <div className="bt-result-winner">L'adversaire a quitté</div>
            <div className="bt-result-sub">Le combat ne peut pas continuer.</div>
            <div className="bt-result-actions">
              <button className="bt-result-btn bt-result-btn--replay" onClick={abandonBattle}>
                {battleConfig ? 'Retour au Tracker' : 'Retour au menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay résultat ── */}
      {result && (
        <div className="bt-result-overlay">
          <div className="bt-result-box">
            <div className="bt-result-trophy">🏆</div>
            <div className="bt-result-winner">{result.winName} remporte le duel !</div>
            <div className="bt-result-sub">{result.loseName} n'a plus de Pokémon en état de combattre.</div>
            <div className="bt-result-stats">
              <div className="bt-result-stat"><strong>{result.turn}</strong> tours</div>
              <div className="bt-result-stat"><strong>{result.survivors}</strong> Pokémon survivant{result.survivors > 1 ? 's' : ''}</div>
            </div>
            <div className="bt-result-actions">
              {(!battleConfig || myRole === 'p1') && (
                <button className="bt-result-btn bt-result-btn--replay" onClick={startBattle}>Rejouer</button>
              )}
              <button className="bt-result-btn" onClick={resetBattle}>
                {battleConfig ? 'Retour au Tracker' : 'Changer les joueurs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
