const EA_WEB_APP_MATCH =
  'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*';

export default defineContentScript({
  matches: [EA_WEB_APP_MATCH],
  runAt: 'document_idle',
  main() {
    // The live observer is added only after its normalized contract and fixtures pass.
  },
});
