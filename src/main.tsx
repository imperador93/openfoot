import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/poppins/100.css'
import '@fontsource/poppins/200.css'
import '@fontsource/poppins/300.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/800.css'
import '@fontsource/poppins/900.css'
import circleFlags from '@iconify/json/json/circle-flags.json'
import { addCollection } from '@iconify/react'

import './styles/main.css'

const root = document.getElementById('root') as HTMLElement

addCollection(circleFlags)

createRoot(root).render(
  <StrictMode>
    <span>fala zeze bom dia cara</span>
  </StrictMode>
)
