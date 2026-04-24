using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;

namespace CodeWalkerApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SoundController : ControllerBase
    {
        private const string ResidentRpfPath = "/opt/lhc-sound/RESIDENT.rpf";

        [HttpPost("inject")]
        public async Task<IActionResult> Inject()
        {
            try
            {
                var rpfFile   = Request.Form.Files.GetFile("rpf");
                var audioFile = Request.Form.Files.GetFile("audio");

                if (rpfFile == null)
                    return BadRequest("Falta el archivo RPF (campo: 'rpf')");
                if (audioFile == null)
                    return BadRequest("Falta el archivo de audio (campo: 'audio')");

                // Read RPF into memory
                byte[] rpfBytes;
                using (var ms = new MemoryStream())
                {
                    await rpfFile.OpenReadStream().CopyToAsync(ms);
                    rpfBytes = ms.ToArray();
                }

                // Build ZIP to a temp file so we can stream it back
                var tmpZip = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N") + ".zip");
                try
                {
                    using (var fs = new FileStream(tmpZip, FileMode.Create, FileAccess.Write))
                    using (var archive = new ZipArchive(fs, ZipArchiveMode.Create, leaveOpen: false))
                    {
                        // User's RPF → WEAPONS_PLAYER.rpf
                        var wpEntry = archive.CreateEntry(
                            "LHC Sound boost/WEAPONS_PLAYER.rpf",
                            CompressionLevel.NoCompression);
                        using (var s = wpEntry.Open())
                            await s.WriteAsync(rpfBytes, 0, rpfBytes.Length);

                        // Static RESIDENT.rpf from server
                        if (System.IO.File.Exists(ResidentRpfPath))
                        {
                            var resEntry = archive.CreateEntry(
                                "LHC Sound boost/RESIDENT.rpf",
                                CompressionLevel.NoCompression);
                            using (var s = resEntry.Open())
                            using (var rfs = System.IO.File.OpenRead(ResidentRpfPath))
                                await rfs.CopyToAsync(s);
                        }
                    }

                    // Stream ZIP back to client
                    var zipBytes = await System.IO.File.ReadAllBytesAsync(tmpZip);
                    Response.Headers["Access-Control-Expose-Headers"] = "Content-Disposition";
                    return File(zipBytes, "application/zip", "LHC Sound boost.zip");
                }
                finally
                {
                    if (System.IO.File.Exists(tmpZip))
                        System.IO.File.Delete(tmpZip);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Error: " + ex.Message);
            }
        }

        [HttpGet("test")]
        public IActionResult Test()
        {
            bool hasResident = System.IO.File.Exists(ResidentRpfPath);
            return Ok($"Sound API v1.0 - Ready | RESIDENT.rpf: {(hasResident ? "OK" : "NOT FOUND at " + ResidentRpfPath)}");
        }

        [HttpOptions("inject")]
        public IActionResult Options() => Ok();
    }
}
