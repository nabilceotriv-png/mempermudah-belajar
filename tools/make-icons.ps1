# Membuat ikon aplikasi TaskMate (PNG) memakai GDI+ — tanpa Node/Python.
# Hasil: icons/icon-192.png, icons/icon-512.png, icons/maskable-512.png, icons/apple-touch-icon.png
param([string]$OutDir = "")

Add-Type -AssemblyName System.Drawing

if (-not $OutDir) {
  $OutDir = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'icons'
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function New-TaskMateIcon {
  param([int]$Size, [string]$FilePath, [bool]$Maskable)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  # Latar gradien biru tua (#131C33 -> #0B1020)
  $bgRect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
  $c1 = [System.Drawing.Color]::FromArgb(255, 19, 28, 51)
  $c2 = [System.Drawing.Color]::FromArgb(255, 11, 16, 32)
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, $c1, $c2, 45)

  if ($Maskable) {
    # Maskable: latar penuh tanpa sudut membulat (aman untuk semua bentuk ikon sistem).
    $g.FillRectangle($bgBrush, $bgRect)
  } else {
    # Bentuk "squircle": sudut membulat 22%.
    $radius = [int]($Size * 0.22)
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $gp.AddArc(0, 0, $d, $d, 180, 90)
    $gp.AddArc($Size - $d, 0, $d, $d, 270, 90)
    $gp.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
    $gp.AddArc(0, $Size - $d, $d, $d, 90, 90)
    $gp.CloseFigure()
    $g.FillPath($bgBrush, $gp)
    $gp.Dispose()
  }

  # Glyph "target" (#60A5FA) di tengah; maskable diperkecil agar masuk zona aman 80%.
  $blue = [System.Drawing.Color]::FromArgb(255, 96, 165, 250)
  if ($Maskable) { $outerR = $Size * 0.30 } else { $outerR = $Size * 0.34 }
  $pen = New-Object System.Drawing.Pen($blue, ([float]($Size * 0.055)))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $center = $Size / 2.0
  $midR = $outerR * 0.60
  $dotR = $outerR * 0.20
  $g.DrawEllipse($pen, ([float]($center - $outerR)), ([float]($center - $outerR)), ([float]($outerR * 2)), ([float]($outerR * 2)))
  $g.DrawEllipse($pen, ([float]($center - $midR)), ([float]($center - $midR)), ([float]($midR * 2)), ([float]($midR * 2)))
  $dotBrush = New-Object System.Drawing.SolidBrush($blue)
  $g.FillEllipse($dotBrush, ([float]($center - $dotR)), ([float]($center - $dotR)), ([float]($dotR * 2)), ([float]($dotR * 2)))

  $g.Dispose()
  $bmp.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "OK: $FilePath"
}

New-TaskMateIcon -Size 192 -FilePath (Join-Path $OutDir 'icon-192.png') -Maskable $false
New-TaskMateIcon -Size 512 -FilePath (Join-Path $OutDir 'icon-512.png') -Maskable $false
New-TaskMateIcon -Size 512 -FilePath (Join-Path $OutDir 'maskable-512.png') -Maskable $true
New-TaskMateIcon -Size 180 -FilePath (Join-Path $OutDir 'apple-touch-icon.png') -Maskable $true
Write-Host "Ikon selesai di $OutDir"
