import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'FUT Copilot',
    description:
      'A local-first personal copilot for FUT SBC, duplicate, and transfer decisions.',
    version: '0.1.0',
    minimum_chrome_version: '114',
    permissions: ['storage', 'sidePanel'],
    action: {
      default_title: 'Open FUT Copilot',
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+U',
          mac: 'Command+Shift+U',
        },
        description: 'Open FUT Copilot',
      },
    },
  },
});
