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

// ── DDS helpers (identical to generate-rpf/route.js) ────────────────────────

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

// ── Find the YTD RSC7 block inside an RPF buffer ─────────────────────────────
//
// GTA V resources embedded in RPFs start with the 'RSC7' magic (4 bytes).
// After that comes a 12-byte header:
//   [4]  uint32 version
//   [8]  uint32 virtualFlags  (virtual/system memory footprint)
//   [12] uint32 physicalFlags (physical/GPU memory footprint)
//
// Textures (YTD) live PRIMARILY in physical memory → physicalFlags is large.
// Models  (YDR) live PRIMARILY in virtual  memory → virtualFlags  is large.
//
// Strategy: scan for all RSC7 blocks; the one with the highest physical
// memory footprint is the YTD.

const RSC7_MAGIC = Buffer.from([0x52, 0x53, 0x43, 0x37]); // 'RSC7'

function findYtdOffsetInRpf(rpfBuf) {
  let bestOffset  = -1;
  let bestPhys    = 0;
  let searchFrom  = 0;

  while (true) {
    const pos = rpfBuf.indexOf(RSC7_MAGIC, searchFrom);
    if (pos === -1) break;

    if (pos + 16 <= rpfBuf.length) {
      // physicalFlags at offset +12 from RSC7 magic
      // Lower 28 bits × 512 ≈ physical memory footprint in bytes
      const physFlags = rpfBuf.readUInt32LE(pos + 12);
      const physEst   = (physFlags & 0x0FFFFFFF) * 512;

      if (physEst > bestPhys) {
        bestPhys   = physEst;
        bestOffset = pos;
      }
    }
    searchFrom = pos + 1;
  }

  return { offset: bestOffset, physSize: bestPhys };
}

// ── In-place YTD replacement ─────────────────────────────────────────────────
//
// The YTD block runs from its RSC7 offset to the end of the RPF file
// (weapon RPFs contain exactly the model YDR + texture YTD; YTD is always last).
//
// Replacement rules:
//  • new ≤ old → write new bytes, zero-pad remainder → file size unchanged ✓
//  • new > old by ≤ 512 bytes → likely same sector count; just write it ✓
//  • new >> old → would require TOC sector-count update → return null (fallback)

function patchYtdInRpf(rpfBuf, newYtdBuf) {
  const { offset, physSize } = findYtdOffsetInRpf(rpfBuf);
  if (offset === -1) {
    console.log('[patchYtdInRpf] No RSC7 block found');
    return null;
  }

  const oldSize = rpfBuf.length - offset;
  console.log(`[patchYtdInRpf] YTD at 0x${offset.toString(16)}, physEst=${physSize}, oldSize=${oldSize}, newSize=${newYtdBuf.length}`);

  // Sector alignment: GTA V aligns resources to 512-byte boundaries in RPF
  const SECTOR = 512;
  const oldSectors = Math.ceil(oldSize  / SECTOR);
  const newSectors = Math.ceil(newYtdBuf.length / SECTOR);

  const before = rpfBuf.slice(0, offset);
  let   block;

  if (newSectors <= oldSectors) {
    // Same or fewer sectors → zero-pad to original size; RPF TOC untouched ✓
    block = Buffer.alloc(oldSize, 0);
    newYtdBuf.copy(block);
  } else {
    // More sectors needed → TOC sector count would need updating.
    // Too risky without a full RPF7 parser; return null to trigger fallback.
    console.log(`[patchYtdInRpf] New YTD sector count (${newSectors}) > old (${oldSectors}), falling back`);
    return null;
  }

  return Buffer.concat([before, block]);
}

// ── Run YtdPatcher and return the new YTD bytes ──────────────────────────────

