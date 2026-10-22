# Changelog

Todas as mudanças relevantes do RecompHub ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [versionamento semântico](https://semver.org/lang/pt-BR/).

O conteúdo de cada versão é usado como nota do release no GitHub (`npm run release-notes`) e aparece no popup "Novidades" do app. Use as seções **Novidades**, **Melhorias** e **Correções**.

## [Não lançado]

## [0.1.0] - 2026-10-22

### Novidades

- Biblioteca em grade com status de cada jogo: **Pronto**, **Falta configurar** ou **Pasta não encontrada**.
- Adição de jogos já instalados com detecção automática do projeto pela pasta (ou escolha manual).
- Manifestos para Ship of Harkinian, 2 Ship 2 Harkinian, Zelda 64: Recompiled, Starship, SpaghettiKart e Super Mario 64 PC Port. Um jogo novo é só um arquivo `manifests/<id>.json`.
- Checklist de configuração com ações: selecionar a sua ROM (com validação por SHA-1), abrir a pasta e abrir o jogo pela primeira vez.
- Editor dos arquivos de configuração (JSON/INI/texto) em formulário ou texto, com backup automático antes de salvar.
- Botão **Jogar** com registro do último acesso e do tempo jogado.
- Busca rápida de jogos com `Ctrl+K` e página **Downloads** com o progresso das atualizações.
- Atualização dos jogos pelos GitHub Releases. O app:
  - verifica ao abrir e a cada 3 horas (usando ETag);
  - avisa com badge e notificação;
  - faz backup antes de atualizar e preserva saves, configs e arquivos gerados da ROM;
  - restaura a versão anterior automaticamente se algo falhar.
- Botão **Voltar para versão anterior** usando o último backup.
- Atualização do próprio launcher em segundo plano, com o botão azul na barra lateral, e este popup de novidades.
- Tema claro e escuro, interface em português (Brasil) e inglês.

### Melhorias

- Token pessoal do GitHub (opcional) guardado cifrado, para aumentar o limite de consultas.

### Correções

- Primeira versão pública: nenhuma correção ainda.
