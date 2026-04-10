import type { TabType } from '../../labels'
import { TABS } from '../../labels'

import { useIntl } from '@/hooks/useIntl'

interface ListPanelProps {
  activeTab: TabType | null
  search: string
  onSearchChange: React.Dispatch<React.SetStateAction<string>>
  selectedId: string | null
  onSelectedIdChange: React.Dispatch<React.SetStateAction<string | null>>
}

const ListPanel = ({ activeTab }: ListPanelProps) => {
  const { t } = useIntl()

  if (!activeTab) {
    return (
      <aside className='w-72 min-w-72 flex flex-col items-center justify-center h-full overflow-hidden border-r border-base-300 bg-base-200'>
        <h2 className='text-xs font-bold tracking-widest text-gray-300 uppercase m-0'>
          {t('dataEditor.listPanel.noSelectionTitle')}
        </h2>

        <span className='text-xs text-gray-500'>
          {t('dataEditor.listPanel.noSelectionSubtitle')}
        </span>
      </aside>
    )
  }

  const TAB_CONFIG = TABS[activeTab]

  return (
    <aside className='w-72 min-w-72 flex flex-col h-full overflow-hidden border-r border-base-300 bg-base-200'>
      {/* List Header */}
      <div className='px-4 pt-4 pb-2 flex items-baseline justify-between'>
        <h2 className='text-xs font-bold tracking-widest text-gray-300 uppercase m-0'>
          {t(TAB_CONFIG.listHeaderId)}
        </h2>

        <span className='text-xs text-gray-500'>
          {t('dataEditor.listPanel.entries', { count: 0 })}
        </span>
      </div>
    </aside>
  )
}

export default ListPanel
