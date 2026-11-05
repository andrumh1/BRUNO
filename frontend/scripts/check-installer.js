// Instalador oficial de BRUNO: yarn 1 (yarn.lock). npm produce otro árbol (ajv 6 vs 8, peers) y rompe el build.
const ua = process.env.npm_config_user_agent || '';
if (!ua.startsWith('yarn/')) {
  console.error('\n✖ BRUNO se instala SOLO con yarn (yarn.lock). Detectado: ' + (ua.split(' ')[0] || 'npm'));
  console.error('  Instala yarn 1:  npm install -g yarn@1.22.22');
  console.error('  Luego ejecuta:   yarn install --frozen-lockfile\n');
  process.exit(1);
}
const major = Number(process.versions.node.split('.')[0]);
if (major < 20 || major > 24) {
  console.error('\n✖ Node ' + process.versions.node + ' no está soportado. Usa Node 22 LTS o 24 LTS (ver .nvmrc). Node 26 NO está soportado por CRA/Craco.');
  console.error('  Windows: nvm-windows → nvm install 24 && nvm use 24   (o instalador LTS desde nodejs.org)\n');
  process.exit(1);
}
