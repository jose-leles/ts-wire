/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  setupFiles: ['./packages/core/src/polyfill.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        lib: ['ES2022', 'ESNext'],
        target: 'ES2022',
        module: 'commonjs',
        strict: true,
        esModuleInterop: true,
        declaration: false,
      },
    }],
  },
  moduleNameMapper: {
    '^@ts-wire/core$':     '<rootDir>/packages/core/src/index.ts',
    '^@ts-wire/errors$':   '<rootDir>/packages/errors/src/index.ts',
    '^@ts-wire/auth$':     '<rootDir>/packages/auth/src/index.ts',
    '^@ts-wire/validate$': '<rootDir>/packages/validate/src/index.ts',
    '^@ts-wire/cache$':    '<rootDir>/packages/cache/src/index.ts',
    '^@ts-wire/storage$':  '<rootDir>/packages/storage/src/index.ts',
    '^@ts-wire/testing$':  '<rootDir>/packages/testing/src/index.ts',
  },
};
