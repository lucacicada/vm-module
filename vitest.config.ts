import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    poolOptions: {
      forks: {
        execArgv: [
          '--experimental-vm-modules',
        ],
      },
    },
    env: {
      NODE_NO_WARNINGS: '1',
    },
  },
})
