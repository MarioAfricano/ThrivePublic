import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initTheme } from './utils/theme.js'
initTheme() // aplica o tema guardado antes do primeiro render
// Fonte Inter empacotada localmente (antes vinha do Google Fonts):
// a app funciona offline e a CSP dispensa hosts externos de fontes.
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
