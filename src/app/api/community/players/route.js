export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const q       = searchParams.get('q')       || '';
    const team_id = searchParams.get('team_id') || '';
    const server_id = searchParams.get('server_id') || 1;
    let sql  = `SELECT p.*, t.name AS team_name, t.logo_url AS team_logo FROM players p LEFT JOIN teams t ON t.id = p.team_id WHERE p.server_id = ?`;
    const args = [server_id];
    if (q)       { sql += ` AND p.discord_name LIKE ?`; args.push(`%${q}%`); }
    if (team_id) { sql += ` AND p.team_id = ?`;          args.push(team_id); }
    sql += ` ORDER BY p.kills DESC`;
    const players = db.prepare(sql).all(...args);
    return NextResponse.json(players);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const formData = await request.formData();
    const discord_id = formData.get('discord_id');
    const discord_name = formData.get('discord_name');
    let discord_avatar = formData.get('discord_avatar');
    const team_id = formData.get('team_id') || null;
    const server_id = formData.get('server_id') || 1;
    const avatar_file = formData.get('discord_avatar_file');

    if (!discord_id || !discord_name) return NextResponse.json({ error: 'discord_id and discord_name required' }, { status: 400 });

    if (avatar_file && typeof avatar_file === 'object') {
      const bytes = await avatar_file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = avatar_file.type || 'image/png';
      discord_avatar = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    const db = getDb();
    const existing = db.prepare(`SELECT * FROM players WHERE discord_id = ?`).get(discord_id);
    if (existing) {
      db.prepare(`UPDATE players SET discord_name = ?, discord_avatar = ?, team_id = ?, server_id = ? WHERE discord_id = ?`)
        .run(discord_name, discord_avatar || existing.discord_avatar, team_id ?? existing.team_id, server_id || existing.server_id || 1, discord_id);
    } else {
      db.prepare(`INSERT INTO players (discord_id, discord_name, discord_avatar, team_id, server_id) VALUES (?, ?, ?, ?, ?)`)
        .run(discord_id, discord_name, discord_avatar || null, team_id || null, server_id || 1);
    }
    const player = db.prepare(`SELECT * FROM players WHERE discord_id = ?`).get(discord_id);
    return NextResponse.json(player, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
