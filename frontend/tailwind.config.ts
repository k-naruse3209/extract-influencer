import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // カスタムカラーは後で追加
    },
  },
  plugins: [],
}

export default config
