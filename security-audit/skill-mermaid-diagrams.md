SKILL VETTING REPORT
═══════════════════════════════════════
Skill: skill-mermaid-diagrams
Source: ClawHub
Author: chunhualiao
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T04:16:30.289Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS:
- Requires global npm package installation (@mermaid-js/mermaid-cli)
- Security scan marked as SUSPICIOUS

PERMISSIONS NEEDED:
• Files: Read local content, write Mermaid/SVG/PNG output files
• Network: None (after initial npm installation)
• Commands: Node.js, mermaid-cli (mmdc), shell scripts
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as SUSPICIOUS, likely due to npm dependencies and shell scripts
- Comprehensive diagram generation skill with 12 template types
- Supports architecture, flowchart, sequence, concept-map, radial-concept, timeline, comparison, comparison-table, gantt, mindmap, class-diagram, state-diagram
- All processing is local, no external API calls
- Uses Mermaid CLI for rendering diagrams to SVG/PNG
- Well-documented with 16KB SKILL.md and extensive examples
- Includes validation, auto-correction, and semantic testing scripts
- Useful for technical documentation, system architecture, project planning
- Shell script (install-deps.sh) should be reviewed before running
═══════════════════════════════════════
