param(
  [string] $Branch = 'main',
  [switch] $SkipChecks
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

if (-not $SkipChecks) {
  & (Join-Path $PSScriptRoot 'check-deploy-ready.ps1')
}

$remote = git remote get-url origin
Write-Host "Git remote: $remote"

Write-Host "Pushing $Branch to GitHub. Render and Netlify auto-deploy should start after this push if both services are connected to the repo."
git push origin $Branch

Pop-Location
