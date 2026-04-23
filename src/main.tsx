import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WorkoutProvider } from './context/WorkoutContext'
import { migrateFromLocalStorage } from './lib/migration'
import './index.css'
import App from './App.tsx'

const rootEl = document.getElementById('root')!

function Root() {
  return (
    <BrowserRouter>
      <WorkoutProvider>
        <App />
      </WorkoutProvider>
    </BrowserRouter>
  )
}

migrateFromLocalStorage()
  .catch((e) => console.error('[IronLog] migration', e))
  .finally(() => {
    createRoot(rootEl).render(
      <StrictMode>
        <Root />
      </StrictMode>,
    )
  })
