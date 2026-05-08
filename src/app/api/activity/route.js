import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

const ACTIVITY_KEY = 'lhc_recent_activity';

function getRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours/24)}d`;
}

const INITIAL_ACTIVITY = [];

export async function GET() {
  try {
    const kvActivity = await kv.get(ACTIVITY_KEY);
    const data = (kvActivity && kvActivity.length > 0) ? kvActivity : INITIAL_ACTIVITY;
    
    // Update relative times
    const updatedData = data.map(act => ({
      ...act,
      time: getRelativeTime(act.timestamp || (Date.now() - 3600000))
    }));

    return NextResponse.json(updatedData);
  } catch (e) {
    console.warn('KV failed');
    const data = INITIAL_ACTIVITY;
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
      currentActivity = (kvActivity && kvActivity.length > 0) ? kvActivity : INITIAL_ACTIVITY;
    } catch (e) {
      currentActivity = INITIAL_ACTIVITY;
    }

    // Filter out old entries for the same user to move them to top
    const updatedActivity = [newEntry, ...currentActivity.filter(a => a.name !== newEntry.name)].slice(0, 4);

    try {
      await kv.set(ACTIVITY_KEY, updatedActivity);
    } catch (e) { console.error('Failed to set KV'); }
    
    return NextResponse.json(updatedActivity);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
