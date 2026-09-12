import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const config = {
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  test: {
    include: ['src/lib/**/__tests__/*.test.js'],
    environment: 'node',
  },
}

export default config
