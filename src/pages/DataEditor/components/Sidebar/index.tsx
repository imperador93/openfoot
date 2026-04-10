import { useState } from 'react'

import type { TabType } from '../../labels'
import { TABS } from '../../labels'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'
import IconChevronLeft from '~icons/mdi/chevron-left'
import IconClose from '~icons/mdi/close'
import IconFileDownload from '~icons/mdi/file-download'
import IconFileUpload from '~icons/mdi/file-upload'

import Button from '@/components/Button'
import { useIntl } from '@/hooks/useIntl'
import { cn } from '@/utils/styles'

interface SidebarProps {
  activeTab: TabType | null
  onChangeTab: React.Dispatch<React.SetStateAction<TabType | null>>
}

const Sidebar = ({ activeTab, onChangeTab }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false)

  const { t } = useIntl()
  const navigate = useNavigate()

  const handleChangeTab = (key: TabType) => {
    if (activeTab === key) return

    onChangeTab(key)
    setCollapsed(true)
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className='flex flex-col h-full overflow-hidden border-r border-base-300 bg-base-100'
    >
      {/* Header */}
      <div className='flex h-12 shrink-0 items-center justify-between border-b border-base-200 p-2 uppercase tracking-widest'>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              key='title'
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className='truncate text-sm font-bold text-base-content mx-2'
            >
              {t('dataEditor.sidebar.title')}
            </motion.span>
          )}
        </AnimatePresence>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'ml-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-base-content/60 transition-colors',
            'hover:bg-base-200 hover:text-base-content',
            { 'w-full': collapsed }
          )}
        >
          <motion.span
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className='flex items-center justify-center'
          >
            <IconChevronLeft className='shrink-0 text-lg' />
          </motion.span>
        </button>
      </div>

      {/* Nav */}
      <nav className='flex flex-1 flex-col gap-0.5 overflow-y-auto p-2'>
        {Object.entries(TABS).map(([key, { labelId, Icon }]) => (
          <button
            key={key}
            onClick={() => handleChangeTab(key as TabType)}
            title={t(labelId)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 rounded px-2.5 py-2 text-sm transition-colors',
              {
                'bg-primary/15 text-primary': activeTab === key,
                'text-base-content/70 hover:bg-base-200 hover:text-base-content': activeTab !== key,
              }
            )}
          >
            <Icon className='shrink-0 text-xl' />

            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  key={`label-${labelId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className='truncate text-left uppercase font-medium'
                >
                  {t(labelId)}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className='flex flex-col gap-2 shrink-0 border-t border-base-200 p-2'>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              key='divider'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className='border-t border-base-200'
            >
              <Button
                variant='outline'
                shape='block'
                size='sm'
                color='accent'
                className='whitespace-nowrap overflow-hidden uppercase tracking-wide mb-1'
                title={t('dataEditor.sidebar.exportDatabase')}
                icon={<IconFileDownload />}
              >
                {t('dataEditor.sidebar.exportDatabase')}
              </Button>

              <Button
                variant='outline'
                shape='block'
                size='sm'
                color='accent'
                className='whitespace-nowrap overflow-hidden uppercase tracking-wide'
                title={t('dataEditor.sidebar.importDatabase')}
                icon={<IconFileUpload />}
              >
                {t('dataEditor.sidebar.importDatabase')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          shape='block'
          color='error'
          className='uppercase tracking-wide'
          icon={<IconClose />}
          title={t('dataEditor.sidebar.backToMenu')}
          onClick={() => navigate('/')}
        >
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {t('dataEditor.sidebar.backToMenu')}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.aside>
  )
}

export default Sidebar
