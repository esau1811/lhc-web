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
function buildDdsHeader(w, h) {
  const buf = new ArrayBuffer(128);
  const dv  = new DataView(buf);
  let o = 0;
  dv.setUint32(o, 0x20534444, true); o += 4; // 'DDS '
  dv.setUint32(o, 124,        true); o += 4;
  dv.setUint32(o, 0x1007,     true); o += 4;
  dv.setUint32(o, h,          true); o += 4;
  dv.setUint32(o, w,          true); o += 4;
  dv.setUint32(o, w * 4,      true); o += 4;
  dv.setUint32(o, 0,          true); o += 4;
  dv.setUint32(o, 1,          true); o += 4;
  for (let i = 0; i < 11; i++) { dv.setUint32(o, 0, true); o += 4; }
  dv.setUint32(o, 32,         true); o += 4;
  dv.setUint32(o, 0x41,       true); o += 4;
  dv.setUint32(o, 0,          true); o += 4;
  dv.setUint32(o, 32,         true); o += 4;
  dv.setUint32(o, 0x00FF0000, true); o += 4;
  dv.setUint32(o, 0x0000FF00, true); o += 4;
  dv.setUint32(o, 0x000000FF, true); o += 4;
  dv.setUint32(o, 0xFF000000, true); o += 4;
  dv.setUint32(o, 0x1000,     true); o += 4;
  return Buffer.from(buf);
}

// Converts RGBA base64 pixels → BGRA DDS file on disk
function writeDds(pixelsB64, w, h, filePath) {
  const rgba = Buffer.from(pixelsB64, 'base64');
  const bgra = Buffer.alloc(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    bgra[i]     = rgba[i + 2];
    bgra[i + 1] = rgba[i + 1];
    bgra[i + 2] = rgba[i];
    bgra[i + 3] = rgba[i + 3];
  }
  fs.writeFileSync(filePath, Buffer.concat([buildDdsHeader(w, h), bgra]));
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
    if (suppName) cmd += ` "${suppDdsArg}" "${suppNameArg}"`;

    console.log('[generate-rpf] CMD:', cmd.slice(0, 150));

    const execOptions = { maxBuffer: 2 * 1024 * 1024, cwd: tmpDir };
    if (IS_WINDOWS) execOptions.shell = 'cmd.exe';

    const { stdout, stderr } = await execAsync(cmd, execOptions);
    console.log('[generate-rpf] stdout:', stdout.slice(0, 500));
    if (stderr) console.warn('[generate-rpf] stderr:', stderr.slice(0, 300));

    // ── Read result RPF ──────────────────────────────────────────────────
    const rpfPath = path.join(tmpDir, `${weaponName}.rpf`);
    if (!fs.existsSync(rpfPath)) {
      return NextResponse.json(
        { error: `RPF no generado. Log: ${stdout.slice(-400)}` },
        { status: 500 }
      );
    }

    const rpfBytes = fs.readFileSync(rpfPath);

    // Cleanup
    if (weaponDdsFile) try { fs.unlinkSync(weaponDdsFile); } catch {}
    try { fs.unlinkSync(rpfPath); }     catch {}
    if (suppDdsFile) try { fs.unlinkSync(suppDdsFile); } catch {}

    // ── Wrap in ZIP ──────────────────────────────────────────────────────
    const zip = new JSZip();
    zip.file(`mods/${weaponName}.rpf`, rpfBytes);
    const zipBytes = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    });

    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${weaponName}_skin.zip"`,
        'Content-Length':      zipBytes.length.toString(),
      },
    });

  } catch (err) {
    console.error('[generate-rpf] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
