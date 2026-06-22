export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { team_id, points_delta, manual_rank } = await request.json();
    if (!team_id) return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });

    const db = getDb();
    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(team_id);
    if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

    let newElo = team.elo;
    let rankToSave = team.manual_rank;

    if (points_delta !== '' && points_delta !== null && points_delta !== undefined) {
      newElo = Math.max(0, team.elo + parseInt(points_delta));
    }
    
    if (manual_rank !== undefined && manual_rank !== '') {
      rankToSave = manual_rank;
    } else if (manual_rank === '') {
      rankToSave = null;
    }

    db.prepare(`UPDATE teams SET elo = ?, manual_rank = ? WHERE id = ?`).run(newElo, rankToSave, team_id);

    // If points changed, log it to matches to show up on the graph
    if (newElo !== team.elo) {
      db.prepare(`
        INSERT INTO matches (winner_team_id, winner_elo_before, winner_elo_after, notes)
        VALUES (?, ?, ?, ?)
      `).run(team_id, team.elo, newElo, `Ajuste manual: ${parseInt(points_delta) > 0 ? '+' : ''}${points_delta} puntos`);
    }

    return NextResponse.json({ success: true, newElo, manual_rank: rankToSave });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
