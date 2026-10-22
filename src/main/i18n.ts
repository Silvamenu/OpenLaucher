import type { Language } from '../shared/types'

/** Textos do processo principal (notificações e diálogos nativos). */
const messages = {
  'pt-BR': {
    updateAvailable: (v: string) => `Atualização disponível: ${v}`,
    updatedTo: (v: string) => `Atualizado para ${v}`,
    updateFailed: (msg: string) => `Falha ao atualizar: ${msg}`,
    pickGameFolder: 'Escolha a pasta do jogo',
    pickFile: 'Selecione o arquivo',
    pickCover: 'Escolha uma imagem de capa',
    images: 'Imagens',
    allFiles: 'Todos os arquivos'
  },
  en: {
    updateAvailable: (v: string) => `Update available: ${v}`,
    updatedTo: (v: string) => `Updated to ${v}`,
    updateFailed: (msg: string) => `Update failed: ${msg}`,
    pickGameFolder: 'Choose the game folder',
    pickFile: 'Select the file',
    pickCover: 'Choose a cover image',
    images: 'Images',
    allFiles: 'All files'
  }
} as const

export function mainText(language: Language) {
  return messages[language] ?? messages['pt-BR']
}
