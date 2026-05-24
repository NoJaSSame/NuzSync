'use strict'

const { app, BrowserWindow, shell, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron')
const { autoUpdater } = require('electron-updater')
const path    = require('path')
const fs      = require('fs')
const { execFile, exec } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)
const isDev = process.env.NODE_ENV === 'development'

// ─── Firebase ─────────────────────────────────────────────────────────────────
const { initializeApp, getApps }       = require('firebase/app')
const { getDatabase, ref, set, update, get, onValue, remove } = require('firebase/database')
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth')

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBJqUm9ODslpo1xfIHCfAv24Ue0LwIapUQ",
  authDomain:        "nuzelocktracker.firebaseapp.com",
  databaseURL:       "https://nuzelocktracker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "nuzelocktracker",
  storageBucket:     "nuzelocktracker.firebasestorage.app",
  messagingSenderId: "906207746746",
  appId:             "1:906207746746:web:d9b7a5f80923c69b51c083",
}

const fbApp  = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
const fbDb   = getDatabase(fbApp)
const fbAuth = getAuth(fbApp)

async function ensureAuth() {
  if (fbAuth.currentUser) return
  const id  = currentConfig.deviceId
  const email = `d${id.replace(/-/g, '')}@nuzsync.app`
  try {
    await signInWithEmailAndPassword(fbAuth, email, id)
  } catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
      await createUserWithEmailAndPassword(fbAuth, email, id)
    } else {
      throw e
    }
  }
  console.log('[Tracker] Auth OK — UID:', fbAuth.currentUser.uid)
}

// ─── Firebase path helpers ────────────────────────────────────────────────────

const sessionMetaRef  = (code)               => ref(fbDb, `sessions/${code}/metadata`)
const playerRef       = (code, pseudo)       => ref(fbDb, `sessions/${code}/players/${pseudo}`)
const tradeReqRef     = (code, pseudo)       => ref(fbDb, `sessions/${code}/pending_trades/${pseudo}/request`)
const tradeCdRef      = (code, pseudo)       => ref(fbDb, `sessions/${code}/pending_trades/${pseudo}/last_trade_at`)
const tradeResultRef  = (code, pseudo)       => ref(fbDb, `sessions/${code}/pending_trades/${pseudo}/result`)
const p2pTradeRef     = (code, tradeId)      => ref(fbDb, `sessions/${code}/trades/${tradeId}`)
const p2pTradesRef    = (code)               => ref(fbDb, `sessions/${code}/trades`)

// ─── Jeux disponibles ─────────────────────────────────────────────────────────

const GAMES = [
  { id: 'sword',   name: 'Pokémon Épée',    prefix: 'EP' },
  { id: 'shield',  name: 'Pokémon Bouclier', prefix: 'BO' },
  { id: 'scarlet', name: 'Pokémon Écarlate', prefix: 'EC' },
  { id: 'violet',  name: 'Pokémon Violet',   prefix: 'VI' },
  { id: 'other',   name: 'Autre',            prefix: 'PK' },
]

