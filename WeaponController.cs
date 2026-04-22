using Microsoft.AspNetCore.Mvc;
using System.IO;
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
            try {
                if (Request.Form.Files.Count == 0) return BadRequest("No files");
                var file = Request.Form.Files[0];
                var data = new byte[file.Length];
                using (var stream = file.OpenReadStream()) {
                    await stream.ReadAsync(data, 0, (int)file.Length);
                }
                return File(data, "application/octet-stream", "test.rpf");
            } catch (Exception ex) {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("test")]
        public IActionResult Test() => Ok("Ready v2.1");

        [HttpOptions("convert")]
        public IActionResult Options() => Ok();
    }
}
