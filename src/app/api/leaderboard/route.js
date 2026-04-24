import { createClient } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Manually initialize KV to try multiple environment variable patterns
const getKVClient = () => {
  const url = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL || process.env.KV_URL || process.env.REDIS_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
  
  if (!url || !token) {
    // If specific REST vars are missing, try generic ones or let @vercel/kv handle it
    const { kv } = require('@vercel/kv');
    return kv;
  }
  
  return createClient({
    url: url,
    token: token,
  });
};

const kv = getKVClient();

export async function GET() {
  try {
    const leaderboard = await kv.zrange('lhc_leaderboard', 0, 9, { withScores: true, rev: true });
    
    const formatted = [];
    for (let i = 0; i < leaderboard.length; i += 2) {
      try {
        const entry = typeof leaderboard[i] === 'string' ? JSON.parse(leaderboard[i]) : leaderboard[i];
        formatted.push({
          name: entry.name || 'Anónimo',
          score: leaderboard[i + 1],
          date: entry.date || '-'
        });
      } catch (e) {
        // Fallback if the member is just a name string
        formatted.push({
          name: leaderboard[i],
          score: leaderboard[i + 1],
          date: '-'
        });
      }
    }

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Leaderboard Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, score } = await request.json();

    if (!name || typeof score !== 'number') {
      return NextResponse.json({ error: 'Invalid data: name and score are required' }, { status: 400 });
    }

    const date = new Date().toLocaleDateString();
    const entry = JSON.stringify({ name, date });

    await kv.zadd('lhc_leaderboard', { score, member: entry });
    await kv.zremrangebyrank('lhc_leaderboard', 0, -101);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leaderboard Save Error:', error);
    return NextResponse.json({ error: 'Failed to save score: ' + error.message }, { status: 500 });
  }
}
