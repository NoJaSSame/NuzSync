import { useState, useEffect, useMemo, useRef } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, remove, get } from 'firebase/database'
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { FIREBASE_CONFIG, GAME_ICON_SRCS, PLAYER_COLORS } from '../constants'
import RewardWheel from './RewardWheel'
import './TrackerTab.css'

// ─── Firebase ─────────────────────────────────────────────────────────────────
const fbApp  = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
const fbDb   = getDatabase(fbApp)
const fbAuth = getAuth(fbApp)

// ─── Constants ────────────────────────────────────────────────────────────────
const SPRITE_BASE  = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const BADGE_COLORS = ['#22c55e','#3b82f6','#f97316','#ef4444','#ec4899','#a16207','#6366f1','#4f46e5']

function genTradeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
const tradeRef      = (code, id)        => ref(fbDb, `sessions/${code}/trades/${id}`)
const tradeFieldRef = (code, id, field) => ref(fbDb, `sessions/${code}/trades/${id}/${field}`)

const ZONE_NORMALIZE = {
  'Route 8 (Steamdrift Way)': 'Route 8',
  'Route 9 (Circhester Bay)': 'Route 9',
  'Route 9 (Outer Spikemuth)': 'Route 9',
}

const ZONE_FR = {
  'Postwick':'Paddoxton','Route 1':'Route 1','Wedgehurst':'Brasswick',
  'Slumbering Weald':'Forêt de Sleepwood','Route 2':'Route 2',
  'Galar Mine':'Mine de Galar','Motostoke':'Motorby','Route 3':'Route 3',
  'Galar Mine No. 2':'Mine de Galar nº 2','Route 4':'Route 4',
  'Turffield':'Greenbury','Route 5':'Route 5','Hulbury':'Skifford',
  'Route 6':'Route 6','Stow-on-Side':'Old Chister',
  'Glimwood Tangle':'Forêt de Lumirinth','Ballonlea':'Corrifey',
  'Route 7':'Route 7','Route 8':'Route 8',
  'Circhester':'Ludester','Route 9':'Route 9',
  'Spikemuth':'Smashings','Hammerlocke':'Kickenham',
  'Route 10':'Route 10','Wyndon':'Winscor',
  'Rolling Fields (Wild Area)':'Plaine Verdoyante (Terres Sauvages)',
  'Dappled Grove (Wild Area)':'Bois de Clairjour (Terres Sauvages)',
  'Watchtower Ruins (Wild Area)':'Tour en ruines (Terres Sauvages)',
  'East Lake Axewell (Wild Area)':'Lac Coupenotte Est (Terres Sauvages)',
  'West Lake Axewell (Wild Area)':'Lac Coupenotte Ouest (Terres Sauvages)',
  "Axew's Eye (Wild Area)":'Œil du Lac (Terres Sauvages)',
  'South Lake Miloch (Wild Area)':'Lac Milobellus Sud (Terres Sauvages)',
  "Giant's Seat (Wild Area)":'Siège du Géant (Terres Sauvages)',
  'North Lake Miloch (Wild Area)':'Lac Milobellus Nord (Terres Sauvages)',
  'Motostoke Riverbank (Wild Area)':'Berges de Motorby (Terres Sauvages)',
  'Bridge Field (Wild Area)':'Prairie Entre-Ponts (Terres Sauvages)',
  'Stony Wilderness (Wild Area)':'Plaine Rocheuse (Terres Sauvages)',
  'Dusty Bowl (Wild Area)':'Fosse des Sables (Terres Sauvages)',
  "Giant's Mirror (Wild Area)":'Miroir du Géant (Terres Sauvages)',
  'Hammerlocke Hills (Wild Area)':'Plateau de Kickenham (Terres Sauvages)',
  "Giant's Cap (Wild Area)":'Coiffe du Géant (Terres Sauvages)',
  'Lake of Outrage (Wild Area)':'Lac Ouragan (Terres Sauvages)',
  'Fields of Honor (Isle of Armor)':'Plaine Salutation (Isolarmure)',
  'Soothing Wetlands (Isle of Armor)':'Lande Boldair (Isolarmure)',
  'Forest of Focus (Isle of Armor)':'Forêt Flexion (Isolarmure)',
  'Challenge Beach (Isle of Armor)':"Plage de l'Épreuve (Isolarmure)",
  "Brawler's Cave (Isle of Armor)":'Grotte du Pugilat (Isolarmure)',
  'Challenge Road (Isle of Armor)':"Route de l'Épreuve (Isolarmure)",
  'Courageous Cavern (Isle of Armor)':'Caverne Pugnacité (Isolarmure)',
  'Loop Lagoon (Isle of Armor)':'Lagune Circulaire (Isolarmure)',
  'Training Lowlands (Isle of Armor)':'Plaine des Efforts (Isolarmure)',
  'Warm-Up Tunnel (Isle of Armor)':'Voie des Étirements (Isolarmure)',
  'Potbottom Desert (Isle of Armor)':'Sables de Kudsac (Isolarmure)',
  'Workout Sea (Isle of Armor)':'Mer Eau-Hisse (Isolarmure)',
  'Stepping-Stone Sea (Isle of Armor)':"Mer Align'Îlots (Isolarmure)",
  'Insular Sea (Isle of Armor)':"Mer Isol'Îlots (Isolarmure)",
  'Honeycalm Sea (Isle of Armor)':'Mer Calméole (Isolarmure)',
  'Honeycalm Island (Isle of Armor)':'Îlot Calméole (Isolarmure)',
  'Slippery Slope (Crown Tundra)':'Plateau Beau-Gant (Couronneige)',
  'Freezington (Crown Tundra)':'Hameau Gelé (Couronneige)',
  'Frostpoint Field (Crown Tundra)':'Plaine Granfroy (Couronneige)',
  "Giant's Bed (Crown Tundra)":'Repos du Géant (Couronneige)',
  'Old Cemetery (Crown Tundra)':'Cimetière Ancien (Couronneige)',
  'Snowslide Slope (Crown Tundra)':'Pente Enneigée (Couronneige)',
  'Tunnel to the Top (Crown Tundra)':'Galeries Monte-Pic (Couronneige)',
  'Crown Shrine (Crown Tundra)':'Temple Couronne (Couronneige)',
  "Giant's Foot (Crown Tundra)":'Empreinte du Géant (Couronneige)',
  'Roaring-Sea Caves (Crown Tundra)':'Cavernes Gronde-Mer (Couronneige)',
  'Frigid Sea (Crown Tundra)':'Mer Banquise (Couronneige)',
  'Three-Point Pass (Crown Tundra)':'Croisée Trois-Voies (Couronneige)',
  'Ballimere Lake (Crown Tundra)':'Lac Poké Ball (Couronneige)',
  'Lakeside Cave (Crown Tundra)':'Grotte du Lac (Couronneige)',
  'Dyna Tree Hill (Crown Tundra)':'Butte du Dynarbre (Couronneige)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const colorMap = {}
let colorCounter = 0
function getColor(code, pseudo) {
  const k = `${code}/${pseudo}`
  if (!colorMap[k]) colorMap[k] = PLAYER_COLORS[colorCounter++ % PLAYER_COLORS.length]
  return colorMap[k]
}

function toArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  return Object.values(val)
}

function zoneFR(key) { return ZONE_FR[key] || key }

function relativeTime(ts) {
  if (!ts) return 'Jamais synchronisé'
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60)    return "À l'instant"
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return `Il y a ${Math.floor(diff / 86400)} j`
}

const ZONE_ORDER = Object.keys(ZONE_FR)

// ─── Components ───────────────────────────────────────────────────────────────

function HpBar({ cur, max }) {
  if (!max) return (
    <div className="hp-bar-wrap">
      <div className="hp-bar"><div className="hp-fill hp-zero" style={{ width: '0%' }} /></div>
      <span className="hp-text">—</span>
    </div>
  )
  const pct = Math.max(0, Math.min(100, (cur / max) * 100))
  const cls = pct > 50 ? 'hp-high' : pct > 20 ? 'hp-mid' : pct > 0 ? 'hp-low' : 'hp-zero'
  return (
    <div className="hp-bar-wrap">
      <div className="hp-bar"><div className={`hp-fill ${cls}`} style={{ width: `${pct}%` }} /></div>
      <span className="hp-text">{cur}/{max}</span>
    </div>
  )
}

