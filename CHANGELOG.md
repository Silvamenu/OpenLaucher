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
- Catálogo com 66 projetos, todos conferidos nos repositórios oficiais. Um jogo novo é só um arquivo `manifests/<id>.json`.
  - Ports e recompilações: Ship of Harkinian, 2 Ship 2 Harkinian, Zelda 64: Recompiled, Starship, SpaghettiKart, Super Mario 64 PC Port, Perfect Dark, Banjo e Donkey Kong 64: Recompiled, Dusklight (Twilight Princess), Zelda3, Unleashed Recompiled (Sonic Unleashed), OpenGOAL (Jak and Daxter), REDRIVER2, Sonic 3 A.I.R., Sonic CD.
  - Clássicos de PC (com os arquivos do seu jogo): DevilutionX (Diablo), Fallout 1 e 2 CE, OpenRCT2, fheroes2, Julius e Augustus (Caesar III), CorsixTH, OpenMW, Daggerfall Unity, Arx Libertatis, vkQuake, UZDoom, dhewm3 e FreeSpace 2 Open.
  - Emuladores: shadPS4, RPCS3, PCSX2, Xenia Canary, Cemu, DuckStation e PPSSPP.
  - Jogos via emulador, com o nível de compatibilidade de cada um: God of War (PS2, PSP, PS3 e o III Remastered de PS4), Bloodborne, Demon's Souls, Dark Souls, Final Fantasy VII, VIII Remastered e X, Metal Gear Solid, MGS3 e Metal Gear Rising, Resident Evil 2, Shadow of the Colossus, Yakuza 0, Need for Speed: Hot Pursuit Remastered, Halo 3, Gears of War 2 e 3, Red Dead Redemption, Zelda: Breath of the Wild, Mario Kart 8, Super Mario 3D World e Xenoblade Chronicles X.
- Catálogo de projetos em listas por plataforma (**Nintendo**, **PlayStation**, **Xbox**, **Sega**, **PC**, **Emuladores**), que abrem ao clicar, com barra de busca e o nível de compatibilidade de cada jogo.
- Jogos grandes de console via emulador (ex.: **God of War III Remastered** no shadPS4): o app instala o emulador do repositório oficial e você escolhe o seu próprio jogo (dump do seu disco ou da sua compra). O app nunca baixa jogos.
- **Instalar pelo link de um repositório**: cole o endereço de um projeto do GitHub e o app instala a última versão publicada, escolhe o arquivo certo para o seu sistema e detecta o executável (ou você escolhe).
- Checklist de configuração com ações: selecionar a sua ROM (com validação por SHA-1), abrir a pasta e abrir o jogo pela primeira vez.
- Dicas nos termos técnicos (**ROM**, **assets**, **port**, **SHA-1**, **.o2r**, **release**, **manifesto**…): passe o mouse ou use o Tab para ver o que cada um significa. A da ROM também explica como usá-la no jogo.
- Capa e banner de cada jogo editáveis: lápis no canto do banner e na capa (ao passar o mouse). Para voltar ao padrão, use o menu ⚙ do jogo.
- Página **Dúvidas frequentes** na barra lateral: o que é uma ROM e como usá-la, SHA-1 não reconhecido, jogos via emulador, instalar pelo link de um repositório, saves nas atualizações, avisos do Windows, dados e PIN.
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
- Atualizações protegidas: só baixam do repositório declarado no manifesto, via HTTPS, conferem o tamanho e, quando o release publica, o SHA-256, e limitam o tamanho e a quantidade de arquivos extraídos (`.zip`, `.tar`, `.tar.xz` e `.7z`).
- Abertura rápida: a validação das ROMs fica guardada entre uma abertura e outra e a busca por atualizações começa depois que a biblioteca aparece.
- Ao remover um jogo da biblioteca, os backups que o app fez dele também são apagados (os arquivos do jogo continuam onde estão).
- Fechar o app no meio de uma atualização cancela e desfaz o que já tinha sido trocado antes de sair.
