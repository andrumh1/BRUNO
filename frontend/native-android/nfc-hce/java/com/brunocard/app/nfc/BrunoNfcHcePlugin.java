package com.brunocard.app.nfc;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.nfc.cardemulation.CardEmulation;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge: BrunoNfcHce.startEmulation({url}) / stopEmulation() / isSupported() */
@CapacitorPlugin(name = "BrunoNfcHce")
public class BrunoNfcHcePlugin extends Plugin {

    private boolean supported() {
        PackageManager pm = getContext().getPackageManager();
        return pm.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION) && NfcAdapter.getDefaultAdapter(getContext()) != null;
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", supported());
        NfcAdapter a = NfcAdapter.getDefaultAdapter(getContext());
        ret.put("enabled", a != null && a.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void startEmulation(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("url requerida"); return; }
        if (!supported()) { call.reject("Este dispositivo no soporta emulación NFC (HCE)"); return; }
        NdefHostApduService.currentUrl = url;
        try {
            CardEmulation ce = CardEmulation.getInstance(NfcAdapter.getDefaultAdapter(getContext()));
            ComponentName cn = new ComponentName(getContext(), NdefHostApduService.class);
            ce.setPreferredService(getActivity(), cn); // foreground preference while the transfer screen is open
        } catch (Exception ignored) { }
        JSObject ret = new JSObject();
        ret.put("emulating", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopEmulation(PluginCall call) {
        NdefHostApduService.currentUrl = null;
        try {
            CardEmulation ce = CardEmulation.getInstance(NfcAdapter.getDefaultAdapter(getContext()));
            ce.unsetPreferredService(getActivity());
        } catch (Exception ignored) { }
        call.resolve();
    }
}
