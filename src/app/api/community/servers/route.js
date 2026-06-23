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
    const client = getDb();
    const res = await client.execute('SELECT * FROM servers ORDER BY id ASC');
    return NextResponse.json(res.rows);
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

    const has_kd = formData.get('has_kd') === 'false' ? 0 : 1;

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    if (logo_file && typeof logo_file === 'object') {
      const bytes = await logo_file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = logo_file.type || 'image/png';
      logo_url = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    const client = getDb();
    const result = await client.execute({ sql: 'INSERT INTO servers (name, logo_url, has_kd) VALUES (?, ?, ?)', args: [name, logo_url, has_kd] });
    const serverRes = await client.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [result.lastInsertRowid] });
    return NextResponse.json(serverRes.rows[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
