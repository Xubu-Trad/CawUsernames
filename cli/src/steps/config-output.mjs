import fs from 'node:fs';

export function publishConfigOutputs(outputs, io = fs) {
  // chmod does not preserve a protected Windows DACL across replacement.
  // Reject before snapshot reads, stage creation or target mutation.
  if (process.platform === 'win32') {
    throw new Error('Configuration publication is unavailable on Windows until ACL-preserving replacement is implemented. No configuration files were written.');
  }
  // Staged replacement is experimental: copying mode bits loses extended ACLs.
  // Keep the existing inode on ordinary writes. This is NOT atomic publication.
  let written = 0;
  try {
    for (const output of outputs) {
      io.writeFileSync(output.file, output.content, output.mode ? { mode: output.mode } : undefined);
      written++;
      if (output.mode) io.chmodSync(output.file, output.mode);
      if (output.verify) output.verify(output.file);
    }
  } catch {
    throw new Error(`Configuration write failed after ${written} completed write(s). Installation incomplete; the failing file may also be partial. Do not start services; review files before retrying.`);
  }
}
