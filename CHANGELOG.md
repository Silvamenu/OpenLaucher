# Changelog

Todas as mudanças relevantes do Relaunch ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [versionamento semântico](https://semver.org/lang/pt-BR/).

O conteúdo de cada versão é usado como nota do release no GitHub (`npm run release-notes`) e aparece no popup "Novidades" do app. Use as seções **Novidades**, **Melhorias** e **Correções**.

## [Não lançado]

## [0.1.0] - 2026-10-22

### Novidades

- Tela **Quem está jogando?** com perfis locais: nome, cor do avatar, PIN opcional de 4 dígitos e exportar/importar o perfil (arquivo `.relaunch`). Nada vai para a internet.
- Biblioteca em grade com status de cada jogo: **Pronto**, **Falta configurar** ou **Pasta não encontrada**.
- Botão **Baixar** nos projetos suportados: instala a versão mais recente, direto do repositório oficial, numa pasta que você escolhe.
- Adição de jogos já instalados com detecção automática do projeto pela pasta (ou escolha manual).
- Manifestos para Ship of Harkinian, 2 Ship 2 Harkinian, Zelda 64: Recompiled, Starship, SpaghettiKart e Super Mario 64 PC Port. Um jogo novo é só um arquivo `manifests/<id>.json`.
- Checklist de configuração com ações: selecionar a sua ROM (com validação por SHA-1), abrir a pasta e abrir o jogo pela primeira vez.
- Dicas nos termos técnicos (**ROM**, **assets**, **port**, **SHA-1**, **.o2r**, **release**, **manifesto**…): passe o mouse ou use o Tab para ver o que cada um significa. A da ROM também explica como usá-la no jogo.
- Editor dos arquivos de configuração (JSON/INI/texto) em formulário ou texto, com backup automático antes de salvar.
- Botão **Jogar** com registro do último acesso e do tempo jogado.
- Busca rápida de jogos com `Ctrl+K` e página **Downloads** com o progresso das atualizações.
- Atualização dos jogos pelos GitHub Releases. O app:
  - verifica ao abrir e a cada 3 horas (usando ETag);
  - avisa com badge e notificação;
  - faz backup dos arquivos que a atualização vai substituir e preserva saves, configs e arquivos gerados da ROM;
  - restaura a versão anterior automaticamente se algo falhar.
- Botão **Voltar para versão anterior** usando o último backup: desfaz só o que a atualização trocou.
- Atualização do próprio launcher em segundo plano, com o botão azul na barra lateral, e este popup de novidades.
- Tema claro e escuro, interface em português (Brasil) e inglês.

### Melhorias

- Token pessoal do GitHub (opcional), cifrado com o cofre do sistema quando disponível, para aumentar o limite de consultas.
- Atualizações protegidas: só baixam do repositório declarado no manifesto, via HTTPS, conferem o tamanho e, quando o release publica, o SHA-256, e limitam o tamanho e a quantidade de arquivos extraídos (`.zip`, `.tar` e `.7z`).
- Abertura rápida: a validação das ROMs fica guardada entre uma abertura e outra e a busca por atualizações começa depois que a biblioteca aparece.
- Ao remover um jogo da biblioteca, os backups que o app fez dele também são apagados (os arquivos do jogo continuam onde estão).
- Fechar o app no meio de uma atualização cancela e desfaz o que já tinha sido trocado antes de sair.
