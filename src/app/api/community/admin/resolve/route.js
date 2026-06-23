export const dynamic = 'force-dynamic';
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
    const { ticket_id, winner_team_id, loser_team_id, points_won, points_lost, winner_kills, loser_kills, notes, player_stats } = await request.json();
    if (!ticket_id || !winner_team_id || !loser_team_id) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const client = getDb();

    const ticketRes = await client.execute({ sql: `SELECT * FROM tickets WHERE id = ? AND status = 'pending'`, args: [ticket_id] });
    const ticket = ticketRes.rows[0];
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado o ya resuelto' }, { status: 404 });

    const winnerRes = await client.execute({ sql: `SELECT * FROM teams WHERE id = ?`, args: [winner_team_id] });
    const winnerTeam = winnerRes.rows[0];
    const loserRes = await client.execute({ sql: `SELECT * FROM teams WHERE id = ?`, args: [loser_team_id] });
    const loserTeam = loserRes.rows[0];
    
    if (!winnerTeam || !loserTeam) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

    // Calculate new ELOs using manual points
    const winnerNew = winnerTeam.elo + (parseInt(points_won) || 0);
    const loserNew  = Math.max(0, loserTeam.elo - (parseInt(points_lost) || 0));

    // Update winner team
    const winStreak = winnerTeam.streak >= 0 ? winnerTeam.streak + 1 : 1;
    await client.execute({
      sql: `UPDATE teams SET elo = ?, wins = wins + 1, kills = kills + ?, deaths = deaths + ?, streak = ? WHERE id = ?`,
      args: [winnerNew, winner_kills || 0, loser_kills || 0, winStreak, winner_team_id]
    });

    // Update loser team
    const loseStreak = loserTeam.streak <= 0 ? loserTeam.streak - 1 : -1;
    await client.execute({
      sql: `UPDATE teams SET elo = ?, losses = losses + 1, kills = kills + ?, deaths = deaths + ?, streak = ? WHERE id = ?`,
      args: [loserNew, loser_kills || 0, winner_kills || 0, loseStreak, loser_team_id]
    });

    // Update player wins/losses for all players in each team
    await client.execute({ sql: `UPDATE players SET wins = wins + 1 WHERE team_id = ?`, args: [winner_team_id] });
    await client.execute({ sql: `UPDATE players SET losses = losses + 1 WHERE team_id = ?`, args: [loser_team_id] });

    // Insert match record (MUST be before player_stats insert)
    const matchResult = await client.execute({
      sql: `INSERT INTO matches (winner_team_id, loser_team_id, winner_kills, loser_kills, winner_elo_before, loser_elo_before, winner_elo_after, loser_elo_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [winner_team_id, loser_team_id, winner_kills || 0, loser_kills || 0, winnerTeam.elo, loserTeam.elo, winnerNew, loserNew, notes || null]
    });
    const matchId = matchResult.lastInsertRowid;

    // Save individual player stats if provided
    if (Array.isArray(player_stats) && player_stats.length > 0) {
      for (const stat of player_stats) {
        if (!stat.player_id) continue;
        await client.execute({
          sql: `INSERT INTO player_match_stats (match_id, player_id, team_id, kills, deaths) VALUES (?, ?, ?, ?, ?)`,
          args: [matchId, stat.player_id, stat.team_id, stat.kills || 0, stat.deaths || 0]
        });
        await client.execute({
          sql: `UPDATE players SET kills = kills + ?, deaths = deaths + ? WHERE id = ?`,
          args: [stat.kills || 0, stat.deaths || 0, stat.player_id]
        });
      }
    }

    // Resolve ticket and delete image/clip from DB
    const resolverRes = await client.execute({ sql: `SELECT id FROM players WHERE discord_id = ?`, args: [session.user.discordId] });
    const resolverPlayer = resolverRes.rows[0];
    
    await client.execute({
      sql: `UPDATE tickets SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ?, image_path = NULL, clip_url = NULL WHERE id = ?`,
      args: [resolverPlayer?.id || null, ticket_id]
    });

    // Delete image file from disk if it was uploaded locally
    if (ticket.image_path && !ticket.image_path.startsWith('data:')) {
      try {
        await unlink(path.join(process.cwd(), 'public', ticket.image_path));
      } catch (_) { /* imagen ya borrada o no existe */ }
    }

    const matchRes = await client.execute({
      sql: `SELECT m.*, tw.name AS winner_name, tl.name AS loser_name FROM matches m JOIN teams tw ON tw.id = m.winner_team_id JOIN teams tl ON tl.id = m.loser_team_id WHERE m.id = ?`,
      args: [matchId]
    });

    return NextResponse.json({ success: true, match: matchRes.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
