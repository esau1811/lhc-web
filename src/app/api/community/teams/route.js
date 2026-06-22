export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    let teams;
    if (q) {
      teams = db.prepare(`SELECT * FROM teams WHERE name LIKE ? ORDER BY elo DESC`).all(`%${q}%`);
    } else {
      teams = db.prepare(`SELECT * FROM teams ORDER BY elo DESC`).all();
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
    const { name, tag, logo_url } = await request.json();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const db = getDb();
    const result = db.prepare(`INSERT INTO teams (name, tag, logo_url) VALUES (?, ?, ?)`).run(name, tag || '', logo_url || null);
    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(result.lastInsertRowid);
    return NextResponse.json(team, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
