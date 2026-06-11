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

// ── RPF7 YTD block finder ─────────────────────────────────────────────────────

const RSC7_LE = 0x37435352; // readUInt32LE of bytes [0x52,0x53,0x43,0x37]

function findYtdBlock(rpfBuf) {
  if (rpfBuf.length < 16) return null;
  if (rpfBuf.readUInt32LE(0) !== 0x52504637) return null; // not RPF7

  const tocSize  = rpfBuf.readUInt32LE(4);
  const tocEnd   = 16 + tocSize;
  const dataStart = Math.ceil(tocEnd / 512) * 512;

  if (dataStart >= rpfBuf.length) return null;

  const blocks = [];
  for (let pos = dataStart; pos + 16 <= rpfBuf.length; pos += 512) {
    if (rpfBuf.readUInt32LE(pos) !== RSC7_LE) continue;
    const physFlags = rpfBuf.readUInt32LE(pos + 12);
    const physEst   = (physFlags & 0x0FFFFFFF) * 512;
    blocks.push({ offset: pos, physEst });
  }

  if (blocks.length === 0) return null;

  blocks.sort((a, b) => b.physEst - a.physEst);
  const ytd = blocks[0];

  const nextBlock = blocks
    .map(b => b.offset)
    .filter(o => o > ytd.offset)
    .sort((a, b) => a - b)[0];

  const blockSize = (nextBlock ?? rpfBuf.length) - ytd.offset;

  return { offset: ytd.offset, blockSize };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  const tmpDir = path.join(os.tmpdir(), `lhc_patch_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const inputAssetsDir = path.join(tmpDir, 'assets');
  const outputDir      = path.join(tmpDir, 'output');

  try {
    fs.mkdirSync(inputAssetsDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const formData = await request.formData();
    const rpfFile  = formData.get('rpf');
    const pixels   = formData.get('pixels');
    const width    = parseInt(formData.get('width')  || '512', 10);
    const height   = parseInt(formData.get('height') || '512', 10);
    const ytdName  = (formData.get('ytdName') || 'w_pi_combatpistol')
      .replace(/\.ytd$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (!rpfFile || !pixels) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }
    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json({ error: 'YtdPatcher no encontrado' }, { status: 500 });
    }

    const origRpfName = (rpfFile.name || `${ytdName}.rpf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const origRpfBuf  = Buffer.from(await rpfFile.arrayBuffer());

    // ── 1. Extract the actual custom YTD from the user's RPF ──────────────────
    const block = findYtdBlock(origRpfBuf);
    if (!block) {
      return NextResponse.json({ error: 'No se encontró el bloque YTD en el RPF' }, { status: 500 });
    }

    const customYtdBuf = origRpfBuf.slice(block.offset, block.offset + block.blockSize);
    
    // Save it to inputAssetsDir so YtdPatcher uses the CUSTOM YTD as its base
    const inputYtdPath = path.join(inputAssetsDir, `${ytdName}.ytd`);
    fs.writeFileSync(inputYtdPath, customYtdBuf);

    // ── 2. Write the painted DDS skin ─────────────────────────────────────────
    const ddsPath = path.join(tmpDir, 'skin.dds');
    writeDds(pixels, width, height, ddsPath);

    // ── 3. Run YtdPatcher to modify the custom YTD ────────────────────────────
    const cmd = `"${PATCHER_EXE}" "${ddsPath}" "${ytdName}" "${inputAssetsDir}"`;
    console.log('[patch-rpf] YtdPatcher CMD:', cmd.slice(0, 200));

    const execOpts = { maxBuffer: 8 * 1024 * 1024, cwd: outputDir };
    if (IS_WINDOWS) execOpts.shell = 'cmd.exe';

    const { stdout, stderr } = await execAsync(cmd, execOpts);
    console.log('[patch-rpf] YtdPatcher stdout:', stdout.slice(0, 300));
    if (stderr) console.warn('[patch-rpf] YtdPatcher stderr:', stderr.slice(0, 200));

    // ── 4. Get the modified custom YTD ────────────────────────────────────────
    const outYtdPath = path.join(outputDir, `${ytdName}.ytd`);
    if (!fs.existsSync(outYtdPath)) {
      return NextResponse.json({ error: 'El parcheador no logró editar el YTD custom.' }, { status: 500 });
    }
    
    const modifiedYtdBuf = fs.readFileSync(outYtdPath);

    // ── 5. Inject the modified YTD back into the user's RPF ───────────────────
    const SECTOR = 512;
    const oldSectors = Math.ceil(block.blockSize / SECTOR);
    const newSectors = Math.ceil(modifiedYtdBuf.length / SECTOR);

    if (newSectors > oldSectors) {
      return NextResponse.json({ 
        error: `La nueva textura hace que el archivo sea demasiado grande (${newSectors} vs ${oldSectors} sectores). No cabe en el hueco original.` 
      }, { status: 500 });
    }

    // Zero-pad to maintain exact original RPF file size and valid TOC
    const paddedBlock = Buffer.alloc(block.blockSize, 0);
    modifiedYtdBuf.copy(paddedBlock);

    const patchedRpf = Buffer.concat([
      origRpfBuf.slice(0, block.offset),
      paddedBlock,
      origRpfBuf.slice(block.offset + block.blockSize),
    ]);

    console.log(`[patch-rpf] Injection successful! Original RPF patched.`);

    return new NextResponse(patchedRpf, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${origRpfName}"`,
        'Content-Length':      patchedRpf.length.toString(),
      },
    });

  } catch (err) {
    console.error('[patch-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
