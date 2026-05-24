import { useState, useEffect, useRef, useMemo } from 'react'
const logoImg = './logo.png'
import SearchBar from './components/SearchBar'
import PokemonCard from './components/PokemonCard'
import PokemonList from './components/PokemonList'
import TrackerTab from './components/TrackerTab'
import SettingsTab from './components/SettingsTab'
import BattleTab   from './components/BattleTab'
import { getPokemon, getSpecies, getEvolutionChain, getAllPokemonNames, getAllFrenchNames } from './api/pokeapi'
import { computeWeaknesses } from './utils/weaknesses'
import { GAME_ICON_SRCS } from './constants'
import './App.css'

const isElectron = typeof window !== 'undefined' && !!window.tracker

export default function App() {
  const [activeTab, setActiveTab]      = useState('tracker')
  const [pokemon, setPokemon]          = useState(null)
  const [typeData, setTypeData]        = useState(null)
  const [speciesData, setSpeciesData]  = useState(null)
  const [evolutionData, setEvoData]    = useState(null)
  const [loading, setLoading]          = useState(false)
  const [error, setError]              = useState(null)
  const [allNames, setAllNames]        = useState([])
  const [activeSessionName, setActiveSessionName] = useState(null)
  const [syncStatus,        setSyncStatus]        = useState({ running: false, lastSync: null, error: null })
  const [settingsModal,     setSettingsModal]     = useState(null)
  const [trackerOpen,       setTrackerOpen]       = useState(false)
  const [sidebarSessions,   setSidebarSessions]   = useState([])
  const [activeCode,        setActiveCode]        = useState(null)
  const [focusCode,         setFocusCode]         = useState(null)
  const [incomingTrade,     setIncomingTrade]     = useState(false)
  const [incomingChallenge, setIncomingChallenge] = useState(false)
  const [myPseudo,          setMyPseudo]          = useState(null)
  const [deviceId,          setDeviceId]          = useState(null)
  const [battleConfig,      setBattleConfig]      = useState(null)

  const ADMIN_DEVICE_ID = '4d9fc789-1466-4baa-859f-515ecc82f2eb'
  const ADMIN_PSEUDO    = ['Nojas', 'Jason']
  const isAdmin = !!(deviceId && deviceId === ADMIN_DEVICE_ID && ADMIN_PSEUDO.includes(myPseudo))

  // Wonder Trade overlay — app-level so it appears regardless of the active tab
  const [wtConfirm, setWtConfirm]  = useState(null)
  const [wtNotif,   setWtNotif]    = useState(null)
  const wtNotifTimer = useRef(null)

  useEffect(() => {
    async function loadNames() {
      const [englishNames, frenchNames] = await Promise.all([
        getAllPokemonNames(),
        getAllFrenchNames(),
      ])
      const frMap = {}
      for (const { name, pokemon_species_id } of frenchNames) {
        frMap[pokemon_species_id] = name
      }
      setAllNames(englishNames.map(p => ({ ...p, nameFr: frMap[p.id] ?? null })))
    }
    loadNames().catch(() => {
      getAllPokemonNames().then(setAllNames).catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (!isElectron) return
    const unsubStatus  = window.tracker.onStatus(setSyncStatus)
    const unsubConfirm = window.tracker.onWonderTradeConfirm(data => setWtConfirm(data))
    const unsubNotify  = window.tracker.onWonderTradeNotify(data => {
      setWtNotif(data)
      clearTimeout(wtNotifTimer.current)
      wtNotifTimer.current = setTimeout(() => setWtNotif(null), 5000)
    })
    const unsubSession = window.tracker.onSessionUpdated((sessions, ac) => {
      const active = (sessions || []).find(s => s.code === ac)
      setActiveSessionName(active?.sessionName || null)
      setSidebarSessions((sessions || []).filter(s => !s.archived))
      setActiveCode(ac)
    })
    // Load initial state
    Promise.all([window.tracker.getAllSessions(), window.tracker.getActiveCode(), window.tracker.getPseudo(), window.tracker.getDeviceId()]).then(([s, ac, pseudo, did]) => {
      const active = (s || []).find(sess => sess.code === ac)
      setActiveSessionName(active?.sessionName || null)
      setSidebarSessions((s || []).filter(sess => !sess.archived))
      setActiveCode(ac)
      setMyPseudo(pseudo || null)
      setDeviceId(did || null)
    }).catch(() => {})
    return () => { unsubStatus(); unsubConfirm(); unsubNotify(); unsubSession() }
  }, [])

  const frenchNamesById = useMemo(() => {
    const map = {}
    for (const p of allNames) {
      if (p.nameFr) map[p.id] = p.nameFr
    }
    return map
  }, [allNames])

  async function handleSearch(englishName) {
    setLoading(true)
    setError(null)
    setPokemon(null)
    setTypeData(null)
    setSpeciesData(null)
    setEvoData(null)

    try {
      const [pokemonData, species] = await Promise.all([
        getPokemon(englishName),
        getSpecies(englishName),
      ])
      const [td, evo] = await Promise.all([
        computeWeaknesses(pokemonData.types),
        getEvolutionChain(species.evolution_chain.url),
      ])
      setPokemon(pokemonData)
      setTypeData(td)
      setSpeciesData(species)
      setEvoData(evo)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSidebarSessionSwitch(code) {
    await window.tracker.setActiveSession(code)
    setActiveCode(code)
    setFocusCode(code)
  }

  function handleWtReply(confirmed) {
    window.tracker.replyWonderTradeConfirm(confirmed)
    setWtConfirm(null)
  }

  return (
    <div className="app">

      {/* ── Sidebar navigation ── */}
      <nav className="app-nav">
        <button className="app-nav-logo" onClick={() => setActiveTab('tracker')} title="Accueil">
          <img src={logoImg} alt="Logo" />
        </button>

        <div className="app-nav-items">
          <div className={`app-nav-tracker-group${trackerOpen && sidebarSessions.length > 0 ? ' app-nav-tracker-group--open' : ''}`}>
            <button
              className={`app-nav-btn${activeTab === 'tracker' ? ' app-nav-btn--active' : ''}`}
              onClick={() => { setActiveTab('tracker'); setTrackerOpen(o => !o); setFocusCode(null); setIncomingTrade(false) }}
            >
              <span className="app-nav-icon">
                <img src="./icon-tracker.svg" className="app-nav-svg" alt="" />
                {isElectron && syncStatus.running && <span className="app-nav-sync-dot" />}
                {incomingTrade && activeTab !== 'tracker' && <span className="app-nav-trade-badge" title="Offre de trade reçue !" />}
                {incomingChallenge && activeTab !== 'tracker' && <span className="app-nav-challenge-badge" title="Défi reçu !" />}
              </span>
              <span className="app-nav-label">Tracker</span>
            </button>

            {isElectron && trackerOpen && sidebarSessions.length > 0 && (
              <div className="app-nav-folder">
                {sidebarSessions.map(s => (
                  <button
                    key={s.code}
                    className={`app-nav-session-item${activeCode === s.code ? ' app-nav-session-item--active' : ''}`}
                    onClick={() => handleSidebarSessionSwitch(s.code)}
                    title={s.sessionName}
                  >
                    <img src={GAME_ICON_SRCS[s.gameId] || './pokeball.svg'} className="app-nav-session-icon" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`app-nav-btn${activeTab === 'battle' ? ' app-nav-btn--active' : ''}`}
            onClick={() => setActiveTab('battle')}
          >
            <span className="app-nav-icon"><img src="./icon-battle.svg" className="app-nav-svg" alt="" /></span>
            <span className="app-nav-label">Combat</span>
          </button>

          <button
            className={`app-nav-btn${activeTab === 'pokedex' ? ' app-nav-btn--active' : ''}`}
            onClick={() => setActiveTab('pokedex')}
          >
            <span className="app-nav-icon"><img src="./icon-pokedex.svg" className="app-nav-svg" alt="" /></span>
            <span className="app-nav-label">Pokédex</span>
          </button>
        </div>

        <div className="app-nav-spacer" />

        <button
          className={`app-nav-btn${activeTab === 'settings' ? ' app-nav-btn--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span className="app-nav-icon"><img src="./icon-settings.svg" className="app-nav-svg app-nav-svg--settings" alt="" /></span>
          <span className="app-nav-label">Réglages</span>
        </button>
      </nav>

      {/* ── Main content ── */}
      <main className="app-main">
        <div style={{ display: activeTab === 'tracker' ? 'contents' : 'none' }}>
          <TrackerTab
            onGoToSettings={modal => { setActiveTab('settings'); setSettingsModal(modal) }}
            focusCode={focusCode}
            onFocusSession={code => { setFocusCode(code); setActiveCode(code); setTrackerOpen(true) }}
            onIncomingTrade={setIncomingTrade}
            onIncomingChallenge={setIncomingChallenge}
            onBattleStart={config => { setBattleConfig(config); setActiveTab('battle') }}
          />
        </div>

        {activeTab === 'pokedex' && (
          <div className="app-layout">
            <aside className="app-sidebar">
              <div className="app-sidebar__search">
                <SearchBar onSearch={handleSearch} loading={loading} allNames={allNames} />
              </div>
              <PokemonList
                allNames={allNames}
                selectedId={pokemon?.id}
                onSelect={handleSearch}
              />
            </aside>
            <div className="app-detail">
              {error && <p className="error-msg">{error}</p>}
              <PokemonCard
                pokemon={pokemon}
                typeData={typeData}
                speciesData={speciesData}
                evolutionData={evolutionData}
                frenchNamesById={frenchNamesById}
                loading={loading}
                onSelect={handleSearch}
              />
              {!pokemon && !loading && !error && (
                <div className="app-detail__empty">
                  <p>Sélectionne un Pokémon dans la liste ou utilise la recherche</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'battle' && (
          <div className="app-tracker-page" style={{ position: 'relative', overflow: 'hidden' }}>
            <BattleTab
            activeCode={activeCode}
            myPseudo={myPseudo}
            battleConfig={battleConfig}
            frenchNamesById={frenchNamesById}
            onBattleEnd={() => { setBattleConfig(null); setActiveTab('tracker') }}
          />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="app-tracker-page">
            <SettingsTab initialModal={settingsModal} onModalConsumed={() => setSettingsModal(null)} isAdmin={isAdmin} />
          </div>
        )}
      </main>

      {/* Global Wonder Trade notification */}
      {wtNotif && (
        <div className={`wt-notif wt-notif--global wt-notif--${wtNotif.type}`}>
          <span className="wt-notif-icon">
            {wtNotif.type === 'success' ? '✓' : wtNotif.type === 'warning' ? '⚠' : '✕'}
          </span>
          {wtNotif.message}
        </div>
      )}

      {/* Global Wonder Trade confirmation modal */}
      {wtConfirm && (
        <div className="wt-overlay" onClick={() => handleWtReply(false)}>
          <div className="wt-modal" onClick={e => e.stopPropagation()}>
            <div className="wt-modal-icon"><img src="./icon-wondertrade.svg" style={{ width: 40, height: 40 }} alt="" /></div>
            <h3 className="wt-modal-title">Wonder Trade</h3>
            <p className="wt-modal-sub">Échange demandé depuis le site</p>
            <p className="wt-modal-pokemon">{wtConfirm.pkName}</p>
            <p className="wt-modal-hint">Si tu n'as pas demandé cet échange, annule.</p>
            <div className="wt-modal-actions">
              <button className="wt-btn wt-btn--cancel"  onClick={() => handleWtReply(false)}>Annuler</button>
              <button className="wt-btn wt-btn--confirm" onClick={() => handleWtReply(true)}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
