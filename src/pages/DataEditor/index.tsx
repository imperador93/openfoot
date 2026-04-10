import { useState } from 'react'

import ListPanel from './components/ListPanel'
import Sidebar from './components/Sidebar'
import type { TabType } from './labels'

const DataEditor = () => {
  const [activeTab, setActiveTab] = useState<TabType | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className='w-svw h-svh flex'>
      <Sidebar activeTab={activeTab} onChangeTab={setActiveTab} />

      <ListPanel
        activeTab={activeTab}
        search={search}
        onSearchChange={setSearch}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
      />
    </div>
  )
}

export default DataEditor