function generateCode(gameId) {
  const game   = GAMES.find(g => g.id === gameId) || GAMES[GAMES.length - 1]
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${game.prefix}-${random}`
}

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfigPath() {
  return path.join(app.getPath('userData'), 'tracker-config.json')
}

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'))
    // Migration ancien format (playerLabel) → nouveau format sessions
    if (raw.playerLabel !== undefined || raw.pseudo === undefined) {
      const cfg = { pseudo: '', sessions: [], activeSessionCode: null, deviceId: require('crypto').randomUUID() }
      saveConfig(cfg)
      return cfg
    }
    // Génère un deviceId stable si absent (migration)
    if (!raw.deviceId) {
      raw.deviceId = require('crypto').randomUUID()
      saveConfig(raw)
    }
    return raw
  } catch {
    const cfg = { pseudo: '', sessions: [], activeSessionCode: null, deviceId: require('crypto').randomUUID() }
    saveConfig(cfg)
    return cfg
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8')
}

function getActiveSession() {
  if (!currentConfig.activeSessionCode) return null
  return (currentConfig.sessions || []).find(s => s.code === currentConfig.activeSessionCode) || null
}

// ─── Challenge System ─────────────────────────────────────────────────────────

let catalogCache     = null
let catalogCacheTime = 0

async function getCatalogCached() {
  if (catalogCache && Date.now() - catalogCacheTime < 5 * 60 * 1000) return catalogCache
  const snap = await get(ref(fbDb, 'challenge_catalog'))
  catalogCache = snap.val() || {}
  catalogCacheTime = Date.now()
  return catalogCache
}

function getMetricValue(metric, data) {
  switch (metric) {
    case 'badge_count':
      return (data.badges || []).filter(Boolean).length
    case 'zones_visited': {
      const all = [...(data.party || []), ...(data.boxes || [])]
        .filter(p => p && p.met_location && p.species_id && !p.is_empty)
      return new Set(all.map(p => p.met_location)).size
    }
    case 'defeats':
      return currentDefeats
    case 'box_count':
      return (data.boxes || []).filter(p => p && p.species_id && !p.is_empty && !p.is_egg).length
    case 'play_time_hours':
      return data.played_hours || 0
    case 'team_alive':
      return (data.party || []).filter(p => p && p.species_id && (p.hp_current || 0) > 0).length
    default:
      return 0
  }
}

function evalCondition(cond, data) {
  if (!cond) return false
  const val = getMetricValue(cond.metric, data)
  switch (cond.operator) {
    case '>=': return val >= cond.value
    case '<=': return val <= cond.value
    case '==': return val == cond.value // eslint-disable-line eqeqeq
    case '>':  return val >  cond.value
    case '<':  return val <  cond.value
    default:   return false
  }
}

function triggerFired(trigger, data) {
  if (!trigger) return false
  if (trigger.type === 'time')
    return (data.played_hours || 0) >= (trigger.timeHours || 0)
  return evalCondition({ metric: trigger.metric, operator: '>=', value: trigger.value }, data)
}

async function checkChallenges(data) {
  const pseudo  = currentConfig.pseudo
  const session = getActiveSession()
  if (!pseudo || !session || !session.challengesEnabled) return

  try {
    await ensureAuth()
    const catalog = await getCatalogCached()
    if (!catalog || Object.keys(catalog).length === 0) return

    const code = session.code

    const [activeSnap, completedSnap, playersSnap, hostSnap] = await Promise.all([
      get(ref(fbDb, `sessions/${code}/active_challenges`)),
      get(ref(fbDb, `sessions/${code}/completed_challenges`)),
      get(ref(fbDb, `sessions/${code}/players`)),
      get(ref(fbDb, `sessions/${code}/metadata/host`)),
    ])
    const activeChallenges    = activeSnap.val()    || {}
    const completedChallenges = completedSnap.val() || {}
    const players             = playersSnap.val()   || {}
    const hostPseudo          = hostSnap.val()      || ''

    const activeCount = Object.keys(activeChallenges).length

    // ── Dispatch new challenges ──────────────────────────────────────────────
    for (const [catalogId, ch] of Object.entries(catalog)) {
      if (activeChallenges[catalogId] || completedChallenges[catalogId]) continue
      if (!ch.simultaneousAllowed && activeCount > 0) continue
      if (!triggerFired(ch.trigger, data)) continue

      const now  = Date.now()
      const endsAt = (ch.timer && ch.timer.unit === 'minutes')
        ? now + ch.timer.duration * 60 * 1000
        : null

      await set(ref(fbDb, `sessions/${code}/active_challenges/${catalogId}`), {
        catalogId,
        name:                ch.name,
        description:         ch.description || '',
        type:                ch.type,
        validation:          ch.validation,
        winCondition:        ch.winCondition  || null,
        failCondition:       ch.failCondition || null,
        timer:               ch.timer         || null,
        points:              ch.points        || 0,
        hasReward:           !!ch.hasReward,
        simultaneousAllowed: !!ch.simultaneousAllowed,
        startedAt:           now,
        endsAt,
        startPlayTime:       data.played_hours || 0,
        playerStatuses:      {},
        votes:               {},
      })
      console.log(`[Challenge] ✨ Déclenché : ${ch.name}`)
      mainWindow?.webContents.send('challenge:new', { name: ch.name, description: ch.description || '' })
    }

    // Re-fetch actif après dispatch potentiel
    const freshSnap   = await get(ref(fbDb, `sessions/${code}/active_challenges`))
    const activeNow   = freshSnap.val() || {}

    // ── Auto-validation ──────────────────────────────────────────────────────
    for (const [catalogId, ch] of Object.entries(activeNow)) {
      if (ch.validation !== 'auto') continue
      const myStatus = (ch.playerStatuses || {})[pseudo]
      if (myStatus === 'won' || myStatus === 'failed') continue

      const statusPath = `sessions/${code}/active_challenges/${catalogId}/playerStatuses/${pseudo}`

      // Timer expiré
      if (ch.endsAt && Date.now() > ch.endsAt) {
        await set(ref(fbDb, statusPath), 'failed')
        console.log(`[Challenge] ⏱ Timer expiré (${pseudo}) : ${ch.name}`)
        continue
      }

      // Condition d'échec en premier
      if (ch.failCondition && evalCondition(ch.failCondition, data)) {
        await set(ref(fbDb, statusPath), 'failed')
        console.log(`[Challenge] 💀 ${pseudo} a échoué : ${ch.name}`)
        continue
      }

      // Condition de victoire
      if (ch.winCondition && evalCondition(ch.winCondition, data)) {
        await set(ref(fbDb, statusPath), 'won')
        console.log(`[Challenge] 🏆 ${pseudo} a remporté : ${ch.name}`)

        if (ch.points > 0) {
          const scoreRef  = ref(fbDb, `sessions/${code}/challenge_scores/${pseudo}`)
          const scoreSnap = await get(scoreRef)
          await set(scoreRef, (scoreSnap.val() || 0) + ch.points)
        }
        mainWindow?.webContents.send('challenge:won', {
          name: ch.name, points: ch.points || 0, hasReward: !!ch.hasReward,
        })
      }
    }

    // ── Résolution des votes (validation manuelle) ───────────────────────────
    for (const [catalogId, ch] of Object.entries(activeNow)) {
      if (ch.validation !== 'manual') continue

      const votes      = ch.votes || {}
      const playerList = Object.keys(players)
      if (Object.keys(votes).length === 0) continue

      let winW = 0, failW = 0, totalW = 0
      for (const p of playerList) {
        const w = (p === hostPseudo) ? 2 : 1
        totalW += w
        if (votes[p] === 'win')  winW  += w
        if (votes[p] === 'fail') failW += w
      }

      // Majorité absolue
      if (winW > totalW / 2 || failW > totalW / 2) {
        const outcome = winW > failW ? 'won' : 'failed'

        if (outcome === 'won' && ch.points > 0) {
          await Promise.all(
            Object.entries(votes)
              .filter(([, v]) => v === 'win')
              .map(async ([p]) => {
                const sr   = ref(fbDb, `sessions/${code}/challenge_scores/${p}`)
                const snap = await get(sr)
                return set(sr, (snap.val() || 0) + ch.points)
              })
          )
        }

        await set(ref(fbDb, `sessions/${code}/completed_challenges/${catalogId}`), {
          ...ch, status: outcome, completedAt: Date.now(),
        })
        await remove(ref(fbDb, `sessions/${code}/active_challenges/${catalogId}`))
        console.log(`[Challenge] 📊 Vote résolu (${outcome}) : ${ch.name}`)
      }
    }

  } catch (e) {
    console.error('[Challenge] checkChallenges:', e.message)
  }
}

// ─── Compteur de défaites ─────────────────────────────────────────────────────

const prevPartyState = {}
let currentDefeats = 0

function detectWhiteout(pseudo, party) {
  const valid    = party.filter(p => p.species_id && p.hp_max > 0)
  if (valid.length === 0) return false
  const aliveNow = valid.filter(p => p.hp_current > 0).length
  const allKoNow = aliveNow === 0
  const prev     = prevPartyState[pseudo]
  const wasAlive = prev && prev.aliveCount > 0
  const cooldownOk = !prev?.lastWhiteoutTime || (Date.now() - prev.lastWhiteoutTime) > 5 * 60 * 1000
  prevPartyState[pseudo] = {
    aliveCount:       aliveNow,
    lastWhiteoutTime: (wasAlive && allKoNow && cooldownOk) ? Date.now() : prev?.lastWhiteoutTime,
  }
  return wasAlive && allKoNow && cooldownOk
}

async function loadDefeats(code, pseudo) {
  try {
    await ensureAuth()
    const snap = await get(ref(fbDb, `sessions/${code}/players/${pseudo}/defeats`))
    currentDefeats = snap.val() || 0
  } catch {
    currentDefeats = 0
  }
}

// ─── Ryujinx ─────────────────────────────────────────────────────────────────

function isRyujinxRunning() {
  return new Promise(resolve => {
    exec('tasklist /NH /FO CSV', { timeout: 5000 }, (_, stdout) => {
      const out = (stdout || '').toLowerCase()
      resolve(out.includes('ryujinx.exe') || out.includes('ryujinx.ava.exe'))
    })
  })
}

async function waitForRyujinxClose(maxSeconds = 300) {
  for (let i = 0; i < maxSeconds; i++) {
    await new Promise(r => setTimeout(r, 1000))
    if (!(await isRyujinxRunning())) return true
  }
  return false
}

// ─── Wonder Trade ─────────────────────────────────────────────────────────────

let wonderTradeUnsub      = null
const handledTrades        = new Set()
let wonderTradeInProgress  = false

async function executeWonderTrade(savePath, slotIndex) {
  const exe = getReaderExePath()
  if (!fs.existsSync(exe)) throw new Error(`NuzelockReader.exe introuvable : ${exe}`)
  const sp = savePath || 'auto'
  try {
    const { stdout } = await execFileAsync(exe, ['wonder-trade', sp, String(slotIndex)], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    })
    return JSON.parse(stdout)
  } catch (err) {
    if (err.code === 2) throw new Error('Save verrouillée — ferme Ryujinx et réessaie.')
    throw err
  }
}

async function handleWonderTradeRequest(slotIndex, pkName) {
  if (wonderTradeInProgress) {
    showInAppNotify('warning', 'Un échange est déjà en cours…')
    return { error: 'in_progress' }
  }
  wonderTradeInProgress = true

  // Cooldown Firebase
  const FIVE_HOURS = 5 * 60 * 60 * 1000
  const pseudo  = currentConfig.pseudo
  const session = getActiveSession()
  if (pseudo && session) {
    try {
      await ensureAuth()
      const cdSnap = await get(tradeCdRef(session.code, pseudo))
      const lastAt = cdSnap.val() || 0
      if (Date.now() - lastAt < FIVE_HOURS) {
        const remaining = Math.ceil((FIVE_HOURS - (Date.now() - lastAt)) / 60000)
        showInAppNotify('warning', `Cooldown actif — encore ${remaining} min`)
        wonderTradeInProgress = false
        return { error: 'cooldown' }
      }
    } catch {}
  }

  // Ryujinx doit être fermé
  const running = await isRyujinxRunning()
  if (running) {
    showInAppNotify('warning', 'Ferme Ryujinx avant d\'effectuer un Wonder Trade !')
    wonderTradeInProgress = false
    return { error: 'ryujinx_running' }
  }

  try {
    const result = await executeWonderTrade(session?.savePath || null, slotIndex)
    const newPk  = result.new_pokemon
    const name   = (newPk.nickname && newPk.nickname !== newPk.species_name)
      ? `${newPk.nickname} (${newPk.species_name})`
      : (newPk.species_name || `#${newPk.species_id}`)

    // Diffuse le résultat sur Firebase pour les viewers du site
    if (pseudo && session) {
      try {
        await ensureAuth()
        await set(tradeResultRef(session.code, pseudo), { ...result, processed_at: Date.now() })
        await set(tradeCdRef(session.code, pseudo), Date.now())
        setTimeout(async () => { try { await remove(tradeResultRef(session.code, pseudo)) } catch {} }, 5000)
      } catch {}
    }

    showInAppNotify('success', `Wonder Trade ! Tu as reçu ${name}${newPk.is_shiny ? ' ✨' : ''} !`)
    wonderTradeInProgress = false
    return { success: true }
  } catch (err) {
    console.error('[WonderTrade]', err.message)
    showInAppNotify('error', `Échange échoué : ${err.message}`)
    wonderTradeInProgress = false
    return { error: err.message }
  }
}

