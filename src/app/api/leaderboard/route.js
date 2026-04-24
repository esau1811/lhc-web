import { createClient } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Ultra-flexible KV client
const getKVClient = () => {
  // Try to find ANY useful variable
  const url = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL || process.env.KV_URL || process.env.REDIS_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

  // If we have REDIS_URL but no token, it might be a full URL with credentials
  if (process.env.REDIS_URL && !token) {
    // Vercel KV often works with just the KV_URL if it's the REST one
    return createClient({
      url: process.env.REDIS_URL.includes('rest') ? process.env.REDIS_URL : process.env.REDIS_URL,
      token: token || '', // Token might be embedded or not needed if using standard Redis
    });
  }

  const { kv } = require('@vercel/kv');
  return kv;
};

const kv = getKVClient();

export async function GET() {
  try {
    const leaderboard = await kv.zrange('lhc_leaderboard', 0, 9, { withScores: true, rev: true });
    
    const formatted = [];
    if (leaderboard && Array.isArray(leaderboard)) {
      for (let i = 0; i < leaderboard.length; i += 2) {
        try {
          const entry = typeof leaderboard[i] === 'string' ? JSON.parse(leaderboard[i]) : leaderboard[i];
          formatted.push({
            name: entry.name || 'Anónimo',
            score: leaderboard[i + 1],
            date: entry.date || '-'
          });
        } catch (e) {
          formatted.push({
            name: leaderboard[i],
            score: leaderboard[i + 1],
            date: '-'
          });
        }
      }
    }

    return NextResponse.json(formatted || []);
  } catch (error) {
    console.error('Leaderboard Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch ranking: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, score } = await request.json();

    if (!name || typeof score !== 'number') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const date = new Date().toLocaleDateString();
    const entry = JSON.stringify({ name, date });

    await kv.zadd('lhc_leaderboard', { score, member: entry });
    await kv.zremrangebyrank('lhc_leaderboard', 0, -101);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leaderboard Save Error:', error);
    return NextResponse.json({ error: 'Failed to save: ' + error.message }, { status: 500 });
  }
}
