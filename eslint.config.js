import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Erlaubt bewusst ungenutzte Parameter mit "_"-Präfix, z. B. wenn eine
      // von Home Assistant vorgegebene Funktionssignatur (getStubConfig) einen
      // Parameter verlangt, den wir nicht brauchen.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  eslintConfigPrettier,
);
