import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR  = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'community.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    -- Equipos
    CREATE TABLE IF NOT EXISTS teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      tag         TEXT    NOT NULL DEFAULT '',
      logo_url    TEXT    DEFAULT NULL,
      elo         INTEGER NOT NULL DEFAULT 1000,
      wins        INTEGER NOT NULL DEFAULT 0,
      losses      INTEGER NOT NULL DEFAULT 0,
      kills       INTEGER NOT NULL DEFAULT 0,
      deaths      INTEGER NOT NULL DEFAULT 0,
      streak      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Jugadores (vinculados a Discord)
    CREATE TABLE IF NOT EXISTS players (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id    TEXT    NOT NULL UNIQUE,
      discord_name  TEXT    NOT NULL,
      discord_avatar TEXT   DEFAULT NULL,
      team_id       INTEGER DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
      kills         INTEGER NOT NULL DEFAULT 0,
      deaths        INTEGER NOT NULL DEFAULT 0,
      wins          INTEGER NOT NULL DEFAULT 0,
      losses        INTEGER NOT NULL DEFAULT 0,
      role          TEXT    NOT NULL DEFAULT 'user',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Partidas
    CREATE TABLE IF NOT EXISTS matches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      winner_team_id  INTEGER NOT NULL REFERENCES teams(id),
      loser_team_id   INTEGER NOT NULL REFERENCES teams(id),
      winner_kills    INTEGER NOT NULL DEFAULT 0,
      loser_kills     INTEGER NOT NULL DEFAULT 0,
      winner_elo_before INTEGER NOT NULL DEFAULT 0,
      loser_elo_before  INTEGER NOT NULL DEFAULT 0,
      winner_elo_after  INTEGER NOT NULL DEFAULT 0,
      loser_elo_after   INTEGER NOT NULL DEFAULT 0,
      played_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      notes           TEXT    DEFAULT NULL
    );

    -- Tickets (capturas de pantalla para reportar partidas)
    CREATE TABLE IF NOT EXISTS tickets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      submitter_id  INTEGER NOT NULL REFERENCES players(id),
      team_a_id     INTEGER NOT NULL REFERENCES teams(id),
      team_b_id     INTEGER NOT NULL REFERENCES teams(id),
      image_path    TEXT    DEFAULT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      admin_note    TEXT    DEFAULT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      resolved_at   TEXT    DEFAULT NULL,
      resolved_by   INTEGER DEFAULT NULL REFERENCES players(id)
    );
  `);
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
