param(
  [ValidateSet("linkedin", "naukri", "both")]
  [string]$Portal = "both",

  [ValidateSet("search", "assist-apply", "next-role", "career-transition", "gmail-cleanup", "demo")]
  [string]$Mode = "search",

  [ValidateSet("preview", "trash", "delete")]
  [string]$GmailAction = "preview",

  [string]$GmailQuery = "",

  [int]$GmailMaxMessages = 0,

  [switch]$Headed
)

$ErrorActionPreference = "Stop"

$env:JOB_AGENT_PORTAL = $Portal
$env:JOB_AGENT_MODE = $Mode
$env:JOB_AGENT_HEADED = if ($Headed) { "true" } else { "false" }
$env:JOB_AGENT_GMAIL_ACTION = $GmailAction
$env:JOB_AGENT_GMAIL_QUERY = $GmailQuery
$env:JOB_AGENT_GMAIL_MAX_MESSAGES = if ($GmailMaxMessages -gt 0) { "$GmailMaxMessages" } else { "" }

node src/index.js

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
