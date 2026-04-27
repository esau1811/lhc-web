const fs = require('fs');
const path = require('path');

async function testNewAPI() {
  const filePath = 'C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma\\MKII_LEOPARDO_LHC.rpf';
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  console.log('=== TEST DE LA NUEVA API v3.0 (BINARY PATCHING) ===');
  console.log(`Archivo: ${fileName} (${fileBuffer.length} bytes)`);
  console.log(`Conversión: w_pi_pistolmk2 → w_pi_vintage_pistol`);
  console.log('');

  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, fileName);
  formData.append('sourceWeapon', 'w_pi_pistolmk2');
  formData.append('targetWeapon', 'w_pi_vintage_pistol');

  console.log('Enviando a la API...');
  
  const response = await fetch('https://187.33.157.103.nip.io/api/WeaponConverter/convert', {
    method: 'POST',
    body: formData,
  });

  if (response.ok) {
    const count = response.headers.get('X-Replacement-Count');
    const resultBuffer = await response.arrayBuffer();
    
    console.log('');
    console.log('✅ RESPUESTA EXITOSA');
    console.log(`   Código: ${response.status}`);
    console.log(`   Reemplazos binarios realizados: ${count}`);
    console.log(`   Tamaño original: ${fileBuffer.length} bytes`);
    console.log(`   Tamaño resultado: ${resultBuffer.byteLength} bytes`);
    
    if (parseInt(count) > 3) {
      console.log('');
      console.log('🏆 ¡PARCHEO PROFUNDO CONFIRMADO!');
      console.log('   El motor ha realizado MÁS de 3 cambios,');
      console.log('   lo que significa que ha tocado el INTERIOR binario.');
    } else if (parseInt(count) === 3) {
      console.log('');
      console.log('⚠️  Solo 3 cambios - puede que solo renombre archivos.');
    } else {
      console.log('');
      console.log(`   ${count} cambios realizados.`);
    }
  } else {
    const errorText = await response.text();
    console.log(`❌ ERROR: ${response.status} - ${errorText}`);
  }
}

// Also test the version endpoint
async function testVersion() {
  try {
    const res = await fetch('https://187.33.157.103.nip.io/api/WeaponConverter/test');
    const text = await res.text();
    console.log(`\nVersión de la API: ${text}`);
  } catch(e) {
    console.log(`Error de versión: ${e.message}`);
  }
}

testVersion().then(() => testNewAPI());
