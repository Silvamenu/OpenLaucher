import type { Language } from '../shared/types'

/** Textos do processo principal (notificações e diálogos nativos). */
const messages = {
  'pt-BR': {
    updateAvailable: (v: string) => `Atualização disponível: ${v}`,
    updatedTo: (v: string) => `Atualizado para ${v}`,
    updateFailed: (msg: string) => `Falha ao atualizar: ${msg}`,
    pickGameFolder: 'Escolha a pasta do jogo',
    pickInstallFolder: (name: string) => `Onde instalar ${name}? Uma pasta com o nome do jogo será criada aqui`,
    importProfile: 'Importar perfil',
    exportProfile: 'Exportar perfil',
    profileFile: 'Perfil do Relaunch',
    pickFile: 'Selecione o arquivo',
    pickCover: 'Escolha uma imagem de capa',
    pickBanner: 'Escolha uma imagem de banner (de preferência larga, como 1920 × 600)',
    pickGameFile: (name: string) => `Escolha o arquivo do seu ${name}`,
    pickExecutable: 'Escolha o executável do jogo',
    programs: 'Programas',
    images: 'Imagens',
    allFiles: 'Todos os arquivos'
  },
  en: {
    updateAvailable: (v: string) => `Update available: ${v}`,
    updatedTo: (v: string) => `Updated to ${v}`,
    updateFailed: (msg: string) => `Update failed: ${msg}`,
    pickGameFolder: 'Choose the game folder',
    pickInstallFolder: (name: string) => `Where should ${name} be installed? A folder named after the game will be created here`,
    importProfile: 'Import profile',
    exportProfile: 'Export profile',
    profileFile: 'Relaunch profile',
    pickFile: 'Select the file',
    pickCover: 'Choose a cover image',
    pickBanner: 'Choose a banner image (preferably wide, like 1920 × 600)',
    pickGameFile: (name: string) => `Choose the file of your ${name}`,
    pickExecutable: 'Choose the game executable',
    programs: 'Programs',
    images: 'Images',
    allFiles: 'All files'
  }
} as const

export function mainText(language: Language) {
  return messages[language] ?? messages['pt-BR']
}
