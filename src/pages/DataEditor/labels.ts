import type { ForwardRefExoticComponent } from 'react'

import IconAccountGroup from '~icons/mdi/account-group'
import IconEarth from '~icons/mdi/earth'
import IconShield from '~icons/mdi/shield'
import IconStadiumVariant from '~icons/mdi/stadium-variant'
import IconTrophy from '~icons/mdi/trophy'
import IconWhistle from '~icons/mdi/whistle'

import type { MessageId } from '@/libs/intl/types'

interface TabItem {
  Icon: ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>
  labelId: MessageId
  listHeaderId: MessageId
}

export type TabType = 'club' | 'nationalTeam' | 'player' | 'coach' | 'stadium' | 'competition'

export const TABS: Record<TabType, TabItem> = {
  club: {
    Icon: IconShield,
    labelId: 'dataEditor.sidebar.clubs',
    listHeaderId: 'dataEditor.listPanel.clubs',
  },
  nationalTeam: {
    Icon: IconEarth,
    labelId: 'dataEditor.sidebar.nationalTeams',
    listHeaderId: 'dataEditor.listPanel.nationalTeams',
  },
  player: {
    Icon: IconAccountGroup,
    labelId: 'dataEditor.sidebar.players',
    listHeaderId: 'dataEditor.listPanel.players',
  },
  coach: {
    Icon: IconWhistle,
    labelId: 'dataEditor.sidebar.coaches',
    listHeaderId: 'dataEditor.listPanel.coaches',
  },
  stadium: {
    Icon: IconStadiumVariant,
    labelId: 'dataEditor.sidebar.stadiums',
    listHeaderId: 'dataEditor.listPanel.stadiums',
  },
  competition: {
    Icon: IconTrophy,
    labelId: 'dataEditor.sidebar.competitions',
    listHeaderId: 'dataEditor.listPanel.competitions',
  },
}
