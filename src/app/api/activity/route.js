import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Fallback memory store for when KV is not configured
const memoryActivity = [
  { name: 'LHCConverter', action: 'Actualizado v2.1.4', time: 'Hace 2h', icon: '/icon_conv.png', isUser: false },
  { name: 'LHCSound', action: 'Nueva biblioteca', time: 'Hace 4h', icon: '/icon_sound.png', isUser: false },
  { name: 'LHCResolution', action: 'Perfil agregado', time: 'Hace 6h', icon: '/icon_res.png', isUser: false },
];

const ACTIVITY_KEY = 'lhc_recent_activity';

export async function GET() {
  try {
    // Try to get from Vercel KV
    const kvActivity = await kv.get(ACTIVITY_KEY);
    if (kvActivity) return NextResponse.json(kvActivity);
  } catch (e) {
    console.warn('KV not configured, using memory fallback');
  }
  
  // Fallback to global memory if KV fails or is not set
  if (!global.recentActivity) global.recentActivity = [...memoryActivity];
  return NextResponse.json(global.recentActivity);
}

export async function POST(req) {
  try {
    const { user } = await req.json();
    if (!user || !user.name) return NextResponse.json({ error: 'Missing user' }, { status: 400 });

    const newEntry = {
      name: user.name.split(' ')[0],
      action: 'Se unió a la comunidad',
      time: 'Ahora',
      isUser: true,
      image: user.image,
      timestamp: Date.now()
    };

    let currentActivity = [];
    let usingKV = false;

    try {
      const kvActivity = await kv.get(ACTIVITY_KEY);
      currentActivity = kvActivity || [...(global.recentActivity || memoryActivity)];
      usingKV = true;
    } catch (e) {
      currentActivity = global.recentActivity || [...memoryActivity];
    }

    // Avoid duplicates
    if (currentActivity[0]?.name === user.name && currentActivity[0]?.isUser) {
      return NextResponse.json(currentActivity);
    }

    const updatedActivity = [newEntry, ...currentActivity.filter(a => a.name !== user.name)].slice(0, 4);

    if (usingKV) {
      try {
        await kv.set(ACTIVITY_KEY, updatedActivity);
      } catch (e) { console.error('Failed to set KV'); }
    }
    
    global.recentActivity = updatedActivity;
    return NextResponse.json(updatedActivity);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}
