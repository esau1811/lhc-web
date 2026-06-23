export const runtime = 'nodejs';
export const dynamic  = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'tickets');

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const server_id = searchParams.get('server_id') || 1;
    const client = getDb();
    let res;
    if (session.user.isAdmin) {
      res = await client.execute({
        sql: `
        SELECT t.*, 
          p.discord_name AS submitter_name, p.discord_avatar AS submitter_avatar,
          ta.name AS team_a_name, tb.name AS team_b_name
        FROM tickets t
        JOIN players p  ON p.id  = t.submitter_id
        JOIN teams   ta ON ta.id = t.team_a_id
        JOIN teams   tb ON tb.id = t.team_b_id
        WHERE t.status = 'pending' AND t.server_id = ?
        ORDER BY t.created_at DESC
      `, args: [server_id] });
    } else {
      const playerRes = await client.execute({ sql: `SELECT * FROM players WHERE discord_id = ?`, args: [session.user.discordId] });
      const player = playerRes.rows[0];
      if (!player) return NextResponse.json([]);
      res = await client.execute({
        sql: `
        SELECT t.*,
          ta.name AS team_a_name, tb.name AS team_b_name
        FROM tickets t
        JOIN teams ta ON ta.id = t.team_a_id
        JOIN teams tb ON tb.id = t.team_b_id
        WHERE t.submitter_id = ? AND t.server_id = ?
        ORDER BY t.created_at DESC LIMIT 20
      `, args: [player.id, server_id] });
    }
    return NextResponse.json(res.rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const formData  = await request.formData();
    const server_id = formData.get('server_id') || 1;
    const team_a_id = formData.get('team_a_id');
    const team_b_id = formData.get('team_b_id');
    const clip_url  = formData.get('clip_url');
    const image     = formData.get('image');

    if (!team_a_id || !team_b_id) {
      return NextResponse.json({ error: 'team_a_id y team_b_id requeridos' }, { status: 400 });
    }

    const client = getDb();

    const playerRes = await client.execute({ sql: `SELECT * FROM players WHERE discord_id = ?`, args: [session.user.discordId] });
    let player = playerRes.rows[0];
    if (!player) {
      const res = await client.execute({
        sql: `INSERT INTO players (discord_id, discord_name, discord_avatar, server_id) VALUES (?, ?, ?, ?)`,
        args: [session.user.discordId, session.user.name, session.user.image, server_id]
      });
      const newPlayerRes = await client.execute({ sql: `SELECT * FROM players WHERE id = ?`, args: [res.lastInsertRowid] });
      player = newPlayerRes.rows[0];
    }

    // Save image
    let image_path = null;
    if (image && typeof image === 'object') {
      const bytes    = await image.arrayBuffer();
      const buffer   = Buffer.from(bytes);
      const mimeType = image.type || 'image/png';
      image_path     = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    const result = await client.execute({
      sql: `INSERT INTO tickets (server_id, submitter_id, team_a_id, team_b_id, image_path, clip_url) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [server_id, player.id, team_a_id, team_b_id, image_path, clip_url || null]
    });

    const ticketRes = await client.execute({ sql: `SELECT * FROM tickets WHERE id = ?`, args: [result.lastInsertRowid] });
    return NextResponse.json(ticketRes.rows[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
