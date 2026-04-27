const fs = require('fs');
const path = require('path');

async function testNewAPI() {
  const filePath = 'C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma\\MKII_LEOPARDO_LHC.rpf';
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

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
    const resultBuffer = await response.arrayBuffer();
    fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma\\MODIFIED.rpf', Buffer.from(resultBuffer));
    console.log('Saved to MODIFIED.rpf');
  } else {
    console.log(`❌ ERROR: ${response.status}`);
  }
}

testNewAPI();
