#!/usr/bin/env node
// Converts CodeWalker YDR XML exports to OBJ files for Three.js
// Usage: node ydr_xml_to_obj.js

const fs   = require('fs');
const path = require('path');

const PRUEBA_DIR  = path.join(__dirname, 'prueba');
const MODELS_DIR  = path.join(__dirname, 'public', 'models');

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
  const tagRe = /<(\w+)\s*\/>/g;
  let m;
  while ((m = tagRe.exec(layoutBlock)) !== null) {
    const name = m[1];
    if (FIELD_SIZES[name] !== undefined) fields.push({ name, size: FIELD_SIZES[name] });
  }
  return fields;
}

// Build map: shaderIndex → DiffuseSampler texture name (lowercased, no underscores)
function parseShaderMap(xml) {
  const map = {};
  const shadersMatch = xml.match(/<Shaders>([\s\S]*?)<\/Shaders>/);
  if (!shadersMatch) return map;

  const itemRe = /<Item>([\s\S]*?)<\/Item>/g;
  let idx = 0;
  let m;
  while ((m = itemRe.exec(shadersMatch[1])) !== null) {
    const block = m[1];
    const diffuse = block.match(/<Item name="DiffuseSampler"[^>]*>[\s\S]*?<Name>(.*?)<\/Name>/);
    const texName = diffuse ? diffuse[1].toLowerCase().replace(/_/g, '') : '';
    map[idx] = texName;
    idx++;
  }
  return map;
}

// Split XML into Geometry <Item> blocks (each contains ShaderIndex + VertexBuffer + IndexBuffer)
function parseGeometryItems(xml) {
  const items = [];
  // Find all Geometries blocks
  const geoBlockRe = /<Geometries>([\s\S]*?)<\/Geometries>/g;
  let gb;
  while ((gb = geoBlockRe.exec(xml)) !== null) {
    const itemRe = /<Item>([\s\S]*?)<\/Item>/g;
    let im;
    while ((im = itemRe.exec(gb[1])) !== null) {
      const block = im[1];
      const siMatch = block.match(/<ShaderIndex value="(\d+)"/);
      const shaderIndex = siMatch ? parseInt(siMatch[1]) : 0;

      const vbMatch = block.match(/<VertexBuffer>([\s\S]*?)<\/VertexBuffer>/);
      const ibMatch = block.match(/<IndexBuffer>([\s\S]*?)<\/IndexBuffer>/);
      if (vbMatch && ibMatch) {
        items.push({ shaderIndex, vb: vbMatch[1], ib: ibMatch[1] });
      }
    }
  }
  return items;
}

function convertXmlToObj(xmlPath, weaponId) {
  const xml = fs.readFileSync(xmlPath, 'utf8');

  // Build shader index → texture name map
  const shaderMap = parseShaderMap(xml);

  // Weapon key: e.g. "w_pi_heavypistol" → "wpiheavypistol"
  const weaponKey = weaponId.toLowerCase().replace(/_/g, '');

  // Determine which shader indices use the main weapon diffuse texture
  const mainShaderIndices = new Set();
  for (const [idx, texName] of Object.entries(shaderMap)) {
    if (texName.startsWith(weaponKey)) {
      mainShaderIndices.add(parseInt(idx));
    }
  }

  // If no shader matched (e.g. unusual naming), fall back to including all
  const filterByShader = mainShaderIndices.size > 0;

  const posLines  = [];
  const uvLines   = [];
  const faceLines = [];
  let globalVertexOffset = 0;

  const geoItems = parseGeometryItems(xml);

  for (const { shaderIndex, vb, ib } of geoItems) {
    // Skip geometry that doesn't use the main weapon texture
    if (filterByShader && !mainShaderIndices.has(shaderIndex)) continue;

    const layoutMatch = vb.match(/<Layout[^>]*>([\s\S]*?)<\/Layout>/);
    if (!layoutMatch) continue;
    const fields = parseLayout(layoutMatch[1]);
    if (fields.length === 0) continue;

    let posOffset = -1, uvOffset = -1, cursor = 0;
    for (const f of fields) {
      if (f.name === 'Position')  posOffset = cursor;
      if (f.name === 'TexCoord0') uvOffset  = cursor;
      cursor += f.size;
    }
    if (posOffset < 0) continue;
    const totalPerVertex = cursor;

    const dataMatch = vb.match(/<Data>([\s\S]*?)<\/Data>/);
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
      if (uvOffset >= 0) {
        uvLines.push(`vt ${vals[uvOffset]} ${vals[uvOffset + 1]}`);
      } else {
        uvLines.push(`vt 0 0`);
      }
      verticesAdded++;
    }

    const idxDataMatch = ib.match(/<Data>([\s\S]*?)<\/Data>/);
    if (!idxDataMatch) { globalVertexOffset += verticesAdded; continue; }

    const allIndices = idxDataMatch[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
    for (let i = 0; i + 2 < allIndices.length; i += 3) {
      const a = allIndices[i]     + vertexStart + 1;
      const b = allIndices[i + 1] + vertexStart + 1;
      const c = allIndices[i + 2] + vertexStart + 1;
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

  fs.writeFileSync(path.join(MODELS_DIR, `${weaponId}.obj`), obj, 'utf8');
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
