import { useState } from 'react'

import DetailsPanel from './components/DetailsPanel'
import ListPanel from './components/ListPanel'
import Sidebar from './components/Sidebar'
import type { TabType } from './labels'

const DataEditor = () => {
  const [activeTab, setActiveTab] = useState<TabType | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const onChangeTab = (tab: TabType) => {
    setActiveTab(tab)
    setSearch('')
    setSelectedId(null)
  }

  return (
    <div className='w-svw h-svh flex bg-base-300'>
      <Sidebar activeTab={activeTab} onChangeTab={onChangeTab} />

      <ListPanel
        activeTab={activeTab}
        search={search}
        onSearchChange={setSearch}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
      />

      {activeTab && <DetailsPanel activeTab={activeTab} selectedId={selectedId} />}
    </div>
  )
}

export default DataEditor
