param(
  [ValidateSet("linkedin", "naukri", "both")]
  [string]$Portal = "both",

  [ValidateSet("search", "assist-apply", "next-role", "career-transition", "demo")]
  [string]$Mode = "search",

  [switch]$Headed
)

$ErrorActionPreference = "Stop"

$env:JOB_AGENT_PORTAL = $Portal
$env:JOB_AGENT_MODE = $Mode
$env:JOB_AGENT_HEADED = if ($Headed) { "true" } else { "false" }

node src/index.js

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
