<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/relaunch-logo-white.svg">
    <img src="docs/brand/relaunch-logo-black.svg" alt="Relaunch" height="56">
  </picture>
</h1>

[![CI](https://github.com/Silvamenu/OpenLaucher/actions/workflows/ci.yml/badge.svg)](https://github.com/Silvamenu/OpenLaucher/actions/workflows/ci.yml)
[![Segurança](https://github.com/Silvamenu/OpenLaucher/actions/workflows/security.yml/badge.svg)](https://github.com/Silvamenu/OpenLaucher/actions/workflows/security.yml)
[![CodeQL](https://github.com/Silvamenu/OpenLaucher/actions/workflows/codeql.yml/badge.svg)](https://github.com/Silvamenu/OpenLaucher/actions/workflows/codeql.yml)

**Seus ports favoritos, num só lugar.**

O Relaunch é um launcher para Windows e Linux que reúne os **ports e recompilações de jogos feitos por fãs** que você já instalou: Ship of Harkinian, Zelda 64: Recompiled, Starship e outros. Ele mostra o que falta configurar, abre o jogo e mantém tudo atualizado a partir dos releases oficiais de cada projeto. A interface está em português (Brasil) e em inglês.

![Biblioteca do Relaunch no tema escuro, com cinco jogos e o status de cada um](docs/screenshots/biblioteca.png)

> [!IMPORTANT]
> O Relaunch **nunca** baixa, distribui ou embute ROMs, assets ou qualquer arquivo com direitos autorais. Ele só usa arquivos que você já possui, e só baixa os binários publicados pelos próprios projetos, direto do repositório declarado no manifesto, via HTTPS.

## Sumário

- **Para jogar:** [Início rápido](#início-rápido) · [Jogos suportados](#jogos-suportados) · [O que o Relaunch faz](#o-que-o-relaunch-faz) · [Atualizações](#atualizações) · [Onde ficam seus dados](#onde-ficam-seus-dados)
- **Para contribuir:** [Criar um manifesto](#criar-um-manifesto) · [Desenvolvimento](#desenvolvimento) · [Publicar uma versão do launcher](#publicar-uma-versão-do-launcher) · [Qualidade e segurança](#qualidade-e-segurança) · [Contribuir](#contribuir)
- [Créditos](#créditos)

## Início rápido

### Para jogar

1. **Instale o Relaunch.** Baixe o `Relaunch-Setup-<versão>.exe` na página de [Releases](https://github.com/Silvamenu/OpenLaucher/releases) e execute. O instalador deixa escolher a pasta e cria atalhos na área de trabalho e no menu Iniciar.
2. **Tenha o port instalado.** O Relaunch trabalha com jogos que você já instalou pelo site ou repositório oficial do projeto; ele não faz a primeira instalação.
3. **Adicione o jogo.** Clique em **Adicionar jogo → Escolher pasta…** e aponte a pasta do port. O app reconhece o projeto sozinho; confirme em **Adicionar à biblioteca**.
4. **Siga o checklist** da aba **Configuração**: por exemplo, selecionar a sua ROM ou abrir o jogo uma vez para gerar os assets.
5. **Clique em Jogar.**

O instalador não é assinado digitalmente, então o Windows SmartScreen pode avisar na primeira execução (**Mais informações → Executar assim mesmo**).

> [!NOTE]
> Os releases trazem só o instalador do Windows. No Linux, gere o app a partir do código: veja abaixo e [Gerar o instalador](#gerar-o-instalador).

### Para rodar a partir do código

```bash
git clone https://github.com/Silvamenu/OpenLaucher.git
cd OpenLaucher
npm install     # também baixa o binário do Electron
npm run dev     # abre o app com recarregamento automático da interface
npm run check   # tipos + lint + formatação + testes; rode antes de todo push
```

Para gerar o app instalável: `npm run dist` (instalador do Windows) ou `npm run dist:linux` (AppImage). Todos os comandos estão em [Scripts](#scripts).

### Requisitos

| Para                                   | Você precisa de                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Jogar                                  | Windows 10/11 (prioridade) ou Linux, o port já instalado e os seus próprios arquivos que o port pedir (como a sua ROM). |
| Desenvolver                            | Node.js **22.12 ou mais recente** (veja `.nvmrc`) e npm.                                                                |
| Gerar o instalador do Windows no Linux | Wine, incluindo o de 32 bits (`wine32`).                                                                                |

## Jogos suportados

Manifestos que já vêm no app. Todos têm executáveis para Windows e Linux.

| Port                                                                     | Jogo original                        | Atualização pelo app                                                   |
| ------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------- |
| [Ship of Harkinian](https://github.com/HarbourMasters/Shipwright)        | The Legend of Zelda: Ocarina of Time | Sim                                                                    |
| [2 Ship 2 Harkinian](https://github.com/2ship2harkinian/2ship2harkinian) | The Legend of Zelda: Majora's Mask   | Sim                                                                    |
| [Zelda 64: Recompiled](https://github.com/Zelda64Recomp/Zelda64Recomp)   | The Legend of Zelda: Majora's Mask   | Sim                                                                    |
| [Starship](https://github.com/HarbourMasters/Starship)                   | Star Fox 64                          | Sim                                                                    |
| [SpaghettiKart](https://github.com/HarbourMasters/SpaghettiKart)         | Mario Kart 64                        | Sim                                                                    |
| [Super Mario 64 PC Port](https://github.com/sm64-port/sm64-port)         | Super Mario 64                       | Não: o projeto só publica código-fonte. Também reconhece o **sm64ex**. |

Falta algum? Cada jogo é um arquivo JSON, sem mexer no código: veja [Criar um manifesto](#criar-um-manifesto) ou peça com o modelo de issue [Suporte a um novo jogo](https://github.com/Silvamenu/OpenLaucher/issues/new/choose).

## O que o Relaunch faz

| Área                        | O que faz                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Biblioteca**              | Grade com o status de cada jogo (**Pronto**, **Falta configurar**, **Pasta não encontrada**), filtros e busca rápida com `Ctrl+K`.                                                                           |
| **Adicionar jogo**          | Você escolhe a pasta e o app detecta o projeto pelos arquivos dela (inclusive numa subpasta), ou deixa você escolher da lista.                                                                               |
| **Página do jogo**          | Abas **Configuração**, **Arquivos de config**, **Atualizações** e **Sobre**. Pelo menu do jogo: renomear, escolher uma capa, trocar a pasta ou remover da biblioteca (os arquivos do jogo não são apagados). |
| **Checklist**               | Requisitos com ✓/✗ e ações: selecionar a sua ROM (validada por tamanho ou SHA-1), copiá-la para a pasta do jogo, abrir a pasta, abrir o jogo pela primeira vez e ver instruções.                             |
| **Editor de configs**       | Arquivos JSON, INI e texto, editáveis em formulário ou como texto. Valida antes de salvar, faz backup automático e permite restaurar.                                                                        |
| **Jogar**                   | Abre o executável com a pasta do jogo como diretório de trabalho, mais os argumentos e variáveis de ambiente do manifesto. Registra o último acesso e o tempo jogado.                                        |
| **Capas**                   | Capa gerada com a cor do manifesto, ou uma imagem escolhida por você.                                                                                                                                        |
| **Atualizações dos jogos**  | Busca versões novas nos GitHub Releases de cada projeto, faz backup, preserva saves e volta sozinho se algo falhar. Veja [como funciona](#atualizações-dos-jogos).                                           |
| **Downloads**               | Atualizações em andamento, disponíveis e concluídas na sessão. O progresso também aparece na barra lateral.                                                                                                  |
| **Atualização do launcher** | Baixa a versão nova do Relaunch em segundo plano e avisa com um botão azul na barra lateral. Depois, o popup **Novidades** mostra o que mudou.                                                               |
| **Configurações**           | Tema escuro, claro ou do sistema; idioma (PT-BR padrão, EN); nome do perfil; token do GitHub; notificações; atualização automática por jogo; pastas de manifestos e de dados; reescanear pastas.             |

![Página do Ship of Harkinian com os botões Jogar e Atualizar para 9.3.1, a versão instalada, o último jogo e o tempo jogado](docs/screenshots/jogo.png)

## Atualizações

### Atualizações dos jogos

- O app consulta os GitHub Releases de cada projeto **ao abrir e a cada 3 horas** (dá para desligar em **Configurações**). Quando há versão nova, aparecem um badge e uma notificação do sistema.
- Para atualizar, use **Atualizar para…** na página do jogo, a aba **Atualizações** ou a página **Downloads**. Com **Atualizar automaticamente** ligado no jogo, as versões novas são instaladas sozinhas quando o jogo não está aberto.
- Saves, configurações, mods e arquivos gerados da sua ROM **não são sobrescritos** (lista `preserve` do manifesto).
- Antes de atualizar, o app faz um backup. Se algo falhar, ele restaura tudo sozinho. O botão **Voltar para a versão anterior** desfaz uma atualização concluída.
- A versão instalada é a tag do release. Em jogos adicionados manualmente ela começa como "Desconhecida": informe a versão na aba **Atualizações** ou clique em **Já tenho a mais recente**.
- Projetos sem binários publicados (como o Super Mario 64 PC Port) mostram só o link do repositório.

<details>
<summary><strong>Passo a passo de uma atualização</strong></summary>

| #   | Etapa                         | O que acontece                                                                                                                                                             |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Escolha do asset              | O app pega o arquivo do release que casa com o `assetPatterns` da plataforma.                                                                                              |
| 2   | Origem                        | Confere se a URL é `https://github.com/<repo do manifesto>/releases/download/…`. Redirecionamentos só são aceitos para a CDN de releases do GitHub.                        |
| 3   | Download                      | Baixa para uma pasta temporária, com progresso e cancelamento.                                                                                                             |
| 4   | Integridade                   | Confere o tamanho e o SHA-256, vindo do campo `digest` da API ou de um arquivo de checksums do release, quando existir.                                                    |
| 5   | Extração                      | Extrai zip, 7z ou tar (`.tar.gz`, `.tgz`, `.tar.bz2`). Uma pasta raiz única vira a raiz; um pacote dentro de outro (ex.: um `.tar.gz` dentro do `.zip`) também é extraído. |
| 6   | Jogo aberto                   | Se o jogo estiver rodando, o app pede para fechar.                                                                                                                         |
| 7   | Backup                        | Cria `backups/<id>/<versão>/backup.zip` nos dados do app e mantém os 2 mais recentes.                                                                                      |
| 8   | Cópia                         | Copia os arquivos novos por cima, pulando o que casar com `preserve`. Cada arquivo é registrado antes de ser escrito.                                                      |
| 9   | Falha                         | Se algo der errado, os arquivos novos são removidos e os alterados voltam do backup automaticamente.                                                                       |
| 10  | Voltar para a versão anterior | Restaura o último backup sem sobrescrever saves e configs, e remove os arquivos que a atualização tinha adicionado.                                                        |

</details>

### Atualização do launcher

- Na versão instalada, o Relaunch procura versões novas dele mesmo **ao abrir e a cada 3 horas**, nos GitHub Releases deste repositório.
- A versão nova é baixada em segundo plano. Um **botão azul** aparece acima do avatar, na barra lateral: clique para reiniciar e instalar, ou ela é instalada quando você fechar o app.
- Depois de atualizar, o popup **Novidades da vX.Y.Z** mostra as notas do `CHANGELOG.md`. Para rever, use **Configurações → Ver novidades**.

![Popup "Novidades da v0.1.0" com a lista de novidades da versão](docs/screenshots/novidades.png)

### Limite da API do GitHub

Sem login, a API do GitHub permite **60 consultas por hora**. O app usa ETag (`If-None-Match`) e reaproveita as respostas que não mudaram (`304`); com um token configurado, essas respostas `304` não contam no limite.

> [!TIP]
> Para mais folga, cole um **token pessoal do GitHub** em **Configurações**: o limite sobe para 5.000 consultas por hora. O token não precisa de nenhuma permissão especial, fica cifrado com o cofre do sistema quando ele está disponível (DPAPI no Windows) e nunca é devolvido à interface.

## Onde ficam seus dados

| Sistema | Pasta                |
| ------- | -------------------- |
| Windows | `%APPDATA%\Relaunch` |
| Linux   | `~/.config/Relaunch` |

| Item              | O que guarda                                                                    |
| ----------------- | ------------------------------------------------------------------------------- |
| `relaunch.json`   | Biblioteca, configurações e cache.                                              |
| `backups/`        | Backups feitos antes de cada atualização de jogo (os 2 mais recentes por jogo). |
| `config-backups/` | Backups dos arquivos de configuração salvos pelo editor (até 10 por arquivo).   |
| `covers/`         | Capas que você escolheu para os jogos.                                          |
| `manifests/`      | Seus manifestos, que adicionam ou substituem os embutidos.                      |

Abra essa pasta em **Configurações → Abrir pasta de dados do app**. Desinstalar o Relaunch não apaga esses dados.

> [!NOTE]
> O Relaunch se chamava **RecompHub**. Na primeira abertura com o nome novo, os dados da pasta antiga (`RecompHub`) são movidos para a pasta `Relaunch`. No Linux, o token do GitHub fica preso ao nome antigo no cofre do sistema: se ele sumir, cole-o de novo em **Configurações**.

## Criar um manifesto

Cada projeto suportado é descrito por um arquivo `manifests/<id>.json`. **Adicionar um jogo = adicionar um manifesto, sem mexer no código.**

- O nome do arquivo precisa ser igual ao `id`.
- Os manifestos embutidos ficam em [`manifests/`](manifests), e os testes (`npm test`) validam todos eles. Os manifestos reais são bons pontos de partida.
- Você também pode colocar manifestos na sua pasta de manifestos (**Configurações → Abrir pasta de manifestos**). Um manifesto seu com o mesmo `id` substitui o embutido.
- Use **Reescanear pastas** para recarregar sem reiniciar. Manifestos inválidos aparecem em **Configurações**, com o erro.

| Campo                      | Obrigatório | Para quê                                                                                      |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `id`                       | sim         | Letras minúsculas, números, `-` e `_`. Igual ao nome do arquivo.                              |
| `name`                     | sim         | Nome exibido.                                                                                 |
| `originalGame`             | não         | Jogo original.                                                                                |
| `description`              | não         | Texto curto exibido na aba **Sobre**.                                                         |
| `repoUrl`                  | sim         | Repositório do projeto (HTTPS).                                                               |
| `website`                  | não         | Site oficial (HTTPS).                                                                         |
| `accentColor`              | não         | Cor da capa gerada, no formato `#RRGGBB`.                                                     |
| `executables`              | sim         | Executáveis por plataforma.                                                                   |
| `detectFiles`              | sim         | Arquivos que identificam a pasta do projeto.                                                  |
| `requirements`             | não         | Itens do checklist da aba **Configuração**.                                                   |
| `configFiles`              | não         | Arquivos de configuração editáveis no app.                                                    |
| `launchArgs` / `launchEnv` | não         | Argumentos e variáveis de ambiente ao abrir o jogo.                                           |
| `updates`                  | não         | De onde vêm as atualizações. Sem ele, vale `{ "source": "none" }`.                            |
| `_todo` e chaves com `_`   | não         | Anotações ignoradas pelo app. O `_todo` aparece na página do jogo como pendência a confirmar. |

<details>
<summary><strong>Exemplo comentado (Ship of Harkinian)</strong></summary>

```jsonc
{
  "id": "soh", // letras minúsculas, números, "-" e "_"
  "name": "Ship of Harkinian",
  "originalGame": "The Legend of Zelda: Ocarina of Time",
  "description": "Texto curto exibido na aba Sobre.",
  "repoUrl": "https://github.com/HarbourMasters/Shipwright",
  "website": "https://www.shipofharkinian.com", // opcional
  "accentColor": "#3f8f4a", // cor da capa gerada (opcional)

  "executables": { "win32": ["soh.exe"], "linux": ["soh.appimage"] },
  "detectFiles": ["soh.exe", "soh.appimage", "soh.o2r"],

  "requirements": [
    { "id": "port-data", "type": "file", "label": "Arquivo de dados do port", "patterns": ["soh.o2r"], "helpText": "Vem junto com o download do port." },
    {
      "id": "rom",
      "type": "userFile",
      "label": "Sua ROM",
      "optional": true,
      "extensions": ["z64", "n64", "v64"],
      "copyToGameDir": true,
      // SHA-1 completo, com 40 caracteres hexadecimais
      "validation": { "sizes": [33554432], "sha1": [{ "sha1": "ad69c91157f6705e8ab06c79fe08aad47bb57ba7", "label": "NTSC 1.0 (US)" }] }
    },
    {
      "id": "rom-assets",
      "type": "firstRun",
      "label": "Gerar os assets a partir da sua ROM",
      "doneWhen": ["oot.o2r", "oot-mq.o2r"],
      "helpText": "Abra o jogo uma vez…"
    }
  ],

  "configFiles": [
    { "path": "shipofharkinian.json", "format": "json", "label": "Configurações" },
    { "path": { "win32": ["general.json", "{localAppData}/Jogo/general.json"] }, "format": "json" }
  ],

  "launchArgs": [],
  "launchEnv": { "linux": { "SHIP_HOME": "{gameDir}" } },

  "updates": {
    "source": "github-releases",
    "repo": "HarbourMasters/Shipwright",
    "assetPatterns": { "win32": "*Win64*.zip", "linux": ["*.appimage", "*Linux*.zip"] },
    "includePrereleases": false,
    "preserve": ["oot.o2r", "oot-mq.o2r", "Save/**", "shipofharkinian.json", "mods/**", "imgui.ini"]
  },

  "_todo": "Use para anotar o que falta confirmar; aparece na página do jogo como pendência."
}
```

</details>

<details>
<summary><strong>Referência completa dos campos</strong></summary>

#### `executables` e `detectFiles`

- Nomes ou globs relativos à pasta do jogo, sem diferenciar maiúsculas de minúsculas.
- `executables` é por plataforma (`win32`, `linux`, `darwin`) e precisa de ao menos uma.
- Na detecção, ganha o manifesto com a maior proporção de `detectFiles` encontrados.

#### `requirements`

Todos os tipos aceitam `id`, `label`, `optional` e `helpText` (markdown). O `id` é recomendado, porque é a chave das escolhas salvas.

| `type`     | Fica ✓ quando                                                                                                                       | Campos próprios                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`     | Algum dos `patterns` existe.                                                                                                        | `patterns`: relativos à pasta do jogo, ou caminhos absolutos com variáveis, como `{localAppData}/Jogo/arquivo.bin`.                                     |
| `userFile` | O usuário seleciona um arquivo dele (ex.: a ROM) e ele passa na validação.                                                          | `extensions` (sem ponto); `validation` com `sizes` e/ou `sha1`; `copyToGameDir` faz o app oferecer copiar o arquivo para a pasta do jogo (cópia local). |
| `firstRun` | Com `doneWhen`: algum desses arquivos existe. Sem `doneWhen`: depois do primeiro lançamento pelo launcher ou ao marcar manualmente. | `doneWhen`                                                                                                                                              |

#### `configFiles`

| Campo      | Valores                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `format`   | `json`, `ini` ou `text`.                                                                        |
| `path`     | Um texto, uma lista de candidatos (o primeiro que existir é usado) ou um objeto por plataforma. |
| `label`    | Nome exibido (opcional).                                                                        |
| `editable` | `false` deixa o arquivo somente leitura no app.                                                 |

#### Variáveis de caminho

Aceitas em caminhos (`path`, `patterns`), em `launchArgs` e em `launchEnv`:

| Variável         | Windows                   | Linux                                |
| ---------------- | ------------------------- | ------------------------------------ |
| `{gameDir}`      | pasta do jogo             | pasta do jogo                        |
| `{appData}`      | `%APPDATA%`               | `$XDG_CONFIG_HOME` ou `~/.config`    |
| `{localAppData}` | `%LOCALAPPDATA%`          | `$XDG_DATA_HOME` ou `~/.local/share` |
| `{home}`         | pasta do usuário          | pasta do usuário                     |
| `{documents}`    | `%USERPROFILE%\Documents` | `~/Documents`                        |

#### `launchArgs` e `launchEnv`

- Argumentos e variáveis de ambiente passados ao abrir o jogo.
- `launchArgs` é uma lista ou um objeto por plataforma; `launchEnv` é um objeto por plataforma.

#### `updates`

- `{ "source": "none" }` para projetos sem binários publicados; o app mostra só o link do repositório.
- `{ "source": "github-releases", … }` para projetos que publicam releases:

| Campo                | O que faz                                                                                                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repo`               | No formato `dono/repositorio`. Os downloads só são aceitos desse repositório.                                                                                                                                                                                   |
| `assetPatterns`      | Globs por plataforma, testados em ordem. Se nenhum casar, o app avisa e não baixa nada. Se o asset for um binário solto (AppImage/exe), ele é salvo com o nome do primeiro executável da plataforma que não seja um glob.                                       |
| `includePrereleases` | Usa a lista de releases em vez de `/releases/latest`.                                                                                                                                                                                                           |
| `preserve`           | O que **nunca é sobrescrito** na atualização. Padrão sem `/` casa pelo nome do arquivo em qualquer pasta (ex.: `imgui.ini`, `*.sav`); com `/`, é relativo à raiz (ex.: `Save/**`, `mods/`). Arquivos preservados que ainda não existem são criados normalmente. |

</details>

> [!WARNING]
> Liste em `preserve` só os arquivos do **usuário**: saves, configs, mods e assets gerados da ROM. Não use curingas que peguem arquivos do próprio port. Exemplo: no Ship of Harkinian, `soh.o2r` é do port e **precisa** ser atualizado, então preserve `oot.o2r` e `oot-mq.o2r`, e não `*.o2r`.

## Desenvolvimento

Electron + electron-vite + React + TypeScript + Tailwind CSS. Requisitos: Node.js **22.12 ou mais recente** (veja `.nvmrc`) e npm. Para clonar e abrir o app, veja [Para rodar a partir do código](#para-rodar-a-partir-do-código).

### Scripts

**Dia a dia**

| Script                 | Para quê                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run dev`          | Abre o app com recarregamento automático da interface.           |
| `npm run check`        | Tipos + lint + formatação + testes. **Rode antes de todo push.** |
| `npm test`             | Testes unitários (Vitest).                                       |
| `npm run test:watch`   | Testes em modo watch.                                            |
| `npm run typecheck`    | Checagem de tipos do processo principal e da interface.          |
| `npm run lint`         | ESLint.                                                          |
| `npm run format`       | Corrige a formatação com o Prettier.                             |
| `npm run format:check` | Confere a formatação sem alterar nada.                           |

**Build, empacotamento e publicação**

| Script                  | Para quê                                                                         |
| ----------------------- | -------------------------------------------------------------------------------- |
| `npm run build`         | Typecheck + build de produção em `out/`.                                         |
| `npm start`             | Abre o build de produção sem empacotar.                                          |
| `npm run dist`          | Gera o **instalador do Windows** em `dist/Relaunch-Setup-<versão>.exe`.          |
| `npm run dist:linux`    | Gera um AppImage para Linux em `dist/`.                                          |
| `npm run dist:dir`      | Empacota sem instalador (útil para testar).                                      |
| `npm run release-notes` | Extrai do `CHANGELOG.md` as notas da versão atual para `build/release-notes.md`. |
| `npm run release`       | Gera o instalador e publica no GitHub Releases (precisa de `GH_TOKEN`).          |
| `npm run icon`          | Regenera `build/icon.png`.                                                       |

`dist`, `dist:linux` e `release` geram as notas a partir do `CHANGELOG.md` e falham se não houver uma seção para a `version` do `package.json`.

> [!TIP]
> Em desenvolvimento a atualização automática do launcher fica desligada. Para testar o botão de atualização, rode com `RELAUNCH_FAKE_UPDATE=1`, que simula o ciclo "disponível → baixando → pronto":
>
> ```bash
> RELAUNCH_FAKE_UPDATE=1 npm run dev           # Linux
> $env:RELAUNCH_FAKE_UPDATE=1; npm run dev     # PowerShell
> ```

### Gerar o instalador

| Alvo                 | Comando              | Resultado                            |
| -------------------- | -------------------- | ------------------------------------ |
| Windows (NSIS)       | `npm run dist`       | `dist/Relaunch-Setup-<versão>.exe`   |
| Linux (AppImage)     | `npm run dist:linux` | `dist/Relaunch-<versão>.AppImage`    |
| Teste sem instalador | `npm run dist:dir`   | Pasta `*-unpacked` dentro de `dist/` |

- Rode `npm run dist` **no Windows**. O instalador deixa escolher a pasta e cria atalhos na área de trabalho e no menu Iniciar.
- Também dá para gerar a partir do Linux, mas o electron-builder precisa do **Wine**, incluindo o de 32 bits (`wine32`), para montar o instalador NSIS.
- O app não é assinado digitalmente; o Windows SmartScreen pode avisar na primeira execução.

### Publicar uma versão do launcher

As notas de cada release vêm do `CHANGELOG.md`, a mesma fonte do popup de novidades do app.

1. No `CHANGELOG.md`, adicione uma seção `## [x.y.z] - AAAA-MM-DD` com as subseções `### Novidades`, `### Melhorias` e `### Correções`.
2. Atualize `version` no `package.json`.
3. Crie e envie a tag:

   ```bash
   git tag vx.y.z
   git push origin vx.y.z
   ```

O workflow [`release.yml`](.github/workflows/release.yml) roda os testes, confere se a tag bate com a `version` do `package.json` e roda `npm run release`, que gera as notas a partir do `CHANGELOG.md` e publica o instalador e o `latest.yml` no GitHub Releases. Para publicar manualmente, use `GH_TOKEN=<token> npm run release`.

Os apps instalados checam os releases ao abrir e a cada 3 horas, baixam em segundo plano e instalam quando você clica no botão azul ou ao fechar o app.

> [!NOTE]
> O `electron-updater` lê os GitHub Releases públicos **deste repositório** (seção `publish` do `electron-builder.yml`). Só releases publicados chegam aos apps instalados: rascunhos e pré-releases são ignorados.

### Estrutura do projeto

<details>
<summary><strong>Mapa das pastas</strong></summary>

| Pasta               | Conteúdo                                                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifests/`        | Manifestos dos jogos suportados, um JSON por jogo.                                                                                                                                                                   |
| `src/shared/`       | Lógica pura e tipos, sem dependência do Electron: esquema de manifesto (zod), versões, globs, `preserve` e checksums, devlog, formulários de config.                                                                 |
| `src/main/`         | Processo principal do Electron: store (electron-store) e IPC, detecção e requisitos, launcher, cliente GitHub com ETag, atualização, backup e rollback (`updateCore.ts`), extração (`archive.ts`), electron-updater. |
| `src/preload/`      | Ponte segura (`contextIsolation` + `sandbox`) que expõe `window.api`.                                                                                                                                                |
| `src/renderer/`     | Interface React + Tailwind. Os textos ficam em `src/renderer/src/i18n/` (`pt-BR.ts` e `en.ts`).                                                                                                                      |
| `tests/`            | Testes Vitest: parser de manifestos, detecção, escolha de asset, versões, preserve/backup/rollback com zip falso, fluxo de atualização, devlog uma vez por versão, cliente GitHub, editor de configs.                |
| `scripts/`          | Geração do ícone e das notas de release.                                                                                                                                                                             |
| `build/`            | Ícone usado no empacotamento.                                                                                                                                                                                        |
| `docs/screenshots/` | Capturas de tela usadas neste README.                                                                                                                                                                                |
| `docs/brand/`       | Logo e símbolo do Relaunch em SVG, nas versões branca e escura. O ícone do app (`npm run icon`) é gerado a partir do símbolo.                                                                                        |
| `.github/`          | Workflows, Dependabot, CODEOWNERS e modelos de issue e PR.                                                                                                                                                           |

</details>

## Qualidade e segurança

Cada PR e cada push na `main` passam por verificações automáticas.

| O quê                                                                      | Onde                                                  | Quando                                 |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Tipos, lint (ESLint), formatação (Prettier) e build                        | [`ci.yml`](.github/workflows/ci.yml), no Linux        | Todo PR e todo push na `main`          |
| Testes (Vitest)                                                            | [`ci.yml`](.github/workflows/ci.yml), Linux e Windows | Todo PR e todo push na `main`          |
| `npm audit`: barra vulnerabilidades altas e críticas no que vai para o app | [`ci.yml`](.github/workflows/ci.yml)                  | Todo PR e todo push na `main`          |
| Segredos no código e no histórico (gitleaks)                               | [`security.yml`](.github/workflows/security.yml)      | Todo PR, push na `main` e toda segunda |
| Problemas de segurança nos workflows (zizmor)                              | [`security.yml`](.github/workflows/security.yml)      | Todo PR, push na `main` e toda segunda |
| Dependências novas com vulnerabilidade alta ou crítica (dependency review) | [`security.yml`](.github/workflows/security.yml)      | Todo PR                                |
| Análise estática do código e dos workflows (CodeQL)                        | [`codeql.yml`](.github/workflows/codeql.yml)          | Todo PR, push na `main` e toda segunda |
| Dependências npm e GitHub Actions, em PRs agrupados                        | [Dependabot](.github/dependabot.yml)                  | Toda segunda, com cooldown de 7 dias   |
| Revisão de [@Silvamenu](https://github.com/Silvamenu) em toda mudança      | [`CODEOWNERS`](.github/CODEOWNERS)                    | Todo PR                                |
| Modelos de issue (bug, ideia, novo jogo) e checklist de PR                 | [`.github/`](.github)                                 | Ao abrir issue ou PR                   |

- A `main` é protegida: toda mudança entra por PR, com essas verificações passando, e o histórico não pode ser reescrito.
- As Actions são fixadas por SHA (com a versão em comentário) e cada workflow tem as permissões mínimas.
- O cooldown do Dependabot espera alguns dias antes de propor versões recém-publicadas, como proteção contra pacotes comprometidos.
- Como o próprio app se protege (isolamento da interface, origem dos downloads, extração segura, token cifrado) está em [SECURITY.md](SECURITY.md#como-o-app-se-protege). O fluxo de contribuição está em [CONTRIBUTING.md](CONTRIBUTING.md).

## Contribuir

| Quero…                        | Caminho                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Enviar código ou um manifesto | Siga o [CONTRIBUTING.md](CONTRIBUTING.md): branch a partir da `main`, Conventional Commits, `npm run check` verde e PR com o template. |
| Pedir suporte a um jogo       | Abra a issue [Suporte a um novo jogo](https://github.com/Silvamenu/OpenLaucher/issues/new/choose), ou envie o manifesto num PR.        |
| Reportar um bug               | Abra a issue [Bug](https://github.com/Silvamenu/OpenLaucher/issues/new/choose).                                                        |
| Sugerir uma melhoria          | Abra a issue [Ideia ou melhoria](https://github.com/Silvamenu/OpenLaucher/issues/new/choose).                                          |
| Reportar uma vulnerabilidade  | Em privado, como explica o [SECURITY.md](SECURITY.md). **Nunca** em issue pública.                                                     |

- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português. Use `npm run format` para corrigir a formatação.
- Mudanças visíveis para quem usa o app entram no `CHANGELOG.md`, na seção **Não lançado**.
- Textos novos da interface entram em `src/renderer/src/i18n/pt-BR.ts` **e** `src/renderer/src/i18n/en.ts`.
- **Nunca** envie ROMs, assets com direitos autorais ou segredos em PRs, issues ou testes.

## Créditos

Os jogos e projetos listados pertencem aos seus respectivos autores e comunidades. O Relaunch é um launcher independente e não é afiliado a nenhum deles.

As fontes Geist e Geist Mono são distribuídas sob a SIL Open Font License.
