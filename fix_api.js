const { Client } = require('ssh2'); 
const conn = new Client(); 

const controller = `
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Threading.Tasks;
using System.Text;
using System;
using System.Collections.Generic;

namespace CodeWalkerApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WeaponConverterController : ControllerBase
    {
        [HttpPost("convert")]
        public async Task<IActionResult> Convert()
        {
            var file = Request.Form.Files[0];
            string source = Request.Form["sourceWeapon"];
            string target = Request.Form["targetWeapon"];

            if (file == null || file.Length == 0) return BadRequest("No file");

            var data = new byte[file.Length];
            using (var stream = file.OpenReadStream()) {
                await stream.ReadAsync(data, 0, (int)file.Length);
            }

            // Return the same for testing connectivity
            return File(data, "application/octet-stream", "test.rpf");
        }

        [HttpGet("test")]
        public IActionResult Test() => Ok("Ready");
    }
}
`;

conn.on('ready', () => { 
    conn.exec(\`cat <<EOF > /var/www/lhc-csharp/CodeWalkerApi/Controllers/WeaponConverterController.cs\n\${controller}\nEOF && cd /var/www/lhc-csharp/CodeWalkerApi && dotnet publish -c Release -o bin/Publish && systemctl restart lhc-api.service\`, (err, stream) => { 
        stream.on('close', () => { console.log('Fixed and Restarted.'); conn.end(); });
        stream.on('data', (d) => process.stdout.write(d));
    }); 
}).connect({ host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' });
