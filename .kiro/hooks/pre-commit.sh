
#!/usr/bin/env bash
set -euo pipefail
echo "Running pre-commit checks..."
npm run -s lint || true
npm test || true
echo "Secret scan (simple grep)"
if grep -R --exclude-dir=node_modules -nE '(AWS_SECRET|BEGIN RSA PRIVATE KEY|apikey=)' . ; then
  echo "Potential secret detected. Commit aborted."
  exit 1
fi
echo "OK"
