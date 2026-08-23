$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $repoRoot 'frontend'
$backend = Join-Path $repoRoot 'backend'

function Assert-FileContains {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [Parameter(Mandatory = $true)] [string] $Pattern,
    [Parameter(Mandatory = $true)] [string] $Message
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing file: $Path"
  }

  $content = Get-Content -LiteralPath $Path -Raw
  if ($content -notmatch $Pattern) {
    throw $Message
  }
}

Write-Host 'Checking deployment files...'

Assert-FileContains `
  -Path (Join-Path $frontend 'public/_redirects') `
  -Pattern '/api/\* https://microfinance-backend-37jz\.onrender\.com/api/:splat 200!' `
  -Message 'frontend/public/_redirects must proxy /api/* to the Render backend.'

Assert-FileContains `
  -Path (Join-Path $frontend 'netlify.toml') `
  -Pattern 'from = "/api/\*"' `
  -Message 'frontend/netlify.toml must include the /api/* redirect.'

Assert-FileContains `
  -Path (Join-Path $frontend '.env.production') `
  -Pattern 'VITE_API_URL=/api' `
  -Message 'frontend/.env.production must use VITE_API_URL=/api.'

Assert-FileContains `
  -Path (Join-Path $repoRoot 'render.yaml') `
  -Pattern 'https://microfinancelive\.netlify\.app,https://microfinanceapplive\.netlify\.app' `
  -Message 'render.yaml must allow both Netlify frontend domains.'

$searchTargets = @(
  Get-ChildItem -LiteralPath (Join-Path $frontend 'src') -Recurse -File
  Get-Item -LiteralPath (Join-Path $frontend '.env.example')
  Get-Item -LiteralPath (Join-Path $frontend '.env.production')
  Get-Item -LiteralPath (Join-Path $frontend 'netlify.toml')
  Get-Item -LiteralPath (Join-Path $frontend 'vercel.json')
  Get-Item -LiteralPath (Join-Path $frontend 'public/_redirects')
  Get-Item -LiteralPath (Join-Path $repoRoot 'README.md')
  Get-Item -LiteralPath (Join-Path $repoRoot 'DEPLOYMENT.md')
)

$oldUrlMatches = $searchTargets |
  Select-String -Pattern 'microfinance-sooty\.vercel\.app' |
  ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line)" }

if ($oldUrlMatches) {
  $allowedOldUrlNotes = $oldUrlMatches | Where-Object {
    $_ -match 'DEPLOYMENT\.md|README\.md|frontend[\\/]+src[\\/]+api\.js'
  }

  if ($oldUrlMatches.Count -ne $allowedOldUrlNotes.Count) {
    throw "Old API URL found in a deploy-sensitive file:`n$($oldUrlMatches -join "`n")"
  }
}

Write-Host 'Installing frontend dependencies...'
Push-Location $frontend
npm ci
Write-Host 'Building frontend...'
npm run build
Pop-Location

$distRedirects = Join-Path $frontend 'dist/_redirects'
Assert-FileContains `
  -Path $distRedirects `
  -Pattern '/api/\* https://microfinance-backend-37jz\.onrender\.com/api/:splat 200!' `
  -Message 'Build output is missing the Netlify /api proxy in dist/_redirects.'

Write-Host 'Checking backend JavaScript syntax...'
Push-Location $backend
Get-ChildItem -LiteralPath 'src' -Recurse -Filter '*.js' | ForEach-Object {
  node --check $_.FullName
}
Pop-Location

Write-Host 'Deployment check passed.'
