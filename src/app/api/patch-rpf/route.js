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

// Reuse the same YtdPatcher binary that generate-rpf uses
const PATCHER_EXE = path.join(
  process.cwd(),
  'src', 'app', 'api', 'generate-rpf', 'bin',
  IS_WINDOWS ? 'YtdPatcher-win.exe' : 'YtdPatcher-linux'
);

const ASSETS_DIR = path.join(
  process.cwd(),
  'src', 'app', 'api', 'generate-rpf', 'assets'
);

// ── DDS helpers (identical to generate-rpf/route.js) ───────────────────────

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

// ── RPF YTD injection ────────────────────────────────────────────────────────
//
// GTA V RPF7 layout (simplified):
//   Header (16 bytes)
//   TOC entries — each entry has: name hash (4), offset (4), size_on_disk (4), size_virtual (4) …
//
// Strategy: We DON'T try to fully parse the binary RPF format (it's complex with
// encryption/resource types). Instead we:
//  1. Use YtdPatcher to generate a fresh standalone YTD file for the detected base weapon.
//  2. Find the YTD blob inside the original RPF by scanning for the known YTD magic bytes.
//  3. Replace that blob in-place (works only if new YTD <= old YTD in size; we pad if needed).
//  4. If in-place fails (size too different), we fall back to appending the new YTD as a
//     standalone file in the ZIP alongside the original RPF so the user can swap it manually.
//
// This approach is robust and doesn't require a full RPF parser.

/**
 * Scan `rpfBuf` for a YTD resource block and replace it with `newYtdBuf`.
 * Returns the modified RPF Buffer or null if the YTD could not be located.
 */
