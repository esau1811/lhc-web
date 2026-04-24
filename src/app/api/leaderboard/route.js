import { createClient } from 'redis';
import { NextResponse } from 'next/server';

let redisClient;

async function getRedisClient() {
  if (!redisClient) {
    const url = process.env.REDIS_URL || process.env.KV_URL;
    if (!url) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }
    
    redisClient = createClient({
      url: url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) return new Error('Max retries reached');
          return Math.min(retries * 50, 500);
        }
      }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  }
  return redisClient;
}

export async function GET() {
  try {
    const client = await getRedisClient();
    
    // ZRANGE with standard redis client
    const leaderboard = await client.zRangeWithScores('lhc_leaderboard', 0, 9, { REV: true });
    
    const formatted = leaderboard.map(item => {
      try {
        const entry = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
        return {
          name: entry.name || 'Anónimo',
          score: item.score,
          date: entry.date || '-'
        };
      } catch (e) {
        return {
          name: item.value,
          score: item.score,
          date: '-'
        };
      }
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Leaderboard Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch ranking: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const client = await getRedisClient();
    const { name, score } = await request.json();

    if (!name || typeof score !== 'number') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const date = new Date().toLocaleDateString();
    const entry = JSON.stringify({ name, date });

    // ZADD with standard redis client
    await client.zAdd('lhc_leaderboard', { score: score, value: entry });
    
    // Keep only top 100
    await client.zRemRangeByRank('lhc_leaderboard', 0, -101);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leaderboard Save Error:', error);
    return NextResponse.json({ error: 'Failed to save: ' + error.message }, { status: 500 });
  }
}
