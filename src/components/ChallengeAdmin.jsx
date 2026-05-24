import { useState, useEffect, useMemo } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, push, remove } from 'firebase/database'
import { FIREBASE_CONFIG } from '../constants'
import RewardWheel from './RewardWheel'
import './ChallengeAdmin.css'

const METRICS = [
  { id: 'badge_count',      label: 'Badges obtenus' },
  { id: 'zones_visited',    label: 'Zones avec capture' },
  { id: 'defeats',          label: 'Défaites' },
  { id: 'box_count',        label: 'Pokémon capturés (total)' },
  { id: 'play_time_hours',  label: 'Temps de jeu (heures)' },
  { id: 'team_alive',       label: 'Pokémon vivants en équipe' },
]

const OPERATORS = ['>=', '<=', '==', '>', '<']

function emptyChallenge() {
  return {
    name: '',
    description: '',
    type: 'individual',
    validation: 'auto',
    trigger: { type: 'event', metric: 'badge_count', value: 1 },
    winCondition: { metric: 'badge_count', operator: '>=', value: 4 },
    failCondition: null,
    timer: null,
    points: 100,
    hasReward: false,
    simultaneousAllowed: true,
  }
}

function emptyReward() {
  return { name: '', description: '', weight: 10 }
}

// ── Formulaire défi ───────────────────────────────────────────────────────────

