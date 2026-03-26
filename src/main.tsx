import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'
import { ENABLE_STRICT_MODE } from './features/performance/flags'
import { initializeRuntimeErrorMonitoring } from './features/performance/runtimeErrorMonitor'

declare global {
  interface Window {
    __PROMPT_IMAGE_CONSOLE_ROOT__?: Root
  }
}

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root container #root was not found')
}

const root = window.__PROMPT_IMAGE_CONSOLE_ROOT__ ?? createRoot(container)

window.__PROMPT_IMAGE_CONSOLE_ROOT__ = root
initializeRuntimeErrorMonitoring()

function renderApp() {
  const app = <App />
  root.render(
    ENABLE_STRICT_MODE ? <StrictMode>{app}</StrictMode> : app,
  )
}

renderApp()

if (import.meta.hot) {
  import.meta.hot.accept(renderApp)
}