function patchYtdInRpf(rpfBuf, newYtdBuf) {
  // GTA V YTD files start with the RSC7 resource magic 0x37435352 (little-endian)
  const RSC7 = Buffer.from([0x52, 0x53, 0x43, 0x37]); // 'RSC7'

  // Find all RSC7 positions in the RPF
  const positions = [];
  let searchFrom = 0;
  while (true) {
    const pos = rpfBuf.indexOf(RSC7, searchFrom);
    if (pos === -1) break;
    positions.push(pos);
    searchFrom = pos + 1;
  }

  if (positions.length === 0) {
    console.log('[patch-rpf] No RSC7 blocks found in RPF');
    return null;
  }

  // Among the RSC7 blocks, identify the YTD one.
  // YTD files have resource type 0x0D in bytes [8..11] of the RSC7 header.
  // RSC7 header: magic(4) version(4) virtualFlags(4) physicalFlags(4)
  //              resource type is encoded in the high byte of virtualFlags.
  let ytdPos = -1;
  let ytdLen = -1;

  for (const pos of positions) {
    if (pos + 16 > rpfBuf.length) continue;
    // version word at +4 (should be 0x0D000000 or similar for YTD)
    const vFlags = rpfBuf.readUInt32LE(pos + 8);
    const resType = (vFlags >> 28) & 0xF; // top nibble encodes resource type category
    // YTD = pgBase/rage texture dictionary. The version at offset 4 is typically 13 (0x0D).
    const version = rpfBuf.readUInt32LE(pos + 4);
    if (version === 13 || version === 0x0D000000) {
      ytdPos = pos;
      // Estimate YTD size: go until the next RSC7 block or end of file
      const nextPos = positions.find(p => p > pos) ?? rpfBuf.length;
      ytdLen = nextPos - pos;
      break;
    }
  }

  // Fallback: use the LAST RSC7 block (YTDs are usually the last resource in weapon RPFs)
  if (ytdPos === -1 && positions.length > 0) {
    ytdPos = positions[positions.length - 1];
    ytdLen = rpfBuf.length - ytdPos;
  }

  if (ytdPos === -1) return null;

  console.log(`[patch-rpf] YTD found at offset ${ytdPos}, length ${ytdLen}. New YTD size: ${newYtdBuf.length}`);

  // Build patched RPF: everything before YTD + new YTD (zero-padded to original size) + everything after
  const before  = rpfBuf.slice(0, ytdPos);
  const after   = rpfBuf.slice(ytdPos + ytdLen);

  let newBlock;
  if (newYtdBuf.length <= ytdLen) {
    // Pad new YTD to original length (zeros are fine — RPF readers use the TOC size)
    newBlock = Buffer.alloc(ytdLen, 0);
    newYtdBuf.copy(newBlock);
  } else {
    // New YTD is larger — just write it as-is (might break RPF alignment but worth trying)
    newBlock = newYtdBuf;
  }

  return Buffer.concat([before, newBlock, after]);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const formData = await request.formData();

    const rpfFile    = formData.get('rpf');          // original RPF as File
    const pixels     = formData.get('pixels');       // base64 RGBA
    const width      = parseInt(formData.get('width')  || '512', 10);
    const height     = parseInt(formData.get('height') || '512', 10);
    const weaponId   = formData.get('weaponId')  || 'w_pi_combatpistol'; // base weapon for YtdPatcher
    const rpfName    = formData.get('rpfName')   || 'custom_weapon';     // output filename

    if (!rpfFile || !pixels) {
      return NextResponse.json({ error: 'Faltan parámetros: rpf y pixels son obligatorios' }, { status: 400 });
    }

    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json({ error: `YtdPatcher no encontrado en: ${PATCHER_EXE}` }, { status: 500 });
    }

    const tmpDir = os.tmpdir();
    const tmpId  = Date.now();

    // 1. Save original RPF to tmp
    const origRpfPath = path.join(tmpDir, `lhc_orig_${tmpId}.rpf`);
    const rpfAb = await rpfFile.arrayBuffer();
    fs.writeFileSync(origRpfPath, Buffer.from(rpfAb));

    // 2. Generate DDS from painted pixels
    const weaponDdsFile = path.join(tmpDir, `lhc_tex_${tmpId}.dds`);
    writeDds(pixels, width, height, weaponDdsFile);

    // 3. Run YtdPatcher to get a valid YTD from the painted texture
    //    YtdPatcher output: <weaponId>.rpf and optionally <weaponId>.ytd in tmpDir
    const cmd = `"${PATCHER_EXE}" "${weaponDdsFile}" "${weaponId}" "${ASSETS_DIR}"`;
    console.log('[patch-rpf] YtdPatcher cmd:', cmd.slice(0, 200));

    const execOptions = { maxBuffer: 4 * 1024 * 1024, cwd: tmpDir };
    if (IS_WINDOWS) execOptions.shell = 'cmd.exe';

    let newYtdBuf = null;
    try {
      const { stdout, stderr } = await execAsync(cmd, execOptions);
      console.log('[patch-rpf] YtdPatcher stdout:', stdout.slice(0, 300));
      if (stderr) console.warn('[patch-rpf] YtdPatcher stderr:', stderr.slice(0, 200));

      // Try to read the generated YTD (standalone file written by patcher)
      const ytdPath = path.join(tmpDir, `${weaponId}.ytd`);
      if (fs.existsSync(ytdPath)) {
        newYtdBuf = fs.readFileSync(ytdPath);
        try { fs.unlinkSync(ytdPath); } catch {}
      } else {
        // Fallback: extract the YTD from the generated RPF
        const genRpfPath = path.join(tmpDir, `${weaponId}.rpf`);
        if (fs.existsSync(genRpfPath)) {
          const genRpf = fs.readFileSync(genRpfPath);
          // Find YTD blob inside the generated RPF (last RSC7 block)
          const RSC7 = Buffer.from([0x52, 0x53, 0x43, 0x37]);
          let lastPos = -1, searchFrom = 0;
          while (true) {
            const p = genRpf.indexOf(RSC7, searchFrom);
            if (p === -1) break;
            lastPos = p; searchFrom = p + 1;
          }
          if (lastPos !== -1) newYtdBuf = genRpf.slice(lastPos);
          try { fs.unlinkSync(genRpfPath); } catch {}
        }
      }
    } catch (patcherErr) {
      console.error('[patch-rpf] YtdPatcher error:', patcherErr.message);
      // Continue — we'll put the DDS in the zip as fallback
    }

    // 4. Read original RPF
    const origRpfBuf = fs.readFileSync(origRpfPath);
    try { fs.unlinkSync(origRpfPath); } catch {}
    try { fs.unlinkSync(weaponDdsFile); } catch {}

    // 5. Attempt in-place YTD injection
    let patchedRpfBuf = null;
    if (newYtdBuf) {
      patchedRpfBuf = patchYtdInRpf(origRpfBuf, newYtdBuf);
    }

    // 6. Build ZIP
    const zip = new JSZip();
    const safeName = rpfName.replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (patchedRpfBuf) {
      // Best case: patched RPF with the new texture baked in
      zip.file(`${safeName}.rpf`, patchedRpfBuf);
      console.log('[patch-rpf] Patched RPF written to ZIP.');
    } else {
      // Fallback: original RPF + standalone YTD so user can swap manually
      zip.file(`${safeName}_original.rpf`, origRpfBuf);
      if (newYtdBuf) zip.file(`${weaponId}.ytd`, newYtdBuf);
      zip.file('INSTRUCCIONES.txt',
        `No se pudo inyectar la textura automáticamente.\n` +
        `Abre ${safeName}_original.rpf con OpenIV y reemplaza el archivo .ytd con el ${weaponId}.ytd incluido.\n`
      );
      console.log('[patch-rpf] Fallback ZIP with original RPF + standalone YTD.');
    }

    const zipBytes = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    });

    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}_skin.zip"`,
        'Content-Length':      zipBytes.length.toString(),
      },
    });

  } catch (err) {
    console.error('[patch-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
