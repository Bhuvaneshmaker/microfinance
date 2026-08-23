param(
  [string] $ServiceId = $env:RENDER_SERVICE_ID,
  [string] $ApiKey = $env:RENDER_API_KEY,
  [string] $CommitId = '',
  [switch] $ClearCache
)

$ErrorActionPreference = 'Stop'

if (-not $ServiceId) {
  throw 'Missing Render service ID. Pass -ServiceId or set RENDER_SERVICE_ID.'
}

if (-not $ApiKey) {
  throw 'Missing Render API key. Pass -ApiKey or set RENDER_API_KEY.'
}

$body = @{
  clearCache = if ($ClearCache) { 'clear' } else { 'do_not_clear' }
}

if ($CommitId) {
  $body.commitId = $CommitId
}

$headers = @{
  Authorization = "Bearer $ApiKey"
  Accept = 'application/json'
  'Content-Type' = 'application/json'
}

$uri = "https://api.render.com/v1/services/$ServiceId/deploys"

Write-Host "Triggering Render deploy for service $ServiceId..."
$response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body ($body | ConvertTo-Json)
$response | ConvertTo-Json -Depth 10
