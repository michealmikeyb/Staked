import { SORT_TYPES } from './lib/types.js';

async function main() {
  console.log('Instance ranker starting...');
  console.log(`Sort types: ${SORT_TYPES.join(', ')}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
