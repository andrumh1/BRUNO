package com.brunocard.app;

import android.os.Bundle;
import com.brunocard.app.nfc.BrunoNfcHcePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BrunoNfcHcePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
