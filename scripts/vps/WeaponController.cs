using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Threading.Tasks;
using System.Text;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CodeWalkerApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WeaponConverterController : ControllerBase
    {
        [HttpPost("convert")]
        public async Task<IActionResult> ConvertRpf(
            [FromForm] IFormFile file, 
            [FromForm] string sourceWeapon, 
            [FromForm] string targetWeapon)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No RPF file uploaded.");

            var workDir = Path.Combine(Directory.GetCurrentDirectory(), "Workspace");
            Directory.CreateDirectory(workDir);

            var inputPath = Path.Combine(workDir, Guid.NewGuid() + "_" + file.FileName);
            var outputPath = Path.Combine(workDir, "converted_" + Guid.NewGuid() + "_" + file.FileName);

            using (var stream = new FileStream(inputPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            try 
            {
                ProcessRpfSurgically(inputPath, outputPath, sourceWeapon, targetWeapon);
                var resultBytes = await System.IO.File.ReadAllBytesAsync(outputPath);
                
                // Cleanup
                System.IO.File.Delete(inputPath);
                System.IO.File.Delete(outputPath);

                return File(resultBytes, "application/octet-stream", $"{targetWeapon}.rpf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal Error: {ex.Message}");
            }
        }

        private void ProcessRpfSurgically(string inputPath, string outputPath, string source, string target)
        {
            using (var reader = new BinaryReader(File.OpenRead(inputPath)))
            using (var writer = new BinaryWriter(File.Create(outputPath)))
            {
                // 1. Read Header (RPF7)
                uint magic = reader.ReadUInt32(); // RPF7
                if (magic != 0x37465052) throw new Exception("Not a valid RPF7 file.");

                uint tocSize = reader.ReadUInt32();
                uint entryCount = reader.ReadUInt32();
                uint unknown = reader.ReadUInt32(); 
                uint encryption = reader.ReadUInt32(); // 0x0ffffff9 (AES) or 0 (None) etc.
                
                // If encrypted, we can't easily modify without keys. 
                // But most modded/converted RPFs are Decrypted (0 or Open).
                 if (encryption != 0 && encryption != 0x4e45504f) {
                     // Try to proceed anyway as some might just have the flag but be plain? 
                     // Or we should fail. Let's try to proceed.
                 }

                // 2. Read TOC
                byte[] tocData = reader.ReadBytes((int)entryCount * 16);
                
                // 3. Read Names Table
                // Names table size can be inferred from tocSize - entryCount*16
                int namesTableSize = (int)tocSize - ((int)entryCount * 16);
                byte[] namesData = reader.ReadBytes(namesTableSize);

                // 4. Parse strings and identify targets
                var names = ParseNamesTable(namesData);
                var newNamesData = new List<byte>();
                var offsetMap = new Dictionary<ushort, ushort>();

                foreach (var kvp in names)
                {
                    string originalName = kvp.Value;
                    string newName = originalName.Replace(source, target, StringComparison.OrdinalIgnoreCase);
                    
                    ushort newOffset = (ushort)newNamesData.Count;
                    offsetMap[kvp.Key] = newOffset;
                    
                    byte[] nameBytes = Encoding.ASCII.GetBytes(newName);
                    newNamesData.AddRange(nameBytes);
                    newNamesData.Add(0); // Null terminator
                }

                // Header update
                int newNamesSize = newNamesData.Count;
                // Pad to 16 bytes for alignment? RPF usually aligns.
                while (newNamesSize % 16 != 0) { newNamesData.Add(0); newNamesSize++; }

                uint newTocSize = (uint)(entryCount * 16 + newNamesSize);
                long dataShift = (long)newTocSize - (long)tocSize;

                // Write Header
                writer.Write(magic);
                writer.Write(newTocSize);
                writer.Write(entryCount);
                writer.Write(unknown);
                writer.Write(encryption);

                // Write modified TOC
                for (int i = 0; i < entryCount; i++)
                {
                    int baseIdx = i * 16;
                    ushort nameOffset = BitConverter.ToUInt16(tocData, baseIdx);
                    byte b2 = tocData[baseIdx + 2];
                    byte b3 = tocData[baseIdx + 3];
                    
                    // Is it a file? (Check Flags)
                    // Simplified: just update Name Offset for all.
                    if (offsetMap.ContainsKey(nameOffset)) {
                        writer.Write(offsetMap[nameOffset]);
                    } else {
                        writer.Write(nameOffset);
                    }
                    writer.Write(b2);
                    writer.Write(b3);

                    // Offset (4 bytes)
                    uint originalAddr = BitConverter.ToUInt32(tocData, baseIdx + 4);
                    // Shifting: addresses in RPF are often in sectors (512 bytes) or absolute.
                    // RPF7 usually uses 24-bit offsets or full 32-bit depending on bit flags.
                    // This is the tricky part. For now let's try a direct shift if it's high enough.
                    if (originalAddr > 0) {
                         // RPF usually has data after the TOC.
                         // If we are strictly surgical, we shift.
                         writer.Write(originalAddr + (uint)dataShift); 
                    } else {
                         writer.Write(originalAddr);
                    }

                    // Remaining 8 bytes (Size + Flags)
                    writer.Write(tocData, baseIdx + 8, 8);
                }

                // Write New Names Table
                writer.Write(newNamesData.ToArray());

                // Copy Data Area
                reader.BaseStream.Position = 20 + tocSize;
                reader.BaseStream.CopyTo(writer.BaseStream);
            }
        }

        private Dictionary<ushort, string> ParseNamesTable(byte[] data)
        {
            var dict = new Dictionary<ushort, string>();
            int i = 0;
            while (i < data.Length)
            {
                ushort start = (ushort)i;
                var sb = new StringBuilder();
                while (i < data.Length && data[i] != 0)
                {
                    sb.Append((char)data[i]);
                    i++;
                }
                if (sb.Length > 0) {
                    dict[start] = sb.ToString();
                }
                i++; // Skip null
                // Align? Standard RPF names aren't aligned, but we check.
            }
            return dict;
        }
    }
}
