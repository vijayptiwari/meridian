# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories or email the maintainer directly. Do not open public issues for credential leaks or RCE reports.

## Local-first security notes

- Meridian binds the dashboard to `127.0.0.1` by default.
- API keys in `config.json` and `.env` are stored on your machine — protect those files.
- Do not commit `src/config.json` or `.env`.

## Responsible use

Meridian assists with job search workflows. Users are responsible for complying with portal terms of service.
