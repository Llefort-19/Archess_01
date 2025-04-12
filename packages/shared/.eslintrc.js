module.exports = {
  // Don't extend the whole root config directly
  // extends: '../../.eslintrc.js', 
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'import' // Only include non-React plugins
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'airbnb-typescript/base', 
    'plugin:import/typescript',
    'prettier', // Must be last
  ],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname, 
    sourceType: 'module', 
    ecmaVersion: 2022, 
  },
  settings: { // Copied relevant settings from root
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.d.ts'], // Include .d.ts
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json', 
      },
      node: true,
    },
  },
  env: {
    es2021: true,
  },
  rules: {
    // Copy necessary base rules from root config (non-React)
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': 'off', 
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/prefer-default-export': 'off', 
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    // Keep stricter rules for shared potentially
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSEnumDeclaration',
        message: 'Do not use enums; prefer union types or maps.',
      },
    ],
    'linebreak-style': process.platform === 'win32' ? 'off' : ['error', 'unix'],
    
    // Rule specific to shared code
    'import/no-extraneous-dependencies': ['error', { devDependencies: false }],
    
    // Disable the need for extensions on TS files
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        ts: 'never',
        js: 'never',
        '': 'never'
      }
    ],
    
    // Turn off React rules explicitly (defense-in-depth, already off via no extends)
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': 'off',
    'react/function-component-definition': 'off',
    'react/require-default-props': 'off',
    'react-hooks/rules-of-hooks': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
  },
  ignorePatterns: [
    'dist/', 
    'build/', 
    'node_modules/',
    '*.js', // Ignore .eslintrc.js itself
    'src/**/*.d.ts' // Ignore declaration files
  ] 
}; 