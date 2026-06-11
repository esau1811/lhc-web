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

// ── fxmanifest.lua generator ─────────────────────────────────────────────────
function buildFxManifest(resourceName) {
  return `fx_version 'cerulean'
game 'gta5'
description 'LHC SkinForge - Custom weapon skin for ${resourceName}'
version '1.0.0'

files {
  'stream/**'
}
`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const formData = await request.formData();

    const rpfFile    = formData.get('rpf');          // original RPF as File
    const pixels     = formData.get('pixels');       // base64 RGBA
    const width      = parseInt(formData.get('width')  || '512', 10);
    const height     = parseInt(formData.get('height') || '512', 10);
    const weaponId   = formData.get('weaponId')  || 'w_pi_combatpistol';
    const rpfName    = formData.get('rpfName')   || 'custom_weapon';
    // ytdName: name of the YTD file inside the user's RPF (detected client-side)
    // Falls back to the base weapon id if not provided.
    const ytdNameRaw = formData.get('ytdName')   || weaponId;
    // Strip path separators and extension so we just have the base name
    const ytdBaseName = ytdNameRaw
      .replace(/.*[\\/]/, '')   // strip directory
      .replace(/\.ytd$/i, '')   // strip extension
      || weaponId;

    if (!rpfFile || !pixels) {
      return NextResponse.json(
        { error: 'Faltan parámetros: rpf y pixels son obligatorios' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json(
        { error: `YtdPatcher no encontrado: ${PATCHER_EXE}` },
        { status: 500 }
      );
    }

    const tmpDir = os.tmpdir();
    const tmpId  = Date.now();

    // 1. Save original RPF (we include it unchanged in the resource)
    const origRpfPath = path.join(tmpDir, `lhc_orig_${tmpId}.rpf`);
    const rpfAb = await rpfFile.arrayBuffer();
    fs.writeFileSync(origRpfPath, Buffer.from(rpfAb));

    // 2. Generate DDS from painted pixels
    const weaponDdsFile = path.join(tmpDir, `lhc_tex_${tmpId}.dds`);
    writeDds(pixels, width, height, weaponDdsFile);

    // 3. Run YtdPatcher to produce a valid GTA V YTD from the painted texture
    const cmd = `"${PATCHER_EXE}" "${weaponDdsFile}" "${weaponId}" "${ASSETS_DIR}"`;
    console.log('[patch-rpf] YtdPatcher cmd:', cmd.slice(0, 200));

    const execOptions = { maxBuffer: 4 * 1024 * 1024, cwd: tmpDir };
    if (IS_WINDOWS) execOptions.shell = 'cmd.exe';

    let newYtdBuf = null;
    let ytdReadError = null;

    try {
      const { stdout, stderr } = await execAsync(cmd, execOptions);
      console.log('[patch-rpf] stdout:', stdout.slice(0, 300));
      if (stderr) console.warn('[patch-rpf] stderr:', stderr.slice(0, 200));

      // Try standalone YTD first
      const ytdPath = path.join(tmpDir, `${weaponId}.ytd`);
      if (fs.existsSync(ytdPath)) {
        newYtdBuf = fs.readFileSync(ytdPath);
        try { fs.unlinkSync(ytdPath); } catch {}
      } else {
        // Fallback: extract YTD bytes from the generated RPF
        // YTD data starts at the last RSC7 magic ('RSC7') in the generated RPF
        const genRpfPath = path.join(tmpDir, `${weaponId}.rpf`);
        if (fs.existsSync(genRpfPath)) {
          const genRpf = fs.readFileSync(genRpfPath);
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
    } catch (e) {
      ytdReadError = e.message;
      console.error('[patch-rpf] YtdPatcher error:', e.message);
    }

    // 4. Read original RPF bytes
    const origRpfBuf = fs.readFileSync(origRpfPath);
    try { fs.unlinkSync(origRpfPath); } catch {}
    try { fs.unlinkSync(weaponDdsFile); } catch {}

    if (!newYtdBuf) {
      return NextResponse.json(
        { error: `No se pudo generar el YTD. ${ytdReadError || 'YtdPatcher no produjo salida.'}` },
        { status: 500 }
      );
    }

    // 5. Build a proper FiveM resource ZIP
    //
    // Structure:
    //   [rpfName]/
    //     fxmanifest.lua
    //     stream/
    //       [originalRpfFile].rpf   <-- original unchanged (3D model)
    //       [ytdBaseName].ytd       <-- new painted texture
    //
    // FiveM will load both. The YTD overrides the texture for the weapon
    // while the RPF provides the custom 3D model.
    //
    const safeResource = rpfName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeRpfName  = (rpfFile.name || `${safeResource}.rpf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const safeYtdName  = ytdBaseName.replace(/[^a-zA-Z0-9_\-]/g, '_');

    const zip = new JSZip();
    const resourceFolder = zip.folder(safeResource);
    resourceFolder.file('fxmanifest.lua', buildFxManifest(safeResource));
    const streamFolder = resourceFolder.folder('stream');
    streamFolder.file(safeRpfName, origRpfBuf);
    streamFolder.file(`${safeYtdName}.ytd`, newYtdBuf);

    const zipBytes = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    });

    console.log(`[patch-rpf] FiveM resource ZIP built: ${safeResource}/ (rpf=${safeRpfName}, ytd=${safeYtdName}.ytd)`);

    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${safeResource}_skin.zip"`,
        'Content-Length':      zipBytes.length.toString(),
      },
    });

  } catch (err) {
    console.error('[patch-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
