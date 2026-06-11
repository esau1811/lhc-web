export const runtime  = 'nodejs';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { exec }         from 'child_process';
import { promisify }    from 'util';
import fs               from 'fs';
import path             from 'path';
import os               from 'os';
import JSZip            from 'jszip';

const IS_WINDOWS = process.platform === 'win32';
const execAsync  = promisify(exec);

const PATCHER_EXE = path.join(
  process.cwd(),
  'src', 'app', 'api', 'generate-rpf', 'bin',
  IS_WINDOWS ? 'YtdPatcher-win.exe' : 'YtdPatcher-linux'
);

const ASSETS_DIR = path.join(
  process.cwd(),
  'src', 'app', 'api', 'generate-rpf', 'assets'
);

// ── DDS helpers ───────────────────────────────────────────────────────────────

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

// ── Extract YTD bytes from a YtdPatcher-generated RPF ────────────────────────

const RSC7 = Buffer.from([0x52, 0x53, 0x43, 0x37]);

function extractYtdFromRpf(rpfBuf) {
  // In a YtdPatcher-generated weapon RPF, the YTD resource is the RSC7 block
  // with the largest physical memory footprint (physicalFlags × 512).
  let bestOffset = -1;
  let bestPhys   = 0;
  let pos        = 0;

  while (true) {
    const found = rpfBuf.indexOf(RSC7, pos);
    if (found === -1) break;
    if (found + 16 <= rpfBuf.length) {
      const physFlags = rpfBuf.readUInt32LE(found + 12);
      const physEst   = (physFlags & 0x0FFFFFFF) * 512;
      if (physEst > bestPhys) { bestPhys = physEst; bestOffset = found; }
    }
    pos = found + 1;
  }

  return bestOffset !== -1 ? rpfBuf.slice(bestOffset) : null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  const tmpDir = path.join(os.tmpdir(), `lhc_patch_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const formData = await request.formData();

    const rpfFile  = formData.get('rpf');
    const pixels   = formData.get('pixels');
    const width    = parseInt(formData.get('width')   || '512', 10);
    const height   = parseInt(formData.get('height')  || '512', 10);
    // ytdName: the YTD dictionary name inside the user's RPF
    // We use this to name the standalone YTD file so FiveM recognises it
    const ytdName  = (formData.get('ytdName') || 'w_pi_combatpistol')
      .replace(/\.ytd$/i, '')
      .replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (!rpfFile || !pixels) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }
    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json({ error: 'YtdPatcher no encontrado' }, { status: 500 });
    }

    // ── 1. Save the user's original RPF (never modified) ─────────────────────
    const origRpfBuf  = Buffer.from(await rpfFile.arrayBuffer());
    const origRpfName = (rpfFile.name || `${ytdName}.rpf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    // ── 2. Write painted pixels as DDS ───────────────────────────────────────
    const ddsPath = path.join(tmpDir, 'skin.dds');
    writeDds(pixels, width, height, ddsPath);

    // ── 3. Run YtdPatcher with STOCK assets to generate a valid new YTD ──────
    //    We use the closest stock weapon that has a .ytd template in ASSETS_DIR
    const stockId = fs.existsSync(path.join(ASSETS_DIR, `${ytdName}.ytd`))
      ? ytdName
      : 'w_pi_combatpistol';

    const cmd = `"${PATCHER_EXE}" "${ddsPath}" "${stockId}" "${ASSETS_DIR}"`;
    console.log('[patch-rpf] cmd:', cmd.slice(0, 180));

    const execOpts = { maxBuffer: 8 * 1024 * 1024, cwd: tmpDir };
    if (IS_WINDOWS) execOpts.shell = 'cmd.exe';

    const { stdout, stderr } = await execAsync(cmd, execOpts);
    console.log('[patch-rpf] stdout:', stdout.slice(0, 300));
    if (stderr) console.warn('[patch-rpf] stderr:', stderr.slice(0, 200));

    // ── 4. Read the new YTD bytes ─────────────────────────────────────────────
    let newYtdBuf = null;

    // Prefer standalone .ytd if patcher emitted it
    const ytdOutPath = path.join(tmpDir, `${stockId}.ytd`);
    if (fs.existsSync(ytdOutPath)) {
      newYtdBuf = fs.readFileSync(ytdOutPath);
    } else {
      // Extract from the generated RPF
      const rpfOutPath = path.join(tmpDir, `${stockId}.rpf`);
      if (fs.existsSync(rpfOutPath)) {
        const genRpf = fs.readFileSync(rpfOutPath);
        newYtdBuf = extractYtdFromRpf(genRpf);
      }
    }

    if (!newYtdBuf) {
      return NextResponse.json({ error: 'YtdPatcher no generó el YTD' }, { status: 500 });
    }

    // ── 5. Pack into a ZIP ────────────────────────────────────────────────────
    //
    //  stream/
    //    <original>.rpf   ← unchanged, provides the 3D model
    //    <ytdName>.ytd    ← new painted texture (FiveM prefers loose files
    //                        over files inside RPFs in the same stream folder)
    //
    const zip = new JSZip();
    const streamFolder = zip.folder('stream');
    streamFolder.file(origRpfName,        origRpfBuf);
    streamFolder.file(`${ytdName}.ytd`,   newYtdBuf);

    const zipBuf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    });

    const zipName = origRpfName.replace(/\.rpf$/i, '') + '_skin.zip';
    console.log(`[patch-rpf] ZIP: stream/${origRpfName} + stream/${ytdName}.ytd → ${zipName}`);

    return new NextResponse(zipBuf, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length':      zipBuf.length.toString(),
      },
    });

  } catch (err) {
    console.error('[patch-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
