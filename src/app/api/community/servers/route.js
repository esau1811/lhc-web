export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';

export async function GET(request) {
  try {
    const db = getDb();
    const servers = db.prepare('SELECT * FROM servers ORDER BY id ASC').all();
    return NextResponse.json(servers);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { name, logo_url } = await request.json();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const db = getDb();
    const result = db.prepare('INSERT INTO servers (name, logo_url) VALUES (?, ?)').run(name, logo_url || null);
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(server, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
