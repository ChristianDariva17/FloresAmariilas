param(
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'assets/textures'),
    [int]$Size = 512,
    [switch]$KeepBaseColorPng
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

if (-not ('SunflowerPbrTextureGenerator' -as [type])) {
    Add-Type -ReferencedAssemblies 'System.Drawing.dll' -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SunflowerPbrTextureGenerator
{
    private static byte ClampByte(float value)
    {
        return (byte)Math.Max(0, Math.Min(255, (int)Math.Round(value)));
    }

    private static float Clamp(float value, float min, float max)
    {
        return Math.Max(min, Math.Min(max, value));
    }

    private static float Luminance(byte[] pixels, int stride, int x, int y, int size)
    {
        x = Math.Max(0, Math.Min(size - 1, x));
        y = Math.Max(0, Math.Min(size - 1, y));
        int offset = y * stride + x * 4;
        float blue = pixels[offset] / 255f;
        float green = pixels[offset + 1] / 255f;
        float red = pixels[offset + 2] / 255f;
        return red * 0.2126f + green * 0.7152f + blue * 0.0722f;
    }

    private static void SaveMap(byte[] pixels, int size, string path)
    {
        using (var bitmap = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        {
            var bounds = new Rectangle(0, 0, size, size);
            var data = bitmap.LockBits(bounds, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
            bitmap.UnlockBits(data);
            bitmap.Save(path, ImageFormat.Png);
        }
    }

    private static void SaveGrayMap(byte[] pixels, int size, string path)
    {
        using (var bitmap = new Bitmap(size, size, PixelFormat.Format8bppIndexed))
        {
            var palette = bitmap.Palette;
            for (int index = 0; index < 256; index++)
            {
                palette.Entries[index] = Color.FromArgb(255, index, index, index);
            }
            bitmap.Palette = palette;

            var bounds = new Rectangle(0, 0, size, size);
            var data = bitmap.LockBits(bounds, ImageLockMode.WriteOnly, PixelFormat.Format8bppIndexed);
            var packed = new byte[data.Stride * size];
            for (int row = 0; row < size; row++)
            {
                Buffer.BlockCopy(pixels, row * size, packed, row * data.Stride, size);
            }
            Marshal.Copy(packed, 0, data.Scan0, packed.Length);
            bitmap.UnlockBits(data);
            bitmap.Save(path, ImageFormat.Png);
        }
    }

    private static void SaveJpeg(Bitmap bitmap, string path)
    {
        ImageCodecInfo jpegCodec = null;
        foreach (var codec in ImageCodecInfo.GetImageEncoders())
        {
            if (codec.FormatID == ImageFormat.Jpeg.Guid)
            {
                jpegCodec = codec;
                break;
            }
        }

        using (var parameters = new EncoderParameters(1))
        {
            parameters.Param[0] = new EncoderParameter(Encoder.Quality, 90L);
            bitmap.Save(path, jpegCodec, parameters);
        }
    }

    public static void Generate(string sourcePath, string outputDirectory, string name, int size, float baseRoughness, float roughnessVariation, float normalStrength)
    {
        using (var original = new Bitmap(sourcePath))
        using (var resized = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(resized))
            {
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                graphics.DrawImage(original, new Rectangle(0, 0, size, size));
            }

            resized.Save(System.IO.Path.Combine(outputDirectory, name + "-basecolor.png"), ImageFormat.Png);
            SaveJpeg(resized, System.IO.Path.Combine(outputDirectory, name + "-basecolor.jpg"));

            var bounds = new Rectangle(0, 0, size, size);
            var sourceData = resized.LockBits(bounds, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var sourcePixels = new byte[sourceData.Stride * size];
            Marshal.Copy(sourceData.Scan0, sourcePixels, 0, sourcePixels.Length);
            resized.UnlockBits(sourceData);

            var normalPixels = new byte[size * size * 4];
            var roughnessPixels = new byte[size * size];
            var aoPixels = new byte[size * size];

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    int offset = (y * size + x) * 4;
                    float center = Luminance(sourcePixels, sourceData.Stride, x, y, size);
                    float left = Luminance(sourcePixels, sourceData.Stride, x - 1, y, size);
                    float right = Luminance(sourcePixels, sourceData.Stride, x + 1, y, size);
                    float up = Luminance(sourcePixels, sourceData.Stride, x, y - 1, size);
                    float down = Luminance(sourcePixels, sourceData.Stride, x, y + 1, size);
                    float dx = (right - left) * normalStrength;
                    float dy = (down - up) * normalStrength;
                    float nx = -dx;
                    float ny = -dy;
                    float nz = 1f;
                    float length = (float)Math.Sqrt(nx * nx + ny * ny + nz * nz);
                    nx /= length;
                    ny /= length;
                    nz /= length;

                    normalPixels[offset] = ClampByte((nz * 0.5f + 0.5f) * 255f);
                    normalPixels[offset + 1] = ClampByte((ny * 0.5f + 0.5f) * 255f);
                    normalPixels[offset + 2] = ClampByte((nx * 0.5f + 0.5f) * 255f);
                    normalPixels[offset + 3] = 255;

                    float roughness = Clamp(baseRoughness + (0.5f - center) * roughnessVariation, 0.18f, 0.98f);
                    byte roughnessValue = ClampByte(roughness * 255f);
                    roughnessPixels[y * size + x] = roughnessValue;

                    float ambientOcclusion = Clamp(0.7f + center * 0.3f, 0.48f, 1f);
                    byte aoValue = ClampByte(ambientOcclusion * 255f);
                    aoPixels[y * size + x] = aoValue;
                }
            }

            SaveMap(normalPixels, size, System.IO.Path.Combine(outputDirectory, name + "-normal.png"));
            SaveGrayMap(roughnessPixels, size, System.IO.Path.Combine(outputDirectory, name + "-roughness.png"));
            SaveGrayMap(aoPixels, size, System.IO.Path.Combine(outputDirectory, name + "-ao.png"));
        }
    }
}
'@
}

