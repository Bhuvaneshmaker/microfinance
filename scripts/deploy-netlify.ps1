param(
  [string] $SiteId = $env:NETLIFY_SITE_ID,
  [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $repoRoot 'frontend'

if (-not $SkipBuild) {
  & (Join-Path $PSScriptRoot 'check-deploy-ready.ps1')
}

Push-Location $frontend

if (-not (Test-Path -LiteralPath 'dist/index.html')) {
  throw 'Missing frontend/dist/index.html. Run scripts/check-deploy-ready.ps1 first.'
}

$deployArgs = @('netlify-cli', 'deploy', '--prod', '--dir', 'dist')
if ($SiteId) {
  $deployArgs += @('--site', $SiteId)
}

Write-Host 'Deploying frontend to Netlify...'
Write-Host 'If this is your first time, Netlify CLI will ask you to log in or provide NETLIFY_AUTH_TOKEN.'
npx --yes @deployArgs

Pop-Location
