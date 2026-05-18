export const runtime = 'nodejs';    // must be Node.js, not Edge
export const maxDuration = 60;      // allow up to 60s for the exe

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';

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

// Builds a DDS header for uncompressed A8R8G8B8 pixel data
function buildDdsHeader(w, h, mipCount) {
  const buf = new ArrayBuffer(128);
  const dv  = new DataView(buf);
  let o = 0;
  dv.setUint32(o, 0x20534444, true); o += 4; // 'DDS '
  dv.setUint32(o, 124,        true); o += 4;
  // DDSD_CAPS|DDSD_HEIGHT|DDSD_WIDTH|DDSD_PIXELFORMAT|DDSD_MIPMAPCOUNT
  dv.setUint32(o, 0x21007,    true); o += 4;
  dv.setUint32(o, h,          true); o += 4;
  dv.setUint32(o, w,          true); o += 4;
  dv.setUint32(o, w * 4,      true); o += 4;
  dv.setUint32(o, 0,          true); o += 4;
  dv.setUint32(o, mipCount,   true); o += 4; // mip count
  for (let i = 0; i < 11; i++) { dv.setUint32(o, 0, true); o += 4; }
  dv.setUint32(o, 32,         true); o += 4;
  dv.setUint32(o, 0x41,       true); o += 4;
  dv.setUint32(o, 0,          true); o += 4;
  dv.setUint32(o, 32,         true); o += 4;
  dv.setUint32(o, 0x00FF0000, true); o += 4;
  dv.setUint32(o, 0x0000FF00, true); o += 4;
  dv.setUint32(o, 0x000000FF, true); o += 4;
  dv.setUint32(o, 0xFF000000, true); o += 4;
  // DDSCAPS_COMPLEX | DDSCAPS_MIPMAP | DDSCAPS_TEXTURE
  dv.setUint32(o, 0x401008,   true); o += 4;
  return Buffer.from(buf);
}

// Generate mip levels via box filter (halve each dimension, average 2x2 block)
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

// Converts RGBA base64 pixels → BGRA DDS with full mipmap chain (fixes black flicker in GTA V)
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

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      weaponName,
      width, height, pixels,
      // Suppressor (optional)
      suppName,                // e.g. "w_at_pi_supp"
      suppPixels,              // base64 RGBA, optional (null = use original texture)
      suppWidth, suppHeight,
    } = body;

    if (!weaponName || !pixels) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!fs.existsSync(PATCHER_EXE)) {
      return NextResponse.json(
        { error: `YtdPatcher no encontrado en: ${PATCHER_EXE}` },
        { status: 500 }
      );
    }

    const tmpDir = os.tmpdir();
    const tmpId  = Date.now();

    // ── Weapon DDS ──────────────────────────────────────────────────────
    let weaponDdsArg = 'none';
    let weaponDdsFile = null;
    if (pixels && pixels !== 'none') {
      weaponDdsFile = path.join(tmpDir, `lhc_weapon_${tmpId}.dds`);
      writeDds(pixels, width || 512, height || 512, weaponDdsFile);
      weaponDdsArg = weaponDdsFile;
    }

    // ── Suppressor DDS (optional) ────────────────────────────────────────
    let suppDdsArg = '';
    let suppNameArg = '';
    let suppDdsFile = null;

    if (suppName) {
      suppNameArg = suppName;
      if (suppPixels && suppPixels !== 'none') {
        suppDdsFile = path.join(tmpDir, `lhc_supp_${tmpId}.dds`);
        writeDds(suppPixels, suppWidth || 1024, suppHeight || 256, suppDdsFile);
        suppDdsArg = suppDdsFile;
      } else {
        suppDdsArg = 'none'; // include suppressor with original texture
      }
    }

    // ── Build command ────────────────────────────────────────────────────
    let cmd = `"${PATCHER_EXE}" "${weaponDdsArg}" "${weaponName}" "${ASSETS_DIR}"`;
    if (suppName) {
      cmd += ` "${suppDdsArg}" "${suppNameArg}"`;
    }

    console.log('[generate-rpf] CMD:', cmd.slice(0, 150));

    const execOptions = { maxBuffer: 2 * 1024 * 1024, cwd: tmpDir };
    if (IS_WINDOWS) execOptions.shell = 'cmd.exe';

    const { stdout, stderr } = await execAsync(cmd, execOptions);
    console.log('[generate-rpf] stdout:', stdout.slice(0, 500));
    if (stderr) console.warn('[generate-rpf] stderr:', stderr.slice(0, 300));
    console.log('[generate-rpf] tmpDir files:', fs.readdirSync(tmpDir).filter(f => f.startsWith('lhc_') || f.endsWith('.rpf') || f.endsWith('.ytd')));

    // ── Read result RPF ──────────────────────────────────────────────────
    const rpfPath = path.join(tmpDir, `${weaponName}.rpf`);
    if (!fs.existsSync(rpfPath)) {
      return NextResponse.json(
        { error: `RPF no generado. Log: ${stdout.slice(-400)}` },
        { status: 500 }
      );
    }

    const rpfBytes = fs.readFileSync(rpfPath);

    // Read standalone YTD files generated by our updated patcher
    const ytdPath = path.join(tmpDir, `${weaponName}.ytd`);
    let ytdBytes = null;
    if (fs.existsSync(ytdPath)) {
      ytdBytes = fs.readFileSync(ytdPath);
    }

    let suppYtdBytes = null;
    const suppYtdPath = suppName ? path.join(tmpDir, `${suppName}.ytd`) : null;
    if (suppYtdPath && fs.existsSync(suppYtdPath)) {
      suppYtdBytes = fs.readFileSync(suppYtdPath);
    }

    // Cleanup
    if (weaponDdsFile) try { fs.unlinkSync(weaponDdsFile); } catch {}
    try { fs.unlinkSync(rpfPath); } catch {}
    if (ytdPath && fs.existsSync(ytdPath)) try { fs.unlinkSync(ytdPath); } catch {}
    if (suppYtdPath && fs.existsSync(suppYtdPath)) try { fs.unlinkSync(suppYtdPath); } catch {}
    if (suppDdsFile) try { fs.unlinkSync(suppDdsFile); } catch {}

    // ── Wrap in ZIP ──────────────────────────────────────────────────────
    const zip = new JSZip();
    zip.file(`${weaponName}.rpf`, rpfBytes);
    // Include standalone suppressor YTD so FiveM can stream it separately from stream/
    if (suppYtdBytes && suppName) {
      zip.file(`${suppName}.ytd`, suppYtdBytes);
      console.log('[generate-rpf] suppressor YTD added to ZIP:', suppName + '.ytd');
    } else if (suppName) {
      console.log('[generate-rpf] suppressor YTD NOT found as standalone file');
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
        'Content-Disposition': `attachment; filename="${weaponName}.zip"`,
        'Content-Length':      zipBytes.length.toString(),
      },
    });

  } catch (err) {
    console.error('[generate-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
