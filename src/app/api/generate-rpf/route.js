export const runtime = 'nodejs';    // must be Node.js, not Edge
export const maxDuration = 60;      // allow up to 60s for the exe

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

// YtdPatcher only works on Windows (local dev).
// On Vercel (Linux) we return 501 with a clear message.
const IS_WINDOWS = process.platform === 'win32';

const execAsync = promisify(exec);

// Ruta al exe del YtdPatcher (publicado como self-contained)
const PATCHER_EXE = path.join(
  process.cwd(),
  'scratch', 'YtdPatcher', 'bin', 'Release', 'net9.0-windows', 'win-x64', 'YtdPatcher.exe'
);

// Construye header DDS A8R8G8B8 (mismo formato que exporta el canvas)
function buildDdsHeader(w, h) {
  const buf = new ArrayBuffer(128);
  const dv = new DataView(buf);
  let o = 0;
  dv.setUint32(o, 0x20534444, true); o += 4; // 'DDS '
  dv.setUint32(o, 124, true);        o += 4; // dwSize
  dv.setUint32(o, 0x1007, true);     o += 4; // dwFlags
  dv.setUint32(o, h, true);          o += 4; // dwHeight
  dv.setUint32(o, w, true);          o += 4; // dwWidth
  dv.setUint32(o, w * 4, true);      o += 4; // dwPitch
  dv.setUint32(o, 0, true);          o += 4; // dwDepth
  dv.setUint32(o, 1, true);          o += 4; // dwMipMapCount
  for (let i = 0; i < 11; i++) { dv.setUint32(o, 0, true); o += 4; }
  // Pixel format
  dv.setUint32(o, 32, true);         o += 4;
  dv.setUint32(o, 0x41, true);       o += 4; // ALPHAPIXELS|RGB
  dv.setUint32(o, 0, true);          o += 4;
  dv.setUint32(o, 32, true);         o += 4;
  dv.setUint32(o, 0x00FF0000, true); o += 4; // R
  dv.setUint32(o, 0x0000FF00, true); o += 4; // G
  dv.setUint32(o, 0x000000FF, true); o += 4; // B
  dv.setUint32(o, 0xFF000000, true); o += 4; // A
  dv.setUint32(o, 0x1000, true);     o += 4; // TEXTURE cap
  dv.setUint32(o, 0, true); o += 4;
  dv.setUint32(o, 0, true); o += 4;
  dv.setUint32(o, 0, true); o += 4;
  dv.setUint32(o, 0, true); o += 4;
  return Buffer.from(buf);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { weaponName, width, height, pixels } = body;

    if (!weaponName || !pixels) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!IS_WINDOWS) {
      return NextResponse.json(
        { error: 'RPF generation requires local server (Windows). Download the DDS instead.' },
        { status: 501 }
      );
    }

    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json(
        { error: `YtdPatcher.exe no encontrado: ${PATCHER_EXE}` },
        { status: 500 }
      );
    }

    const tmpDir  = os.tmpdir();
    const tmpId   = Date.now();
    const ddsPng  = path.join(tmpDir, `lhc_skin_${tmpId}.dds`);

    const rgbaBytes = Buffer.from(pixels, 'base64');
    const bgraBytes = Buffer.alloc(rgbaBytes.length);
    for (let i = 0; i < rgbaBytes.length; i += 4) {
      bgraBytes[i]     = rgbaBytes[i + 2];
      bgraBytes[i + 1] = rgbaBytes[i + 1];
      bgraBytes[i + 2] = rgbaBytes[i];
      bgraBytes[i + 3] = rgbaBytes[i + 3];
    }

    const header = buildDdsHeader(width || 512, height || 512);
    fs.writeFileSync(ddsPng, Buffer.concat([header, bgraBytes]));

    const cmd = `"${PATCHER_EXE}" "${ddsPng}" "${weaponName}"`;
    console.log('[generate-rpf] Ejecutando en:', tmpDir);
    console.log('[generate-rpf] Command:', cmd.slice(0, 100) + '...');

    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 1024 * 1024,
      cwd: tmpDir,
      shell: 'cmd.exe'
    });

    console.log('[generate-rpf] stdout:', stdout.slice(0, 500));
    if (stderr) console.warn('[generate-rpf] stderr:', stderr.slice(0, 300));

    const rpfPath = path.join(tmpDir, `${weaponName}.rpf`);
    if (!fs.existsSync(rpfPath)) {
      const files = fs.readdirSync(tmpDir).filter(f => f.includes('rpf') || f.includes(weaponName));
      return NextResponse.json(
        { error: `RPF no generado en ${rpfPath}. Archivos: ${files.join(', ')}. Log: ${stdout.slice(-300)}` },
        { status: 500 }
      );
    }

    const rpfBytes = fs.readFileSync(rpfPath);

    try { fs.unlinkSync(ddsPng); } catch {}
    try { fs.unlinkSync(rpfPath); } catch {}

    return new NextResponse(rpfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${weaponName}.rpf"`,
        'Content-Length': rpfBytes.length.toString(),
      },
    });

  } catch (err) {
    console.error('[generate-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