// ─── P2P Trade ────────────────────────────────────────────────────────────────

async function executeTradeExport(savePath, slotIndex) {
  const exe = getReaderExePath()
  if (!fs.existsSync(exe)) throw new Error(`NuzelockReader.exe introuvable : ${exe}`)
  const { stdout } = await execFileAsync(exe, ['trade', 'export', savePath || 'auto', String(slotIndex)], {
    timeout: 30000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8',
  })
  return JSON.parse(stdout)
}

async function executeTradeInject(savePath, slotIndex, b64) {
  const exe = getReaderExePath()
  if (!fs.existsSync(exe)) throw new Error(`NuzelockReader.exe introuvable : ${exe}`)
  try {
    const { stdout } = await execFileAsync(exe, ['trade', 'inject', savePath || 'auto', String(slotIndex), b64], {
      timeout: 30000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8',
    })
    return JSON.parse(stdout)
  } catch (err) {
    if (err.code === 2) throw new Error('Save verrouillée — ferme Ryujinx et réessaie.')
    throw err
  }
}

async function cleanupMyTrades() {
  const pseudo = currentConfig.pseudo
  if (!pseudo) return
  try {
    await ensureAuth()
    const removals = []
    for (const session of (currentConfig.sessions || [])) {
      const snap   = await get(p2pTradesRef(session.code))
      const trades = snap.val() || {}
      for (const [tradeId, t] of Object.entries(trades)) {
        if (t && (t.initiator === pseudo || t.receiver === pseudo) && t.status !== 'completed') {
          removals.push(remove(p2pTradeRef(session.code, tradeId)))
        }
      }
    }
    await Promise.all(removals)
  } catch (e) {
    console.error('[TradeCleanup]', e.message)
  }
}

