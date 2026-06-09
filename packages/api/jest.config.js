module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2022',
        module: 'commonjs',
        lib: ['ES2022'],
        strict: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: true,
        noImplicitAny: false,
        strictNullChecks: false,
        moduleResolution: 'node',
        sourceMap: true,
        paths: {
          '@abitia/core': ['../../core/src'],
          '@abitia/data': ['../../data/src'],
          '@abitia/services': ['../../services/src'],
        },
      },
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@abitia/core$': '<rootDir>/../core/src/index.ts',
    '^@abitia/core/(.*)$': '<rootDir>/../core/src/$1',
    '^@abitia/data$': '<rootDir>/../data/src/index.ts',
    '^@abitia/data/(.*)$': '<rootDir>/../data/src/$1',
    '^@abitia/services$': '<rootDir>/../services/src/index.ts',
    '^@abitia/services/(.*)$': '<rootDir>/../services/src/$1',
  },
};
