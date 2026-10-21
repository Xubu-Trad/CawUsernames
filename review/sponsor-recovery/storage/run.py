import json,os,subprocess,tempfile,time,hashlib,argparse,shutil
from pathlib import Path
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--runtime-root',required=True);args=parser.parse_args()
runtime=Path(args.runtime_root).resolve();pg=runtime/'usr/lib/postgresql/14/bin';env=dict(os.environ);env['LD_LIBRARY_PATH']=str(runtime/'usr/lib/x86_64-linux-gnu')
assert os.name=='posix' and os.geteuid()!=0, 'run as an ordinary Linux user'
mem={line.split(':')[0]:int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:')}
assert mem['MemAvailable']>=768*1024**2 and shutil.disk_usage('/tmp').free>=2*1024**3, 'resource guard'
assert (root/'pinned-functions.js').is_file() and (root/'schema.prisma').is_file(), 'run prepare-storage.cjs first'
env['PRISMA_HIDE_UPDATE_MESSAGE']='1'
run=Path(tempfile.mkdtemp(prefix='caw-db-review-',dir='/tmp'));os.chmod(run,0o700);data=run/'pgdata';sock=run/'sockets';sock.mkdir(mode=0o700)
def call(args):return subprocess.check_output([str(x) for x in args],env=env,stderr=subprocess.STDOUT,timeout=40).decode()
redis=None;started=False;result={'purpose':'pinned indexer functions with real Prisma/PostgreSQL/Redis, synthetic RPC/events/timers','tcp_listeners':False}
try:
 call([pg/'initdb','-D',data,'-L',runtime/'usr/share/postgresql/14','--no-locale','--encoding=UTF8','--auth-local=trust','--auth-host=reject'])
 call([pg/'pg_ctl','-D',data,'-l',run/'postgres.log','-o',"-c listen_addresses='' -c unix_socket_directories="+str(sock)+" -c shared_buffers=16MB -c max_connections=10 -c jit=off",'-w','start']);started=True
 result['postgres']=call([pg/'psql','-h',sock,'-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-c',"CREATE TABLE smoke(v integer); INSERT INTO smoke VALUES(42); SELECT v FROM smoke;"]).strip()
 log=(run/'redis.log').open('wb')
 redis=subprocess.Popen([str(runtime/'usr/bin/redis-server'),'--port','0','--unixsocket',str(sock/'redis.sock'),'--unixsocketperm','700','--save','','--appendonly','no','--maxmemory','16mb','--dir',str(run)],env=env,stdout=log,stderr=subprocess.STDOUT)
 for i in range(100):
  if (sock/'redis.sock').exists():break
  if redis.poll() is not None:raise RuntimeError('redis exited')
  time.sleep(.05)
 result['redis_ping']=call([runtime/'usr/bin/redis-cli','-s',sock/'redis.sock','PING']).strip()
 result['redis_write']=call([runtime/'usr/bin/redis-cli','-s',sock/'redis.sock','SET','synthetic-checkpoint','11']).strip()
 result['redis_read']=call([runtime/'usr/bin/redis-cli','-s',sock/'redis.sock','GET','synthetic-checkpoint']).strip()
 assert result['postgres'].endswith('42') and result['redis_ping']=='PONG' and result['redis_read']=='11'
 env['DATABASE_URL']='postgresql://'+os.environ.get('USER','xubutrad')+'@localhost/postgres?host='+str(sock)
 env['CAW_REVIEW_SOCKET']=str(sock)
 env['NODE_OPTIONS']='--max-old-space-size=256'
 integration=root
 result['generate']=call(['node',integration/'node_modules/prisma/build/index.js','generate','--schema',integration/'schema.prisma'])
 ddl=call(['node',integration/'node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel',integration/'schema.prisma','--script'])
 sql=run/'schema.sql';sql.write_text(ddl)
 call([pg/'psql','-h',sock,'-d','postgres','-X','-v','ON_ERROR_STOP=1','-f',sql])
 result['integration']=call(['node',integration/'recovery.cjs'])
 assert 'REAL_STORAGE_RETRY_PASS' in result['integration']
 for mode in ['baseline','restart','candidate']:
  result[mode]=call(['node',integration/'checkpoint.cjs',mode])
  assert 'CHECKPOINT_CASE_PASS '+mode in result[mode]
 result['passed']=True
except Exception as error:
 result['passed']=False
 result['error']=str(error)
 if hasattr(error,'output') and error.output:result['error_output']=error.output.decode(errors='replace')[-6000:]
 raise
finally:
 try:
  if redis is not None:
   redis.terminate();redis.wait(timeout=10);log.close()
 finally:
  if started or (data/'postmaster.pid').exists():call([pg/'pg_ctl','-D',data,'-m','fast','-w','stop'])
 result['processes_stopped']=True
 (root/'checkpoint-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
