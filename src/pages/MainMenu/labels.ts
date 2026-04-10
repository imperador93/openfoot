import type { MessageId } from '@/libs/intl/types'

export const menuItems: { key: string; labelId: MessageId }[] = [
  { key: 'new-game', labelId: 'mainMenu.newGame' },
  { key: 'load-game', labelId: 'mainMenu.loadGame' },
  { key: 'data-editor', labelId: 'mainMenu.dataEditor' },
  { key: 'exit', labelId: 'mainMenu.exit' },
] as const
