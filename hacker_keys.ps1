$ErrorActionPreference = 'SilentlyContinue'
$proc = Get-Process "GTA5"
if (!$proc) {
    Write-Host "[!] Abre el GTA V para que pueda leer la memoria."
    exit
}

$inputPath = "C:\Users\esau2\Desktop\magic.bin"
$outputPath = "C:\Users\esau2\Desktop\llave_real.dat"

if (Test-Path $inputPath) {
    $bytes = [System.IO.File]::ReadAllBytes($inputPath)
    # Buscamos la secuencia maestra de Rockstar: 0x06, 0x1E, 0xEB, 0xA6
    for ($i=0; $i -lt ($bytes.Length - 4); $i++) {
        if ($bytes[$i] -eq 0x06 -and $bytes[$i+1] -eq 0x1E -and $bytes[$i+2] -eq 0xEB) {
            $table = New-Object byte[] 69632
            [Array]::Copy($bytes, $i, $table, 0, 69632)
            [System.IO.File]::WriteAllBytes($outputPath, $table)
            Write-Host "[✓] LLAVE EXTRAIDA CON EXITO"
            exit
        }
    }
    Write-Host "[✗] No se encontro la firma en el magic.bin"
} else {
    Write-Host "[✗] No hay magic.bin en el escritorio"
}
