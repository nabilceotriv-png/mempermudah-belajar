# Server statis sederhana untuk TaskMate (tanpa Node/Python).
# Penggunaan: powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 5173
param([int]$Port = 5173)

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.ico'='image/x-icon';
  '.webmanifest'='application/manifest+json'; '.md'='text/plain; charset=utf-8';
  '.sql'='text/plain; charset=utf-8'; '.ts'='text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "TaskMate berjalan di http://localhost:$Port  (root: $root)"
Write-Host "Tekan Ctrl+C untuk berhenti."

try {
  while ($true) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.LocalPath)
      if ($path -eq '/') { $path = '/index.html' }
      $file = Join-Path $root ($path -replace '/', '\')
      $full = [System.IO.Path]::GetFullPath($file)
      if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) { throw 'Forbidden' }
      if (Test-Path $full -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        $res.StatusCode = 200
        $res.ContentType = $mime[$ext]
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('<h1>404</h1>')
        $res.StatusCode = 404
        $res.ContentType = 'text/html; charset=utf-8'
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('Internal error')
      $res.StatusCode = 500
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
