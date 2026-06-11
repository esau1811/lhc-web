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

// ── RPF7 YTD block finder ─────────────────────────────────────────────────────
//
// RPF7 layout:
//   [0..15]  Header: magic(4) tocSize(4) numEntries(4) encryption(4)
//   [16 .. 16+tocSize-1]  TOC: entries(numEntries×16) + name table
//   [dataStart ..]  Data area: RSC7 resource blocks, each at 512-byte boundary
//
// RSC7 resource header (16 bytes):
//   [0..3]   magic    = 0x52534337  ('RSC7' as bytes: 52 53 43 37, readUInt32LE = 0x37435352)
//   [4..7]   version
//   [8..11]  virtualFlags  (system/CPU memory footprint, high 4 bits = size bucket)
//   [12..15] physicalFlags (GPU/VRAM memory footprint, high 4 bits = size bucket)
//
// YTD (texture dictionary) has HIGH physicalFlags (textures live in GPU memory).
// YDR (model) has HIGH virtualFlags (geometry lives in CPU memory).
// → We identify the YTD by finding the RSC7 block with the largest physical footprint.
//
// Block boundaries: each RSC7 block starts at a 512-byte aligned offset within the data area.
// Block size = distance to the next RSC7-at-512B or to EOF.

const RSC7_LE = 0x37435352; // readUInt32LE of bytes [0x52,0x53,0x43,0x37]

function findYtdBlock(rpfBuf) {
  if (rpfBuf.length < 16) return null;
  if (rpfBuf.readUInt32LE(0) !== 0x52504637) return null; // not RPF7

  const tocSize  = rpfBuf.readUInt32LE(4);
  const tocEnd   = 16 + tocSize;
  // Data area starts after TOC, aligned to the next 512-byte boundary
  const dataStart = Math.ceil(tocEnd / 512) * 512;

  if (dataStart >= rpfBuf.length) return null;

  // ── Collect all RSC7 blocks at 512-byte boundaries within data area ──────
  const blocks = [];
  for (let pos = dataStart; pos + 16 <= rpfBuf.length; pos += 512) {
    if (rpfBuf.readUInt32LE(pos) !== RSC7_LE) continue;
    const physFlags = rpfBuf.readUInt32LE(pos + 12);
    const physEst   = (physFlags & 0x0FFFFFFF) * 512;
    blocks.push({ offset: pos, physEst });
  }

  if (blocks.length === 0) return null;

  // ── Find the block with the highest physical footprint = the YTD ─────────
  blocks.sort((a, b) => b.physEst - a.physEst);
  const ytd = blocks[0];

  // Block size = distance to the next RSC7 block OR to EOF
  const nextBlock = blocks
    .map(b => b.offset)
    .filter(o => o > ytd.offset)
    .sort((a, b) => a - b)[0];

  const blockSize = (nextBlock ?? rpfBuf.length) - ytd.offset;

  console.log(`[findYtdBlock] dataStart=0x${dataStart.toString(16)} ` +
    `ytdOffset=0x${ytd.offset.toString(16)} blockSize=${blockSize} physEst=${ytd.physEst}`);

  return { offset: ytd.offset, blockSize };
}

// ── In-place YTD replacement with zero-padding ────────────────────────────────
//
// The RPF TOC stores resource sizes in 512-byte sectors. As long as the new YTD
// fits within the same number of sectors as the old one, the TOC stays valid.
// Any trailing zeros are ignored by GTA V (the RSC7 header tells it how much data
// to actually consume).

