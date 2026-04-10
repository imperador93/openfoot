import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import pluginReact from 'eslint-plugin-react'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  { ignores: ['**/dist/**', '**/node_modules/**', '**/dist-ssr/**', 'src-tauri/**'] },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  prettierConfig,
  {
    settings: {
      react: {
        version: '19',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }], // Evitar console.log esquecido em produção
      '@typescript-eslint/no-explicit-any': 'warn', // Evitar 'any' ao máximo
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // Variáveis não usadas são erro
      '@typescript-eslint/consistent-type-imports': 'error', // Força 'import type' para tipos (melhora performance de build)
      'react/react-in-jsx-scope': 'off', // React 17+ não precisa importar React para usar JSX
    },
  },
])
