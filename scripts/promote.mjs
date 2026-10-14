import {promoteComposition} from './promotion-boundary.mjs';

promoteComposition({workspace:process.cwd(),dryRun:process.argv.includes('--dry-run')});
