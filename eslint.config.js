import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'media_storage/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
