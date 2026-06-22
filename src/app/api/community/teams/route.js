export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'teams');

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const server_id = searchParams.get('server_id') || 1;
    let teams;
    if (q) {
      teams = db.prepare(`SELECT * FROM teams WHERE server_id = ? AND name LIKE ? ORDER BY elo DESC`).all(server_id, `%${q}%`);
    } else {
      teams = db.prepare(`SELECT * FROM teams WHERE server_id = ? ORDER BY elo DESC`).all(server_id);
    }
    return NextResponse.json(teams);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const formData = await request.formData();
    const name = formData.get('name');
    const tag = formData.get('tag') || '';
    const server_id = formData.get('server_id') || 1;
    let logo_url = formData.get('logo_url') || null;
    const logo_file = formData.get('logo_file');

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    if (logo_file && typeof logo_file === 'object') {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext = logo_file.name?.split('.').pop() || 'jpg';
      const filename = `team_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      logo_url = `/uploads/teams/${filename}`;
      const bytes = await logo_file.arrayBuffer();
      await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(bytes));
    }

    const db = getDb();
    const result = db.prepare(`INSERT INTO teams (server_id, name, tag, logo_url) VALUES (?, ?, ?, ?)`).run(server_id || 1, name, tag, logo_url);
    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(result.lastInsertRowid);
    return NextResponse.json(team, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
