export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, calcElo } from '@/lib/communityDb';
import { unlink } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { ticket_id, winner_team_id, loser_team_id, winner_kills, loser_kills, notes } = await request.json();
    if (!ticket_id || !winner_team_id || !loser_team_id) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const db = getDb();

    const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ? AND status = 'pending'`).get(ticket_id);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado o ya resuelto' }, { status: 404 });

    const winnerTeam = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(winner_team_id);
    const loserTeam  = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(loser_team_id);
    if (!winnerTeam || !loserTeam) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

    // Calculate new ELOs
    const { winnerNew, loserNew } = calcElo(winnerTeam.elo, loserTeam.elo);

    // Update winner team
    const winStreak = winnerTeam.streak >= 0 ? winnerTeam.streak + 1 : 1;
    db.prepare(`
      UPDATE teams SET elo = ?, wins = wins + 1, kills = kills + ?, deaths = deaths + ?, streak = ?
      WHERE id = ?
    `).run(winnerNew, winner_kills || 0, loser_kills || 0, winStreak, winner_team_id);

    // Update loser team
    const loseStreak = loserTeam.streak <= 0 ? loserTeam.streak - 1 : -1;
    db.prepare(`
      UPDATE teams SET elo = ?, losses = losses + 1, kills = kills + ?, deaths = deaths + ?, streak = ?
      WHERE id = ?
    `).run(loserNew, loser_kills || 0, winner_kills || 0, loseStreak, loser_team_id);

    // Update player stats (all players in each team)
    db.prepare(`UPDATE players SET wins = wins + 1,   kills = kills + ? WHERE team_id = ?`).run(Math.round((winner_kills || 0) / Math.max(1, db.prepare(`SELECT COUNT(*) as c FROM players WHERE team_id = ?`).get(winner_team_id)?.c || 1)), winner_team_id);
    db.prepare(`UPDATE players SET losses = losses + 1, kills = kills + ? WHERE team_id = ?`).run(Math.round((loser_kills  || 0) / Math.max(1, db.prepare(`SELECT COUNT(*) as c FROM players WHERE team_id = ?`).get(loser_team_id)?.c  || 1)), loser_team_id);

    // Insert match record
    const matchResult = db.prepare(`
      INSERT INTO matches (winner_team_id, loser_team_id, winner_kills, loser_kills,
        winner_elo_before, loser_elo_before, winner_elo_after, loser_elo_after, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      winner_team_id, loser_team_id,
      winner_kills || 0, loser_kills || 0,
      winnerTeam.elo, loserTeam.elo,
      winnerNew, loserNew,
      notes || null
    );

    // Resolve ticket and delete image
    const resolverPlayer = db.prepare(`SELECT id FROM players WHERE discord_id = ?`).get(session.user.discordId);
    db.prepare(`
      UPDATE tickets SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ?
      WHERE id = ?
    `).run(resolverPlayer?.id || null, ticket_id);

    if (ticket.image_path) {
      try {
        await unlink(path.join(process.cwd(), 'public', ticket.image_path));
      } catch (_) { /* imagen ya borrada o no existe */ }
    }

    const match = db.prepare(`
      SELECT m.*,
        tw.name AS winner_name, tl.name AS loser_name
      FROM matches m
      JOIN teams tw ON tw.id = m.winner_team_id
      JOIN teams tl ON tl.id = m.loser_team_id
      WHERE m.id = ?
    `).get(matchResult.lastInsertRowid);

    return NextResponse.json({ success: true, match });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
