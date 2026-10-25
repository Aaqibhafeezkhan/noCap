// Prints the app's demo flow map as JSON, so the recording can serve it as a library track.
// usage: npx tsx capture/dump-demo.ts
import { sampleFlowmap } from '../../frontend/src/sampleFlowmap';

console.log(JSON.stringify(sampleFlowmap()));
