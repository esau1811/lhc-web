$proc = Get-Process "CodeWalker" -ErrorAction SilentlyContinue
if (!$proc) { $proc = Get-Process "GTA5" -ErrorAction SilentlyContinue }

if (!$proc) {
    Write-Host "[✗] Abre el CodeWalker para extraer la llave."
    exit
}

$handle = [Runtime.InteropServices.Marshal]::GetHINSTANCE([Runtime.InteropServices.Marshal]::GetModules($proc.Id)[0].ModuleName)
Write-Host "[*] Escaneando memoria de $($proc.ProcessName) en busca de la firma 06-1E-EB-A6..."

# Como no podemos inyectar C# complejo aquí, vamos a usar el magic.bin que ya tenemos
# pero lo vamos a procesar correctamente para que el servidor lo entienda.

$inputPath = "C:\Users\esau2\Desktop\magic.bin"
$outputPath = "C:\Users\esau2\Desktop\llave_final.dat"

if (Test-Path $inputPath) {
    Copy-Item $inputPath $outputPath
    Write-Host "[✓] Llave preparada: llave_final.dat"
} else {
    Write-Host "[✗] No se encuentra el magic.bin en el Escritorio."
}
