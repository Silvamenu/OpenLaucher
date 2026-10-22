# Como contribuir

Obrigado por ajudar o Relaunch! Este guia resume o fluxo do projeto.

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

## Princípios do código

Toda mudança segue estes princípios. Na dúvida, escolha a opção mais simples e mais segura.

- **Segurança primeiro.** Trate como não confiável tudo que vem de fora: manifestos, releases, arquivos do usuário e respostas da rede. Valide na fronteira (IPC, schema do manifesto, URLs), dê só a permissão necessária (workflows, preload, processos) e, quando algo der errado, falhe de forma segura, sem perder dados do usuário.
- **KISS.** Prefira o código direto e fácil de ler a soluções genéricas ou "espertas". Uma função faz uma coisa.
- **YAGNI.** Escreva só o que é usado agora. Nada de opções, abstrações ou dependências "para o futuro"; código, arquivo ou dependência sem uso sai.
- **DRY.** Cada regra ou dado mora em um lugar só (por exemplo, a marca em `src/shared/brand.ts` e o schema do manifesto em `src/shared/manifest.ts`). Reaproveite antes de copiar, mas não crie abstração para duas linhas parecidas.
- **Testes para o que importa.** Lógica nova em `src/shared/` ou no fluxo de atualização vem com teste em `tests/`; um bug corrigido ganha o teste que teria pegado o bug.
- **Mudanças pequenas.** Um PR resolve um assunto, com commits pequenos e revisáveis.

## Fluxo de trabalho

1. Crie uma branch a partir da `main`.
2. Faça commits pequenos no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português: `feat: …`, `fix: …`, `docs: …`, `chore: …`.
3. Atualize o `CHANGELOG.md` na seção **Não lançado** quando a mudança for visível para quem usa o app.
4. Abra o PR preenchendo o template.

## Adicionar um jogo

Um jogo novo é só um arquivo `manifests/<id>.json` — não precisa mexer no código. O formato está explicado no [README](README.md#criar-um-manifesto). Os testes (`npm test`) validam todos os manifestos da pasta.

## Conduta

Participar do projeto significa seguir o [Código de Conduta](CODE_OF_CONDUCT.md).

## Regras que não mudam

- O Relaunch **nunca** baixa, distribui ou embute ROMs ou assets com direitos autorais. Não envie esses arquivos em PRs, issues ou testes.
- Nada de segredos (tokens, senhas, chaves) no código: use GitHub Secrets nos workflows.
- Problemas de segurança vão para o canal privado descrito em [SECURITY.md](SECURITY.md).
