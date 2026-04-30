import { NextResponse } from 'next/server';

export async function POST(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'inject';
  
  try {
    const formData = await request.formData();
    const endpoint = action === 'chunk' 
      ? 'http://187.33.157.103:5000/api/Sound/upload-chunk'
      : 'http://187.33.157.103:5000/api/Sound/assemble-and-inject';

    const vpsResponse = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!vpsResponse.ok) {
      const error = await vpsResponse.text();
      return NextResponse.json({ error }, { status: vpsResponse.status });
    }

    if (action === 'chunk') {
      return NextResponse.json({ status: 'ok' });
    }

    const blob = await vpsResponse.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=LHC_Sound.zip',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
