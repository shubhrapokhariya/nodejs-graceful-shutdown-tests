// A tiny long-running process used to test whether SIGTERM reaches your app
// through wrappers (sh -c, npm start) and through PID 1 (docker / PID namespace).
//
//   HANDLE=1  install a SIGTERM handler that logs and exits 0
//   HANDLE=0  no handler (Node's default: SIGTERM terminates the process)

const handle = process.env.HANDLE === '1';
console.log(`READY pid=${process.pid} ppid=${process.ppid} handle=${handle}`);

if (handle) {
  process.on('SIGTERM', () => {
    console.log('GOT SIGTERM');
    setTimeout(() => process.exit(0), 50);
  });
}

setInterval(() => {}, 1000);
