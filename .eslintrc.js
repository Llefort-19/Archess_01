module.exports = {
  // Keep this minimal, acting as a base configuration
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'airbnb-typescript/base', // Use airbnb-base, as react rules are added via plugin:react/recommended
    'plugin:import/typescript',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier', // Must be last
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    // Project-specific tsconfig is set in packageeslintrc files
    // tsconfigRootDir: __dirname, // Not needed if project paths are relative to packageeslintrc
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        // Project-specific resolution handled by package tsconfig
      },
      node: true,
    },
  },
  // Define environments in packageeslintrc files where needed
  // env: {
  //   browser: true,
  //   es2021: true,
  //   node: true,
  // },
  rules: {
    // --- Keep desired base rules --- 
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': 'off', 
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/prefer-default-export': 'off', 
    // Relaxed dependency rule - adjust per-package if needed
    'import/no-extraneous-dependencies': 'off', // Turned off globally, enable in packageeslintrc if needed
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    // Relax unsafe rules globally, tighten per-package if needed
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': [1, { extensions: ['.tsx'] }],
    'react/function-component-definition': [
      2,
      { 
        namedComponents: 'function-declaration',
        unnamedComponents: 'arrow-function' 
      }
    ],
    'react/require-default-props': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSEnumDeclaration',
        message: 'Do not use enums; prefer union types or maps.',
      },
    ],
    'linebreak-style': process.platform === 'win32' ? 'off' : ['error', 'unix'],
    // Add other base rules shared across all packages

  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '*.js', // Ignore root config files
    'packages/*/dist/',
    'packages/*/build/',
    'packages/*/*.js', // Ignore package config files
    'packages/client/vite.config.ts.timestamp-*.mjs',
  ],
  // Remove overrides, handle in packageeslintrc
}; 