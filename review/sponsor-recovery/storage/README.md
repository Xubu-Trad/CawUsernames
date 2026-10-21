# isolated storage checks

these trials run extracted PR311 functions against a new PostgreSQL database and
Redis instance. RPC, events and timer scheduling remain synthetic. no existing
node database or checkpoint endpoint is accepted.

## prerequisites

Linux, Python3, Node24.20.0 for source extraction, and a non-root user. local
runtime execution was checked with Node20.20.2. install the exact dependency lock
in this directory with `npm ci --ignore-scripts --no-audit --no-fund`. Prisma client
generation subsequently runs explicitly and can download its pinned engines.
the local packaged rerun reused the identical already-installed lock through a
local symlink; the clean npm-ci path has not been independently exercised.

`--runtime-root` points to an extracted Ubuntu22.04 amd64 runtime tree containing
`usr/lib/postgresql/14/bin`, `usr/share/postgresql/14`, `usr/bin/redis-server` and
`usr/bin/redis-cli`. the nine archive filenames, sizes and SHA256 values used
locally are in PACKAGE_HASHES.json. obtain these through trusted Ubuntu package
sources, verify the hashes, then use `dpkg-deb -x` into one fresh directory. this
is extraction, not system installation. PostgreSQL14.24 and Redis6.0.16 are the
checked versions. existing Linux system libraries are also required; this is not
a hermetic runtime, container image or assurance of continued binary availability.

## run

from the parent review directory:

```sh
python3 prepare.py
node --max-old-space-size=256 storage/prepare-storage.cjs
cd storage
npm ci --ignore-scripts --no-audit --no-fund
python3 run.py --runtime-root /absolute/path/to/extracted-runtime
```

the preparation step verifies pinned input hashes before extracting functions and
the SponsorRepay model. fetched upstream inputs and generated outputs retain their
upstream licensing status; no new license is applied to those inputs here.

the runner requires 768MiB available memory and 2GiB free temporary storage.
on WSL, also check the Windows host has 768MiB available before starting: the
Linux reading alone is insufficient. local execution used that existing host
guard. Node heap is256MiB; commands time out after40seconds. PostgreSQL uses16MiB
shared buffers and Redis has a16MiB data limit; these are not total process-memory
caps. temporary data stays in a private newly created /tmp/caw-db-review directory
for inspection. PostgreSQL has no TCP listener; Redis uses port0 and a private
Unix socket. services stop in finally on ordinary completion/errors. a forcibly
killed runner or host failure can prevent cleanup; inspect its private temporary
directory before rerunning. never point other services at these test sockets.

## assertions

- rejected PostgreSQL sweep: balance100 and no checkpoint; retry after removing
  the rejection: balance40, checkpoint11 and healthy heartbeat.
- rejected Redis SET: baseline keeps checkpoint10 but reports healthy on the
  next fixed-tip poll. this case reproduces the bug, not a correctness pass.
- fresh Node process: reads that saved10 and retained balance40, then replays to11.
- candidate ordering: retry after Redis accepts writes saves11 without restart.

`checkpoint-result.json` records outcome and logs. inspect passed and
processes_stopped as well as each assertion. results are local and can contain
runtime paths; review before sharing. no real chain, abrupt crash, Redis disk
persistence, full service startup, backfill, reorg or cross-store atomicity proof
is provided. replay timestamps and incomplete historical inputs remain unresolved.
