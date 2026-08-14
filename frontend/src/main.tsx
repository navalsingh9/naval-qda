import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import App from './App.tsx'

// The docx package (APA-7 export) and matrix-js-sdk both assume a Node
// environment with a global Buffer. The renderer has nodeIntegration:
// false (see electron/main.js), so this polyfill has to be provided
// explicitly, once, before anything that needs it runs.
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Failed to find the root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