function New-PbrSet {
    param(
        [string]$Name,
        [string]$SourcePath,
        [double]$BaseRoughness,
        [double]$RoughnessVariation,
        [double]$NormalStrength
    )

    $temporarySource = $null
    if (-not (Test-Path $SourcePath)) {
        $fallbackSource = Join-Path $OutputDirectory ($Name + '-basecolor.png')
        if (-not (Test-Path $fallbackSource)) {
            $fallbackSource = Join-Path $OutputDirectory ($Name + '-basecolor.jpg')
        }
        if (Test-Path $fallbackSource) {
            $temporarySource = Join-Path $OutputDirectory ($Name + '-basecolor-working.png')
            Copy-Item $fallbackSource $temporarySource -Force
            $SourcePath = $temporarySource
        } else {
            throw "No se encontró la textura baseColor: $SourcePath"
        }
    }

    [SunflowerPbrTextureGenerator]::Generate(
        $SourcePath,
        $OutputDirectory,
        $Name,
        $Size,
        $BaseRoughness,
        $RoughnessVariation,
        $NormalStrength
    )

    if ($temporarySource) {
        Remove-Item $temporarySource -Force
    }
}

New-PbrSet 'petal' (Join-Path $OutputDirectory 'petal-basecolor-source.png') 0.58 0.12 1.25
New-PbrSet 'leaf' (Join-Path $OutputDirectory 'leaf-basecolor-source.png') 0.78 0.1 1.05
New-PbrSet 'center' (Join-Path $OutputDirectory 'center-basecolor-source.png') 0.86 0.1 1.45

Remove-Item (Join-Path $OutputDirectory '*-basecolor-source.png') -Force
if (-not $KeepBaseColorPng) {
    Remove-Item (Join-Path $OutputDirectory '*-basecolor.png') -Force -ErrorAction SilentlyContinue
}
Write-Output "Mapas PBR generados en $OutputDirectory"
