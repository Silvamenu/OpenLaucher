# Como contribuir

Obrigado por ajudar o RecompHub! Este guia resume o fluxo do projeto.

## Preparar o ambiente

Requisitos: **Node.js 22.12+** (veja `.nvmrc`) e npm.

```bash
npm install     # também baixa o binário do Electron
npm run dev     # abre o app com recarregamento automático
```

## Antes de abrir um PR

```bash
npm run check   # tipos + lint + formatação + testes
npm run format  # corrige a formatação (Prettier)
```

O CI roda as mesmas verificações no Linux e no Windows, além de `npm audit` e das varreduras de segurança. Um PR só entra na `main` com tudo verde e a revisão de [@Silvamenu](https://github.com/Silvamenu) (veja `.github/CODEOWNERS`).

## Fluxo de trabalho

1. Crie uma branch a partir da `main`.
2. Faça commits pequenos no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português: `feat: …`, `fix: …`, `docs: …`, `chore: …`.
3. Atualize o `CHANGELOG.md` na seção **Não lançado** quando a mudança for visível para quem usa o app.
4. Abra o PR preenchendo o template.

## Adicionar um jogo

Um jogo novo é só um arquivo `manifests/<id>.json` — não precisa mexer no código. O formato está explicado no [README](README.md#criar-um-manifesto). Os testes (`npm test`) validam todos os manifestos da pasta.

## Regras que não mudam

- O RecompHub **nunca** baixa, distribui ou embute ROMs ou assets com direitos autorais. Não envie esses arquivos em PRs, issues ou testes.
- Nada de segredos (tokens, senhas, chaves) no código: use GitHub Secrets nos workflows.
- Problemas de segurança vão para o canal privado descrito em [SECURITY.md](SECURITY.md).
