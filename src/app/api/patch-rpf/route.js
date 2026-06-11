export const runtime  = 'nodejs';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { exec }         from 'child_process';
import { promisify }    from 'util';
import fs               from 'fs';
import path             from 'path';
import os               from 'os';

const IS_WINDOWS = process.platform === 'win32';
const execAsync  = promisify(exec);

const PATCHER_EXE = path.join(
  process.cwd(),
  'src', 'app', 'api', 'generate-rpf', 'bin',
  IS_WINDOWS ? 'YtdPatcher-win.exe' : 'YtdPatcher-linux'
);

// ── DDS helpers ──────────────────────────────────────────────────────────────

function buildDdsHeader(w, h, mipCount) {
  const buf = new ArrayBuffer(128);
  const dv  = new DataView(buf);
  let o = 0;
  dv.setUint32(o, 0x20534444, true); o += 4;
  dv.setUint32(o, 124,        true); o += 4;
  dv.setUint32(o, 0x21007,    true); o += 4;
  dv.setUint32(o, h,          true); o += 4;
  dv.setUint32(o, w,          true); o += 4;
  dv.setUint32(o, w * 4,      true); o += 4;
  dv.setUint32(o, 0,          true); o += 4;
  dv.setUint32(o, mipCount,   true); o += 4;
  for (let i = 0; i < 11; i++) { dv.setUint32(o, 0, true); o += 4; }
  dv.setUint32(o, 32,         true); o += 4;
  dv.setUint32(o, 0x41,       true); o += 4;
  dv.setUint32(o, 0,          true); o += 4;
  dv.setUint32(o, 32,         true); o += 4;
  dv.setUint32(o, 0x00FF0000, true); o += 4;
  dv.setUint32(o, 0x0000FF00, true); o += 4;
  dv.setUint32(o, 0x000000FF, true); o += 4;
  dv.setUint32(o, 0xFF000000, true); o += 4;
  dv.setUint32(o, 0x401008,   true); o += 4;
  return Buffer.from(buf);
}

function generateMips(rgba, w, h) {
  const mips = [{ data: rgba, w, h }];
  let mw = w >> 1, mh = h >> 1;
  while (mw >= 1 && mh >= 1) {
    const prev = mips[mips.length - 1];
    const mip  = Buffer.alloc(mw * mh * 4);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const dst = (y * mw + x) * 4;
        const p00 = ((y * 2)     * prev.w + (x * 2))     * 4;
        const p10 = ((y * 2)     * prev.w + (x * 2 + 1)) * 4;
        const p01 = ((y * 2 + 1) * prev.w + (x * 2))     * 4;
        const p11 = ((y * 2 + 1) * prev.w + (x * 2 + 1)) * 4;
        for (let c = 0; c < 4; c++) {
          mip[dst + c] = (prev.data[p00+c] + prev.data[p10+c] + prev.data[p01+c] + prev.data[p11+c]) >> 2;
        }
      }
    }
    mips.push({ data: mip, w: mw, h: mh });
    mw >>= 1; mh >>= 1;
  }
  return mips;
}

function writeDds(pixelsB64, w, h, filePath) {
  const rgba = Buffer.from(pixelsB64, 'base64');
  const mips = generateMips(rgba, w, h);
  const parts = [buildDdsHeader(w, h, mips.length)];
  for (const mip of mips) {
    const bgra = Buffer.alloc(mip.data.length);
    for (let i = 0; i < mip.data.length; i += 4) {
      bgra[i]     = mip.data[i + 2];
      bgra[i + 1] = mip.data[i + 1];
      bgra[i + 2] = mip.data[i];
      bgra[i + 3] = mip.data[i + 3];
    }
    parts.push(bgra);
  }
  fs.writeFileSync(filePath, Buffer.concat(parts));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  const reqDir = path.join(os.tmpdir(), `lhc_patch_${Date.now()}`);
  fs.mkdirSync(reqDir, { recursive: true });

  try {
    const formData = await request.formData();

    const rpfFile  = formData.get('rpf');          // user's RPF File
    const pixels   = formData.get('pixels');       // base64 RGBA painted texture
    const width    = parseInt(formData.get('width')   || '512', 10);
    const height   = parseInt(formData.get('height')  || '512', 10);
    // ytdName: base name of the YTD found inside the RPF (e.g. 'w_pi_combatpistol')
    // YtdPatcher uses this as both the weapon name and the YTD dictionary key
    const ytdName  = (formData.get('ytdName') || 'w_pi_combatpistol')
      .replace(/\.ytd$/i, '')   // strip extension if sent with it
      .replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (!rpfFile || !pixels) {
      return NextResponse.json({ error: 'Faltan parámetros: rpf y pixels son obligatorios' }, { status: 400 });
    }

    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json({ error: `YtdPatcher no encontrado: ${PATCHER_EXE}` }, { status: 500 });
    }

    // 1. Save the user's RPF into reqDir using the YTD base name as the filename.
    //    YtdPatcher looks for [assetsDir]/[weaponName].rpf — so we use the user's
    //    RPF as the base template instead of the stock game RPF.
    const rpfDestPath = path.join(reqDir, `${ytdName}.rpf`);
    const rpfAb = await rpfFile.arrayBuffer();
    fs.writeFileSync(rpfDestPath, Buffer.from(rpfAb));

    // 2. Write the painted pixels as a DDS file
    const ddsPath = path.join(reqDir, `lhc_tex.dds`);
    writeDds(pixels, width, height, ddsPath);

    // 3. Run YtdPatcher:
    //    args: [ddsFile] [weaponName] [assetsDir]
    //    It will open [assetsDir]/[weaponName].rpf, replace the texture, and
    //    write the patched RPF back to [cwd]/[weaponName].rpf
    const cmd = `"${PATCHER_EXE}" "${ddsPath}" "${ytdName}" "${reqDir}"`;
    console.log('[patch-rpf] cmd:', cmd.slice(0, 200));

    const execOptions = { maxBuffer: 8 * 1024 * 1024, cwd: reqDir };
    if (IS_WINDOWS) execOptions.shell = 'cmd.exe';

    const { stdout, stderr } = await execAsync(cmd, execOptions);
    console.log('[patch-rpf] stdout:', stdout.slice(0, 400));
    if (stderr) console.warn('[patch-rpf] stderr:', stderr.slice(0, 200));

    // 4. Read the patched RPF (YtdPatcher writes [weaponName].rpf in cwd)
    const patchedRpfPath = path.join(reqDir, `${ytdName}.rpf`);
    if (!fs.existsSync(patchedRpfPath)) {
      return NextResponse.json(
        { error: `YtdPatcher no generó el RPF. Log: ${stdout.slice(-400)}` },
        { status: 500 }
      );
    }

    const patchedRpf = fs.readFileSync(patchedRpfPath);

    // 5. Return the patched RPF directly (same filename as input)
    const outFilename = (rpfFile.name || `${ytdName}.rpf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    return new NextResponse(patchedRpf, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${outFilename}"`,
        'Content-Length':      patchedRpf.length.toString(),
      },
    });

  } catch (err) {
    console.error('[patch-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    // Cleanup temp dir
    try { fs.rmSync(reqDir, { recursive: true, force: true }); } catch {}
  }
}
