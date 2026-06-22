export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'servers');

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
    const formData = await request.formData();
    const name = formData.get('name');
    let logo_url = formData.get('logo_url') || null;
    const logo_file = formData.get('logo_file');

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    if (logo_file && typeof logo_file === 'object') {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext = logo_file.name?.split('.').pop() || 'jpg';
      const filename = `server_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      logo_url = `/uploads/servers/${filename}`;
      const bytes = await logo_file.arrayBuffer();
      await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(bytes));
    }

    const db = getDb();
    const result = db.prepare('INSERT INTO servers (name, logo_url) VALUES (?, ?)').run(name, logo_url);
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(server, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
