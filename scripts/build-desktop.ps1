# Build noCap as a self-contained Windows app (frontend/dist-app/win-unpacked/noCap.exe)
#
# Usage:
#   .\scripts\build-desktop.ps1                  # full build
#   .\scripts\build-desktop.ps1 -SkipBackend     # reuse existing frontend/build/backend
#   .\scripts\build-desktop.ps1 -SkipFrontend    # skip electron-builder packaging
#
# Prerequisites: .venv (Windows layout) with project deps + openai-whisper + demucs +
# pyinstaller installed, Node.js + npm. Models are downloaded if not cached.
param([switch]$SkipBackend, [switch]$SkipFrontend)
# Not 'Stop': Windows PowerShell turns native stderr (progress bars) into errors.
# Native steps are checked by exit code instead; cmdlets opt in with -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
$PSDefaultParameterValues['*:ErrorAction'] = 'Stop'

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$FrontendDir = Join-Path $ProjectRoot 'frontend'
$VenvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
$BuildDir = Join-Path $FrontendDir 'build'

function Check([string]$step) { if ($LASTEXITCODE -ne 0) { throw "$step failed (exit $LASTEXITCODE)" } }

if (-not (Test-Path $VenvPython)) { throw '.venv not found (expected .venv\Scripts\python.exe)' }

# 1. Whisper model
$WhisperCache = Join-Path $HOME '.cache\whisper'
$WhisperOut = Join-Path $BuildDir 'whisper_models'
New-Item -ItemType Directory -Force $WhisperOut | Out-Null
$model = @('medium.en', 'medium') | ForEach-Object { Join-Path $WhisperCache "$_.pt" } |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $model) {
  Write-Host '> Whisper model not cached - downloading medium.en (~1.5 GB)...'
  & $VenvPython -c "import whisper; whisper.load_model('medium.en', device='cpu')"; Check 'Whisper download'
  $model = Join-Path $WhisperCache 'medium.en.pt'
}
Copy-Item $model $WhisperOut -Force
Write-Host "> Whisper model: $model"

# 1b. Demucs weights (torch.hub layout)
Push-Location $ProjectRoot
& $VenvPython -m nocap.audio.demucs_models (Join-Path $BuildDir 'demucs_models') htdemucs; Check 'Demucs export'
Pop-Location

# 2. React renderer (Flask serves it from inside the PyInstaller bundle)
Push-Location $FrontendDir
npx vite build; Check 'vite build'
Pop-Location

# 3. Python backend
if (-not $SkipBackend) {
  Write-Host '> Building Python backend with PyInstaller (takes a while)...'
  $BackendOut = Join-Path $BuildDir 'backend'
  $Work = Join-Path $env:TEMP 'nocap-pyinstaller'
  if (Test-Path "$BackendOut\nocap-server") { Remove-Item -Recurse -Force "$BackendOut\nocap-server" }
  $collect = 'whisper librosa numba llvmlite torch torchaudio demucs einops julius openunmix omegaconf dora scipy sklearn soundfile pronouncing syllables cmudict tiktoken flask'.Split(' ') |
    ForEach-Object { '--collect-all', $_ }
  $hidden = 'nocap.web.desktop nocap.web.app nocap.web.analysis_routes nocap.web.library_routes nocap.web.media_routes nocap.pipeline.service nocap.audio.transcriber nocap.audio.beat_tracker nocap.audio.separator nocap.analysis.aligner nocap.text.rhyme'.Split(' ') |
    ForEach-Object { '--hidden-import', $_ }
  Push-Location $ProjectRoot
  & $VenvPython -m PyInstaller --name nocap-server --onedir --noconfirm --console `
    --distpath $BackendOut --workpath "$Work\work" --specpath "$Work\spec" `
    --add-data "$FrontendDir\dist;frontend_dist" `
    @collect --collect-submodules nocap @hidden `
    nocap\web\desktop.py
  Check 'PyInstaller'
  Pop-Location
}

# 4. Icon
Copy-Item (Join-Path $ProjectRoot 'source\app-icon.png') (Join-Path $BuildDir 'icon.png') -Force

# 5. Electron main + package
if (-not $SkipFrontend) {
  Push-Location $FrontendDir
  npx tsc -b; Check 'tsc'
  npx vite build --config vite.desktop.config.ts; Check 'vite desktop build'
  npx electron-builder --win; Check 'electron-builder'
  Pop-Location
}

Write-Host ''
Write-Host "Build complete: $FrontendDir\dist-app\win-unpacked\noCap.exe"
