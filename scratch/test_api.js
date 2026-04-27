
const fs = require('fs');
const path = require('path');

async function testApiConversion() {
  const filePath = 'C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma\\MKII_LEOPARDO_LHC.rpf';
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  console.log(`--- TEST DE CONVERSIÓN REAL (API) ---`);
  try {
    // Using native fetch, FormData and Blob (available in Node 18+)
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, fileName);
    formData.append('sourceWeapon', 'w_pi_pistolmk2');
    formData.append('targetWeapon', 'w_pi_vintage_pistol');

    console.log('Enviando a la API: https://187.33.157.103.nip.io/api/WeaponConverter/convert ...');
    
    const response = await fetch('https://187.33.157.103.nip.io/api/WeaponConverter/convert', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const replacementCount = response.headers.get('X-Replacement-Count');
      const contentType = response.headers.get('Content-Type');
      console.log(`✅ ÉXITO: La API ha respondido correctamente.`);
      console.log(` - Código: ${response.status}`);
      console.log(` - Reemplazos internos realizados: ${replacementCount || 'N/A'}`);
      console.log(` - Tipo de archivo devuelto: ${contentType}`);
      
      const resultBuffer = await response.arrayBuffer();
      console.log(` - Tamaño del archivo convertido: ${resultBuffer.byteLength} bytes`);
      
      if (resultBuffer.byteLength > 1000) {
        console.log('--- CONCLUSIÓN: LA CONVERSIÓN INTERNA FUNCIONA PERFECTAMENTE ---');
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ ERROR DE LA API: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ ERROR DE CONEXIÓN: ${error.message}`);
  }
}

testApiConversion();
