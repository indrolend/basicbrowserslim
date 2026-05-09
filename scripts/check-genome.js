#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const checker = path.resolve(__dirname, 'check-semantic-genome.js');
const child = spawnSync(process.execPath, [checker, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(child.status == null ? 1 : child.status);
