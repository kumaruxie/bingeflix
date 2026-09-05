Add-Type -AssemblyName System.Drawing

$srcLogo = "A:\movies app\public\logo.png"
$srcTransparent = "A:\movies app\public\logo-transparent.png"
$resDir = "A:\movies app\android\app\src\main\res"

function Resize-Image {
    param(
        [string]$inputPath,
        [string]$outputPath,
        [int]$width,
        [int]$height,
        [string]$bgColor = "#0b0f19",
        [bool]$fitCenter = $true,
        [float]$scalePadding = 0.85
    )

    $src = [System.Drawing.Bitmap]::FromFile($inputPath)
    $dest = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($bgColor -ne "transparent") {
        $color = [System.Drawing.ColorTranslator]::FromHtml($bgColor)
        $brush = New-Object System.Drawing.SolidBrush($color)
        $g.FillRectangle($brush, 0, 0, $width, $height)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    if ($fitCenter) {
        $ratioW = ($width * $scalePadding) / $src.Width
        $ratioH = ($height * $scalePadding) / $src.Height
        $ratio = [Math]::Min($ratioW, $ratioH)
        $destW = [int]($src.Width * $ratio)
        $destH = [int]($src.Height * $ratio)
        $destX = [int](($width - $destW) / 2)
        $destY = [int](($height - $destH) / 2)
        $g.DrawImage($src, $destX, $destY, $destW, $destH)
    } else {
        $g.DrawImage($src, 0, 0, $width, $height)
    }

    $g.Dispose()
    $src.Dispose()

    $parentDir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    $dest.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "Generated: $outputPath ($width x $height)"
}

# 1. Launcher Icons (Square with dark background)
$launcherSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($density in $launcherSizes.Keys) {
    $size = $launcherSizes[$density]
    $outPath = Join-Path $resDir "$density\ic_launcher.png"
    Resize-Image -inputPath $srcTransparent -outputPath $outPath -width $size -height $size -bgColor "#0b0f19" -scalePadding 0.82
    
    $outRound = Join-Path $resDir "$density\ic_launcher_round.png"
    Resize-Image -inputPath $srcTransparent -outputPath $outRound -width $size -height $size -bgColor "#0b0f19" -scalePadding 0.82
}

# 2. Adaptive Foreground Icons (Transparent background, centered logo)
$foregroundSizes = @{
    "mipmap-mdpi" = 108
    "mipmap-hdpi" = 162
    "mipmap-xhdpi" = 216
    "mipmap-xxhdpi" = 324
    "mipmap-xxxhdpi" = 432
}

foreach ($density in $foregroundSizes.Keys) {
    $size = $foregroundSizes[$density]
    $outPath = Join-Path $resDir "$density\ic_launcher_foreground.png"
    Resize-Image -inputPath $srcTransparent -outputPath $outPath -width $size -height $size -bgColor "transparent" -scalePadding 0.65
}

# 3. Splash Screens
$splashScreens = @(
    @{ path = "drawable\splash.png"; w = 480; h = 800 },
    @{ path = "drawable-port-mdpi\splash.png"; w = 320; h = 480 },
    @{ path = "drawable-port-hdpi\splash.png"; w = 480; h = 800 },
    @{ path = "drawable-port-xhdpi\splash.png"; w = 720; h = 1280 },
    @{ path = "drawable-port-xxhdpi\splash.png"; w = 960; h = 1600 },
    @{ path = "drawable-port-xxxhdpi\splash.png"; w = 1280; h = 1920 },
    @{ path = "drawable-land-mdpi\splash.png"; w = 480; h = 320 },
    @{ path = "drawable-land-hdpi\splash.png"; w = 800; h = 480 },
    @{ path = "drawable-land-xhdpi\splash.png"; w = 1280; h = 720 },
    @{ path = "drawable-land-xxhdpi\splash.png"; w = 1600; h = 960 },
    @{ path = "drawable-land-xxxhdpi\splash.png"; w = 1920; h = 1280 }
)

foreach ($splash in $splashScreens) {
    $outPath = Join-Path $resDir $splash.path
    Resize-Image -inputPath $srcLogo -outputPath $outPath -width $splash.w -height $splash.h -bgColor "#0b0f19" -scalePadding 0.55
}

Write-Host "ALL ICONS AND SPLASH SCREENS GENERATED SUCCESSFULLY!"