function ChallengeForm({ initial, onSave, onCancel, saving }) {
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(initial)))

  function set_(path, value) {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.')
      let obj = next
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
      obj[keys[keys.length - 1]] = value
      return next
    })
  }

  return (
    <div className="cha-form">
      <div className="cha-form-grid">

        <div className="cha-field cha-field--full">
          <label className="cha-label">Nom</label>
          <input className="cha-input" value={data.name} onChange={e => set_('name', e.target.value)} placeholder="Ex : Premier badge" />
        </div>

        <div className="cha-field cha-field--full">
          <label className="cha-label">Description</label>
          <textarea className="cha-input cha-textarea" value={data.description} onChange={e => set_('description', e.target.value)} placeholder="Visible par tous les joueurs" rows={2} />
        </div>

        <div className="cha-field">
          <label className="cha-label">Type</label>
          <div className="cha-toggle-group">
            {[['individual','Individuel'],['collective','Collectif']].map(([v,l]) => (
              <button key={v} className={`cha-toggle${data.type === v ? ' cha-toggle--active' : ''}`} onClick={() => set_('type', v)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="cha-field">
          <label className="cha-label">Validation</label>
          <div className="cha-toggle-group">
            {[['auto','Automatique'],['manual','Vote']].map(([v,l]) => (
              <button key={v} className={`cha-toggle${data.validation === v ? ' cha-toggle--active' : ''}`} onClick={() => set_('validation', v)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="cha-field cha-field--full">
          <label className="cha-label">Déclencheur</label>
          <div className="cha-row">
            <div className="cha-toggle-group">
              {[['event','Événement'],['time','Timer']].map(([v,l]) => (
                <button key={v} className={`cha-toggle${data.trigger.type === v ? ' cha-toggle--active' : ''}`} onClick={() => set_('trigger.type', v)}>{l}</button>
              ))}
            </div>
            {data.trigger.type === 'event' ? (
              <>
                <select className="cha-select" value={data.trigger.metric} onChange={e => set_('trigger.metric', e.target.value)}>
                  {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <span className="cha-sep">atteint</span>
                <input className="cha-input cha-input--sm" type="number" min={0} value={data.trigger.value} onChange={e => set_('trigger.value', Number(e.target.value))} />
              </>
            ) : (
              <>
                <span className="cha-sep">après</span>
                <input className="cha-input cha-input--sm" type="number" min={0} value={data.trigger.timeHours || 0} onChange={e => set_('trigger.timeHours', Number(e.target.value))} />
                <span className="cha-sep">h de jeu</span>
              </>
            )}
          </div>
        </div>

        {data.validation === 'auto' && (
          <div className="cha-field cha-field--full">
            <label className="cha-label">Condition de victoire</label>
            <div className="cha-row">
              <select className="cha-select" value={data.winCondition.metric} onChange={e => set_('winCondition.metric', e.target.value)}>
                {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <select className="cha-select cha-select--sm" value={data.winCondition.operator} onChange={e => set_('winCondition.operator', e.target.value)}>
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <input className="cha-input cha-input--sm" type="number" value={data.winCondition.value} onChange={e => set_('winCondition.value', Number(e.target.value))} />
            </div>
          </div>
        )}

        {data.validation === 'auto' && (
          <div className="cha-field cha-field--full">
            <label className="cha-label">
              Condition d'échec
              <button className="cha-label-btn" onClick={() => set_('failCondition', data.failCondition ? null : { metric: 'defeats', operator: '>=', value: 1 })}>
                {data.failCondition ? '− Retirer' : '+ Ajouter'}
              </button>
            </label>
            {data.failCondition && (
              <div className="cha-row">
                <select className="cha-select" value={data.failCondition.metric} onChange={e => set_('failCondition.metric', e.target.value)}>
                  {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <select className="cha-select cha-select--sm" value={data.failCondition.operator} onChange={e => set_('failCondition.operator', e.target.value)}>
                  {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                <input className="cha-input cha-input--sm" type="number" value={data.failCondition.value} onChange={e => set_('failCondition.value', Number(e.target.value))} />
              </div>
            )}
          </div>
        )}

        <div className="cha-field cha-field--full">
          <label className="cha-label">
            Timer du défi
            <button className="cha-label-btn" onClick={() => set_('timer', data.timer ? null : { duration: 60, unit: 'minutes' })}>
              {data.timer ? '− Retirer' : '+ Ajouter'}
            </button>
          </label>
          {data.timer && (
            <div className="cha-row">
              <input className="cha-input cha-input--sm" type="number" min={1} value={data.timer.duration} onChange={e => set_('timer.duration', Number(e.target.value))} />
              <div className="cha-toggle-group">
                {[['minutes','min réels'],['playtime_hours','h de jeu']].map(([v,l]) => (
                  <button key={v} className={`cha-toggle${data.timer.unit === v ? ' cha-toggle--active' : ''}`} onClick={() => set_('timer.unit', v)}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="cha-field">
          <label className="cha-label">Points</label>
          <input className="cha-input" type="number" min={0} step={10} value={data.points} onChange={e => set_('points', Number(e.target.value))} />
        </div>

        <div className="cha-field">
          <label className="cha-label">Options</label>
          <div className="cha-checks">
            <label className="cha-check">
              <input type="checkbox" checked={data.hasReward} onChange={e => set_('hasReward', e.target.checked)} />
              Récompense Wonder Trade
            </label>
            <label className="cha-check">
              <input type="checkbox" checked={data.simultaneousAllowed} onChange={e => set_('simultaneousAllowed', e.target.checked)} />
              Défis simultanés autorisés
            </label>
          </div>
        </div>
      </div>

      <div className="cha-form-actions">
        <button className="cha-btn cha-btn--cancel" onClick={onCancel}>Annuler</button>
        <button className="cha-btn cha-btn--save" onClick={() => onSave(data)} disabled={saving || !data.name.trim()}>
          {saving ? '…' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ── Formulaire récompense ─────────────────────────────────────────────────────

function RewardForm({ initial, onSave, onCancel, saving }) {
  const [data, setData] = useState(() => ({ ...initial }))
  return (
    <div className="cha-form">
      <div className="cha-form-grid">
        <div className="cha-field">
          <label className="cha-label">Nom</label>
          <input className="cha-input" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Ex : Master Ball" />
        </div>
        <div className="cha-field">
          <label className="cha-label">Poids <span className="cha-hint">(probabilité relative)</span></label>
          <input className="cha-input" type="number" min={1} value={data.weight} onChange={e => setData(d => ({ ...d, weight: Number(e.target.value) }))} />
        </div>
        <div className="cha-field cha-field--full">
          <label className="cha-label">Description <span className="cha-hint">(optionnel)</span></label>
          <input className="cha-input" value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))} placeholder="Ex : Capture à coup sûr" />
        </div>
      </div>
      <div className="cha-form-actions">
        <button className="cha-btn cha-btn--cancel" onClick={onCancel}>Annuler</button>
        <button className="cha-btn cha-btn--save" onClick={() => onSave(data)} disabled={saving || !data.name.trim()}>
          {saving ? '…' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ── ChallengeAdmin ────────────────────────────────────────────────────────────

export default function ChallengeAdmin() {
  const fbDb = useMemo(() => {
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
    return getDatabase(app)
  }, [])

  const [tab,        setTab]        = useState('catalog')
  const [catalog,    setCatalog]    = useState({})
  const [pool,       setPool]       = useState({})
  const [form,       setForm]       = useState(null)  // { mode, id?, initial }
  const [rewardForm, setRewardForm] = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [testWheel,  setTestWheel]  = useState(false)

  useEffect(() => {
    const u1 = onValue(ref(fbDb, 'challenge_catalog'), s => setCatalog(s.val() || {}))
    const u2 = onValue(ref(fbDb, 'challenge_pool'),    s => setPool(s.val() || {}))
    return () => { u1(); u2() }
  }, [fbDb])

  async function saveChallenge(data) {
    setSaving(true)
    try {
      if (form.mode === 'create') await push(ref(fbDb, 'challenge_catalog'), data)
      else                        await set(ref(fbDb, `challenge_catalog/${form.id}`), data)
      setForm(null)
    } finally { setSaving(false) }
  }

  async function deleteChallenge(id) {
    if (!confirm('Supprimer ce défi ?')) return
    await remove(ref(fbDb, `challenge_catalog/${id}`))
  }

  async function saveReward(data) {
    setSaving(true)
    try {
      if (rewardForm.mode === 'create') await push(ref(fbDb, 'challenge_pool'), data)
      else                              await set(ref(fbDb, `challenge_pool/${rewardForm.id}`), data)
      setRewardForm(null)
    } finally { setSaving(false) }
  }

  async function deleteReward(id) {
    if (!confirm('Supprimer cette récompense ?')) return
    await remove(ref(fbDb, `challenge_pool/${id}`))
  }

  const catalogList = Object.entries(catalog)
  const poolList    = Object.entries(pool)

  return (
    <div className="cha-root">
      <div className="cha-topbar">
        <h3 className="cha-title">Défis — Admin</h3>
        <div className="cha-tabs">
          {[['catalog','Catalogue'],['pool','Récompenses']].map(([v,l]) => (
            <button key={v} className={`cha-tab${tab === v ? ' cha-tab--active' : ''}`} onClick={() => { setTab(v); setForm(null); setRewardForm(null) }}>{l}</button>
          ))}
        </div>
        <button className="cha-wheel-test-btn" onClick={() => setTestWheel(true)} title="Tester la roue">🎰</button>
      </div>

      {testWheel && <RewardWheel onClose={() => setTestWheel(false)} />}

      {/* ── Catalogue ── */}
      {tab === 'catalog' && (
        <>
          <div className="cha-list">
            {catalogList.length === 0 && <p className="cha-empty">Aucun défi — crées-en un.</p>}
            {catalogList.map(([id, ch]) => (
              <div key={id} className={`cha-item${form?.id === id ? ' cha-item--editing' : ''}`}>
                <div className="cha-item-main">
                  <span className="cha-item-name">{ch.name}</span>
                  <div className="cha-item-badges">
                    <span className={`cha-badge cha-badge--type-${ch.type}`}>{ch.type === 'individual' ? 'Individuel' : 'Collectif'}</span>
                    <span className={`cha-badge cha-badge--val-${ch.validation}`}>{ch.validation === 'auto' ? 'Auto' : 'Vote'}</span>
                    <span className="cha-badge cha-badge--pts">{ch.points} pts</span>
                    {ch.hasReward && <span className="cha-badge cha-badge--reward">WT</span>}
                  </div>
                </div>
                <div className="cha-item-actions">
                  <button className="cha-btn" onClick={() => setForm(f => f?.id === id ? null : { mode: 'edit', id, initial: ch })}>
                    {form?.id === id ? 'Fermer' : 'Modifier'}
                  </button>
                  <button className="cha-btn cha-btn--danger" onClick={() => deleteChallenge(id)}>✕</button>
                </div>
                {form?.id === id && (
                  <ChallengeForm initial={form.initial} onSave={saveChallenge} onCancel={() => setForm(null)} saving={saving} />
                )}
              </div>
            ))}
          </div>

          {!form && (
            <button className="cha-add-btn" onClick={() => setForm({ mode: 'create', initial: emptyChallenge() })}>
              + Nouveau défi
            </button>
          )}
          {form?.mode === 'create' && (
            <ChallengeForm initial={form.initial} onSave={saveChallenge} onCancel={() => setForm(null)} saving={saving} />
          )}
        </>
      )}

      {/* ── Pool récompenses ── */}
      {tab === 'pool' && (
        <>
          <div className="cha-list">
            {poolList.length === 0 && <p className="cha-empty">Aucune récompense dans le pool.</p>}
            {poolList.map(([id, r]) => (
              <div key={id} className={`cha-item${rewardForm?.id === id ? ' cha-item--editing' : ''}`}>
                <div className="cha-item-main">
                  <span className="cha-item-name">{r.name}</span>
                  <div className="cha-item-badges">
                    <span className="cha-badge cha-badge--pts">Poids {r.weight}</span>
                    {r.description && <span className="cha-item-desc">{r.description}</span>}
                  </div>
                </div>
                <div className="cha-item-actions">
                  <button className="cha-btn" onClick={() => setRewardForm(f => f?.id === id ? null : { mode: 'edit', id, initial: r })}>
                    {rewardForm?.id === id ? 'Fermer' : 'Modifier'}
                  </button>
                  <button className="cha-btn cha-btn--danger" onClick={() => deleteReward(id)}>✕</button>
                </div>
                {rewardForm?.id === id && (
                  <RewardForm initial={rewardForm.initial} onSave={saveReward} onCancel={() => setRewardForm(null)} saving={saving} />
                )}
              </div>
            ))}
          </div>

          {!rewardForm && (
            <button className="cha-add-btn" onClick={() => setRewardForm({ mode: 'create', initial: emptyReward() })}>
              + Nouvelle récompense
            </button>
          )}
          {rewardForm?.mode === 'create' && (
            <RewardForm initial={rewardForm.initial} onSave={saveReward} onCancel={() => setRewardForm(null)} saving={saving} />
          )}
        </>
      )}
    </div>
  )
}
