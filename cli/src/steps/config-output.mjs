import fs from 'node:fs';
import { publishConfigOutputs as stageOutputs } from './config-output-core.mjs';

export function publishConfigOutputs(outputs, io = fs) {
  // chmod does not preserve a protected Windows DACL across replacement.
  // Reject before snapshot reads, stage creation or target mutation.
  if (process.platform === 'win32') {
    throw new Error('Configuration publication is unavailable on Windows until ACL-preserving replacement is implemented. No configuration files were written.');
  }
  return stageOutputs(outputs, io);
}
