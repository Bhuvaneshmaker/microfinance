param(
  [string[]] $NetlifySiteIds = @(),
  [string] $Branch = 'main',
  [switch] $SkipNetlifyCliDeploy
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot 'check-deploy-ready.ps1')

Push-Location $repoRoot
$status = git status --short
if ($status) {
  Write-Host 'There are uncommitted changes. Commit them before Git-based deploy:'
  Write-Host $status
  Write-Host ''
  Write-Host 'Suggested commands:'
  Write-Host 'git add .'
  Write-Host 'git commit -m "Fix production deployment"'
  Write-Host "git push origin $Branch"
} else {
  git push origin $Branch
}
Pop-Location

if (-not $SkipNetlifyCliDeploy) {
  if ($NetlifySiteIds.Count -eq 0) {
    Write-Host 'No Netlify site IDs were provided. Skipping direct Netlify CLI deploy.'
    Write-Host 'If Netlify auto-deploy is connected to GitHub, the git push above is enough.'
    Write-Host 'For direct deploy, run:'
    Write-Host '.\scripts\deploy-netlify.ps1 -SiteId YOUR_NETLIFY_SITE_ID -SkipBuild'
  } else {
    foreach ($siteId in $NetlifySiteIds) {
      & (Join-Path $PSScriptRoot 'deploy-netlify.ps1') -SiteId $siteId -SkipBuild
    }
  }
}
