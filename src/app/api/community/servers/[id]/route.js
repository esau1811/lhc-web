export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/communityDb';

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const client = getDb();
    const { id } = params;
    
    // Check if server is ID 1 (default server). We shouldn't delete the default one, but let's allow it if they really want to, or block it?
    if (id === '1' || id === 1) {
      return NextResponse.json({ error: 'No se puede eliminar el servidor por defecto (ID 1)' }, { status: 400 });
    }

    // Unlink players, teams, tickets?
    await client.execute({ sql: `DELETE FROM servers WHERE id = ?`, args: [id] });
    
    // Also cleanup linked stuff? For now just cascade delete or let them be orphaned, we will delete them.
    await client.execute({ sql: `DELETE FROM teams WHERE server_id = ?`, args: [id] });
    await client.execute({ sql: `DELETE FROM players WHERE server_id = ?`, args: [id] });
    await client.execute({ sql: `DELETE FROM tickets WHERE server_id = ?`, args: [id] });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
