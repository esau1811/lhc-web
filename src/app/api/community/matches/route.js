export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/communityDb';

export async function GET(request) {
  try {
    const client = getDb();
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id') || '';
    let sql = `
      SELECT m.*,
        tw.name AS winner_name, tw.logo_url AS winner_logo, tw.tag AS winner_tag,
        tl.name AS loser_name,  tl.logo_url AS loser_logo,  tl.tag AS loser_tag
      FROM matches m
      JOIN teams tw ON tw.id = m.winner_team_id
      JOIN teams tl ON tl.id = m.loser_team_id
      WHERE 1=1
    `;
    const args = [];
    if (team_id) { sql += ` AND (m.winner_team_id = ? OR m.loser_team_id = ?)`; args.push(team_id, team_id); }
    sql += ` ORDER BY m.played_at DESC LIMIT 50`;
    const res = await client.execute({ sql, args });
    return NextResponse.json(res.rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
