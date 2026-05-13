#!/usr/bin/env node
// Converts CodeWalker YDR XML exports to OBJ files for Three.js
// Usage: node ydr_xml_to_obj.js

const fs   = require('fs');
const path = require('path');

const PRUEBA_DIR  = path.join(__dirname, 'prueba');
const MODELS_DIR  = path.join(__dirname, 'public', 'models');

// Field sizes for each layout element type (number of space-separated values)
const FIELD_SIZES = {
  Position:      3,
  BlendWeights:  4,
  BlendIndices:  4,
  Normal:        3,
  Colour0:       4,
  Colour1:       4,
  TexCoord0:     2,
  TexCoord1:     2,
  TexCoord2:     2,
  TexCoord3:     2,
  Tangent:       4,
  Tangent2:      4,
  Binormal:      3,
};

// Weapons we need OBJ files for (already has one for combatpistol)
const WEAPONS = [
  'w_pi_combatpistol',
  'w_pi_pistol',
  'w_pi_pistolmk2',
  'w_pi_appistol',
  'w_pi_heavypistol',
  'w_pi_vintage_pistol',
  'w_sb_microsmg',
  'w_sb_smg',
  'w_sb_assaultsmg',
  'w_sb_smgmk2',
  'w_ar_assaultrifle',
  'w_ar_assaultriflemk2',
  'w_ar_carbinerifle',
  'w_ar_carbineriflemk2',
  'w_ar_advancedrifle',
  'w_ar_specialcarbine',
  'w_ar_bullpuprifle',
  'w_mg_combatmg',
  'w_mg_combatmgmk2',
  'w_mg_mg',
  'w_mg_minigun',
  'w_sg_pumpshotgun',
  'w_sg_assaultshotgun',
  'w_sg_bullpupshotgun',
  'w_sg_heavyshotgun',
  'w_sg_sawnoff',
  'w_sr_sniperrifle',
  'w_sr_heavysniper',
  'w_sr_heavysnipermk2',
  'w_sr_marksmanrifle',
  'w_lr_rpg',
  'w_lr_grenadelauncher',
];

function parseLayout(layoutBlock) {
  const fields = [];
  // Match each tag inside the Layout block
  const tagRe = /<(\w+)\s*\/>/g;
  let m;
  while ((m = tagRe.exec(layoutBlock)) !== null) {
    const name = m[1];
    if (FIELD_SIZES[name] !== undefined) {
      fields.push({ name, size: FIELD_SIZES[name] });
    }
  }
  return fields;
}

