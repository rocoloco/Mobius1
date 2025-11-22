
# Kiro Prompt Library — Mobius1v3

## 1) Create/Refine Specs
```
#spec:create-spec
We are building Mobius 1 — a sovereign AI platform for Spain-focused gestorías and expat agencies.
Please generate a complete requirements.md for the module “Workspace Management” including:
- functional + non-functional requirements
- user stories with acceptance criteria
- data model outline and API sketch
Follow `.kiro/steering/team-standards.md`.
```
```
#spec:workspace-management
Update design.md to add AESIA-ready audit export and OIDC/SCIM identity.
Include Mermaid diagram and list endpoints + DB schema.
```

## 2) Break down tasks
```
#spec:workspace-management
Generate tasks.md with granular tasks (backend, migrations, tests).
Each task must reference related requirements (e.g., REQ-1, NFR-2).
```

## 3) Implement
```
#spec:workspace-management implement task 1.1
Create Fastify routes for /workspaces (CRUD) with zod validation and unit tests.
```

## 4) Review/Hardening
```
Review the code for GDPR compliance, ensure PII redaction in logs, and add threat model checklist.
```
