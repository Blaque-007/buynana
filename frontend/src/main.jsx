import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

try {
  document.documentElement.dataset.textSize = localStorage.getItem('buynana:text-size') || 'normal';
  document.documentElement.dataset.contrast = localStorage.getItem('buynana:contrast') || 'standard';
} catch { /* Storage may be disabled; standard styling still works. */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
