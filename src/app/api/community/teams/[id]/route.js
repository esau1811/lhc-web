export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';

export async function GET(request, { params }) {
  try {
    const client = getDb();
    const { id } = params;
    const teamRes = await client.execute({ sql: `
      SELECT t.*, s.has_kd
      FROM teams t
      LEFT JOIN servers s ON s.id = t.server_id
      WHERE t.id = ?
    `, args: [id] });
    const team = teamRes.rows[0];
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const playersRes = await client.execute({ sql: `SELECT * FROM players WHERE team_id = ? ORDER BY kills DESC`, args: [id] });
    const matchesRes = await client.execute({ sql: `
      SELECT m.*,
        tw.name AS winner_name, tw.logo_url AS winner_logo,
        tl.name AS loser_name,  tl.logo_url AS loser_logo
      FROM matches m
      JOIN teams tw ON tw.id = m.winner_team_id
      JOIN teams tl ON tl.id = m.loser_team_id
      WHERE m.winner_team_id = ? OR m.loser_team_id = ?
      ORDER BY m.played_at DESC LIMIT 10
    `, args: [id, id] });
    return NextResponse.json({ team, players: playersRes.rows, matches: matchesRes.rows, has_kd: team.has_kd ?? 1 });
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
    if (body.name     !== undefined) { fields.push('name = ?');     vals.push(body.name); }
    if (body.tag      !== undefined) { fields.push('tag = ?');      vals.push(body.tag); }
    if (body.logo_url !== undefined) { fields.push('logo_url = ?'); vals.push(body.logo_url); }
    if (!fields.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(id);
    await client.execute({ sql: `UPDATE teams SET ${fields.join(', ')} WHERE id = ?`, args: vals });
    const teamRes = await client.execute({ sql: `SELECT * FROM teams WHERE id = ?`, args: [id] });
    return NextResponse.json(teamRes.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const client = getDb();
    await client.execute({ sql: `UPDATE players SET team_id = NULL WHERE team_id = ?`, args: [params.id] });
    await client.execute({ sql: `DELETE FROM teams WHERE id = ?`, args: [params.id] });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
