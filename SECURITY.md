# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x     | Yes       |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please email security reports to: **security@clipchat.dev** (or open a [GitHub Security Advisory](https://github.com/your-org/clipchat/security/advisories/new)).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive an acknowledgement within 48 hours and a resolution timeline within 7 days.

## Scope

In scope:
- API key authentication bypass
- SQL injection via job inputs
- Path traversal in file storage
- Remote code execution via FFmpeg arguments
- Privilege escalation

Out of scope:
- Denial of service via large file uploads (mitigate with reverse proxy limits)
- Issues in third-party dependencies (report upstream)
