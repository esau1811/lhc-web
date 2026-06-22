export const runtime = 'nodejs';
export const dynamic  = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'tickets');

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb();
    let tickets;
    if (session.user.isAdmin) {
      tickets = db.prepare(`
        SELECT t.*, 
          p.discord_name AS submitter_name, p.discord_avatar AS submitter_avatar,
          ta.name AS team_a_name, tb.name AS team_b_name
        FROM tickets t
        JOIN players p  ON p.id  = t.submitter_id
        JOIN teams   ta ON ta.id = t.team_a_id
        JOIN teams   tb ON tb.id = t.team_b_id
        WHERE t.status = 'pending'
        ORDER BY t.created_at DESC
      `).all();
    } else {
      const player = db.prepare(`SELECT * FROM players WHERE discord_id = ?`).get(session.user.discordId);
      if (!player) return NextResponse.json([]);
      tickets = db.prepare(`
        SELECT t.*,
          ta.name AS team_a_name, tb.name AS team_b_name
        FROM tickets t
        JOIN teams ta ON ta.id = t.team_a_id
        JOIN teams tb ON tb.id = t.team_b_id
        WHERE t.submitter_id = ?
        ORDER BY t.created_at DESC LIMIT 20
      `).all(player.id);
    }
    return NextResponse.json(tickets);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const formData = await request.formData();
    const team_a_id = formData.get('team_a_id');
    const team_b_id = formData.get('team_b_id');
    const image     = formData.get('image');

    if (!team_a_id || !team_b_id) {
      return NextResponse.json({ error: 'team_a_id y team_b_id requeridos' }, { status: 400 });
    }

    const db = getDb();

    // Ensure player exists (auto-register on first ticket)
    let player = db.prepare(`SELECT * FROM players WHERE discord_id = ?`).get(session.user.discordId);
    if (!player) {
      const res = db.prepare(`INSERT INTO players (discord_id, discord_name, discord_avatar) VALUES (?, ?, ?)`)
        .run(session.user.discordId, session.user.name, session.user.image);
      player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(res.lastInsertRowid);
    }

    // Save image
    let image_path = null;
    if (image && typeof image === 'object') {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext      = image.name?.split('.').pop() || 'jpg';
      const filename = `ticket_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      image_path     = `/uploads/tickets/${filename}`;
      const bytes    = await image.arrayBuffer();
      await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(bytes));
    }

    const result = db.prepare(`
      INSERT INTO tickets (submitter_id, team_a_id, team_b_id, image_path)
      VALUES (?, ?, ?, ?)
    `).run(player.id, team_a_id, team_b_id, image_path);

    const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(result.lastInsertRowid);
    return NextResponse.json(ticket, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
