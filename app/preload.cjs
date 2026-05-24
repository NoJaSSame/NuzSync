'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tracker', {
  // ── App ─────────────────────────────────────────────────────────────────────
  getVersion:  () => ipcRenderer.invoke('app:get-version'),
  getDeviceId: () => ipcRenderer.invoke('app:get-device-id'),
  getPseudo:   () => ipcRenderer.invoke('app:get-pseudo'),
  setPseudo:   (p) => ipcRenderer.invoke('app:set-pseudo', p),

  // ── Sessions ─────────────────────────────────────────────────────────────────
  getGames:         ()                   => ipcRenderer.invoke('session:get-games'),
  getAllSessions:    ()                   => ipcRenderer.invoke('session:get-all'),
  getActiveCode:    ()                   => ipcRenderer.invoke('session:get-active-code'),
  createSession:    (opts)               => ipcRenderer.invoke('session:create', opts),
  joinSession:      (opts)               => ipcRenderer.invoke('session:join', opts),
  setActiveSession: (code)               => ipcRenderer.invoke('session:set-active', code),
  updateSession:    (opts)               => ipcRenderer.invoke('session:update', opts),
  leaveSession:     (code)               => ipcRenderer.invoke('session:leave', code),
  archiveSession:   (code)               => ipcRenderer.invoke('session:archive', code),
  deleteSession:    (code)               => ipcRenderer.invoke('session:delete', code),

  onSessionUpdated: (cb) => {
    const handler = (_, sessions, activeCode) => cb(sessions, activeCode)
    ipcRenderer.on('session:updated', handler)
    return () => ipcRenderer.removeListener('session:updated', handler)
  },

  // ── Tracker ──────────────────────────────────────────────────────────────────
  browse: () => ipcRenderer.invoke('tracker:browse'),
  start:  () => ipcRenderer.invoke('tracker:start'),
  stop:   () => ipcRenderer.invoke('tracker:stop'),

  onStatus: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('tracker:status-update', handler)
    return () => ipcRenderer.removeListener('tracker:status-update', handler)
  },

  // ── Wonder Trade ─────────────────────────────────────────────────────────────
  requestWonderTrade: (slot, pkName) => ipcRenderer.invoke('wonder-trade:request', { slot, pkName }),

  // ── P2P Trade ────────────────────────────────────────────────────────────────
  exportPkm: (slot)      => ipcRenderer.invoke('trade:export', { slot }),
  injectPkm: (slot, b64) => ipcRenderer.invoke('trade:inject', { slot, b64 }),
  forceSync: ()          => ipcRenderer.invoke('tracker:force-sync'),
  onWonderTradeConfirm: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('tracker:wt-confirm', handler)
    return () => ipcRenderer.removeListener('tracker:wt-confirm', handler)
  },
  replyWonderTradeConfirm: (confirmed) => ipcRenderer.send('tracker:wt-confirm-reply', confirmed),
  onWonderTradeNotify: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('tracker:wt-notify', handler)
    return () => ipcRenderer.removeListener('tracker:wt-notify', handler)
  },

  // ── Challenges ───────────────────────────────────────────────────────────────
  onChallengeNew: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('challenge:new', handler)
    return () => ipcRenderer.removeListener('challenge:new', handler)
  },
  onChallengeWon: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('challenge:won', handler)
    return () => ipcRenderer.removeListener('challenge:won', handler)
  },
})