// ─── In-app UI ────────────────────────────────────────────────────────────────

function showInAppConfirm(data) {
  return new Promise(resolve => {
    function handler(_, confirmed) { clearTimeout(timer); resolve(confirmed) }
    const timer = setTimeout(() => {
      ipcMain.removeListener('tracker:wt-confirm-reply', handler)
      resolve(false)
    }, 60000)
    ipcMain.once('tracker:wt-confirm-reply', handler)
    mainWindow?.show(); mainWindow?.focus()
    mainWindow?.webContents.send('tracker:wt-confirm', data)
  })
}

function showInAppNotify(type, message) {
  mainWindow?.webContents.send('tracker:wt-notify', { type, message })
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

function getReaderExePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'nuzelock-reader', 'NuzelockReader.exe')
  }
  return path.join(__dirname, '../../Nuzelock Tracker/csharp/bin/Release/net9.0-windows/win-x64/NuzelockReader.exe')
}

async function pushToFirebase(data) {
  const pseudo  = currentConfig.pseudo
  const session = getActiveSession()
  if (!pseudo || !session) return

  const party = data.party || []
  if (detectWhiteout(pseudo, party)) {
    currentDefeats++
    console.log(`[Tracker] 💀 Défaite détectée ! Total: ${currentDefeats}`)
  }

  await ensureAuth()
  const playPayload = {}
  if (data.played_hours != null) {
    playPayload.play_time_hours   = data.played_hours
    playPayload.play_time_minutes = data.played_minutes ?? 0
    playPayload.play_time_seconds = data.played_seconds ?? 0
  }

  await update(playerRef(session.code, pseudo), {
    player:       pseudo,
    player_name:  data.trainer || pseudo,
    timestamp:    Date.now() / 1000,
    is_connected: true,
    team:         party,
    boxes:        data.boxes || [],
    badges:       data.badges || [false, false, false, false, false, false, false, false],
    defeats:      currentDefeats,
    ...playPayload,
  })
}

