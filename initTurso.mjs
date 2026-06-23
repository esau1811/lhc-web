import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://lhctools-esau1811.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIyNTUyODIsImlkIjoiMDE5ZWY2YjEtMTkwMS03MWY0LWE5ZGItYzAxZTBjYTA1MTdkIiwicmlkIjoiNjhmNjZhYmItNTAzNy00ZTQ4LTg1N2QtNDNiM2QyMmNmOTM5In0.VCvVmwlSZlIGAFvqscxHQA37KdZi-dr8t-EvPkIofRa_KFIzlIAP4d7r7x6EBAaREZNKvs6Nai-L9lshFQEGAw'
});

async function run() {
  console.log("Initializing schema...");
  
  const stmts = [
    `CREATE TABLE IF NOT EXISTS servers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      logo_url    TEXT    DEFAULT NULL,
      has_kd      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );`,
    `CREATE TABLE IF NOT EXISTS teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id   INTEGER DEFAULT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      tag         TEXT    NOT NULL DEFAULT '',
      logo_url    TEXT    DEFAULT NULL,
      elo         INTEGER NOT NULL DEFAULT 1000,
      manual_rank TEXT    DEFAULT NULL,
      wins        INTEGER NOT NULL DEFAULT 0,
      losses      INTEGER NOT NULL DEFAULT 0,
      kills       INTEGER NOT NULL DEFAULT 0,
      deaths      INTEGER NOT NULL DEFAULT 0,
      streak      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(server_id, name)
    );`,
    `CREATE TABLE IF NOT EXISTS players (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id     INTEGER DEFAULT NULL REFERENCES servers(id) ON DELETE CASCADE,
      discord_id    TEXT    NOT NULL,
      discord_name  TEXT    NOT NULL,
      discord_avatar TEXT   DEFAULT NULL,
      team_id       INTEGER DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
      kills         INTEGER NOT NULL DEFAULT 0,
      deaths        INTEGER NOT NULL DEFAULT 0,
      wins          INTEGER NOT NULL DEFAULT 0,
      losses        INTEGER NOT NULL DEFAULT 0,
      role          TEXT    NOT NULL DEFAULT 'user',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(server_id, discord_id)
    );`,
    `CREATE TABLE IF NOT EXISTS matches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id       INTEGER DEFAULT NULL REFERENCES servers(id) ON DELETE CASCADE,
      winner_team_id  INTEGER NOT NULL REFERENCES teams(id),
      loser_team_id   INTEGER DEFAULT NULL REFERENCES teams(id),
      winner_kills    INTEGER NOT NULL DEFAULT 0,
      loser_kills     INTEGER NOT NULL DEFAULT 0,
      winner_elo_before INTEGER NOT NULL DEFAULT 0,
      loser_elo_before  INTEGER NOT NULL DEFAULT 0,
      winner_elo_after  INTEGER NOT NULL DEFAULT 0,
      loser_elo_after   INTEGER NOT NULL DEFAULT 0,
      played_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      notes           TEXT    DEFAULT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS player_match_stats (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team_id     INTEGER NOT NULL REFERENCES teams(id),
      kills       INTEGER NOT NULL DEFAULT 0,
      deaths      INTEGER NOT NULL DEFAULT 0
    );`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id     INTEGER DEFAULT NULL REFERENCES servers(id) ON DELETE CASCADE,
      submitter_id  INTEGER NOT NULL REFERENCES players(id),
      team_a_id     INTEGER NOT NULL REFERENCES teams(id),
      team_b_id     INTEGER NOT NULL REFERENCES teams(id),
      image_path    TEXT    DEFAULT NULL,
      clip_url      TEXT    DEFAULT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      resolved_at   TEXT    DEFAULT NULL,
      resolved_by   TEXT    DEFAULT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );`
  ];

  for (const s of stmts) {
    await client.execute(s);
  }
  
  console.log("Schema initialized successfully!");
}

run().catch(console.error);
