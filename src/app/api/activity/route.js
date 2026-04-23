import { NextResponse } from 'next/server';

// Global variable to store activity in memory (will reset on cold starts/redeployments)
// In production, a database like Redis/KV is recommended.
if (!global.recentActivity) {
  global.recentActivity = [
    { name: 'LHCConverter', action: 'Actualizado v2.1.4', time: 'Hace 2h', icon: '/icon_conv.png', isUser: false },
    { name: 'LHCSound', action: 'Nueva biblioteca', time: 'Hace 4h', icon: '/icon_sound.png', isUser: false },
    { name: 'LHCResolution', action: 'Perfil agregado', time: 'Hace 6h', icon: '/icon_res.png', isUser: false },
  ];
}

export async function GET() {
  return NextResponse.json(global.recentActivity);
}

export async function POST(req) {
  try {
    const { user } = await req.json();
    
    if (!user || !user.name) {
      return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    }

    // Avoid duplicates if the same user is already at the top
    if (global.recentActivity[0]?.name === user.name && global.recentActivity[0]?.isUser) {
      return NextResponse.json(global.recentActivity);
    }

    const newEntry = {
      name: user.name.split(' ')[0],
      action: 'Se unió a la comunidad',
      time: 'Ahora',
      isUser: true,
      image: user.image,
      timestamp: Date.now()
    };

    // Add to top and keep only last 5
    global.recentActivity = [newEntry, ...global.recentActivity.filter(a => a.name !== user.name)].slice(0, 5);

    return NextResponse.json(global.recentActivity);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}