async function runSync() {
  const session = getActiveSession()
  const exe     = getReaderExePath()
  const args    = session?.savePath ? [session.savePath] : []

  try {
    if (!fs.existsSync(exe)) throw new Error(`NuzelockReader.exe introuvable : ${exe}`)
    const { stdout } = await execFileAsync(exe, args, {
      timeout: 30000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8',
    })
    const data = JSON.parse(stdout)
    await pushToFirebase(data)
    await checkChallenges(data).catch(e => console.error('[Challenge]', e.message))
    console.log(`[Tracker] ${data.trainer} — ${(data.party || []).length} Pokémon`)
    mainWindow?.webContents.send('tracker:status-update', {
      running: true, lastSync: Date.now(), error: null,
      trainerName: data.trainer, teamSize: (data.party || []).length,
    })
  } catch (err) {
    console.error('[Tracker] Erreur sync :', err.message)
    mainWindow?.webContents.send('tracker:status-update', {
      running: true, lastSync: null, error: err.message,
    })
  }
}

// ─── Tracker core ─────────────────────────────────────────────────────────────

let trackerInterval = null

async function startTrackerCore(code) {
  if (trackerInterval) clearInterval(trackerInterval)
  const pseudo  = currentConfig.pseudo
  const session = (currentConfig.sessions || []).find(s => s.code === code)
  if (!pseudo || !session) return

  await loadDefeats(code, pseudo)
  delete prevPartyState[pseudo]
  await runSync()
  trackerInterval = setInterval(runSync, (session.interval || 30) * 1000)
}

