using Microsoft.AspNetCore.Mvc;
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
        /// <summary>
        /// Converts weapon RPF files by performing deep binary patching:
        /// 1. Searches for all occurrences of the source weapon name (multiple variations)
        /// 2. Replaces them with the target weapon name in the raw binary data
        /// 3. Handles padding when target name is shorter/longer than source
        /// 4. Returns the patched RPF file
        /// 
        /// This works because RPF7 archives store filenames as plain ASCII strings
        /// in their directory entries. By replacing these strings (and any internal
        /// references in .ydr/.ytd resource files), the game engine will load
        /// the assets under the new weapon identity.
        /// </summary>
        [HttpPost("convert")]
        public async Task<IActionResult> Convert()
        {
            try
            {
                if (Request.Form.Files.Count == 0)
                    return BadRequest("No file uploaded");

                var file = Request.Form.Files[0];
                var sourceWeapon = Request.Form["sourceWeapon"].ToString().Trim();
                var targetWeapon = Request.Form["targetWeapon"].ToString().Trim();

                if (string.IsNullOrEmpty(sourceWeapon) || string.IsNullOrEmpty(targetWeapon))
                    return BadRequest("sourceWeapon and targetWeapon are required");

                // Read the entire RPF into memory
                var data = new byte[file.Length];
                using (var stream = file.OpenReadStream())
                {
                    await stream.ReadAsync(data, 0, (int)file.Length);
                }

                // Generate all possible name variations for search & replace
                var replacements = GenerateReplacements(sourceWeapon, targetWeapon);

                int totalReplacements = 0;

                // Apply each replacement pair to the binary data
                // Process longest patterns first to avoid partial matches
                foreach (var (search, replace) in replacements.OrderByDescending(r => r.search.Length))
                {
                    var searchBytes = Encoding.ASCII.GetBytes(search);
                    var replaceBytes = Encoding.ASCII.GetBytes(replace);

                    int count = BinarySearchAndReplace(data, searchBytes, replaceBytes);
                    totalReplacements += count;
                }

                // Set header with the number of replacements made
                Response.Headers["X-Replacement-Count"] = totalReplacements.ToString();
                Response.Headers["Access-Control-Expose-Headers"] = "X-Replacement-Count";

                return File(data, "application/octet-stream", $"{targetWeapon}.rpf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        /// <summary>
        /// Generates all variations of source->target name pairs to search for.
        /// Covers: full ID, without w_ prefix, without category prefix, 
        /// no underscores, and common casing variations.
        /// </summary>
        private List<(string search, string replace)> GenerateReplacements(string source, string target)
        {
            var pairs = new List<(string search, string replace)>();

            // 1. Exact full ID (e.g., w_pi_pistolmk2 -> w_pi_vintage_pistol)
            pairs.Add((source.ToLower(), target.ToLower()));

            // 2. Without "w_" prefix (e.g., pi_pistolmk2 -> pi_vintage_pistol)
            string sourceMid = RemovePrefix(source.ToLower(), "w_");
            string targetMid = RemovePrefix(target.ToLower(), "w_");
            if (sourceMid != source.ToLower())
                pairs.Add((sourceMid, targetMid));

            // 3. Without category prefix (e.g., pistolmk2 -> vintage_pistol)
            string sourceShort = RemoveCategoryPrefix(source.ToLower());
            string targetShort = RemoveCategoryPrefix(target.ToLower());
            if (sourceShort != sourceMid && sourceShort.Length >= 4)
                pairs.Add((sourceShort, targetShort));

            // 4. No underscores version (e.g., pistolmk2 -> vintagepistol)
            string sourceClean = sourceShort.Replace("_", "");
            string targetClean = targetShort.Replace("_", "");
            if (sourceClean != sourceShort && sourceClean.Length >= 4)
                pairs.Add((sourceClean, targetClean));

            // 5. Also add uppercase first letter variations
            var extraPairs = new List<(string, string)>();
            foreach (var (s, r) in pairs)
            {
                // Add PascalCase version
                if (s.Length > 0)
                {
                    string sPascal = char.ToUpper(s[0]) + s.Substring(1);
                    string rPascal = char.ToUpper(r[0]) + r.Substring(1);
                    extraPairs.Add((sPascal, rPascal));
                }
                // Add UPPERCASE version
                extraPairs.Add((s.ToUpper(), r.ToUpper()));
            }
            pairs.AddRange(extraPairs);

            // Remove duplicates and empty entries
            return pairs
                .Where(p => !string.IsNullOrEmpty(p.search) && p.search.Length >= 3)
                .Distinct()
                .ToList();
        }

        /// <summary>
        /// Performs binary search and replace on a byte array.
        /// When target is shorter than source, pads with null bytes (0x00).
        /// When target is longer than source, truncates to source length to maintain file structure.
        /// Returns the number of replacements made.
        /// </summary>
        private int BinarySearchAndReplace(byte[] data, byte[] search, byte[] replace)
        {
            int count = 0;
            int searchLen = search.Length;

            for (int i = 0; i <= data.Length - searchLen; i++)
            {
                bool match = true;
                for (int j = 0; j < searchLen; j++)
                {
                    if (data[i + j] != search[j])
                    {
                        match = false;
                        break;
                    }
                }

                if (match)
                {
                    // Replace bytes - use the shorter of the two lengths
                    int copyLen = Math.Min(replace.Length, searchLen);
                    Array.Copy(replace, 0, data, i, copyLen);

                    // If replacement is shorter, pad remaining bytes with null (0x00)
                    // This preserves file size and structure
                    for (int j = copyLen; j < searchLen; j++)
                    {
                        data[i + j] = 0x00;
                    }

                    count++;
                    i += searchLen - 1; // Skip past the replacement to avoid re-matching
                }
            }

            return count;
        }

        private string RemovePrefix(string input, string prefix)
        {
            return input.StartsWith(prefix) ? input.Substring(prefix.Length) : input;
        }

        private string RemoveCategoryPrefix(string input)
        {
            // Remove common weapon category prefixes: pi_, sb_, ar_, sg_, mg_, sr_, lr_, me_, ex_
            string[] prefixes = { "w_pi_", "w_sb_", "w_ar_", "w_sg_", "w_mg_", "w_sr_", "w_lr_", "w_me_", "w_ex_",
                                  "pi_", "sb_", "ar_", "sg_", "mg_", "sr_", "lr_", "me_", "ex_" };
            foreach (var p in prefixes)
            {
                if (input.StartsWith(p))
                    return input.Substring(p.Length);
            }
            return input;
        }

        [HttpGet("test")]
        public IActionResult Test() => Ok("Ready v3.0 - Deep Binary Patching Engine");

        [HttpOptions("convert")]
        public IActionResult Options() => Ok();
    }
}
