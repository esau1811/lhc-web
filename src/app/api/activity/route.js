import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
// Force redeploy v2

// Empty by default, only shows real user activity
const memoryActivity = [];

const ACTIVITY_KEY = 'lhc_recent_activity';

const INITIAL_ACTIVITY = [
  { name: 'Alex', action: 'Convirtió una skin de Glock', time: '5m', isUser: false, icon: '/icon_conv.png' },
  { name: 'Santi', action: 'Compró Nitro Boost', time: '12m', isUser: false, icon: '/nitro_v2.png' },
  { name: 'Marco', action: 'Usó el Optimizador', time: '20m', isUser: false, icon: '/opti_v2.png' },
  { name: 'LHC Bot', action: 'Sistema operativo v32', time: '1h', isUser: false, icon: '/logo.png' }
];

export async function GET() {
  try {
    const kvActivity = await kv.get(ACTIVITY_KEY);
    if (kvActivity && kvActivity.length > 0) return NextResponse.json(kvActivity);
  } catch (e) {
    console.warn('KV not configured');
  }
  
  if (!global.recentActivity || global.recentActivity.length === 0) {
    global.recentActivity = INITIAL_ACTIVITY;
  }
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
