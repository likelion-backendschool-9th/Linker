import { createOrvalConfig } from './orval.config';

/** Same options as `pnpm generate`, pointed at the pipeline fixture. Not the Linker API. */
export default createOrvalConfig(
  './fixtures/client-pipeline.openapi.yaml',
  process.env.ORVAL_PIPELINE_OUT ?? './pipeline-out',
);
