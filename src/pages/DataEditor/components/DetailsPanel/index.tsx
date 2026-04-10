import { useEffect, useState } from 'react'

import type { TabType } from '../../labels'

import { useIntl } from '@/hooks/useIntl'
import type { Coach } from '@/types/entities/coach'
import type { Competition } from '@/types/entities/competition'
import type { NationalTeam } from '@/types/entities/nationalTeam'
import type { Player } from '@/types/entities/player'
import type { Stadium } from '@/types/entities/stadium'

import ClubPanel from './components/ClubPanel'
import { CLUB_DETAILS_LIST } from './mocks/club.mock'
import type { ClubDetails } from './types'

interface DetailsPanelProps {
  activeTab: TabType | null
  selectedId: string | null
}

type ItemType = ClubDetails | NationalTeam | Player | Coach | Stadium | Competition

const DetailsPanel = ({ activeTab, selectedId }: DetailsPanelProps) => {
  const { t } = useIntl()

  const [item, setItem] = useState<ItemType | null>(null)

  const fetchItem = () => {
    if (activeTab === 'club') {
      const item = CLUB_DETAILS_LIST.find((club) => club.id === selectedId) || null
      setItem(item)
    }
  }

  const getItemComponent = (item: ItemType) => {
    if (activeTab === 'club') {
      return <ClubPanel club={item as ClubDetails} />
    }
  }

  useEffect(() => {
    fetchItem()
  }, [activeTab, selectedId])

  if (!selectedId) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center'>
        <h2 className='text-xs font-bold tracking-widest text-base-content uppercase m-0'>
          {t('dataEditor.detailsPanel.noSelectionTitle')}
        </h2>

        <span className='text-xs text-base-content/50'>
          {t('dataEditor.detailsPanel.noSelectionSubtitle')}
        </span>
      </div>
    )
  }

  if (!item) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center'>
        <h2 className='text-xs font-bold tracking-widest text-base-content uppercase m-0'>
          {t('dataEditor.detailsPanel.noItemFound')}
        </h2>
      </div>
    )
  }

  return <div className='flex-1 flex flex-col'>{getItemComponent(item)}</div>
}

export default DetailsPanel