function BadgeRow({ badges = [] }) {
  return (
    <div className="badges-row">
      {BADGE_COLORS.map((color, i) => (
        <span
          key={i}
          className={`badge-icon${badges[i] ? ' badge-icon--obtained' : ''}`}
          style={badges[i] ? { '--bc': color } : {}}
        />
      ))}
    </div>
  )
}

function PokemonSlot({ pk, onWonderTrade, onInitiateTrade }) {
  const [wtPending, setWtPending] = useState(false)
  const nickname = pk.nickname && pk.nickname !== pk.species_name
    ? pk.nickname
    : pk.species_name || `#${pk.species_id}`

  function handleWtConfirm() {
    setWtPending(false)
    onWonderTrade(pk.slot ?? 0, nickname)
  }

  return (
    <div className={`pokemon-slot${pk.is_dead ? ' is-dead' : ''}${wtPending ? ' pokemon-slot--wt-pending' : ''}`}>
      <div className="pokemon-sprite-wrap">
        <img className="pokemon-sprite" src={`${SPRITE_BASE}/${pk.species_id}.png`} alt={pk.species_name || ''} loading="lazy" />
      </div>
      <div className="pokemon-info">
        <div className="pokemon-nickname-row">
          <span className="pokemon-nickname">{nickname}</span>
          {!wtPending && (onWonderTrade || onInitiateTrade) && (
            <div className="pokemon-slot-actions">
              {onWonderTrade && (
                <button className="wt-slot-btn" title="Wonder Trade" onClick={() => setWtPending(true)}>
                  <img src="./icon-wondertrade.svg" style={{ width: 12, height: 12, verticalAlign: 'middle' }} alt="" />
                </button>
              )}
              {onInitiateTrade && (
                <button
                  className="trade-slot-btn"
                  title="Échanger avec un joueur"
                  onClick={() => onInitiateTrade(pk.slot ?? 0, nickname)}
                >⇄</button>
              )}
            </div>
          )}
        </div>
        <span className="pokemon-species">{pk.species_name || ''}</span>
        <HpBar cur={pk.hp_current} max={pk.hp_max} />
        {wtPending ? (
          <div className="wt-inline-confirm">
            <span className="wt-inline-label">Envoyer <strong>{nickname}</strong> en WT ?</span>
            <div className="wt-inline-actions">
              <button className="wt-inline-btn wt-inline-btn--cancel" onClick={() => setWtPending(false)}>Annuler</button>
              <button className="wt-inline-btn wt-inline-btn--confirm" onClick={handleWtConfirm}>Confirmer</button>
            </div>
          </div>
        ) : (
          <div className="pokemon-footer">
            <span className="pokemon-level">Niv. {pk.level}</span>
            <span className="pokemon-met-location">{zoneFR(pk.met_location || '')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function BoxesSection({ boxes }) {
  const [open, setOpen] = useState(false)
  const valid = toArray(boxes).filter(p => p && p.species_id && !p.is_egg)
  if (!valid.length) return null
  return (
    <div className="boxes-section">
      <button className="boxes-toggle" onClick={() => setOpen(o => !o)}>
        <span className="boxes-toggle-label">Boîtes</span>
        <span className="boxes-toggle-count">({valid.length})</span>
        <span className="boxes-toggle-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="boxes-grid">
          {valid.map((pk, i) => <PokemonSlot key={i} pk={pk} />)}
        </div>
      )}
    </div>
  )
}

function TeamGrid({ team, onWonderTrade, onInitiateTrade }) {
  const alive = toArray(team).filter(p => p && !p.is_empty && p.species_id)
  if (!alive.length) return <p className="team-empty">Équipe vide</p>
  return (
    <div className="team-grid">
      {alive.map((pk, i) => (
        <PokemonSlot key={i} pk={pk} onWonderTrade={onWonderTrade} onInitiateTrade={onInitiateTrade} />
      ))}
    </div>
  )
}

function PlayerCol({ code, pseudo, state, myCode, myPseudo, onSelect, isSelected, onInitiateTrade, onChallenge }) {
  const color   = getColor(code, pseudo)
  const online  = state.is_connected !== false && (Date.now() / 1000 - (state.timestamp || 0)) < 300
  const firstPk = toArray(state.team).find(p => p && p.species_id)
  const defeats = state.defeats || 0
  const isOwn   = myCode === code && myPseudo === pseudo
  const boxCount = toArray(state.boxes).filter(p => p && p.species_id && !p.is_empty).length

  return (
    <section className={`player-col${isSelected ? ' player-col--selected' : ''}`}>
      <div className="player-header player-header--clickable" style={{ '--player-color': color }} onClick={onSelect}>
        <div className="player-avatar">
          {firstPk && <img className="avatar-img" src={`${SPRITE_BASE}/${firstPk.species_id}.png`} alt="" />}
        </div>
        <div className="player-info">
          <h2 className="player-label">{pseudo}</h2>
          <p className="player-name">{state.player_name || pseudo}</p>
        </div>
        <div className="player-header-right">
          {boxCount > 0 && <span className="player-pc-badge">PC · {boxCount}</span>}
          {defeats > 0 && <span className="player-defeats-badge">{defeats} défaite{defeats > 1 ? 's' : ''}</span>}
          {onChallenge && !isOwn && (
            <button
              className="player-challenge-btn"
              title={`Défier ${pseudo}`}
              onClick={e => { e.stopPropagation(); onChallenge(pseudo) }}
            >⚔ Défier</button>
          )}
          <div className={`player-status-dot${online ? '' : ' offline'}`} title={relativeTime(state.timestamp)} />
        </div>
      </div>
      <div className="badges-section">
        <BadgeRow badges={state.badges} />
      </div>
      <div className="team-section">
        <h3 className="section-title">Équipe active</h3>
        <TeamGrid
          team={state.team}
          onWonderTrade={isOwn && typeof window !== 'undefined' && window.tracker
            ? (slot, pkName) => window.tracker.requestWonderTrade(slot, pkName)
            : null}
          onInitiateTrade={isOwn ? onInitiateTrade : null}
        />
      </div>
    </section>
  )
}

// ─── Challenge UI ─────────────────────────────────────────────────────────────

function formatMs(ms) {
  const secs  = Math.floor(ms / 1000)
  const mins  = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  if (hours > 0) return `${hours}h${String(mins % 60).padStart(2, '0')}m`
  if (mins  > 0) return `${mins}m${String(secs % 60).padStart(2, '0')}s`
  return `${secs}s`
}

function ChallengeCard({ challengeId, ch, code, myPseudo }) {
  const myStatus  = (ch.playerStatuses || {})[myPseudo] || null
  const myVote    = (ch.votes || {})[myPseudo]
  const isManual  = ch.validation === 'manual'
  const [remaining, setRemaining] = useState(() =>
    ch.endsAt ? Math.max(0, ch.endsAt - Date.now()) : null
  )

  useEffect(() => {
    if (!ch.endsAt) return
    const iv = setInterval(() => setRemaining(Math.max(0, ch.endsAt - Date.now())), 1000)
    return () => clearInterval(iv)
  }, [ch.endsAt])

  async function castVote(vote) {
    if (!myPseudo || !code || !challengeId) return
    await set(ref(fbDb, `sessions/${code}/active_challenges/${challengeId}/votes/${myPseudo}`), vote).catch(() => {})
  }

  const statusEntries = Object.entries(ch.playerStatuses || {})
  const voteEntries   = Object.entries(ch.votes || {})
  const ownSide       = myStatus === 'won' ? 'won' : myStatus === 'failed' ? 'failed' : 'active'

  return (
    <div className={`ch-card ch-card--${ownSide}`}>
      <div className="ch-card-top">
        <span className="ch-card-name">{ch.name}</span>
        <div className="ch-card-badges">
          <span className={`ch-badge ch-badge--${ch.type}`}>
            {ch.type === 'individual' ? 'Indiv.' : 'Collectif'}
          </span>
          <span className="ch-badge ch-badge--pts">{ch.points} pts</span>
          {ch.hasReward && <span className="ch-badge ch-badge--reward">🎁 WT</span>}
          <span className={`ch-badge ch-badge--val-${ch.validation}`}>
            {ch.validation === 'auto' ? 'Auto' : 'Vote'}
          </span>
        </div>
      </div>

      {ch.description && <p className="ch-card-desc">{ch.description}</p>}

      {remaining !== null && (
        <div className={`ch-timer${remaining < 60000 ? ' ch-timer--urgent' : ''}`}>
          ⏱ {remaining > 0 ? formatMs(remaining) : 'Expiré'}
        </div>
      )}

      {statusEntries.length > 0 && (
        <div className="ch-statuses">
          {statusEntries.map(([p, s]) => (
            <span key={p} className={`ch-status-pill ch-status-pill--${s}`}>
              {s === 'won' ? '🏆' : s === 'failed' ? '💀' : '⏳'} {p}
            </span>
          ))}
        </div>
      )}

      {isManual && myPseudo && !myVote && (
        <div className="ch-vote-row">
          <button className="ch-vote-btn ch-vote-btn--fail" onClick={() => castVote('fail')}>
            💀 Échec
          </button>
          <button className="ch-vote-btn ch-vote-btn--win" onClick={() => castVote('win')}>
            🏆 Réussi
          </button>
        </div>
      )}

      {isManual && myVote && (
        <div className="ch-voted">
          <span className={`ch-voted-badge ch-voted-badge--${myVote}`}>
            {myVote === 'win' ? '🏆 Voté : Réussi' : '💀 Voté : Échec'}
          </span>
          {voteEntries.length > 0 && (
            <span className="ch-vote-count">
              {voteEntries.filter(([, v]) => v === 'win').length}✓
              {' / '}
              {voteEntries.filter(([, v]) => v === 'fail').length}✕
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ChallengesPanel({ code, activeChallenges, myPseudo }) {
  const entries = Object.entries(activeChallenges || {})
  if (entries.length === 0) return null
  return (
    <div className="ch-panel">
      <div className="ch-panel-header">
        <span className="ch-panel-icon">⚡</span>
        <span className="ch-panel-title">Défis en cours</span>
        <span className="ch-panel-count">{entries.length}</span>
      </div>
      <div className="ch-panel-list">
        {entries.map(([id, ch]) => (
          <ChallengeCard key={id} challengeId={id} ch={ch} code={code} myPseudo={myPseudo} />
        ))}
      </div>
    </div>
  )
}

function ChallengeAnnouncement({ challenge, onDismiss }) {
  const [timeLeft, setTimeLeft] = useState(10)
  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); onDismiss(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [onDismiss])

  return (
    <div className="ch-announce" onClick={onDismiss}>
      <div className="ch-announce-box" onClick={e => e.stopPropagation()}>
        <div className="ch-announce-bolt">⚡</div>
        <div className="ch-announce-content">
          <p className="ch-announce-label">Nouveau défi !</p>
          <h3 className="ch-announce-name">{challenge.name}</h3>
          {challenge.description && <p className="ch-announce-desc">{challenge.description}</p>}
        </div>
        <div className="ch-announce-timer">{timeLeft}</div>
        <button className="ch-announce-close" onClick={onDismiss}>✕</button>
      </div>
    </div>
  )
}

// ─── SessionGroup ─────────────────────────────────────────────────────────────

function SessionGroup({ code, meta, players, myCode, myPseudo, onSelectPlayer, selectedPlayer, onEnter, onInitiateTrade, onChallenge, activeChallenges }) {
  const iconSrc  = GAME_ICON_SRCS[meta.game] || '/pokeball.svg'
  const archived = meta.status === 'archived'
  const entries  = Object.entries(players)

  const playerSummaries = entries.map(([pseudo, state]) => {
    const online    = state.is_connected !== false && (Date.now() / 1000 - (state.timestamp || 0)) < 300
    const badgesArr = state.badges || []
    const alive     = toArray(state.team).filter(p => p?.species_id && !p.is_empty).length
    const firstPk   = toArray(state.team).find(p => p?.species_id)
    const lastSeen  = relativeTime(state.timestamp)
    let playTime = null
    if (state.play_time_hours != null) {
      const h = state.play_time_hours, m = state.play_time_minutes ?? 0
      playTime = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
    }
    return { pseudo, online, badgesArr, alive, firstPk, shiny: !!firstPk?.is_shiny, defeats: state.defeats || 0, lastSeen, playTime }
  })

  return (
    <div className={`session-group${archived ? ' session-group--archived' : ''}`}>
      <div className={`session-group-header${onEnter ? ' session-group-header--clickable' : ''}`} onClick={onEnter ? () => onEnter(code) : undefined}>
        <img src={iconSrc} className="session-group-icon-svg" alt="" />
        <div className="session-group-header-info">
          <div className="session-group-header-top">
            <span className="session-group-name">{meta.name || code}</span>
            {meta.mode && <span className="session-group-mode-badge">{meta.mode}</span>}
            {archived && <span className="session-group-archived-badge">Archivée</span>}
          </div>
          {playerSummaries.length > 0 && (
            <div className="session-group-summary">
              {playerSummaries.map(p => (
                <div key={p.pseudo} className="session-summary-player">
                  <div className="session-summary-sprite-wrap">
                    {p.firstPk && <img className="session-summary-sprite" src={`${SPRITE_BASE}/${p.firstPk.species_id}.png`} alt="" />}
                    {p.shiny && <span className="session-summary-shiny-star">✦</span>}
                  </div>
                  <span className={`session-summary-dot${p.online ? ' session-summary-dot--online' : ''}`} />
                  <span className="session-summary-pseudo">{p.pseudo}</span>
                  <div className="session-summary-badge-dots">
                    {BADGE_COLORS.map((color, i) => (
                      <span key={i} className={`session-badge-dot${p.badgesArr[i] ? ' session-badge-dot--earned' : ''}`} style={p.badgesArr[i] ? { '--bc': color } : {}} />
                    ))}
                  </div>
                  <span className="session-summary-stats">{p.alive}/6 🐾{p.defeats > 0 ? ` · ${p.defeats} 💀` : ''}{p.playTime ? ` · ⏱ ${p.playTime}` : ` · ${p.lastSeen}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {onEnter && <span className="session-group-enter-arrow">›</span>}
      </div>
      {!onEnter && activeChallenges && Object.keys(activeChallenges).length > 0 && (
        <ChallengesPanel
          code={code}
          activeChallenges={activeChallenges}
          myPseudo={myCode === code ? myPseudo : null}
        />
      )}

      {!onEnter && (
        <div className="session-group-players">
          {entries.map(([pseudo, state]) => (
            <PlayerCol
              key={pseudo} code={code} pseudo={pseudo} state={state}
              myCode={myCode} myPseudo={myPseudo}
              onSelect={() => onSelectPlayer({ code, pseudo })}
              isSelected={selectedPlayer?.code === code && selectedPlayer?.pseudo === pseudo}
              onInitiateTrade={onInitiateTrade}
              onChallenge={onChallenge}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Trade Selector ───────────────────────────────────────────────────────────

const GEN8_GAMES = ['sword', 'shield']
const GEN9_GAMES = ['scarlet', 'violet']

function TradeSelector({ myPkName, sessionGame, otherPlayers, onSelect, onCancel }) {
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  const unknownGame = sessionGame && !GEN8_GAMES.includes(sessionGame) && !GEN9_GAMES.includes(sessionGame)

  async function handlePick(pseudo, slot, pkName) {
    if (submitting) return
    setSubmitting(true)
    setErr(null)
    try {
      await onSelect(pseudo, slot, pkName)
    } catch (e) {
      setErr(e.message || 'Erreur lors de l\'export')
      setSubmitting(false)
    }
  }

  return (
    <div className="trade-sel-overlay" onClick={onCancel}>
      <div className="trade-sel-panel" onClick={e => e.stopPropagation()}>
        <div className="trade-sel-header">
          <span>Échanger <strong>{myPkName}</strong> contre…</span>
          <button className="trade-sel-close" onClick={onCancel} disabled={submitting}>✕</button>
        </div>
        {unknownGame && <p className="trade-sel-warn">⚠ Jeu « {sessionGame} » non reconnu — compatibilité save incertaine</p>}
        {err && <p className="trade-sel-error">{err}</p>}
        {submitting ? (
          <div className="trade-sel-loading"><div className="spinner" style={{ margin: '20px auto' }} /></div>
        ) : otherPlayers.length === 0 ? (
          <p className="trade-sel-empty">Aucun autre joueur avec une équipe dans cette session.</p>
        ) : (
          <div className="trade-sel-body">
            {otherPlayers.map(({ pseudo, team }) => (
              <div key={pseudo} className="trade-sel-player">
                <span className="trade-sel-player-name">{pseudo}</span>
                <div className="trade-sel-team">
                  {team.map((pk, i) => {
                    const name = pk.nickname && pk.nickname !== pk.species_name
                      ? pk.nickname : (pk.species_name || `#${pk.species_id}`)
                    return (
                      <button key={i} className="trade-sel-pk" onClick={() => handlePick(pseudo, pk.slot ?? i, name)}>
                        <img className="trade-sel-sprite" src={`${SPRITE_BASE}/${pk.species_id}.png`} alt="" loading="lazy" />
                        <span className="trade-sel-pk-name">{name}</span>
                        <span className="trade-sel-pk-level">Niv.{pk.level}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Trade Overlay ────────────────────────────────────────────────────────────

function TradeOverlay({ trade, myPseudo, onAccept, onReject, onReady, onConfirm, onCancel, executing, syncingReady }) {
  const isInit      = trade.initiator === myPseudo
  const myPkName    = isInit ? trade.initiator_pk_name  : trade.receiver_pk_name
  const partnerPk   = isInit ? trade.receiver_pk_name   : trade.initiator_pk_name
  const partner     = isInit ? trade.receiver            : trade.initiator
  const myReady     = isInit ? trade.initiator_ready     : trade.receiver_ready
  const myConfirmed = isInit ? trade.initiator_confirmed : trade.receiver_confirmed

  return (
    <div className="trade-overlay">
      <div className="trade-overlay-panel">
        {executing ? (
          <>
            <p className="trade-overlay-title">Trade en cours…</p>
            <div className="spinner" style={{ margin: '12px auto' }} />
          </>
        ) : trade.status === 'pending' && !isInit ? (
          <>
            <p className="trade-overlay-title">Offre de trade</p>
            <p className="trade-overlay-sub"><strong>{trade.initiator}</strong> te propose un échange :</p>
            <div className="trade-overlay-pks">
              <div className="trade-overlay-pk"><span className="trade-overlay-pk-label">Il envoie</span><strong>{partnerPk}</strong></div>
              <span className="trade-overlay-arrow">⇄</span>
              <div className="trade-overlay-pk"><span className="trade-overlay-pk-label">Il veut ton</span><strong>{myPkName}</strong></div>
            </div>
            <div className="trade-overlay-actions">
              <button className="wt-inline-btn wt-inline-btn--cancel" onClick={onReject}>Refuser</button>
              <button className="wt-inline-btn wt-inline-btn--confirm" onClick={onAccept}>Accepter</button>
            </div>
          </>
        ) : trade.status === 'pending' && isInit ? (
          <>
            <p className="trade-overlay-title">Offre envoyée</p>
            <p className="trade-overlay-sub">En attente de <strong>{partner}</strong>…</p>
            <div className="trade-overlay-pks">
              <div className="trade-overlay-pk"><span className="trade-overlay-pk-label">Tu proposes</span><strong>{myPkName}</strong></div>
              <span className="trade-overlay-arrow">⇄</span>
              <div className="trade-overlay-pk"><span className="trade-overlay-pk-label">Tu veux</span><strong>{partnerPk}</strong></div>
            </div>
            <button className="wt-inline-btn wt-inline-btn--cancel" style={{ marginTop: 10 }} onClick={onCancel}>
              Annuler l'offre
            </button>
          </>
        ) : trade.status === 'waiting_close' ? (
          <>
            <p className="trade-overlay-title">Ferme Ryujinx</p>
            <div className="trade-overlay-ready-row">
              <span className={`trade-ready-dot${trade.initiator_ready ? ' trade-ready-dot--ok' : ''}`} />
              <span>{trade.initiator}</span>
              <span className={`trade-ready-dot${trade.receiver_ready ? ' trade-ready-dot--ok' : ''}`} />
              <span>{trade.receiver}</span>
            </div>
            {!myReady ? (
              syncingReady ? (
                <p className="trade-overlay-sub">Synchronisation en cours…</p>
              ) : (
                <button className="wt-inline-btn wt-inline-btn--confirm" onClick={onReady}>✓ Ryujinx fermé — Prêt</button>
              )
            ) : (
              <p className="trade-overlay-sub">En attente de <strong>{partner}</strong>…</p>
            )}
            <button className="wt-inline-btn wt-inline-btn--cancel" style={{ marginTop: 6 }} onClick={onCancel}>Annuler</button>
          </>
        ) : trade.status === 'waiting_confirm' ? (
          <>
            <p className="trade-overlay-title">Confirmation finale</p>
            <p className="trade-overlay-warn">⚠ Modifie la save définitivement</p>
            <div className="trade-overlay-pks">
              <div className="trade-overlay-pk"><span className="trade-overlay-pk-label">Tu envoies</span><strong>{myPkName}</strong></div>
              <span className="trade-overlay-arrow">⇄</span>
              <div className="trade-overlay-pk"><span className="trade-overlay-pk-label">Tu reçois</span><strong>{partnerPk}</strong></div>
            </div>
            <div className="trade-overlay-ready-row">
              <span className={`trade-ready-dot${trade.initiator_confirmed ? ' trade-ready-dot--ok' : ''}`} />
              <span>{trade.initiator}</span>
              <span className={`trade-ready-dot${trade.receiver_confirmed ? ' trade-ready-dot--ok' : ''}`} />
              <span>{trade.receiver}</span>
            </div>
            {!myConfirmed ? (
              <div className="trade-overlay-actions">
                <button className="wt-inline-btn wt-inline-btn--cancel" onClick={onCancel}>Annuler</button>
                <button className="wt-inline-btn wt-inline-btn--confirm" onClick={onConfirm}>Confirmer</button>
              </div>
            ) : (
              <p className="trade-overlay-sub">En attente de <strong>{partner}</strong>…</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── PC Panel ─────────────────────────────────────────────────────────────────

function PCPanel({ code, pseudo, state, onClose, maxHeight, bottom }) {
  const color   = getColor(code, pseudo)
  // Exclure les Pokémon déjà dans l'équipe active (certains lecteurs les dupliquent dans boxes)
  const teamKeys = new Set(
    toArray(state.team).filter(p => p?.species_id).map(p => `${p.species_id}-${p.level}-${p.slot ?? ''}`)
  )
  const allPk = toArray(state.boxes).filter(p => {
    if (!p || !p.species_id || p.is_empty) return false
    return !teamKeys.has(`${p.species_id}-${p.level}-${p.slot ?? ''}`)
  })
  const PER_BOX = 30

  const boxes = useMemo(() => {
    if (!allPk.length) return [[]]
    const numBoxes = Math.ceil(allPk.length / PER_BOX)
    return Array.from({ length: numBoxes }, (_, i) => {
      const chunk = allPk.slice(i * PER_BOX, (i + 1) * PER_BOX)
      // Arrondi à la ligne complète suivante (6 par ligne)
      const slots = Array(PER_BOX).fill(null)
      chunk.forEach((pk, j) => { slots[j] = pk })
      return slots
    })
  }, [state.boxes])

  return (
    <>
      <div className="pc-overlay" onClick={onClose} />
      <div className="pc-panel" style={{ bottom: `${bottom}px`, maxHeight: `${maxHeight}px` }}>
        <div className="pc-panel-header" style={{ '--player-color': color }}>
          <span className="pc-panel-title">PC de {pseudo}</span>
          <button className="pc-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="pc-panel-body">
          {allPk.length === 0 ? (
            <p className="pc-empty">PC vide</p>
          ) : boxes.map((slots, boxIdx) => (
            <div key={boxIdx} className="pc-box">
              <div className="pc-box-header">Boîte {boxIdx + 1}</div>
              <div className="pc-box-grid">
                {slots.map((pk, slotIdx) => (
                  <div key={slotIdx} className={`pc-cell${pk ? ' pc-cell--filled' : ''}`}>
                    {pk && (
                      <>
                        <img className="pc-sprite" src={`${SPRITE_BASE}/${pk.species_id}.png`} alt="" loading="lazy" />
                        <div className="pc-tooltip">
                          <span className="pc-tooltip-name">
                            {pk.nickname && pk.nickname !== pk.species_name ? pk.nickname : pk.species_name}
                          </span>
                          <span className="pc-tooltip-level">Niv. {pk.level}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Zones view ───────────────────────────────────────────────────────────────

function ZoneRow({ zoneName, players, isOpen, isVisited, canToggle, onToggleVisited, onMouseEnter, onMouseLeave }) {
  const label    = ZONE_FR[zoneName] || zoneName
  const hasData  = players && Object.keys(players).length > 0
  const allPks   = hasData ? Object.values(players).flatMap(p => p.pks) : []

  return (
    <div
      className={`zone-row${!hasData && !isVisited ? ' zone-row--empty' : ''}${isVisited && !hasData ? ' zone-row--visited' : ''}${isOpen ? ' zone-row--open' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="zone-row-main">
        <div className="zone-row-left">
          <span className="zone-row-name">{label}</span>
          {hasData && (
            <span className="zone-row-meta">
              {Object.keys(players).length} joueur{Object.keys(players).length > 1 ? 's' : ''} · {allPks.length} capture{allPks.length > 1 ? 's' : ''}
            </span>
          )}
          {isVisited && !hasData && <span className="zone-row-meta zone-row-meta--visited">Visitée · aucune capture</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasData && (
            <div className="zone-row-sprites">
              {allPks.slice(0, 5).map((pk, i) => (
                <img key={i} className="zone-sprite-tiny" src={`${SPRITE_BASE}/${pk.species_id}.png`} alt="" loading="lazy" />
              ))}
              {allPks.length > 5 && <span className="zone-more">+{allPks.length - 5}</span>}
            </div>
          )}
          {canToggle && (
            <button
              className={`zone-visited-btn${isVisited ? ' zone-visited-btn--on' : ''}`}
              title={isVisited ? 'Marquer non visitée' : 'Marquer visitée (sans capture)'}
              onClick={e => { e.stopPropagation(); onToggleVisited() }}
            >{isVisited ? '✓' : '+'}</button>
          )}
        </div>
      </div>
      {hasData && (
        <div className="zone-row-details">
          <div className="zone-row-details-inner">
            {Object.entries(players).map(([pseudo, { pks, color }]) => (
              <div key={pseudo} className="zone-player-group">
                <span className="zone-player-label" style={{ color }}>● {pseudo}</span>
                <div className="zone-player-pks">
                  {pks.map((pk, i) => {
                    const name = pk.nickname && pk.nickname !== pk.species_name
                      ? pk.nickname : (pk.species_name || `#${pk.species_id}`)
                    return (
                      <div key={i} className="zone-pk">
                        <img src={`${SPRITE_BASE}/${pk.species_id}.png`} alt="" loading="lazy" />
                        <span className="zone-pk-name">{name}</span>
                        <span className="zone-pk-level">Niv.{pk.level}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ZonesView({ sessions, myCode, myPseudo, focusCode }) {
  const [hoveredZone, setHoveredZone] = useState(null)

  // Zones visitées manuellement (sans capture) par le joueur actif
  const visitedZones = useMemo(() => {
    if (!myCode || !myPseudo) return {}
    return sessions[myCode]?.players?.[myPseudo]?.visited_zones || {}
  }, [sessions, myCode, myPseudo])

  async function toggleVisited(zoneName) {
    if (!myCode || !myPseudo) return
    const key = zoneName.replace(/[.#$/[\]]/g, '_')
    const r   = ref(fbDb, `sessions/${myCode}/players/${myPseudo}/visited_zones/${key}`)
    try {
      if (visitedZones[key]) { await remove(r) } else { await set(r, true) }
    } catch (e) {
      console.error('[ZonesView] toggleVisited failed:', e.message)
    }
  }

  // Zones capturées par le joueur actif dans SA session uniquement
  const myCapturedZones = useMemo(() => {
    if (!myCode || !myPseudo) return new Set()
    const pState = sessions[myCode]?.players?.[myPseudo]
    const allPk  = [...toArray(pState?.team), ...toArray(pState?.boxes)]
      .filter(p => p && !p.is_empty && !p.is_egg && p.species_id && p.met_location)
    return new Set(allPk.map(p => p.met_location))
  }, [sessions, myCode, myPseudo])

  // Données de zone : uniquement la session affichée (focusCode || myCode)
  const zoneData = useMemo(() => {
    const map         = {}
    const sessionCode = focusCode || myCode
    const session     = sessions[sessionCode]
    if (!session?.metadata) return map
    for (const [pseudo, state] of Object.entries(session.players || {})) {
      const color = getColor(sessionCode, pseudo)
      const allPk = [...toArray(state.team), ...toArray(state.boxes)]
        .filter(p => p && !p.is_empty && !p.is_egg && p.species_id && p.met_location)
      for (const pk of allPk) {
        const zone = ZONE_NORMALIZE[pk.met_location] || pk.met_location
        if (!map[zone]) map[zone] = {}
        if (!map[zone][pseudo]) map[zone][pseudo] = { pks: [], color }
        map[zone][pseudo].pks.push(pk)
      }
    }
    return map
  }, [sessions, focusCode, myCode])

  // Toutes les zones du jeu, dans l'ordre, puis les zones inconnues avec captures
  const unknownZones = Object.keys(zoneData).filter(z => !ZONE_ORDER.includes(z))
  const allZones     = [...ZONE_ORDER, ...unknownZones]

  return (
    <div className="zones-split">
      {/* ── Table panel ── */}
      <div className="zones-table-panel">
        <div className="zones-list">
          {allZones.map(zoneName => {
            const zkey = zoneName.replace(/[.#$/[\]]/g, '_')
            return (
              <ZoneRow
                key={zoneName}
                zoneName={zoneName}
                players={zoneData[zoneName] || null}
                isOpen={hoveredZone === zoneName}
                isVisited={!!visitedZones[zkey]}
                canToggle={!!myCode && !!myPseudo && !myCapturedZones.has(zoneName)}
                onToggleVisited={() => toggleVisited(zoneName)}
                onMouseEnter={() => (zoneData[zoneName] || visitedZones[zkey]) && setHoveredZone(zoneName)}
                onMouseLeave={() => setHoveredZone(null)}
              />
            )
          })}
        </div>
      </div>

      {/* ── Map panel ── */}
      <div className="zones-map-panel">
        <div className="zones-map-placeholder">
          <div className="zones-map-icon">🗺️</div>
          <p>Carte interactive</p>
          <p className="zones-map-hint">Ajoute <code>public/galar-map.png</code> pour activer</p>
        </div>
      </div>
    </div>
  )
}

// ─── Classement view ──────────────────────────────────────────────────────────

function ClassementView({ sessions, compact = false }) {
  const sessionEntries = useMemo(
    () => Object.entries(sessions).filter(([, s]) => s?.metadata),
    [sessions]
  )

  return (
    <div className="classement-view-native">
      {sessionEntries.map(([code, session]) => {
        const players = Object.entries(session.players || {})

        const challengeScores = session.challenge_scores || {}

        const ranked = players.map(([pseudo, state]) => {
          const badges   = toArray(state.badges).filter(Boolean).length
          const team     = toArray(state.team).filter(p => p && !p.is_empty && p.species_id)
          const alive    = team.filter(p => !p.is_dead && !p.is_egg).length
          const allPk    = [...team, ...toArray(state.boxes).filter(p => p && !p.is_empty && p.species_id)]
          const zones    = new Set(allPk.map(p => p.met_location).filter(Boolean)).size
          const defeats  = state.defeats || 0
          const firstPk  = team[0] || null
          const chPoints = challengeScores[pseudo] || 0
          return { pseudo, badges, alive, zones, defeats, firstPk, color: getColor(code, pseudo), chPoints }
        }).sort((a, b) => {
          if (b.badges !== a.badges) return b.badges - a.badges
          if (b.alive !== a.alive)   return b.alive - a.alive
          if (b.zones !== a.zones)   return b.zones - a.zones
          return a.defeats - b.defeats
        })

        return (
          <div key={code} className="classement-session">
            <p className="classement-session-title">{session.metadata?.name || code}</p>
            <div className="classement-list">
              {ranked.map((p, i) => (
                <div key={p.pseudo} className="classement-row">
                  <span className={`classement-rank classement-rank--${i < 3 ? i + 1 : 'other'}`}>#{i + 1}</span>
                  <div className="classement-avatar">
                    {p.firstPk && (
                      <img className="classement-sprite" src={`${SPRITE_BASE}/${p.firstPk.species_id}.png`} alt="" />
                    )}
                  </div>
                  <div className="classement-info">
                    <span className="classement-pseudo" style={{ color: p.color }}>{p.pseudo}</span>
                    <span className="classement-sub">{p.zones} zone{p.zones !== 1 ? 's' : ''} explorée{p.zones !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="classement-stats">
                    <span className="classement-stat" title="Arènes vaincues">{p.badges}/8 🏅</span>
                    <span className="classement-stat" title="Équipe en vie">{p.alive}/6 🐾</span>
                    {p.defeats > 0 && (
                      <span className="classement-stat classement-stat--defeat" title="Défaites">{p.defeats} 💀</span>
                    )}
                    {p.chPoints > 0 && (
                      <span className="classement-stat classement-stat--challenge" title="Points défis">⚡{p.chPoints}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SESSIONS_CACHE_KEY  = 'nuzsync_sessions_cache'
const CLASSEMENT_HIDE_KEY = 'nuzsync_classement_hidden'

export default function TrackerTab({ onGoToSettings, focusCode, onFocusSession, onIncomingTrade, onIncomingChallenge, onBattleStart }) {
  const isElectron = typeof window !== 'undefined' && !!window.tracker

  const [sessions,  setSessions]  = useState(() => {
    try { const c = localStorage.getItem(SESSIONS_CACHE_KEY); return c ? JSON.parse(c) : {} } catch { return {} }
  })
  const [connected, setConnected] = useState(false)
  const [ready,     setReady]     = useState(() => {
    try { return !!localStorage.getItem(SESSIONS_CACHE_KEY) } catch { return false }
  })
  const [fbError,   setFbError]   = useState(null)
  const [myCode,    setMyCode]    = useState(null)
  const [myPseudo,  setMyPseudo]  = useState(null)
  const [myCodes,   setMyCodes]   = useState(null) // null = chargement en cours
  const [fbUid,     setFbUid]     = useState(null)
  const [innerTab,       setInnerTab]       = useState('tracker')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [pcMaxHeight, setPcMaxHeight] = useState(400)
  const [pcBottom,    setPcBottom]    = useState(77)
  const [showClassement, setShowClassement] = useState(() => {
    try { return localStorage.getItem(CLASSEMENT_HIDE_KEY) !== '1' } catch { return true }
  })
  const [tradeOffer,     setTradeOffer]     = useState(null)
  const [tradeExecuting, setTradeExecuting] = useState(false)
  const [tradeSyncing,   setTradeSyncing]   = useState(false)
  const [tradeNotif,     setTradeNotif]     = useState(null)
  const tradeNotifTimer   = useRef(null)
  const tradeExecutingRef = useRef(false)
  const tradeCleanupTimer = useRef(null)
  const sessionsRef = useRef(null)

  const [incomingChallenge,  setIncomingChallenge]  = useState(null) // { from, to, status }
  const [sentChallenge,      setSentChallenge]      = useState(null) // { to }
  const [challengeSyncing,   setChallengeSyncing]   = useState(false)
  const onBattleStartRef = useRef(onBattleStart)
  useEffect(() => { onBattleStartRef.current = onBattleStart }, [onBattleStart])

  // ── Défis itinérants ─────────────────────────────────────────────────────────
  const [challengeAnnouncement, setChallengeAnnouncement] = useState(null)
  const [challengeWinNotif,     setChallengeWinNotif]     = useState(null)
  const [showRewardWheel,       setShowRewardWheel]       = useState(false)
  const prevChallengeIdsRef = useRef(new Set())

  // Détection nouveaux défis via Firebase
  useEffect(() => {
    const code = focusCode || myCode
    if (!code) return
    const activeChalls = sessions[code]?.active_challenges || {}
    const currentIds   = new Set(Object.keys(activeChalls))

    if (prevChallengeIdsRef.current.size > 0) {
      for (const id of currentIds) {
        if (!prevChallengeIdsRef.current.has(id)) {
          const ch = activeChalls[id]
          if (ch && !challengeAnnouncement) {
            setChallengeAnnouncement({ name: ch.name, description: ch.description || '' })
          }
          break
        }
      }
    }
    prevChallengeIdsRef.current = currentIds
  }, [sessions, focusCode, myCode]) // eslint-disable-line

  // Notification win depuis IPC (main.cjs)
  useEffect(() => {
    if (!isElectron || !window.tracker?.onChallengeWon) return
    const unsub = window.tracker.onChallengeWon(data => {
      setChallengeWinNotif(data)
      if (data.hasReward) setShowRewardWheel(true)
      else setTimeout(() => setChallengeWinNotif(null), 5000)
    })
    return () => unsub()
  }, []) // eslint-disable-line

  useEffect(() => { onIncomingChallenge?.(!!incomingChallenge) }, [incomingChallenge]) // eslint-disable-line

  function toggleClassement() {
    setShowClassement(v => {
      const next = !v
      try { localStorage.setItem(CLASSEMENT_HIDE_KEY, next ? '0' : '1') } catch {}
      return next
    })
  }

  function showTradeNotif(type, message) {
    setTradeNotif({ type, message })
    clearTimeout(tradeNotifTimer.current)
    tradeNotifTimer.current = setTimeout(() => setTradeNotif(null), 5000)
  }

  const myActiveTrade = useMemo(() => {
    if (!focusCode || !myPseudo) return null
    const trades = sessions[focusCode]?.trades || {}
    for (const [tradeId, trade] of Object.entries(trades)) {
      if (!trade || !trade.status) continue
      if (['completed', 'rejected', 'cancelled'].includes(trade.status)) continue
      if (trade.initiator === myPseudo || trade.receiver === myPseudo) {
        return { tradeId, ...trade }
      }
    }
    return null
  }, [sessions, focusCode, myPseudo])

  // Badge notification — trades entrants pour myPseudo dans toutes les sessions
  useEffect(() => {
    if (!onIncomingTrade || !myPseudo) { onIncomingTrade?.(false); return }
    for (const session of Object.values(sessions)) {
      const trades = session?.trades || {}
      if (Object.values(trades).some(t => t && t.status === 'pending' && t.receiver === myPseudo)) {
        onIncomingTrade(true)
        return
      }
    }
    onIncomingTrade(false)
  }, [sessions, myPseudo, onIncomingTrade])

  // Auto-clear du cleanup timer quand le trade avance ou est supprimé
  useEffect(() => {
    if (!myActiveTrade || myActiveTrade.status !== 'pending') {
      clearTimeout(tradeCleanupTimer.current)
    }
  }, [myActiveTrade?.status, myActiveTrade])

  useEffect(() => {
    if (!myActiveTrade || !focusCode || !isElectron) return
    const { tradeId, status } = myActiveTrade

    if (status === 'waiting_close' && myActiveTrade.initiator_ready && myActiveTrade.receiver_ready) {
      set(tradeFieldRef(focusCode, tradeId, 'status'), 'waiting_confirm').catch(() => {})
      return
    }

    if (status === 'waiting_confirm' &&
        myActiveTrade.initiator_confirmed && myActiveTrade.receiver_confirmed &&
        !tradeExecutingRef.current) {
      tradeExecutingRef.current = true
      setTradeExecuting(true)
      const isInit     = myActiveTrade.initiator === myPseudo
      const mySlot     = isInit ? myActiveTrade.initiator_slot : myActiveTrade.receiver_slot
      const partnerB64 = isInit ? myActiveTrade.receiver_pk_b64 : myActiveTrade.initiator_pk_b64
      ;(async () => {
        try {
          await window.tracker.injectPkm(mySlot, partnerB64)
          await remove(tradeRef(focusCode, tradeId)).catch(() => {})
          showTradeNotif('success', 'Trade réussi !')
        } catch (e) {
          showTradeNotif('error', `Inject échoué : ${e.message}`)
        } finally {
          tradeExecutingRef.current = false
          setTradeExecuting(false)
        }
      })()
    }
  }, [myActiveTrade, focusCode, myPseudo])

  function handleInitiateTrade(slot, pkName) {
    setTradeOffer({ slot, pkName })
  }

  async function handleSubmitTrade(receiverPseudo, receiverSlot, receiverPkName) {
    if (!tradeOffer || !focusCode || !myPseudo) return
    const { slot: mySlot, pkName: myPkName } = tradeOffer
    const result = await window.tracker.exportPkm(mySlot)
    if (!result?.success) throw new Error(result?.pk_info ? 'Export PKM échoué' : 'Impossible de lire ce Pokémon')
    const tradeId = genTradeId()
    await set(tradeRef(focusCode, tradeId), {
      status:              'pending',
      initiator:           myPseudo,
      receiver:            receiverPseudo,
      initiator_slot:      mySlot,
      initiator_pk_name:   myPkName,
      initiator_pk_b64:    result.pk_b64,
      receiver_slot:       receiverSlot,
      receiver_pk_name:    receiverPkName,
      initiator_ready:     false,
      receiver_ready:      false,
      initiator_confirmed: false,
      receiver_confirmed:  false,
      created_at:          Date.now(),
    })
    setTradeOffer(null)

    // Auto-cleanup si l'offre reste sans réponse pendant 10 min
    clearTimeout(tradeCleanupTimer.current)
    const cleanCode = focusCode, cleanId = tradeId
    tradeCleanupTimer.current = setTimeout(async () => {
      try {
        const snap = await get(tradeRef(cleanCode, cleanId))
        const t = snap.val()
        if (t && t.status === 'pending') {
          await remove(tradeRef(cleanCode, cleanId))
          showTradeNotif('error', 'Offre de trade expirée (10 min sans réponse)')
        }
      } catch {}
    }, 10 * 60 * 1000)
  }

  async function handleTradeAccept() {
    if (!myActiveTrade || !focusCode || !myPseudo) return
    const { tradeId } = myActiveTrade
    try {
      const result = await window.tracker.exportPkm(myActiveTrade.receiver_slot)
      if (!result?.success) throw new Error('Export échoué')
      await set(tradeFieldRef(focusCode, tradeId, 'receiver_pk_b64'), result.pk_b64)
      await set(tradeFieldRef(focusCode, tradeId, 'status'), 'waiting_close')
    } catch (e) {
      showTradeNotif('error', `Acceptation échouée : ${e.message}`)
    }
  }

  async function handleTradeReject() {
    clearTimeout(tradeCleanupTimer.current)
    if (!myActiveTrade || !focusCode) return
    await remove(tradeRef(focusCode, myActiveTrade.tradeId)).catch(() => {})
  }

  async function handleTradeReady() {
    if (!myActiveTrade || !focusCode || !myPseudo) return
    // Force une dernière sync pour s'assurer que la save est à jour
    if (window.tracker?.forceSync) {
      setTradeSyncing(true)
      try { await window.tracker.forceSync() } catch {}
      setTradeSyncing(false)
    }
    const isInit = myActiveTrade.initiator === myPseudo
    await set(tradeFieldRef(focusCode, myActiveTrade.tradeId, isInit ? 'initiator_ready' : 'receiver_ready'), true)
      .catch(e => showTradeNotif('error', `Erreur : ${e.message}`))
  }

  async function handleTradeConfirm() {
    if (!myActiveTrade || !focusCode || !myPseudo) return
    const isInit = myActiveTrade.initiator === myPseudo
    await set(tradeFieldRef(focusCode, myActiveTrade.tradeId, isInit ? 'initiator_confirmed' : 'receiver_confirmed'), true)
      .catch(e => showTradeNotif('error', `Erreur : ${e.message}`))
  }

  async function handleTradeCancel() {
    clearTimeout(tradeCleanupTimer.current)
    if (!myActiveTrade || !focusCode) return
    await remove(tradeRef(focusCode, myActiveTrade.tradeId)).catch(() => {})
  }

  // ── Défi (challenge) ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!focusCode || !myPseudo) return
    return onValue(ref(fbDb, `sessions/${focusCode}/challenge`), async snap => {
      const data = snap.val()
      if (!data) { setIncomingChallenge(null); setSentChallenge(null); return }
      if (data.to === myPseudo && data.status === 'pending') {
        setIncomingChallenge(data)
      } else if (data.from === myPseudo) {
        if (data.status === 'accepted') {
          setSentChallenge(null)
          setChallengeSyncing(true)
          remove(ref(fbDb, `sessions/${focusCode}/challenge`)).catch(() => {})
          if (window.tracker?.forceSync) {
            try { await window.tracker.forceSync() } catch {}
          }
          setChallengeSyncing(false)
          onBattleStartRef.current?.({ p1Pseudo: myPseudo, p2Pseudo: data.to, myRole: 'p1' })
        } else if (data.status === 'declined') {
          setSentChallenge(null)
          remove(ref(fbDb, `sessions/${focusCode}/challenge`)).catch(() => {})
        }
      }
    })
  }, [focusCode, myPseudo]) // eslint-disable-line

  async function handleSendChallenge(pseudo) {
    if (!focusCode || !myPseudo) return
    setSentChallenge({ to: pseudo })
    await set(ref(fbDb, `sessions/${focusCode}/challenge`), {
      from: myPseudo, to: pseudo, status: 'pending', timestamp: Date.now(),
    })
  }

  async function handleAcceptChallenge() {
    if (!incomingChallenge || !focusCode) return
    const challenger = incomingChallenge.from
    setIncomingChallenge(null)
    setChallengeSyncing(true)
    if (window.tracker?.forceSync) {
      try { await window.tracker.forceSync() } catch {}
    }
    setChallengeSyncing(false)
    await set(ref(fbDb, `sessions/${focusCode}/challenge/status`), 'accepted')
    onBattleStartRef.current?.({ p1Pseudo: challenger, p2Pseudo: myPseudo, myRole: 'p2' })
  }

  async function handleDeclineChallenge() {
    if (!incomingChallenge || !focusCode) return
    setIncomingChallenge(null)
    await set(ref(fbDb, `sessions/${focusCode}/challenge/status`), 'declined')
  }

  async function handleCancelSentChallenge() {
    setSentChallenge(null)
    if (focusCode) await remove(ref(fbDb, `sessions/${focusCode}/challenge`)).catch(() => {})
  }

  // ── Indicateur de connexion Firebase ─────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(fbDb, '.info/connected'), snap => setConnected(!!snap.val()))
    return () => unsub()
  }, [])

  // ── Auth Firebase avec deviceId partagé main↔renderer ────────────────────────
  useEffect(() => {
    async function doAuth() {
      if (!isElectron) {
        // hors Electron : auth anonyme classique pour la vue web
        try { const c = await signInAnonymously(fbAuth); setFbUid(c.user.uid) } catch {}
        return
      }
      try {
        const deviceId = await window.tracker.getDeviceId()
        if (!deviceId) return
        const email = `d${deviceId.replace(/-/g, '')}@nuzsync.app`
        try {
          const c = await signInWithEmailAndPassword(fbAuth, email, deviceId)
          setFbUid(c.user.uid)
        } catch (e) {
          if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
            const c = await createUserWithEmailAndPassword(fbAuth, email, deviceId)
            setFbUid(c.user.uid)
          }
        }
      } catch {}
    }
    doAuth()
  }, [])

  // ── Chargement config Electron (myCode, myPseudo, myCodes) ────────────────────
  useEffect(() => {
    if (!isElectron) { setMyCodes([]); return }
    Promise.all([
      window.tracker.getActiveCode(),
      window.tracker.getPseudo(),
      window.tracker.getAllSessions(),
    ]).then(([code, pseudo, allSessions]) => {
      setMyCode(code || null)
      setMyPseudo(pseudo || null)
      setMyCodes((allSessions || []).map(s => s.code))
    })
    const unsubSession = window.tracker.onSessionUpdated((sessions, activeCode) => {
      setMyCode(activeCode || null)
      setMyCodes((sessions || []).map(s => s.code))
    })
    return () => unsubSession()
  }, [])

  // ── Listeners Firebase par session (remplace le listener global) ──────────────
  useEffect(() => {
    if (!fbUid || myCodes === null) return

    // Nettoyer les sessions qui ne sont plus dans myCodes
    setSessions(prev => {
      const next = {}
      for (const code of myCodes) { if (prev[code]) next[code] = prev[code] }
      return next
    })

    if (myCodes.length === 0) { setReady(true); return }

    let cancelled = false
    const unsubs  = []

    ;(async () => {
      // Enregistrer l'UID dans members de chaque session avant d'écouter
      await Promise.allSettled(
        myCodes.map(code => set(ref(fbDb, `sessions/${code}/members/${fbUid}`), true))
      )
      if (cancelled) return

      // Écouter uniquement les sessions autorisées
      for (const code of myCodes) {
        const unsub = onValue(
          ref(fbDb, `sessions/${code}`),
          snap => {
            const val = snap.val()
            if (!val) {
              setSessions(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== code)))
              window.tracker?.leaveSession(code)
            } else {
              setSessions(prev => ({ ...prev, [code]: val }))
            }
            setReady(true)
            setFbError(null)
          },
          err => { setFbError(err.message || 'Erreur Firebase'); setReady(true) }
        )
        unsubs.push(unsub)
      }
    })()

    return () => { cancelled = true; unsubs.forEach(u => u()) }
  }, [fbUid, myCodes])

  // ── Cache localStorage ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || Object.keys(sessions).length === 0) return
    try { localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sessions)) } catch {}
  }, [sessions, ready])

  useEffect(() => {
    if (!selectedPlayer) return
    function measure() {
      if (!sessionsRef.current) return
      const nativeEl = sessionsRef.current.closest('.tracker-native')
      if (!nativeEl) return
      const sessionsRect = sessionsRef.current.getBoundingClientRect()
      const nativeRect   = nativeEl.getBoundingClientRect()
      setPcBottom(Math.max(0, nativeRect.bottom - sessionsRect.bottom))
      setPcMaxHeight(Math.max(100, sessionsRect.bottom - nativeRect.top - 190))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [selectedPlayer])

  const sessionEntries = Object.entries(sessions)
    .filter(([, s]) => s?.metadata)
    .filter(([code]) => {
      if (focusCode) return code === focusCode
      if (myCodes !== null) return myCodes.includes(code)
      return false // pendant le chargement, n'affiche rien
    })

  return (
    <div className="tracker-native">
      <div className={`tracker-fb-dot-wrap tracker-fb-${connected ? 'connected' : 'disconnected'}`}>
        <span className="tracker-fb-dot" />
      </div>

      {(!ready || myCodes === null) ? (
        <div className="tracker-no-data">
          <div className="spinner" />
        </div>
      ) : fbError ? (
        <div className="tracker-no-data tracker-error">
          <span className="tracker-error-icon">⚠️</span>
          <p>Connexion Firebase impossible</p>
          <p className="tracker-error-detail">{fbError}</p>
        </div>
      ) : sessionEntries.length === 0 ? (
        <div className="tracker-no-data tracker-empty">
          <div className="tracker-empty-icon">🎮</div>
          <p className="tracker-empty-title">Aucune session active</p>
          <p className="tracker-empty-sub">Crée une nouvelle session ou rejoins celle d'un ami.</p>
          <div className="tracker-empty-actions">
            <button className="tracker-empty-btn tracker-empty-btn--primary" onClick={() => onGoToSettings('create')}>
              ＋ Créer une session
            </button>
            <button className="tracker-empty-btn" onClick={() => onGoToSettings('join')}>
              Rejoindre une session
            </button>
          </div>
        </div>
      ) : (
        <div className="tracker-body">
          {innerTab === 'tracker' && (
            <>
              <div className="tracker-content">
                <div className="tracker-sessions" ref={sessionsRef}>
                  {sessionEntries.map(([code, session]) => (
                    <SessionGroup key={code} code={code} meta={session.metadata} players={session.players || {}} myCode={myCode} myPseudo={myPseudo} onSelectPlayer={setSelectedPlayer} selectedPlayer={selectedPlayer} onEnter={focusCode ? null : onFocusSession} onInitiateTrade={isElectron && !myActiveTrade ? handleInitiateTrade : null} onChallenge={isElectron && !myActiveTrade && !sentChallenge ? handleSendChallenge : null} activeChallenges={session.active_challenges || null} />
                  ))}
                </div>
              </div>
              {focusCode && (showClassement ? (
                <div className="tracker-ranking-float">
                  <div className="tracker-ranking-title">
                    <img src="./icon-classement.svg" style={{ width: 18, height: 18, verticalAlign: 'middle' }} alt="" /> Classement
                    <button className="tracker-ranking-close" onClick={toggleClassement} title="Masquer">✕</button>
                  </div>
                  <ClassementView sessions={sessions} compact />
                </div>
              ) : (
                <button className="tracker-ranking-show-btn" onClick={toggleClassement} title="Afficher le classement"><img src="./icon-classement.svg" style={{ width: 20, height: 20 }} alt="" /></button>
              ))}
            </>
          )}
          {innerTab === 'zones' && <ZonesView sessions={sessions} myCode={myCode} myPseudo={myPseudo} focusCode={focusCode} />}
        </div>
      )}

      {selectedPlayer && (() => {
        const sess  = sessions[selectedPlayer.code]
        const state = sess?.players?.[selectedPlayer.pseudo]
        return state ? <PCPanel code={selectedPlayer.code} pseudo={selectedPlayer.pseudo} state={state} onClose={() => setSelectedPlayer(null)} maxHeight={pcMaxHeight} bottom={pcBottom} /> : null
      })()}

      {tradeOffer && focusCode && (() => {
        const otherPlayers = Object.entries(sessions[focusCode]?.players || {})
          .filter(([p]) => p !== myPseudo)
          .map(([pseudo, state]) => ({
            pseudo,
            team: toArray(state.team).filter(p => p && !p.is_empty && p.species_id),
          }))
          .filter(({ team }) => team.length > 0)
        return (
          <TradeSelector
            myPkName={tradeOffer.pkName}
            sessionGame={sessions[focusCode]?.metadata?.game}
            otherPlayers={otherPlayers}
            onSelect={handleSubmitTrade}
            onCancel={() => setTradeOffer(null)}
          />
        )
      })()}

      {myActiveTrade && isElectron && (
        <TradeOverlay
          trade={myActiveTrade}
          myPseudo={myPseudo}
          onAccept={handleTradeAccept}
          onReject={handleTradeReject}
          onReady={handleTradeReady}
          onConfirm={handleTradeConfirm}
          onCancel={handleTradeCancel}
          executing={tradeExecuting}
          syncingReady={tradeSyncing}
        />
      )}

      {incomingChallenge && (
        <div className="challenge-overlay" onClick={handleDeclineChallenge}>
          <div className="challenge-modal" onClick={e => e.stopPropagation()}>
            <div className="challenge-modal-icon">⚔️</div>
            <h3 className="challenge-modal-title">Défi reçu !</h3>
            <p className="challenge-modal-body">
              <strong>{incomingChallenge.from}</strong> vous défie en duel Pokémon !
            </p>
            <div className="challenge-modal-actions">
              <button className="challenge-btn challenge-btn--decline" onClick={handleDeclineChallenge}>Refuser</button>
              <button className="challenge-btn challenge-btn--accept" onClick={handleAcceptChallenge}>Accepter ⚔</button>
            </div>
          </div>
        </div>
      )}

      {(sentChallenge || challengeSyncing) && !incomingChallenge && (
        <div className="challenge-toast">
          {challengeSyncing
            ? <span>Synchronisation en cours…</span>
            : <><span>Défi envoyé à <strong>{sentChallenge.to}</strong>…</span>
                <button className="challenge-toast-cancel" onClick={handleCancelSentChallenge}>Annuler</button></>
          }
        </div>
      )}

      {tradeNotif && (
        <div className={`trade-notif trade-notif--${tradeNotif.type}`}>
          {tradeNotif.type === 'success' ? '✓' : '✕'} {tradeNotif.message}
        </div>
      )}

      {challengeAnnouncement && (
        <ChallengeAnnouncement
          challenge={challengeAnnouncement}
          onDismiss={() => setChallengeAnnouncement(null)}
        />
      )}

      {challengeWinNotif && !showRewardWheel && (
        <div className="ch-win-notif">
          🏆 <strong>{challengeWinNotif.name}</strong> — +{challengeWinNotif.points} pts
          {challengeWinNotif.hasReward && (
            <button className="ch-win-notif-wheel-btn" onClick={() => setShowRewardWheel(true)}>
              🎁 Récompense
            </button>
          )}
        </div>
      )}

      {showRewardWheel && (
        <RewardWheel onClose={() => { setShowRewardWheel(false); setChallengeWinNotif(null) }} />
      )}

      {focusCode && (
        <div className="tracker-inner-tabs">
          {[['tracker', './icon-tracker.svg', 'Tracker'], ['zones', './icon-zones.svg', 'Zones']].map(([id, iconSrc, label]) => (
            <button
              key={id}
              className={`tracker-inner-tab${innerTab === id ? ' tracker-inner-tab--active' : ''}`}
              onClick={() => setInnerTab(id)}
            >
              <span className="tracker-inner-tab-icon"><img src={iconSrc} className="tracker-inner-tab-svg" alt="" /></span>
              <span className="tracker-inner-tab-label">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