function patchYtdInRpf(rpfBuf, newYtdBuf) {
  const block = findYtdBlock(rpfBuf);
  if (!block) return { buf: null, reason: 'YTD block not found in RPF data area' };

  const { offset, blockSize } = block;
  const SECTOR = 512;
  const oldSectors = Math.ceil(blockSize   / SECTOR);
  const newSectors = Math.ceil(newYtdBuf.length / SECTOR);

  console.log(`[patchYtdInRpf] blockSize=${blockSize} (${oldSectors} sectors), newYtdSize=${newYtdBuf.length} (${newSectors} sectors)`);

  if (newSectors > oldSectors) {
    return {
      buf: null,
      reason: `New YTD (${newYtdBuf.length}B, ${newSectors} sectors) is larger than old block (${blockSize}B, ${oldSectors} sectors). Cannot patch in-place.`
    };
  }

  // Zero-pad new YTD to exactly fill the old block (maintains exact file size)
  const paddedBlock = Buffer.alloc(blockSize, 0);
  newYtdBuf.copy(paddedBlock);

  const patched = Buffer.concat([
    rpfBuf.slice(0, offset),
    paddedBlock,
    rpfBuf.slice(offset + blockSize),
  ]);

  return { buf: patched, reason: null };
}

// ── Generate a valid GTA V YTD via YtdPatcher ─────────────────────────────────

async function generateNewYtd(ddsPath, weaponId, tmpDir) {
  const cmd = `"${PATCHER_EXE}" "${ddsPath}" "${weaponId}" "${ASSETS_DIR}"`;
  console.log('[patch-rpf] YtdPatcher:', cmd.slice(0, 180));
  const opts = { maxBuffer: 8 * 1024 * 1024, cwd: tmpDir };
  if (IS_WINDOWS) opts.shell = 'cmd.exe';
  const { stdout, stderr } = await execAsync(cmd, opts);
  console.log('[patch-rpf] stdout:', stdout.slice(0, 300));
  if (stderr) console.warn('[patch-rpf] stderr:', stderr.slice(0, 200));

  // Prefer standalone .ytd written by patcher
  const ytdPath = path.join(tmpDir, `${weaponId}.ytd`);
  if (fs.existsSync(ytdPath)) {
    const buf = fs.readFileSync(ytdPath);
    try { fs.unlinkSync(ytdPath); } catch {}
    return buf;
  }

  // Fallback: extract YTD RSC7 block from generated RPF
  const rpfPath = path.join(tmpDir, `${weaponId}.rpf`);
  if (fs.existsSync(rpfPath)) {
    const genRpf = fs.readFileSync(rpfPath);
    try { fs.unlinkSync(rpfPath); } catch {}
    const block = findYtdBlock(genRpf);
    if (block) return genRpf.slice(block.offset);
  }

  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  const tmpDir = path.join(os.tmpdir(), `lhc_patch_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
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

    // 1. Read original RPF
    const origRpfBuf  = Buffer.from(await rpfFile.arrayBuffer());
    const origRpfName = (rpfFile.name || `${ytdName}.rpf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    // 2. Generate DDS from painted pixels
    const ddsPath = path.join(tmpDir, 'skin.dds');
    writeDds(pixels, width, height, ddsPath);

    // 3. Use YtdPatcher + STOCK assets to generate a valid GTA V YTD
    const stockId = fs.existsSync(path.join(ASSETS_DIR, `${ytdName}.ytd`))
      ? ytdName : 'w_pi_combatpistol';
    const newYtdBuf = await generateNewYtd(ddsPath, stockId, tmpDir);
    try { fs.unlinkSync(ddsPath); } catch {}

    if (!newYtdBuf) {
      return NextResponse.json({ error: 'YtdPatcher no generó el YTD' }, { status: 500 });
    }

    // 4. Inject the new YTD into the user's RPF
    const { buf: patchedRpf, reason } = patchYtdInRpf(origRpfBuf, newYtdBuf);

    if (!patchedRpf) {
      console.error('[patch-rpf] Patch failed:', reason);
      return NextResponse.json({
        error: `No se pudo reemplazar el YTD en el RPF: ${reason}`
      }, { status: 500 });
    }

    console.log(`[patch-rpf] Patched RPF: ${origRpfName} (${patchedRpf.length} bytes)`);

    return new NextResponse(patchedRpf, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${origRpfName}"`,
        'Content-Length':      patchedRpf.length.toString(),
      },
    });

  } catch (err) {
    console.error('[patch-rpf] error:', err.message, err.stack?.slice(0, 500));
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
