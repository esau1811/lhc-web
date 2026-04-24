import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch top 10 scores from a sorted set called 'leaderboard'
    // revrange returns scores from highest to lowest
    const leaderboard = await kv.zrange('lhc_leaderboard', 0, 9, { withScores: true, rev: true });
    
    // Format the data for the frontend
    const formatted = [];
    for (let i = 0; i < leaderboard.length; i += 2) {
      const entry = JSON.parse(leaderboard[i]);
      formatted.push({
        name: entry.name,
        score: leaderboard[i + 1],
        date: entry.date
      });
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

    // Add to sorted set
    await kv.zadd('lhc_leaderboard', { score, member: entry });

    // Keep only top 100 to save space
    await kv.zremrangebyrank('lhc_leaderboard', 0, -101);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leaderboard Save Error:', error);
    return NextResponse.json({ error: 'Failed to save score: ' + error.message }, { status: 500 });
  }
}
