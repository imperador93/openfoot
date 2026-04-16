import type { RouteObject } from 'react-router'

import Career from '@/pages/Career'
import CoachTransfer from '@/pages/CoachTransfer'
import DataEditor from '@/pages/DataEditor'
import LoadGame from '@/pages/LoadGame'
import SaveGame from '@/pages/SaveGame'
import MainMenu from '@/pages/MainMenu'
import NewGame from '@/pages/NewGame'

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    element: <MainMenu />,
  },
  {
    path: '/new-game',
    element: <NewGame />,
  },
  {
    path: '/load-game',
    element: <LoadGame />,
  },
  {
    path: '/save-game',
    element: <SaveGame />,
  },
  {
    path: '/coach-transfer',
    element: <CoachTransfer />,
  },
  {
    path: '/career',
    element: <Career />,
  },
  {
    path: '/data-editor',
    element: <DataEditor />,
  },
]

export default rootRoutes