function convertXmlToObj(xmlPath, weaponId) {
  const xml = fs.readFileSync(xmlPath, 'utf8');

  // Collect all geometry blocks: each <GeometryInfo> or similar that has VertexBuffer+IndexBuffer pairs
  // In CodeWalker XML the structure is Geometries > Item > VertexBuffer + IndexBuffer
  // We extract all VertexBuffer/IndexBuffer pairs in order

  const posLines  = [];  // OBJ "v x y z"
  const uvLines   = [];  // OBJ "vt u v"
  const faceLines = [];  // OBJ "f v/vt v/vt v/vt"

  let globalVertexOffset = 0;

  // Split into VertexBuffer sections — each is paired with the following IndexBuffer
  // We'll find all <VertexBuffer>...</VertexBuffer> and their matching <IndexBuffer>
  const vbRe = /<VertexBuffer>([\s\S]*?)<\/VertexBuffer>/g;
  const ibRe = /<IndexBuffer>([\s\S]*?)<\/IndexBuffer>/g;

  const vbBlocks = [];
  const ibBlocks = [];
  let vm, im;
  while ((vm = vbRe.exec(xml)) !== null) vbBlocks.push(vm[1]);
  while ((im = ibRe.exec(xml)) !== null) ibBlocks.push(im[1]);

  const count = Math.min(vbBlocks.length, ibBlocks.length);

  for (let gi = 0; gi < count; gi++) {
    const vbContent = vbBlocks[gi];
    const ibContent = ibBlocks[gi];

    // Parse Layout to know field order
    const layoutMatch = vbContent.match(/<Layout[^>]*>([\s\S]*?)<\/Layout>/);
    if (!layoutMatch) continue;
    const fields = parseLayout(layoutMatch[1]);
    if (fields.length === 0) continue;

    // Find Position and TexCoord0 field offsets
    let posOffset   = -1;
    let uvOffset    = -1;
    let cursor      = 0;
    for (const f of fields) {
      if (f.name === 'Position')  posOffset = cursor;
      if (f.name === 'TexCoord0') uvOffset  = cursor;
      cursor += f.size;
    }
    const totalPerVertex = cursor;

    if (posOffset < 0) continue; // no position data

    // Parse vertex data lines
    const dataMatch = vbContent.match(/<Data>([\s\S]*?)<\/Data>/);
    if (!dataMatch) continue;

    const dataLines = dataMatch[1].trim().split('\n');
    const vertexStart = globalVertexOffset;
    let verticesAdded = 0;

    for (const line of dataLines) {
      const vals = line.trim().split(/\s+/);
      if (vals.length < totalPerVertex) continue;

      const x = parseFloat(vals[posOffset]);
      const y = parseFloat(vals[posOffset + 1]);
      const z = parseFloat(vals[posOffset + 2]);
      if (isNaN(x)) continue;

      posLines.push(`v ${x} ${y} ${z}`);

      if (uvOffset >= 0 && uvOffset + 1 < vals.length) {
        const u = parseFloat(vals[uvOffset]);
        const v = parseFloat(vals[uvOffset + 1]);
        uvLines.push(`vt ${u} ${v}`);
      } else {
        uvLines.push(`vt 0 0`);
      }

      verticesAdded++;
    }

    // Parse index buffer
    const idxDataMatch = ibContent.match(/<Data>([\s\S]*?)<\/Data>/);
    if (!idxDataMatch) { globalVertexOffset += verticesAdded; continue; }

    const allIndices = idxDataMatch[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n));

    // Triangles: groups of 3
    for (let i = 0; i + 2 < allIndices.length; i += 3) {
      const a = allIndices[i]     + vertexStart + 1; // OBJ is 1-based
      const b = allIndices[i + 1] + vertexStart + 1;
      const c = allIndices[i + 2] + vertexStart + 1;
      // Skip degenerate triangles
      if (a === b || b === c || a === c) continue;
      faceLines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
    }

    globalVertexOffset += verticesAdded;
  }

  if (posLines.length === 0) return false;

  const obj = [
    `# ${weaponId} — generated from CodeWalker YDR XML`,
    '',
    ...posLines,
    '',
    ...uvLines,
    '',
    ...faceLines,
  ].join('\n');

  const outPath = path.join(MODELS_DIR, `${weaponId}.obj`);
  fs.writeFileSync(outPath, obj, 'utf8');
  return true;
}

// ---- Main ----
if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

let ok = 0, skip = 0, missing = 0;

for (const id of WEAPONS) {
  const xmlPath = path.join(PRUEBA_DIR, `${id}.ydr.xml`);
  const objPath = path.join(MODELS_DIR, `${id}.obj`);

  if (!fs.existsSync(xmlPath)) {
    console.log(`  MISSING  ${id}.ydr.xml`);
    missing++;
    continue;
  }

  // Skip combatpistol — already has a hand-crafted OBJ
  if (id === 'w_pi_combatpistol' && fs.existsSync(objPath)) {
    console.log(`  SKIP     ${id} (already exists)`);
    skip++;
    continue;
  }

  try {
    const wrote = convertXmlToObj(xmlPath, id);
    if (wrote) {
      const size = fs.statSync(objPath).size;
      console.log(`  OK       ${id}.obj  (${(size/1024).toFixed(0)} KB)`);
      ok++;
    } else {
      console.log(`  EMPTY    ${id} — no vertex data found`);
      missing++;
    }
  } catch (e) {
    console.log(`  ERROR    ${id}: ${e.message}`);
    missing++;
  }
}

console.log(`\nDone: ${ok} generated, ${skip} skipped, ${missing} missing/failed`);
