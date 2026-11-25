// Run a single scenario and print the JSON result.
//   node src/run-one.mjs --framework express --strategy drain --lag 1000 [--keepalive false]
import { parseArgs } from 'node:util';
import { runScenario } from './scenario.mjs';

const { values } = parseArgs({
  options: {
    framework: { type: 'string', default: 'node' },
    strategy: { type: 'string', default: 'drain' },
    lag: { type: 'string', default: '1000' },
    keepalive: { type: 'string', default: 'true' },
    port: { type: 'string', default: '4100' },
    'keepalive-ms': { type: 'string' },
    'force-ms': { type: 'string', default: '8000' },
  },
});

const result = await runScenario({
  framework: values.framework,
  strategy: values.strategy,
  lagMs: Number(values.lag),
  keepAlive: values.keepalive !== 'false',
  port: Number(values.port),
  forceMs: Number(values['force-ms']),
  keepAliveMs: values['keepalive-ms'] ? Number(values['keepalive-ms']) : null,
});
console.log(JSON.stringify(result, null, 2));
