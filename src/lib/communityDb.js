import { createClient } from '@libsql/client';

let _client = null;

export function getDb() {
  if (_client) return _client;
  
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing in environment variables.');
  }

  _client = createClient({
    url,
    authToken
  });

  return _client;
}

// ── ELO calculation ──────────────────────────────────────────────────────────

export function calcElo(winnerElo, loserElo, K = 32) {
  const expectedWin  = 1 / (1 + Math.pow(10, (loserElo  - winnerElo) / 400));
  const expectedLoss = 1 / (1 + Math.pow(10, (winnerElo - loserElo)  / 400));
  return {
    winnerNew: Math.round(winnerElo + K * (1 - expectedWin)),
    loserNew:  Math.round(loserElo  + K * (0 - expectedLoss)),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getRankTier(elo) {
  if (elo >= 1800) return { name: 'Diamond',  color: '#5eead4', bg: 'rgba(94,234,212,0.15)' };
  if (elo >= 1600) return { name: 'Platinum', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' };
  if (elo >= 1400) return { name: 'Gold',     color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  };
  if (elo >= 1200) return { name: 'Silver',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
  return                  { name: 'Bronze',   color: '#a16207', bg: 'rgba(161,98,7,0.15)'    };
}
