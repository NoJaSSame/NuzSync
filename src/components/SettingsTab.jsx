import { useState, useEffect } from 'react'
import { GAME_ICON_SRCS } from '../constants'
import ChallengeAdmin from './ChallengeAdmin'

const isElectron = typeof window !== 'undefined' && !!window.tracker

// ── SessionCard ───────────────────────────────────────────────────────────────

function SessionCard({ session, isActive, editing, onActivate, onEdit, onSaveEdit, onLeave, onArchive, onDelete }) {
  const [savePath, setSavePath] = useState(session.savePath || '')
  const [interval, setInterval_] = useState(session.interval || 30)

  useEffect(() => {
    if (editing) {
      setSavePath(session.savePath || '')
      setInterval_(session.interval || 30)
    }
  }, [editing])

  async function handleBrowse() {
    const p = await window.tracker.browse()
    if (p) setSavePath(p)
  }

  return (
    <div className={`session-card${isActive ? ' session-card--active' : ''}${session.archived ? ' session-card--archived' : ''}`}>
      <div className="session-card-header">
        <img src={GAME_ICON_SRCS[session.gameId] || '/pokeball.svg'} className="session-game-icon-svg" alt="" />
        <div className="session-card-info">
          <span className="session-name">{session.sessionName}</span>
          <span className="session-meta">
            <span className="session-code">{session.code}</span>
            {session.isHost && <span className="session-badge session-badge--host">Hôte</span>}
            {session.archived && <span className="session-badge session-badge--archived">Archivée</span>}
          </span>
        </div>
        {isActive && <span className="session-badge session-badge--active">Active</span>}
      </div>

      {editing ? (
        <div className="session-edit-form">
          <div className="tracker-field">
            <label className="tracker-label">Fichier save <span className="tracker-label-hint">(optionnel)</span></label>
            <div className="tracker-path-row">
              <input
                className="tracker-input"
                value={savePath}
                onChange={e => setSavePath(e.target.value)}
                placeholder="Auto-détecter"
              />
              <button className="tracker-browse-btn" onClick={handleBrowse}>📁</button>
            </div>
          </div>
          <div className="tracker-field" style={{ marginBottom: 0 }}>
            <label className="tracker-label">Intervalle de sync</label>
            <div className="tracker-interval-group">
              {[15, 30, 60].map(s => (
                <button
                  key={s}
                  className={`tracker-interval-btn${interval === s ? ' tracker-interval-btn--active' : ''}`}
                  onClick={() => setInterval_(s)}
                >{s}s</button>
              ))}
            </div>
          </div>
          <div className="session-edit-actions">
            <button className="session-btn session-btn--save" onClick={() => onSaveEdit({ savePath, interval })}>
              Sauvegarder
            </button>
            <button className="session-btn session-btn--cancel" onClick={() => onEdit(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="session-card-actions">
          {!isActive && !session.archived && (
            <button className="session-btn session-btn--activate" onClick={onActivate}>Activer</button>
          )}
          <button className="session-btn" onClick={() => onEdit(session.code)}>⚙ Config</button>
          {session.isHost ? (
            <>
              {!session.archived && (
                <button className="session-btn session-btn--warn" onClick={onArchive}>Archiver</button>
              )}
              <button className="session-btn session-btn--danger" onClick={onDelete}>Supprimer</button>
            </>
          ) : (
            <button className="session-btn session-btn--danger" onClick={onLeave}>Quitter</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── CreateModal ───────────────────────────────────────────────────────────────

const MODES = [
  { id: 'nuzlocke',  label: '📜 Nuzlocke'  },
  { id: 'hardcore',  label: '💀 Hardcore'  },
  { id: 'wedlocke',  label: '💍 Wedlocke'  },
  { id: 'solo',      label: '🧍 Solo'      },
]

function CreateModal({ games, onClose, onCreate }) {
  const [gameId,            setGameId]            = useState(games[0]?.id || 'sword')
  const [mode,              setMode]              = useState('nuzlocke')
  const [sessionName,       setSessionName]       = useState('')
  const [savePath,          setSavePath]          = useState('')
  const [interval,          setInterval_]         = useState(30)
  const [challengesEnabled, setChallengesEnabled] = useState(false)
  const [busy,              setBusy]              = useState(false)
  const [error,             setError]             = useState(null)

  async function handleCreate() {
    setBusy(true); setError(null)
    try {
      await onCreate({ gameId, mode, sessionName: sessionName.trim(), savePath, interval, challengesEnabled })
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Créer une session</h3>

        <div className="tracker-field">
          <label className="tracker-label">Jeu</label>
          <div className="game-select-group">
            {games.map(g => (
              <button
                key={g.id}
                className={`game-select-btn${gameId === g.id ? ' game-select-btn--active' : ''}`}
                onClick={() => setGameId(g.id)}
              >
                <img src={GAME_ICON_SRCS[g.id] || '/pokeball.svg'} className="game-select-icon-svg" alt="" /> {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="tracker-field">
          <label className="tracker-label">Mode</label>
          <div className="game-select-group">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`game-select-btn${mode === m.id ? ' game-select-btn--active' : ''}`}
                onClick={() => setMode(m.id)}
              >{m.label}</button>
            ))}
          </div>
        </div>

        <div className="tracker-field">
          <label className="tracker-label">Nom <span className="tracker-label-hint">(optionnel)</span></label>
          <input
            className="tracker-input"
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder={`Run ${games.find(g => g.id === gameId)?.name || ''}`}
            maxLength={64}
          />
        </div>

        <div className="tracker-field">
          <label className="tracker-label">Fichier save <span className="tracker-label-hint">(optionnel)</span></label>
          <div className="tracker-path-row">
            <input
              className="tracker-input"
              value={savePath}
              onChange={e => setSavePath(e.target.value)}
              placeholder="Auto-détecter"
            />
            <button className="tracker-browse-btn" onClick={async () => {
              const p = await window.tracker.browse()
              if (p) setSavePath(p)
            }}>📁</button>
          </div>
        </div>

        <div className="tracker-field">
          <label className="tracker-label">Intervalle de sync</label>
          <div className="tracker-interval-group">
            {[15, 30, 60].map(s => (
              <button
                key={s}
                className={`tracker-interval-btn${interval === s ? ' tracker-interval-btn--active' : ''}`}
                onClick={() => setInterval_(s)}
              >{s}s</button>
            ))}
          </div>
        </div>

        <div className="tracker-field" style={{ marginBottom: 0 }}>
          <label className="tracker-label">Options</label>
          <label className="modal-check">
            <input
              type="checkbox"
              checked={challengesEnabled}
              onChange={e => setChallengesEnabled(e.target.checked)}
            />
            Activer les défis
          </label>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onClose}>Annuler</button>
          <button className="modal-btn modal-btn--confirm" onClick={handleCreate} disabled={busy}>
            {busy ? '...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── JoinModal ─────────────────────────────────────────────────────────────────

function JoinModal({ onClose, onJoin }) {
  const [code,     setCode]      = useState('')
  const [savePath, setSavePath]  = useState('')
  const [interval, setInterval_] = useState(30)
  const [busy,     setBusy]      = useState(false)
  const [error,    setError]     = useState(null)

  async function handleJoin() {
    setBusy(true); setError(null)
    try {
      await onJoin({ code: code.trim(), savePath, interval })
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Rejoindre une session</h3>

        <div className="tracker-field">
          <label className="tracker-label">Code de session</label>
          <input
            className="tracker-input tracker-input--code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="EP-A4F2"
            maxLength={8}
          />
        </div>

        <div className="tracker-field">
          <label className="tracker-label">Fichier save <span className="tracker-label-hint">(optionnel)</span></label>
          <div className="tracker-path-row">
            <input
              className="tracker-input"
              value={savePath}
              onChange={e => setSavePath(e.target.value)}
              placeholder="Auto-détecter"
            />
            <button className="tracker-browse-btn" onClick={async () => {
              const p = await window.tracker.browse()
              if (p) setSavePath(p)
            }}>📁</button>
          </div>
        </div>

        <div className="tracker-field">
          <label className="tracker-label">Intervalle de sync</label>
          <div className="tracker-interval-group">
            {[15, 30, 60].map(s => (
              <button
                key={s}
                className={`tracker-interval-btn${interval === s ? ' tracker-interval-btn--active' : ''}`}
                onClick={() => setInterval_(s)}
              >{s}s</button>
            ))}
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onClose}>Annuler</button>
          <button className="modal-btn modal-btn--confirm" onClick={handleJoin} disabled={busy || !code.trim()}>
            {busy ? '...' : 'Rejoindre'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SettingsTab ───────────────────────────────────────────────────────────────

export default function SettingsTab({ initialModal = null, onModalConsumed, isAdmin = false }) {
  const [pseudo,      setPseudo]      = useState('')
  const [pseudoInput, setPseudoInput] = useState('')
  const [sessions,    setSessions]    = useState([])
  const [activeCode,  setActiveCode]  = useState(null)
  const [status,      setStatus]      = useState({ running: false, lastSync: null, error: null })
  const [busy,        setBusy]        = useState(false)
  const [version,     setVersion]     = useState('')
  const [games,       setGames]       = useState([])
  const [modal,       setModal]       = useState(null)
  const [editCode,    setEditCode]    = useState(null)

  useEffect(() => {
    if (!initialModal) return
    setModal(initialModal)
    onModalConsumed?.()
  }, [initialModal])

  useEffect(() => {
    if (!isElectron) return
    Promise.all([
      window.tracker.getPseudo(),
      window.tracker.getAllSessions(),
      window.tracker.getActiveCode(),
      window.tracker.getVersion(),
      window.tracker.getGames(),
    ]).then(([p, s, ac, v, g]) => {
      const saved = p || ''
      setPseudo(saved)
      setPseudoInput(saved)
      setSessions(s || [])
      setActiveCode(ac)
      setVersion(v)
      setGames(g || [])
    })

    const unsubStatus  = window.tracker.onStatus(setStatus)
    const unsubSession = window.tracker.onSessionUpdated((s, ac) => {
      setSessions(s || [])
      setActiveCode(ac)
    })
    return () => { unsubStatus(); unsubSession() }
  }, [])

  async function handleSavePseudo() {
    const trimmed = pseudoInput.trim()
    if (!trimmed || trimmed === pseudo) return
    await window.tracker.setPseudo(trimmed)
    setPseudo(trimmed)
  }

  async function handleToggle() {
    setBusy(true)
    try {
      status.running ? await window.tracker.stop() : await window.tracker.start()
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit(code, opts) {
    await window.tracker.updateSession({ code, ...opts })
    setSessions(s => s.map(sess => sess.code === code ? { ...sess, ...opts } : sess))
    setEditCode(null)
  }

  async function handleLeave(code) {
    if (!confirm('Quitter cette session ? Tes données seront retirées de la session.')) return
    try { await window.tracker.leaveSession(code) }
    catch (e) { alert(e.message) }
  }

  async function handleArchive(code) {
    if (!confirm('Archiver cette session ? Elle passera en lecture seule.')) return
    try { await window.tracker.archiveSession(code) }
    catch (e) { alert(e.message) }
  }

  async function handleDelete(code) {
    if (!confirm('Supprimer définitivement cette session et toutes ses données ?')) return
    try { await window.tracker.deleteSession(code) }
    catch (e) { alert(e.message) }
  }

  const activeSession  = sessions.find(s => s.code === activeCode) || null
  const lastSyncText   = status.lastSync ? new Date(status.lastSync).toLocaleTimeString('fr-FR') : 'jamais'
  const pseudoChanged  = pseudoInput.trim() !== pseudo

  return (
    <div className="settings-tab">

      {/* ── Pseudo ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Pseudo</h3>
        <div className="tracker-card">
          <div className="tracker-field" style={{ marginBottom: 0 }}>
            <label className="tracker-label">Ton pseudo sur le tracker</label>
            <div className="tracker-path-row">
              <input
                className="tracker-input"
                value={pseudoInput}
                onChange={e => setPseudoInput(e.target.value)}
                placeholder="ex : Sacha"
                maxLength={32}
                disabled={status.running}
                onKeyDown={e => e.key === 'Enter' && handleSavePseudo()}
              />
              <button
                className={`tracker-browse-btn${pseudoChanged && pseudoInput.trim() && !status.running && isElectron ? ' tracker-browse-btn--active' : ''}`}
                onClick={handleSavePseudo}
                disabled={!pseudoChanged || !pseudoInput.trim() || status.running || !isElectron}
                title="Sauvegarder"
              >✓</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sessions ── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-section-title">Sessions</h3>
          {pseudo && (
            <div className="sessions-header-btns">
              <button className="session-action-btn" onClick={() => setModal('join')}>Rejoindre</button>
              <button className="session-action-btn session-action-btn--primary" onClick={() => setModal('create')}>
                + Créer
              </button>
            </div>
          )}
        </div>

        {!pseudo ? (
          <p className="settings-empty">Définis ton pseudo pour créer ou rejoindre une session.</p>
        ) : sessions.length === 0 ? (
          <p className="settings-empty">Aucune session. Crée ou rejoins une session pour commencer.</p>
        ) : (
          <div className="sessions-list">
            {sessions.map(s => (
              <SessionCard
                key={s.code}
                session={s}
                isActive={s.code === activeCode}
                editing={editCode === s.code}
                onActivate={() => window.tracker.setActiveSession(s.code)}
                onEdit={setEditCode}
                onSaveEdit={opts => handleSaveEdit(s.code, opts)}
                onLeave={() => handleLeave(s.code)}
                onArchive={() => handleArchive(s.code)}
                onDelete={() => handleDelete(s.code)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Tracker ── */}
      {activeSession && (
        <div className="settings-section">
          <h3 className="settings-section-title">Tracker — {activeSession.sessionName}</h3>
          <div className="tracker-card">
            <div className={`tracker-status-bar ${status.running ? 'tracker-status--running' : 'tracker-status--idle'}`}>
              <span className="tracker-status-dot" />
              <span className="tracker-status-text">
                {status.running
                  ? `Actif · sync : ${lastSyncText}${status.trainerName ? ` · ${status.trainerName}` : ''}`
                  : 'Inactif'}
              </span>
              {status.error && <span className="tracker-status-error" title={status.error}>⚠ Erreur</span>}
            </div>
            {status.error && <div className="tracker-error-detail">{status.error}</div>}
            <button
              className={`tracker-toggle-btn ${status.running ? 'tracker-toggle-btn--stop' : 'tracker-toggle-btn--start'}`}
              onClick={handleToggle}
              disabled={busy || !isElectron}
            >
              {busy
                ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                : status.running ? '⏹  Arrêter la sync' : '▶  Démarrer la sync'}
            </button>
          </div>
        </div>
      )}

      {!isElectron && (
        <p className="tracker-warn">Lance l'application via Electron pour utiliser cette fonctionnalité.</p>
      )}
      {version && <p className="tracker-version">v{version}</p>}

      {/* ── Admin défis (visible uniquement pour l'admin) ── */}
      {isAdmin && (
        <div className="settings-section">
          <ChallengeAdmin />
        </div>
      )}

      {/* ── Modals ── */}
      {modal === 'create' && (
        <CreateModal games={games} onClose={() => setModal(null)} onCreate={opts => window.tracker.createSession(opts)} />
      )}
      {modal === 'join' && (
        <JoinModal onClose={() => setModal(null)} onJoin={opts => window.tracker.joinSession(opts)} />
      )}
    </div>
  )
}
