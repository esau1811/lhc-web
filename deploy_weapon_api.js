const { Client } = require('ssh2'); 
const conn = new Client(); 

const controllerCode = `using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeWalkerApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WeaponConverterController : ControllerBase
    {
        [HttpPost("convert")]
        public async Task<IActionResult> Convert()
        {
            try
            {
                if (Request.Form.Files.Count == 0)
                    return BadRequest("No file uploaded");

                var file = Request.Form.Files[0];
                string source = Request.Form["sourceWeapon"].ToString().Trim();
                string target = Request.Form["targetWeapon"].ToString().Trim();

                if (string.IsNullOrEmpty(source) || string.IsNullOrEmpty(target))
                    return BadRequest("sourceWeapon and targetWeapon required");

                var data = new byte[file.Length];
                using (var stream = file.OpenReadStream())
                {
                    await stream.ReadAsync(data, 0, (int)file.Length);
                }

                var replacements = GenerateReplacements(source, target);
                int totalReplacements = 0;

                foreach (var pair in replacements.OrderByDescending(r => r.Item1.Length))
                {
                    var searchBytes = Encoding.ASCII.GetBytes(pair.Item1);
                    var replaceBytes = Encoding.ASCII.GetBytes(pair.Item2);
                    int count = BinaryPatch(data, searchBytes, replaceBytes);
                    totalReplacements += count;
                }

                Response.Headers["X-Replacement-Count"] = totalReplacements.ToString();
                Response.Headers["Access-Control-Expose-Headers"] = "X-Replacement-Count";

                return File(data, "application/octet-stream", target + ".rpf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        private List<Tuple<string, string>> GenerateReplacements(string source, string target)
        {
            var pairs = new List<Tuple<string, string>>();

            pairs.Add(Tuple.Create(source.ToLower(), target.ToLower()));

            string srcMid = source.ToLower().StartsWith("w_") ? source.ToLower().Substring(2) : source.ToLower();
            string tgtMid = target.ToLower().StartsWith("w_") ? target.ToLower().Substring(2) : target.ToLower();
            if (srcMid != source.ToLower())
                pairs.Add(Tuple.Create(srcMid, tgtMid));

            string srcShort = RemoveCategory(source.ToLower());
            string tgtShort = RemoveCategory(target.ToLower());
            if (srcShort != srcMid && srcShort.Length >= 4)
                pairs.Add(Tuple.Create(srcShort, tgtShort));

            string srcClean = srcShort.Replace("_", "");
            string tgtClean = tgtShort.Replace("_", "");
            if (srcClean != srcShort && srcClean.Length >= 4)
                pairs.Add(Tuple.Create(srcClean, tgtClean));

            var extras = new List<Tuple<string, string>>();
            foreach (var p in pairs)
            {
                extras.Add(Tuple.Create(p.Item1.ToUpper(), p.Item2.ToUpper()));
                if (p.Item1.Length > 0)
                {
                    string sp = char.ToUpper(p.Item1[0]) + p.Item1.Substring(1);
                    string rp = char.ToUpper(p.Item2[0]) + p.Item2.Substring(1);
                    extras.Add(Tuple.Create(sp, rp));
                }
            }
            pairs.AddRange(extras);

            return pairs.Where(p => !string.IsNullOrEmpty(p.Item1) && p.Item1.Length >= 3)
                        .Distinct().ToList();
        }

        private int BinaryPatch(byte[] data, byte[] search, byte[] replace)
        {
            int count = 0;
            for (int i = 0; i <= data.Length - search.Length; i++)
            {
                bool match = true;
                for (int j = 0; j < search.Length; j++)
                {
                    if (data[i + j] != search[j]) { match = false; break; }
                }
                if (match)
                {
                    int copyLen = Math.Min(replace.Length, search.Length);
                    Array.Copy(replace, 0, data, i, copyLen);
                    for (int j = copyLen; j < search.Length; j++)
                        data[i + j] = 0x00;
                    count++;
                    i += search.Length - 1;
                }
            }
            return count;
        }

        private string RemoveCategory(string input)
        {
            string[] prefixes = { "w_pi_", "w_sb_", "w_ar_", "w_sg_", "w_mg_", "w_sr_", "w_lr_", "w_me_", "w_ex_",
                                  "pi_", "sb_", "ar_", "sg_", "mg_", "sr_", "lr_", "me_", "ex_" };
            foreach (var p in prefixes)
                if (input.StartsWith(p)) return input.Substring(p.Length);
            return input;
        }

        [HttpGet("test")]
        public IActionResult Test() => Ok("Ready v3.0 - Deep Binary Patching");

        [HttpOptions("convert")]
        public IActionResult Options() => Ok();
    }
}`;

conn.on('ready', () => { 
    console.log('Connected to VPS. Deploying WeaponConverter v3.0 with DEEP BINARY PATCHING...');
    
    const cmd = `mkdir -p /var/www/lhc-csharp/CodeWalkerApi/Controllers && cat > /var/www/lhc-csharp/CodeWalkerApi/Controllers/WeaponConverterController.cs << 'ENDOFCONTROLLER'
${controllerCode}
ENDOFCONTROLLER
echo "Controller written. Building..."
cd /var/www/lhc-csharp/CodeWalkerApi && dotnet publish -c Release -o bin/Publish 2>&1
echo "Restarting service..."
systemctl restart lhc-api.service 2>&1
echo "DEPLOY COMPLETE"`;

    conn.exec(cmd, (err, stream) => { 
        if (err) { console.error('SSH Error:', err); conn.end(); return; }
        stream.on('close', (code) => { 
            console.log('Exit code:', code); 
            conn.end(); 
        });
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    }); 
}).connect({ host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' });