async function generateNewYtd(ddsPath, weaponId, tmpDir) {
  const cmd = `"${PATCHER_EXE}" "${ddsPath}" "${weaponId}" "${ASSETS_DIR}"`;
  console.log('[patch-rpf] YtdPatcher cmd:', cmd.slice(0, 200));

  const execOptions = { maxBuffer: 8 * 1024 * 1024, cwd: tmpDir };
  if (IS_WINDOWS) execOptions.shell = 'cmd.exe';

  const { stdout, stderr } = await execAsync(cmd, execOptions);
  console.log('[patch-rpf] stdout:', stdout.slice(0, 300));
  if (stderr) console.warn('[patch-rpf] stderr:', stderr.slice(0, 200));

  // Prefer standalone YTD output
  const ytdPath = path.join(tmpDir, `${weaponId}.ytd`);
  if (fs.existsSync(ytdPath)) {
    const buf = fs.readFileSync(ytdPath);
    try { fs.unlinkSync(ytdPath); } catch {}
    return buf;
  }

  // Fall back: extract YTD from the generated stock RPF
  const genRpfPath = path.join(tmpDir, `${weaponId}.rpf`);
  if (fs.existsSync(genRpfPath)) {
    const genRpf = fs.readFileSync(genRpfPath);
    try { fs.unlinkSync(genRpfPath); } catch {}
    const { offset } = findYtdOffsetInRpf(genRpf);
    if (offset !== -1) return genRpf.slice(offset);
  }

  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  const tmpDir = path.join(os.tmpdir(), `lhc_patch_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const formData = await request.formData();

    const rpfFile = formData.get('rpf');       // user's original RPF
    const pixels  = formData.get('pixels');    // base64 RGBA
    const width   = parseInt(formData.get('width')   || '512', 10);
    const height  = parseInt(formData.get('height')  || '512', 10);
    // weaponId: base stock weapon id used to generate the YTD template via YtdPatcher
    // (must exist in ASSETS_DIR as [weaponId].ytd)
    const weaponId = (formData.get('ytdName') || formData.get('weaponId') || 'w_pi_combatpistol')
      .replace(/\.ytd$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (!rpfFile || !pixels) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json({ error: `YtdPatcher no encontrado` }, { status: 500 });
    }

    // 1. Save the user's RPF
    const origRpfBuf = Buffer.from(await rpfFile.arrayBuffer());

    // 2. Generate DDS from painted pixels
    const ddsPath = path.join(tmpDir, 'lhc_tex.dds');
    writeDds(pixels, width, height, ddsPath);

    // 3. Use YtdPatcher + STOCK assets to create a valid new YTD
    //    (we use the stock weapon template from ASSETS_DIR to produce a
    //    correctly-formatted YTD, then inject it into the user's RPF)
    const fallbackId = fs.existsSync(path.join(ASSETS_DIR, `${weaponId}.ytd`))
      ? weaponId
      : 'w_pi_combatpistol';

    const newYtdBuf = await generateNewYtd(ddsPath, fallbackId, tmpDir);
    try { fs.unlinkSync(ddsPath); } catch {}

    if (!newYtdBuf) {
      return NextResponse.json({ error: 'YtdPatcher no generó el YTD' }, { status: 500 });
    }

    // 4. Inject the new YTD into the user's RPF
    const patchedRpfBuf = patchYtdInRpf(origRpfBuf, newYtdBuf);

    if (!patchedRpfBuf) {
      // Fallback: can't patch (sizes incompatible). Return standalone YTD
      // with a header that tells the client to inform the user.
      console.warn('[patch-rpf] In-place patch failed, returning standalone YTD');
      const outName = (weaponId + '.ytd').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      return new NextResponse(newYtdBuf, {
        status: 200,
        headers: {
          'Content-Type':        'application/octet-stream',
          'Content-Disposition': `attachment; filename="${outName}"`,
          'Content-Length':      newYtdBuf.length.toString(),
          'X-Patch-Mode':        'ytd-only', // client can show instructions
        },
      });
    }

    // 5. Return the patched RPF with the same filename
    const outFilename = (rpfFile.name || `${weaponId}.rpf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    console.log(`[patch-rpf] Returning patched RPF: ${outFilename} (${patchedRpfBuf.length} bytes)`);

    return new NextResponse(patchedRpfBuf, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${outFilename}"`,
        'Content-Length':      patchedRpfBuf.length.toString(),
        'X-Patch-Mode':        'rpf-patched',
      },
    });

  } catch (err) {
    console.error('[patch-rpf] error:', err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
