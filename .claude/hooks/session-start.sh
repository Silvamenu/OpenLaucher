#!/bin/bash
# SessionStart (Claude Code na nuvem): prepara o repositório para a sessão.
# - Commits saem da conta do dono do projeto (e-mail noreply do GitHub), sem assinatura com a
#   chave do container — no GitHub ela apareceria como "Unverified" para essa conta.
# - Instala as dependências (inclui o binário do Electron via postinstall) para testes,
#   lint e build funcionarem desde o início.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

git config user.name "Silvamenu"
git config user.email "106407101+Silvamenu@users.noreply.github.com"
git config commit.gpgsign false
git config tag.gpgsign false

# npm install (e não npm ci) aproveita o cache do container entre sessões; é idempotente.
npm install --no-audit --no-fund
