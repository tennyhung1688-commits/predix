const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '../../data');
const DAILY_FILE = () => {
  const d = new Date();
  return path.join(DATA_DIR, `pv-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.json`);
};

// Ensure data directory exists
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// In-memory counts for fast read
let todayCounts = { pv: 0, uv: 0, pages: {}, refs: {} };
let todayDate = '';

function loadToday() {
  const file = DAILY_FILE();
  try {
    if (fs.existsSync(file)) {
      todayCounts = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch { /* ignore */ }
  todayDate = new Date().toDateString();
}

function persist() {
  try { fs.writeFileSync(DAILY_FILE(), JSON.stringify(todayCounts)); } catch {}
}

loadToday();

// Simple UID from IP + UA hash (privacy-friendly)
function uid(req) {
  const raw = (req.ip || req.connection?.remoteAddress || '') + (req.headers['user-agent'] || '');
  let h = 0;
  for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h + raw.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

router.get('/analytics/pageview', (req, res) => {
  try {
    const d = new Date().toDateString();
    if (d !== todayDate) { todayCounts = { pv: 0, uv: 0, pages: {}, refs: {} }; todayDate = d; }

    const page = (req.query.p || '/').slice(0, 200);
    const ref = (req.query.r || 'direct').slice(0, 300);
    const uvKey = uid(req);

    todayCounts.pv = (todayCounts.pv || 0) + 1;
    if (!todayCounts.uvMap) todayCounts.uvMap = {};
    if (!todayCounts.uvMap[uvKey]) {
      todayCounts.uvMap[uvKey] = true;
      todayCounts.uv = Object.keys(todayCounts.uvMap).length;
    }
    todayCounts.pages = todayCounts.pages || {};
    todayCounts.pages[page] = (todayCounts.pages[page] || 0) + 1;
    todayCounts.refs = todayCounts.refs || {};
    const refDomain = ref.replace(/https?:\/\//, '').split('/')[0] || 'direct';
    todayCounts.refs[refDomain] = (todayCounts.refs[refDomain] || 0) + 1;

    // Persist every 10 PVs (reduce disk writes)
    if (todayCounts.pv % 10 === 0) persist();

    res.status(204).end(); // No content — fire and forget
  } catch (err) {
    res.status(204).end(); // Never fail analytics
  }
});

// View stats (protected in production — require auth)
router.get('/analytics/stats', async (req, res) => {
  try {
    const file = DAILY_FILE();
    let data = todayCounts;
    if (fs.existsSync(file)) {
      try { data = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch {}
    }
    res.json({ success: true, data: { pv: data.pv || 0, uv: data.uv || 0, pages: data.pages || {}, refs: data.refs || {} } });
  } catch (err) {
    res.json({ success: true, data: { pv: 0, uv: 0, pages: {}, refs: {} } });
  }
});

module.exports = router;
