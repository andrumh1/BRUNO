# BRUNO NFC HCE (Android) — el teléfono se comporta como un tag NFC

Con este plugin, la pantalla **Transferir por contacto** (`/cards/:id/transfer`) hace que el Android
emita la tarjeta por NFC. Un **iPhone (XS o posterior, pantalla encendida)** la lee al acercarlo y muestra
el banner con el enlace `/t/<token>`; otro Android la lee igual. (iPhone no puede emitir: Apple no
permite HCE a apps de terceros; en iPhone se comparte con AirDrop/QR.)

## Instalación (después de `yarn cap:add:android`)
1. Copia `java/com/brunocard/app/nfc/*.java` → `android/app/src/main/java/com/brunocard/app/nfc/`
2. Copia `res/xml/apdu_service.xml` → `android/app/src/main/res/xml/`
3. Añade a `android/app/src/main/res/values/strings.xml`:
   `<string name="nfc_service_desc">BRUNO · transferencia de tarjeta por NFC</string>`
4. Pega el contenido de `AndroidManifest.snippet.xml` en `android/app/src/main/AndroidManifest.xml`
5. Registra el plugin en `MainActivity.java`:
   ```java
   import com.brunocard.app.nfc.BrunoNfcHcePlugin;
   public class MainActivity extends BridgeActivity {
     @Override public void onCreate(Bundle savedInstanceState) {
       registerPlugin(BrunoNfcHcePlugin.class);
       super.onCreate(savedInstanceState);
     }
   }
   ```
6. `yarn build && npx cap sync android && npx cap open android` → compila en un teléfono real con NFC.

El frontend ya lo usa automáticamente (`src/native/nfcShare.js` → `BrunoNfcHce.startEmulation({url})`).
Sin el plugin (web o iPhone) la pantalla cae a Web NFC / AirDrop / QR sin errores.