function stopTrackerCore() {
  clearInterval(trackerInterval)
  trackerInterval = null
  mainWindow?.webContents.send('tracker:status-update', {
    running: false, lastSync: null, error: null,
  })
}

// ─── Ryujinx auto-start watcher ──────────────────────────────────────────────

let ryujinxWatcher    = null
let wasRyujinxRunning = false

function startRyujinxWatcher() {
  if (ryujinxWatcher) return
  ryujinxWatcher = setInterval(async () => {
    const running = await isRyujinxRunning()
    if (running && !wasRyujinxRunning) {
      wasRyujinxRunning = true
      if (!trackerInterval && currentConfig.pseudo && currentConfig.activeSessionCode) {
        console.log('[AutoStart] Ryujinx détecté — démarrage auto')
        showInAppNotify('info', 'Ryujinx détecté — tracker démarré automatiquement !')
        await startTrackerCore(currentConfig.activeSessionCode)
      }
    } else if (!running && wasRyujinxRunning) {
      wasRyujinxRunning = false
      if (trackerInterval && !wonderTradeInProgress) {
        console.log('[AutoStart] Ryujinx fermé — arrêt auto')
        showInAppNotify('info', 'Ryujinx fermé — tracker arrêté')
        stopTrackerCore()
      }
    }
  }, 10000)
}

// ─── Auto-update ──────────────────────────────────────────────────────────────

autoUpdater.autoDownload = false

autoUpdater.on('update-available', info => {
  mainWindow?.show(); mainWindow?.focus()
  dialog.showMessageBox(mainWindow, {
    type: 'info', buttons: ['Mettre à jour', 'Plus tard'],
    title: 'Mise à jour disponible',
    message: `Version ${info.version} disponible !`,
    detail: info.releaseNotes || 'Une nouvelle version est disponible.',
  }).then(({ response }) => { if (response === 0) autoUpdater.downloadUpdate() })
})

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info', buttons: ['Installer et redémarrer'],
    title: 'Prêt à installer',
    message: "Téléchargement terminé. L'app va redémarrer pour installer la mise à jour.",
  }).then(() => autoUpdater.quitAndInstall())
})

autoUpdater.on('error', err => console.error('[Updater]', err.message))

// ─── State global ─────────────────────────────────────────────────────────────

let currentConfig = { pseudo: '', sessions: [], activeSessionCode: null }
let mainWindow    = null
let tray          = null
let forceQuit     = false

