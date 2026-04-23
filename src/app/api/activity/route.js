import { NextResponse } from 'next/server';

// Better global state pattern for Next.js
const getGlobalActivity = () => {
  if (!global.recentActivity) {
    global.recentActivity = [
      { name: 'LHCConverter', action: 'Actualizado v2.1.4', time: 'Hace 2h', icon: '/icon_conv.png', isUser: false },
      { name: 'LHCSound', action: 'Nueva biblioteca', time: 'Hace 4h', icon: '/icon_sound.png', isUser: false },
      { name: 'LHCResolution', action: 'Perfil agregado', time: 'Hace 6h', icon: '/icon_res.png', isUser: false },
    ];
  }
  return global.recentActivity;
};

export async function GET() {
  return NextResponse.json(getGlobalActivity());
}

export async function POST(req) {
  try {
    const { user } = await req.json();
    const activity = getGlobalActivity();
    
    if (!user || !user.name) {
      return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    }

    // Avoid duplicates if the same user is already at the top
    if (activity[0]?.name === user.name && activity[0]?.isUser) {
      return NextResponse.json(activity);
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
    global.recentActivity = [newEntry, ...activity.filter(a => a.name !== user.name)].slice(0, 5);

    return NextResponse.json(global.recentActivity);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}
