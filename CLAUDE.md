# Relaunch — instruções para o Claude

Launcher desktop (Electron + Vite + React + TypeScript + Tailwind) para ports e recompilações de jogos feitas por fãs. Interface em PT-BR (padrão) e EN.

## Comandos

- `npm run check` — typecheck + ESLint + Prettier + Vitest. Rode antes de todo push.
- `npm run dev` — app em desenvolvimento. `npm run build` — build de produção em `out/`.
- `npm run dist` — instalador Windows (NSIS). No Linux precisa de Wine 32 bits.

## Mapa do código

- `src/shared/` — lógica pura e tipos (manifesto/zod, versões, globs/preserve/checksums, devlog, formulários de config). Sem dependência do Electron; coberta por testes.
- `src/main/` — processo principal: IPC (`ipc.ts`), biblioteca, requisitos, launcher, cliente GitHub com ETag, atualização/backup/rollback (`updateCore.ts`), extração (`archive.ts`), electron-updater.
- `src/preload/` — ponte `window.api` (contextIsolation + sandbox).
- `src/renderer/` — interface React. Textos novos entram em `i18n/pt-BR.ts` **e** `i18n/en.ts`.
- `manifests/` — um JSON por jogo. `tests/` — Vitest.

## Regras do dono do projeto (Silvamenu)

- **Tudo sai da conta dele.** Commits com autor e committer `Silvamenu <106407101+Silvamenu@users.noreply.github.com>`, sem assinatura com a chave do container (`commit.gpgsign=false`) e **sem** trailers `Co-Authored-By`/`Claude-Session`; descrições de PR sem rodapé de atribuição ao Claude. O hook `.claude/hooks/session-start.sh` já configura a identidade em sessões na nuvem.
- **Auto-fix sempre ligado.** Trabalhe em branch e abra PR para a `main`; logo após abrir, inscreva a sessão na atividade do PR e corrija CI e revisões até ficar verde.
- **Segurança primeiro.** Workflows com permissões mínimas e Actions fixadas por SHA (com a versão em comentário); nenhum segredo no código; downloads só do repositório declarado no manifesto, via HTTPS; nada de ROMs ou assets com direitos autorais no repositório.
- Use a estrutura do GitHub que agilize, proteja e otimize o projeto (CI, Dependabot, templates, varreduras), sempre seguindo as melhores práticas de segurança.