// ─── IPC handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  ipcMain.handle('app:get-version',   () => app.getVersion())
  ipcMain.handle('app:get-device-id', () => currentConfig.deviceId || null)

  // ── Pseudo ──────────────────────────────────────────────────────────────────
  ipcMain.handle('app:get-pseudo', () => currentConfig.pseudo || null)

  ipcMain.handle('app:set-pseudo', (_, pseudo) => {
    currentConfig.pseudo = pseudo.trim()
    saveConfig(currentConfig)
  })

  // ── Config (browse save file) ────────────────────────────────────────────────
  ipcMain.handle('tracker:browse', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Sélectionne le fichier save Ryujinx',
      buttonLabel: 'Choisir',
      filters: [{ name: 'Save file', extensions: ['*'] }],
      properties: ['openFile'],
      defaultPath: path.join(app.getPath('appData'), 'Ryujinx', 'bis', 'user', 'save'),
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Sessions ─────────────────────────────────────────────────────────────────
  ipcMain.handle('session:get-all', () => currentConfig.sessions || [])
  ipcMain.handle('session:get-active-code', () => currentConfig.activeSessionCode || null)
  ipcMain.handle('session:get-games', () => GAMES)

  ipcMain.handle('session:create', async (_, { gameId, mode, sessionName, savePath, interval, challengesEnabled }) => {
    const game = GAMES.find(g => g.id === gameId) || GAMES[GAMES.length - 1]
    const code = generateCode(gameId)
    const pseudo = currentConfig.pseudo

    await ensureAuth()
    await set(sessionMetaRef(code), {
      name:              sessionName || `Run ${game.name}`,
      game:              gameId,
      mode:              mode || null,
      host:              pseudo,
      created_at:        Date.now(),
      status:            'active',
      challengesEnabled: !!challengesEnabled,
    })
    await set(ref(fbDb, `sessions/${code}/members/${fbAuth.currentUser.uid}`), true)

    const session = {
      code, gameId, gameName: game.name,
      sessionName: sessionName || `Run ${game.name}`,
      savePath: savePath || '', interval: interval || 30, isHost: true,
      challengesEnabled: !!challengesEnabled,
    }
    currentConfig.sessions = [...(currentConfig.sessions || []), session]
    currentConfig.activeSessionCode = code
    saveConfig(currentConfig)

    // Notif à l'UI
    mainWindow?.webContents.send('session:updated', currentConfig.sessions, code)
    return { code, session }
  })

  ipcMain.handle('session:join', async (_, { code, savePath, interval }) => {
    const upperCode = code.trim().toUpperCase()
    const already = (currentConfig.sessions || []).find(s => s.code === upperCode)
    if (already) throw new Error('Tu es déjà dans cette session')

    await ensureAuth()
    const snap = await get(sessionMetaRef(upperCode))
    if (!snap.exists()) throw new Error('Session introuvable — vérifie le code')
    const meta = snap.val()
    if (meta.status === 'archived') throw new Error('Cette session est archivée')

    await set(ref(fbDb, `sessions/${upperCode}/members/${fbAuth.currentUser.uid}`), true)

    const joinedGame = GAMES.find(g => g.id === meta.game) || GAMES[GAMES.length - 1]
    const session = {
      code: upperCode, gameId: meta.game, gameName: joinedGame.name,
      sessionName: meta.name, savePath: savePath || '',
      interval: interval || 30, isHost: false,
    }
    currentConfig.sessions = [...(currentConfig.sessions || []), session]
    if (!currentConfig.activeSessionCode) currentConfig.activeSessionCode = upperCode
    saveConfig(currentConfig)

    mainWindow?.webContents.send('session:updated', currentConfig.sessions, currentConfig.activeSessionCode)
    return { code: upperCode, session }
  })

  ipcMain.handle('session:set-active', async (_, code) => {
    if (currentConfig.activeSessionCode === code) return
    currentConfig.activeSessionCode = code
    saveConfig(currentConfig)
    if (trackerInterval) {
      stopTrackerCore()
      await startTrackerCore(code)
    }
    mainWindow?.webContents.send('session:updated', currentConfig.sessions, code)
  })

  ipcMain.handle('session:update', (_, { code, savePath, interval }) => {
    const session = (currentConfig.sessions || []).find(s => s.code === code)
    if (session) { session.savePath = savePath; session.interval = interval; saveConfig(currentConfig) }
  })

  ipcMain.handle('session:leave', async (_, code) => {
    const pseudo  = currentConfig.pseudo
    const session = (currentConfig.sessions || []).find(s => s.code === code)
    if (!session) return

    try {
      await ensureAuth()
      await remove(playerRef(code, pseudo))
      if (fbAuth.currentUser) await remove(ref(fbDb, `sessions/${code}/members/${fbAuth.currentUser.uid}`)).catch(() => {})
    } catch {}

    if (currentConfig.activeSessionCode === code && trackerInterval) stopTrackerCore()
    currentConfig.sessions = currentConfig.sessions.filter(s => s.code !== code)
    if (currentConfig.activeSessionCode === code) {
      currentConfig.activeSessionCode = currentConfig.sessions[0]?.code || null
    }
    saveConfig(currentConfig)
    mainWindow?.webContents.send('session:updated', currentConfig.sessions, currentConfig.activeSessionCode)
  })

  ipcMain.handle('session:archive', async (_, code) => {
    try {
      await ensureAuth()
      await set(ref(fbDb, `sessions/${code}/metadata/status`), 'archived')
    } catch (e) {
      throw new Error(`Impossible d'archiver : ${e.message}`)
    }
    if (currentConfig.activeSessionCode === code && trackerInterval) stopTrackerCore()
    const session = (currentConfig.sessions || []).find(s => s.code === code)
    if (session) session.archived = true
    saveConfig(currentConfig)
    mainWindow?.webContents.send('session:updated', currentConfig.sessions, currentConfig.activeSessionCode)
  })

  ipcMain.handle('session:delete', async (_, code) => {
    try {
      await ensureAuth()
      if (fbAuth.currentUser) await remove(ref(fbDb, `sessions/${code}/members/${fbAuth.currentUser.uid}`)).catch(() => {})
      await remove(ref(fbDb, `sessions/${code}`))
    } catch (e) {
      throw new Error(`Impossible de supprimer : ${e.message}`)
    }
    if (currentConfig.activeSessionCode === code && trackerInterval) stopTrackerCore()
    currentConfig.sessions = currentConfig.sessions.filter(s => s.code !== code)
    if (currentConfig.activeSessionCode === code) {
      currentConfig.activeSessionCode = currentConfig.sessions[0]?.code || null
    }
    saveConfig(currentConfig)
    mainWindow?.webContents.send('session:updated', currentConfig.sessions, currentConfig.activeSessionCode)
  })

  // ── Tracker start/stop ───────────────────────────────────────────────────────
  // ── Wonder Trade direct ───────────────────────────────────────────────────────
  ipcMain.handle('wonder-trade:request', (_, { slot, pkName }) => handleWonderTradeRequest(slot, pkName))

  ipcMain.handle('trade:export', async (_, { slot }) => {
    const session = getActiveSession()
    return executeTradeExport(session?.savePath || null, slot)
  })

  ipcMain.handle('trade:inject', async (_, { slot, b64 }) => {
    const running = await isRyujinxRunning()
    if (running) throw new Error('Ferme Ryujinx avant de finaliser le trade !')
    const session = getActiveSession()
    return executeTradeInject(session?.savePath || null, slot, b64)
  })

  ipcMain.handle('tracker:force-sync', async () => {
    await runSync()
    return { success: true }
  })

  ipcMain.handle('tracker:start', async () => {
    const code = currentConfig.activeSessionCode
    if (!code) return
    await startTrackerCore(code)
  })

  ipcMain.handle('tracker:stop', () => stopTrackerCore())

  ipcMain.handle('tracker:status', () => ({
    running: !!trackerInterval,
    activeSessionCode: currentConfig.activeSessionCode,
  }))
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.ico')
    : path.join(__dirname, '../build/icon.ico')
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('NuzSync — Nuzlocke Tracker')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Afficher', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quitter', click: async () => { forceQuit = true; await cleanupMyTrades().catch(() => {}); app.quit() } },
  ]))
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// ─── Fenêtre principale ───────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 800, minHeight: 600,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'NuzSync', autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', e => {
    if (!forceQuit) { e.preventDefault(); mainWindow.hide() }
  })

  mainWindow.on('closed', () => {
    clearInterval(trackerInterval)
    clearInterval(ryujinxWatcher)
    ryujinxWatcher = null
    mainWindow = null
  })
}

// ─── Single instance + boot ───────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show(); mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    currentConfig = loadConfig()
    registerIpcHandlers()
    createTray()
    createWindow()
    startRyujinxWatcher()

    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 800))
      const running = await isRyujinxRunning()
      wasRyujinxRunning = running
      if (running && currentConfig.pseudo && currentConfig.activeSessionCode) {
        console.log('[AutoStart] Ryujinx déjà ouvert au lancement')
        showInAppNotify('info', 'Ryujinx détecté — tracker démarré automatiquement !')
        await startTrackerCore(currentConfig.activeSessionCode)
      }
    })

    setTimeout(() => { if (app.isPackaged) autoUpdater.checkForUpdates() }, 3000)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') app.quit()
  })
}
