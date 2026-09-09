// CommonJS entry point for cPanel/Passenger loaders; the backend build is ESM.
process.chdir(__dirname);
import('./dist/server.js').catch((error) => {
  console.error('Unable to start ADEK TATU backend:', error);
  process.exit(1);
});
