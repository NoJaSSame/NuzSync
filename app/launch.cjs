'use strict'
const { spawn } = require('child_process')
const path = require('path')

const electronPath = require('electron')
const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, [path.resolve(__dirname, '..')], {
  env,
  stdio: 'inherit',
  windowsHide: false,
})

child.on('close', code => process.exit(code ?? 0))
