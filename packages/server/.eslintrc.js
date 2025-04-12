module.exports = {
  // Don't extend the whole root config directly to avoid React plugins
  // extends: '../../.eslintrc.js', 
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'import' // Only include non-React plugins from the root
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'airbnb-typescript/base', // Use base config, not the React one
    'plugin:import/typescript',
    'prettier', // Must be last
  ],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname, 
    sourceType: 'module', // Added from root
    ecmaVersion: 2022, // Added from root
  },
  settings: { // Copied relevant settings from root
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'], // Only .ts for server
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json', // Point to server tsconfig
      },
      node: true,
    },
  },
  env: {
    node: true, 
    es2021: true,
  },
  rules: {
    // Copy necessary base rules from root config
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': 'off', 
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/prefer-default-export': 'off', 
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    '@typescript-eslint/no-unsafe-assignment': 'warn', // Enable stricter backend rules
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
    // Add or override rules specific to the server package
    'import/no-extraneous-dependencies': ['error', { 
      devDependencies: [
        '**/*.test.ts', 
        '**/*.spec.ts', 
        './src/scripts/**', // Allow in potential scripts
        './test/**' // Allow in test setup
      ] 
    }],
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
  },
  ignorePatterns: [
    'dist/', 
    'build/', 
    'node_modules/',
  ] // Added basic ignores
}; 