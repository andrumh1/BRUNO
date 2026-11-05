// Build nativo multiplataforma (Windows cmd/PowerShell, macOS, Linux). Equivale a scripts/native-build.sh.
// Uso: yarn native:build   →  build web (producción, .env.native) → cap sync android → cap copy ios → native-verify
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
process.chdir(root);
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function loadEnvNative() {
  const file = path.join(root, '.env.native');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

function run(cmd, args, extraEnv = {}) {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) {
    console.error(`\n✖ Falló: ${cmd} ${args.join(' ')} (código ${r.status})`);
    process.exit(r.status || 1);
  }
}

loadEnvNative();
const api = process.env.REACT_APP_BACKEND_URL;
if (!api) {
  console.error('✖ Falta REACT_APP_BACKEND_URL. Copia .env.native.example a .env.native (en frontend/) y vuelve a ejecutar.');
  process.exit(1);
}
if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(api)) {
  console.error('✖ REACT_APP_BACKEND_URL no puede ser localhost: el teléfono no puede verlo.');
  process.exit(1);
}
if (!api.startsWith('https://')) {
  console.error('✖ REACT_APP_BACKEND_URL debe empezar por https:// (iOS/Android bloquean http en producción).');
  process.exit(1);
}
console.log(`▶ API/dominio que usará la app: ${api}`);

run('yarn', ['build'], { CI: 'false', GENERATE_SOURCEMAP: 'false', REACT_APP_BACKEND_URL: api });

const indexHtml = path.join(root, 'build', 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('✖ El build no generó build/index.html; cap sync no puede continuar.');
  process.exit(1);
}
console.log('✔ build/index.html generado');

run('npx', ['cap', 'sync', 'android']);

if (isMac) {
  run('npx', ['cap', 'sync', 'ios']);
} else {
  console.log('\n▶ Copiando web → ios/ (sin pod install; en el Mac ejecuta: npx cap sync ios)');
  const r = spawnSync('npx', ['cap', 'copy', 'ios'], { stdio: 'inherit', shell: isWin, env: process.env });
  if (r.status !== 0) console.warn('⚠ cap copy ios no se completó en este sistema; no afecta a Android. Hazlo en el Mac con: npx cap sync ios');
}

run(process.execPath, [path.join(__dirname, 'native-verify.js'), api]);
