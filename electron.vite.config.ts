import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import terser from '@rollup/plugin-terser'
import visualizer from 'rollup-plugin-visualizer'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            minify: isProd ? 'terser' : false,
            terserOptions: {
                compress: {
                    drop_console: isProd,
                    drop_debugger: isProd,
                    pure_funcs: ['console.log', 'console.info'],
                },
                mangle: {
                    safari10: true,
                },
            },
            rollupOptions: {
                input: { index: resolve(__dirname, 'src/main/index.ts') },
                output: {
                    manualChunks: {
                        'analytics': ['./src/main/services/searchAnalytics'],
                        'storage': ['./src/main/services/storage'],
                    },
                },
            },
            sourcemap: !isProd,
            chunkSizeWarningLimit: 1000,
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            minify: isProd ? 'terser' : false,
            terserOptions: {
                compress: {
                    drop_console: isProd,
                },
            },
            rollupOptions: {
                input: { index: resolve(__dirname, 'src/preload/index.ts') }
            },
            sourcemap: !isProd,
        },
    },
    renderer: {
        root: resolve(__dirname, 'src/renderer'),
        build: {
            minify: isProd ? 'terser' : false,
            terserOptions: {
                compress: {
                    drop_console: isProd,
                    drop_debugger: isProd,
                    ecma: 2020,
                },
                format: {
                    ecma: 2020,
                },
            },
            rollupOptions: {
                input: { index: resolve(__dirname, 'src/renderer/index.html') },
                output: {
                    manualChunks: (id) => {
                        if (id.includes('node_modules')) {
                            if (id.includes('react') || id.includes('react-dom')) {
                                return 'vendor-react'
                            }
                            if (id.includes('framer-motion')) {
                                return 'vendor-motion'
                            }
                            if (id.includes('@radix-ui')) {
                                return 'vendor-ui'
                            }
                        }
                        if (id.includes('AnalyticsDashboard') || 
                            id.includes('KnowledgeBasePanel') ||
                            id.includes('PDFExportDialog') ||
                            id.includes('SavedSearchesPanel')) {
                            return 'components'
                        }
                    },
                    chunkFileNames: 'assets/[name]-[hash].js',
                    entryFileNames: 'assets/[name]-[hash].js',
                    assetFileNames: 'assets/[name]-[hash].[ext]',
                },
            },
            sourcemap: !isProd,
            chunkSizeWarningLimit: 500,
        },
        plugins: [
            react(),
            isProd && visualizer({
                filename: 'dist/bundle-analysis.html',
                open: false,
                gzipSize: true,
                brotliSize: true,
            }),
        ].filter(Boolean),
    },
})
