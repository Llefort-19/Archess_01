module.exports = {
  extends: '../../.eslintrc.js', // Extend the root config
  parserOptions: {
    // Point to the tsconfig.json for this package
    project: './tsconfig.json',
    tsconfigRootDir: __dirname, // Important for ESLint to find tsconfig correctly
  },
  env: {
    browser: true, // Specify Browser environment
    es2021: true,
  },
  rules: {
    // Allow devDependencies in Vite config, tests, etc.
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    
    // Disable the need for extensions on TS/TSX files
    'import/extensions': [
      'error',
      'ignorePackages', // Ignore packages
      {
        ts: 'never',  // Never add .ts
        tsx: 'never', // Never add .tsx
        js: 'never',  // Optional: if you have js files too
        jsx: 'never', // Optional: if you have jsx files too
        '': 'never'  // Allow imports with no extension
      }
    ],
    
    // You might want stricter rules for React code
    // '@typescript-eslint/no-unsafe-assignment': 'warn',
    // '@typescript-eslint/no-unsafe-call': 'warn',
    // '@typescript-eslint/no-unsafe-member-access': 'warn',
  },
  settings: {
    // Ensure React version detection works within the package context if needed
    react: {
        version: 'detect',
    },
    // Explicitly define resolver settings to be sure
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true, 
        project: './tsconfig.json', // Point to this package's tsconfig
      },
      node: true
    }
  }
}; 