export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';

export async function GET(request, { params }) {
  try {
    const client = getDb();
    const { id } = params;
    // Support lookup by DB id or discord_id
    const playerRes = await client.execute({
      sql: `
      SELECT p.*, t.name AS team_name, t.logo_url AS team_logo, t.elo AS team_elo, t.manual_rank AS team_manual_rank, s.has_kd AS team_has_kd
      FROM players p LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN servers s ON s.id = t.server_id
      WHERE p.id = ? OR p.discord_id = ?
    `, args: [id, id]
    });
    const player = playerRes.rows[0];
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    let matches = [];
    if (player.team_id) {
      const matchRes = await client.execute({
        sql: `
        SELECT m.*,
          tw.name AS winner_name, tw.logo_url AS winner_logo,
          tl.name AS loser_name,  tl.logo_url AS loser_logo
        FROM matches m
        JOIN teams tw ON tw.id = m.winner_team_id
        JOIN teams tl ON tl.id = m.loser_team_id
        WHERE m.winner_team_id = ? OR m.loser_team_id = ?
        ORDER BY m.played_at DESC LIMIT 10
      `, args: [player.team_id, player.team_id]
      });
      matches = matchRes.rows;
    }

    return NextResponse.json({ player, matches });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const client = getDb();
    const { id } = params;
    const body = await request.json();
    const fields = [];
    const vals = [];
    if (body.team_id !== undefined) { fields.push('team_id = ?'); vals.push(body.team_id); }
    if (body.role    !== undefined) { fields.push('role = ?');    vals.push(body.role); }
    if (!fields.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(id, id);
    await client.execute({ sql: `UPDATE players SET ${fields.join(', ')} WHERE id = ? OR discord_id = ?`, args: vals });
    const playerRes = await client.execute({ sql: `SELECT * FROM players WHERE id = ? OR discord_id = ?`, args: [id, id] });
    return NextResponse.json(playerRes.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const client = getDb();
    const { id } = params;
    await client.execute({ sql: `DELETE FROM players WHERE id = ?`, args: [id] });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
