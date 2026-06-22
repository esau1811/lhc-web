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
      const bytes = await logo_file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = logo_file.type || 'image/png';
      logo_url = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    const db = getDb();
    const result = db.prepare('INSERT INTO servers (name, logo_url) VALUES (?, ?)').run(name, logo_url);
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(server, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
