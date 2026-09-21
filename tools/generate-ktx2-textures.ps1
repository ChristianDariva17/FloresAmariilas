param(
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'assets/textures'),
    [int]$DesktopSize = 512,
    [int]$MobileSize = 256
)

$ErrorActionPreference = 'Stop'
$sets = @('petal', 'leaf', 'center')

function Convert-Ktx2 {
    param(
        [string]$Name,
        [string]$Map,
        [string]$Format,
        [string]$Encoding,
        [string[]]$EncodingOptions,
        [string]$Transfer = 'linear',
        [int]$Size
    )

    $source = Join-Path $OutputDirectory ("$Name-$Map.png")
    $suffix = if ($Size -eq $MobileSize) { '-mobile' } else { '' }
    $destination = Join-Path $OutputDirectory ("$Name-$Map$suffix.ktx2")
    if (-not (Test-Path -LiteralPath $source)) {
        throw "No se encontró la fuente PNG: $source"
    }

    $arguments = @(
        'create', '--format', $Format, '--width', $Size, '--height', $Size,
        '--assign-tf', $Transfer, '--encode', $Encoding
    ) + $EncodingOptions + @('--generate-mipmap', $source, $destination)

    & ktx @arguments
    if ($LASTEXITCODE -ne 0) { throw "Falló la conversión de $source" }
    & ktx validate $destination | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "KTX2 inválido: $destination" }
    Write-Output "Validado $destination"
}

foreach ($name in $sets) {
    foreach ($size in @($DesktopSize, $MobileSize)) {
        Convert-Ktx2 $name 'basecolor' 'R8G8B8A8_SRGB' 'uastc' @('--uastc-quality', '2', '--zstd', '18') 'srgb' $size
        Convert-Ktx2 $name 'normal' 'R8G8B8A8_UNORM' 'uastc' @('--uastc-quality', '2', '--zstd', '18') 'linear' $size
        Convert-Ktx2 $name 'roughness' 'R8_UNORM' 'basis-lz' @('--qlevel', '180') 'linear' $size
        Convert-Ktx2 $name 'ao' 'R8_UNORM' 'basis-lz' @('--qlevel', '180') 'linear' $size
    }
}

Write-Output 'Conversión KTX2 desktop/móvil completada.'
