// Verificación multiplataforma del paquete nativo (sin bash ni python). Equivale a scripts/native-verify.sh.
// Uso: yarn native:verify [https://brunocard.com]
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

let expected = process.argv[2] || process.env.REACT_APP_BACKEND_URL || '';
if (!expected && fs.existsSync('.env.native')) {
  const m = fs.readFileSync('.env.native', 'utf8').match(/^REACT_APP_BACKEND_URL=(.+)$/m);
  if (m) expected = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!expected) {
  console.error('✖ Indica el dominio esperado: yarn native:verify https://brunocard.com');
  process.exit(1);
}

let fail = false;
const ok = (msg) => console.log('✔ ' + msg);
const bad = (msg) => { console.log('✖ ' + msg); fail = true; };

function checkDir(dir, label) {
  const jsDir = path.join(dir, 'static', 'js');
  const js = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).find((f) => /^main\..*\.js$/.test(f)) : null;
  if (!js) return bad(`${label}: no hay bundle en ${dir} (ejecuta yarn native:build)`);
  const code = fs.readFileSync(path.join(jsDir, js), 'utf8');
  if (code.includes(expected)) ok(`${label}: el bundle apunta a ${expected}`); else bad(`${label}: el bundle NO contiene ${expected}`);
  if (/localhost:8001|127\.0\.0\.1:8001/.test(code)) bad(`${label}: el bundle contiene localhost:8001`);
  const hits = [...new Set(code.match(/https:\/\/[a-z0-9.-]+\.(emergentagent\.com|emergent\.host)/g) || [])]
    .filter((h) => h !== expected && !h.includes('auth.emergentagent.com'));
  if (hits.length) console.log(`⚠ ${label}: otros dominios Emergent en el bundle (revisa .env.native): ${hits.join(' ')}`);
}

checkDir(path.join('android', 'app', 'src', 'main', 'assets', 'public'), 'Android');
checkDir(path.join('ios', 'App', 'App', 'public'), 'iOS');

const pluginsFile = path.join('android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');
if (fs.existsSync(pluginsFile)) {
  console.log('▶ Plugins nativos registrados en Android:');
  for (const p of JSON.parse(fs.readFileSync(pluginsFile, 'utf8'))) console.log(`   • ${p.pkg} → ${p.classpath}`);
}

const cordovaVars = path.join('android', 'capacitor-cordova-android-plugins', 'cordova.variables.gradle');
if (fs.existsSync(cordovaVars)) ok('android/capacitor-cordova-android-plugins/cordova.variables.gradle generado (Gradle sync OK)');
else bad('Falta android/capacitor-cordova-android-plugins/cordova.variables.gradle → ejecuta: npx cap sync android');

const appId = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8')).appId;
const gradle = fs.readFileSync(path.join('android', 'app', 'build.gradle'), 'utf8');
if (gradle.includes(`applicationId "${appId}"`)) ok(`Android applicationId = ${appId}`); else bad(`applicationId en android/app/build.gradle ≠ ${appId}`);
const pbx = fs.readFileSync(path.join('ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
if (pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${appId};`)) ok(`iOS bundle id = ${appId}`); else bad(`bundle id iOS ≠ ${appId}`);

const manifest = fs.readFileSync(path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
for (const perm of ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'NFC', 'POST_NOTIFICATIONS', 'USE_BIOMETRIC']) {
  if (manifest.includes(`android.permission.${perm}`)) ok(`Android permiso ${perm}`); else bad(`Falta permiso Android ${perm}`);
}
const plist = fs.readFileSync(path.join('ios', 'App', 'App', 'Info.plist'), 'utf8');
for (const key of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSLocationWhenInUseUsageDescription', 'NFCReaderUsageDescription', 'NSFaceIDUsageDescription', 'NSPhotoLibraryUsageDescription']) {
  if (plist.includes(key)) ok(`iOS ${key}`); else bad(`Falta ${key} en Info.plist`);
}

if (fail) { console.log('❌ Hay problemas en el paquete nativo'); process.exit(1); }
console.log(`✅ Paquete nativo coherente con la web (${expected})`);
