[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$true)]
    [string]$OutputDir,

    [Parameter(Mandatory=$false)]
    [int]$TargetWidth = 1920,

    [Parameter(Mandatory=$false)]
    [int]$TargetHeight = 1080
)

$result = [PSCustomObject]@{
    success = $false
    slideCount = 0
    slides = @()
    errorMessage = $null
    errorCode = $null
    powerpointAlreadyRunning = $false
}

try {
    # 1. Validation of parameters and file existence
    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        $result.errorMessage = "El archivo no existe: $FilePath"
        $result.errorCode = "FILE_NOT_FOUND"
        $result | ConvertTo-Json -Compress
        exit 1
    }

    $ext = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
    $allowed = @('.pptx', '.ppt', '.pptm', '.ppsx')
    if ($allowed -notcontains $ext) {
        $result.errorMessage = "Extensión no permitida ($ext). Formatos permitidos: .pptx, .ppt, .pptm, .ppsx"
        $result.errorCode = "INVALID_EXTENSION"
        $result | ConvertTo-Json -Compress
        exit 1
    }

    # Ensure output directory exists
    if (-not (Test-Path -LiteralPath $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    # 2. Check if PowerPoint was already running before we start
    $existingPptProcs = Get-Process -Name "POWERPNT" -ErrorAction SilentlyContinue
    $pptAlreadyRunning = ($existingPptProcs -ne $null -and $existingPptProcs.Count -gt 0)
    $result.powerpointAlreadyRunning = $pptAlreadyRunning

    # 3. Create COM Object
    try {
        $ppt = New-Object -ComObject PowerPoint.Application
    } catch {
        $result.errorMessage = "No se pudo iniciar el servicio COM de Microsoft PowerPoint. Verifique que PowerPoint esté instalado y activado en este equipo."
        $result.errorCode = "COM_INIT_FAILED"
        $result | ConvertTo-Json -Compress
        exit 1
    }

    # 4. Security: Disable macro execution completely (msoAutomationSecurityForceDisable = 3)
    try {
        $ppt.AutomationSecurity = 3
    } catch {
        # Ignore if policy restrictions apply
    }

    # 5. Open presentation in ReadOnly, without visible window (WithWindow = False)
    # ReadOnly = -1 (msoTrue), Untitled = 0 (msoFalse), WithWindow = 0 (msoFalse)
    $presentation = $null
    try {
        $presentation = $ppt.Presentations.Open($FilePath, -1, 0, 0)
    } catch {
        $rawError = $_.Exception.Message
        $code = "OPEN_FAILED"
        $msg = "No se pudo abrir la presentación: $rawError"

        if ($rawError -like "*password*" -or $rawError -like "*contraseña*") {
            $code = "PROTECTED_PASSWORD"
            $msg = "La presentación está protegida con contraseña. Por favor, elimine la contraseña antes de importarla."
        } elseif ($rawError -like "*protected view*" -or $rawError -like "*vista protegida*" -or $rawError -like "*blocked*") {
            $code = "PROTECTED_VIEW"
            $msg = "El archivo está bloqueado por Windows (descargado de Internet). Haga clic derecho sobre el archivo en el explorador, seleccione Propiedades y marque 'Desbloquear'."
        } elseif ($rawError -like "*locked*" -or $rawError -like "*in use*" -or $rawError -like "*bloqueado*") {
            $code = "FILE_LOCKED"
            $msg = "El archivo está abierto por otra aplicación o usuario en modo exclusivo. Ciérrelo antes de reintentar."
        }

        $result.errorMessage = $msg
        $result.errorCode = $code
        $result | ConvertTo-Json -Compress

        if (-not $pptAlreadyRunning) {
            $ppt.Quit()
            [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
        }
        exit 1
    }

    # 6. Export each slide to PNG at highest target resolution
    $slideCount = $presentation.Slides.Count
    $result.slideCount = $slideCount
    $slideList = @()

    for ($i = 1; $i -le $slideCount; $i++) {
        $slide = $presentation.Slides.Item($i)
        $outFileName = [string]::Format("slide_{0:D4}.png", $i)
        $outFilePath = [System.IO.Path]::Combine($OutputDir, $outFileName)

        $slide.Export($outFilePath, "PNG", $TargetWidth, $TargetHeight)
        $slideList += [PSCustomObject]@{
            index = $i
            file = $outFileName
            path = $outFilePath
        }
    }

    $result.slides = $slideList
    $result.success = $true

    # 7. Clean up presentation
    $presentation.Close()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null

    # 8. Clean up Application only if we launched it!
    if (-not $pptAlreadyRunning) {
        $ppt.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    }

    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    $result | ConvertTo-Json -Compress
    exit 0
} catch {
    $result.errorMessage = "Error inesperado durante la exportación COM: " + $_.Exception.Message
    $result.errorCode = "UNEXPECTED_ERROR"
    $result | ConvertTo-Json -Compress
    exit 1
}
