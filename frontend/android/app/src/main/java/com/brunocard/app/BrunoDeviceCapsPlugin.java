package com.brunocard.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge: BrunoDeviceCaps.get() → qué servicios/hardware existen, para no llamar a plugins que harían crash sin ellos. */
@CapacitorPlugin(name = "BrunoDeviceCaps")
public class BrunoDeviceCapsPlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        JSObject ret = new JSObject();
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();

        // Firebase solo queda inicializado si el plugin google-services generó el recurso google_app_id (google-services.json presente).
        boolean firebase = false;
        try { firebase = ctx.getResources().getIdentifier("google_app_id", "string", ctx.getPackageName()) != 0; } catch (Exception ignored) {}
        ret.put("firebase", firebase);

        boolean playServices = false;
        try { pm.getPackageInfo("com.google.android.gms", 0); playServices = true; } catch (Exception ignored) {}
        ret.put("playServices", playServices);

        boolean nfc = false;
        try { nfc = pm.hasSystemFeature(PackageManager.FEATURE_NFC) && NfcAdapter.getDefaultAdapter(ctx) != null; } catch (Exception ignored) {}
        ret.put("nfc", nfc);

        boolean biometricHardware = false;
        try {
            biometricHardware = pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && (pm.hasSystemFeature(PackageManager.FEATURE_FACE) || pm.hasSystemFeature(PackageManager.FEATURE_IRIS)));
        } catch (Exception ignored) {}
        ret.put("biometricHardware", biometricHardware);

        call.resolve(ret);
    }
}
