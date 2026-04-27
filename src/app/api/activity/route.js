import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
// Force redeploy v2

// Empty by default, only shows real user activity
const memoryActivity = [];

const ACTIVITY_KEY = 'lhc_recent_activity';

function getRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

const INITIAL_ACTIVITY = [
  { name: 'Alex', action: 'Convirtió una skin de Glock', timestamp: Date.now() - 300000, isUser: false, icon: '/icon_conv.png' },
  { name: 'Santi', action: 'Compró Nitro Boost', timestamp: Date.now() - 720000, isUser: false, icon: '/nitro_v2.png' },
  { name: 'Marco', action: 'Usó el Optimizador', timestamp: Date.now() - 1200000, isUser: false, icon: '/opti_v2.png' },
  { name: 'LHC Bot', action: 'Sistema operativo v33', timestamp: Date.now() - 3600000, isUser: false, icon: '/logo.png' }
];

export async function GET() {
  try {
    const kvActivity = await kv.get(ACTIVITY_KEY);
    const data = (kvActivity && kvActivity.length > 0) ? kvActivity : (global.recentActivity || INITIAL_ACTIVITY);
    
    // Update relative times
    const updatedData = data.map(act => ({
      ...act,
      time: getRelativeTime(act.timestamp || (Date.now() - 3600000))
    }));

    return NextResponse.json(updatedData);
  } catch (e) {
    console.warn('KV failed');
    const data = global.recentActivity || INITIAL_ACTIVITY;
    return NextResponse.json(data.map(act => ({
      ...act,
      time: getRelativeTime(act.timestamp || (Date.now() - 3600000))
    })));
  }
}

export async function POST(req) {
  try {
    const { user } = await req.json();
    if (!user || !user.name) return NextResponse.json({ error: 'Missing user' }, { status: 400 });

    const newEntry = {
      name: user.name.split(' ')[0],
      action: 'Se unió a la comunidad',
      isUser: true,
      image: user.image,
      timestamp: Date.now()
    };

    let currentActivity = [];
    try {
      const kvActivity = await kv.get(ACTIVITY_KEY);
      currentActivity = (kvActivity && kvActivity.length > 0) ? kvActivity : (global.recentActivity || INITIAL_ACTIVITY);
    } catch (e) {
      currentActivity = global.recentActivity || INITIAL_ACTIVITY;
    }

    // Filter out old entries for the same user to move them to top
    const updatedActivity = [newEntry, ...currentActivity.filter(a => a.name !== newEntry.name)].slice(0, 4);

    try {
      await kv.set(ACTIVITY_KEY, updatedActivity);
    } catch (e) { console.error('Failed to set KV'); }
    
    global.recentActivity = updatedActivity;
    return NextResponse.json(updatedActivity);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
