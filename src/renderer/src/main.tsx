import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Global error handlers for renderer stability
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
})

// Handle memory cleanup messages from main process
window.addEventListener('message', (event) => {
    if (event.data?.type === 'memory:cleanup') {
        // Clear local caches
        if ('caches' in window) {
            caches.keys().then(names => names.forEach(name => caches.delete(name)))
        }
    }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
