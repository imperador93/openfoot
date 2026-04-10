import { getCurrentWindow } from '@tauri-apps/api/window'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router'

import { useIntl } from '@/hooks/useIntl'

import { menuItems } from './labels'

const MainMenu = () => {
  const { t } = useIntl()
  const navigate = useNavigate()

  const handleMenuClick = (key: string) => {
    if (key === 'exit') {
      getCurrentWindow().close()
      return
    }

    navigate(`/${key}`)
  }

  return (
    <div className='w-svw h-svh flex flex-col justify-center items-center lg:items-start bg-linear-to-r from-base-300 to-base-100 bg-linear p-8'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.75, delay: 0.25 }}
        className='mb-8 text-center'
      >
        <h1 className='text-4xl font-bold tracking-wide m-0'>Openfoot</h1>
      </motion.div>

      <div className='flex w-64 flex-col gap-3'>
        {menuItems.map((item, index) => (
          <motion.div
            key={item.key}
            role='button'
            onClick={() => handleMenuClick(item.key)}
            className='cursor-pointer bg-green-900 border border-primary/50 py-4 px-6 text-lg font-medium uppercase tracking-wide'
            initial={{ opacity: 0, x: -200, skewX: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.1 + index * 0.1 }}
          >
            <div style={{ transform: 'skewX(24deg)' }}>{t(item.labelId)}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default MainMenu
