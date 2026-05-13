#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const SILENCIADORES_DIR = path.join(__dirname, 'silenciadores');
const MODELS_DIR        = path.join(__dirname, 'public', 'models');

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

function parseGeometryItems(xml) {
  const items = [];
  const geoBlockRe = /<Geometries>([\s\S]*?)<\/Geometries>/g;
  let gb;
  while ((gb = geoBlockRe.exec(xml)) !== null) {
    const itemRe = /<Item>([\s\S]*?)<\/Item>/g;
    let im;
    while ((im = itemRe.exec(gb[1])) !== null) {
      const block = im[1];
      const vbMatch = block.match(/<VertexBuffer>([\s\S]*?)<\/VertexBuffer>/);
      const ibMatch = block.match(/<IndexBuffer>([\s\S]*?)<\/IndexBuffer>/);
      if (vbMatch && ibMatch) {
        items.push({ vb: vbMatch[1], ib: ibMatch[1] });
      }
    }
  }
  return items;
}

function convertXmlToObj(xmlPath, modelName) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const posLines  = [];
  const uvLines   = [];
  const faceLines = [];
  let globalVertexOffset = 0;

  const geoItems = parseGeometryItems(xml);

  for (const { vb, ib } of geoItems) {
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
    `# ${modelName} — converted from CodeWalker YDR XML`,
    '',
    ...posLines,
    '',
    ...uvLines,
    '',
    ...faceLines,
  ].join('\n');

  fs.writeFileSync(path.join(MODELS_DIR, `${modelName}.obj`), obj, 'utf8');
  return true;
}

if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

const files = fs.readdirSync(SILENCIADORES_DIR);
let count = 0;
for (const file of files) {
  if (file.endsWith('.ydr.xml')) {
    const modelName = file.replace('.ydr.xml', '');
    const xmlPath = path.join(SILENCIADORES_DIR, file);
    try {
      if (convertXmlToObj(xmlPath, modelName)) {
        console.log(`Converted: ${modelName}.obj`);
        count++;
      } else {
        console.log(`Failed/Empty: ${modelName}`);
      }
    } catch (e) {
      console.log(`Error converting ${modelName}: ${e.message}`);
    }
  }
}
console.log(`Successfully converted ${count} suppressor models.`);
