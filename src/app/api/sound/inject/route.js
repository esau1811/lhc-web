import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Forward the request to the VPS (HTTP is fine server-to-server)
    const vpsResponse = await fetch('http://187.33.157.103:5000/api/Sound/inject', {
      method: 'POST',
      body: formData,
    });

    if (!vpsResponse.ok) {
      const error = await vpsResponse.text();
      return NextResponse.json({ error }, { status: vpsResponse.status });
    }

    const blob = await vpsResponse.blob();
    
    // Return the binary data back to the client
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=LHC_Sound.zip',
      },
    });
  } catch (error) {
    console.error('[Proxy Error]:', error);
    return NextResponse.json({ error: 'Error interno en el servidor de la web' }, { status: 500 });
  }
}
