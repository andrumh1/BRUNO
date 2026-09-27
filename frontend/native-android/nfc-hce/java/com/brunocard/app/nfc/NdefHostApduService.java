package com.brunocard.app.nfc;

import android.content.Intent;
import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Emulates an NFC Forum Type 4 Tag holding ONE NDEF URI record (the BRUNO transfer link).
 * iPhone (XS or newer, screen on) reads it in the background and shows the link banner;
 * Android phones read it with any NFC reader / Chrome Web NFC.
 */
public class NdefHostApduService extends HostApduService {
    public static volatile String currentUrl = null;

    private static final byte[] SW_OK = {(byte) 0x90, 0x00};
    private static final byte[] SW_NOT_FOUND = {(byte) 0x6A, (byte) 0x82};
    private static final byte[] SW_UNKNOWN = {(byte) 0x6F, 0x00};
    private static final byte[] NDEF_AID = hex("D2760000850101");
    private static final byte[] CC_ID = {(byte) 0xE1, 0x03};
    private static final byte[] NDEF_ID = {(byte) 0xE1, 0x04};
    // Capability Container: CCLEN=000F, version 2.0, MLe=00FF, MLc=00FF, NDEF File Control TLV (E104, max 0x7FFF, R/W flags)
    private static final byte[] CC_FILE = hex("000F2000FF00FF0406E1047FFF0000");

    private byte[] selected = null;

    @Override
    public byte[] processCommandApdu(byte[] apdu, Bundle extras) {
        if (apdu == null || apdu.length < 4) return SW_UNKNOWN;
        int cla = apdu[0] & 0xFF, ins = apdu[1] & 0xFF, p1 = apdu[2] & 0xFF, p2 = apdu[3] & 0xFF;
        if (cla != 0x00) return SW_UNKNOWN;
        if (ins == 0xA4) { // SELECT
            if (p1 == 0x04) { // by AID
                byte[] aid = Arrays.copyOfRange(apdu, 5, 5 + (apdu[4] & 0xFF));
                return Arrays.equals(aid, NDEF_AID) ? SW_OK : SW_NOT_FOUND;
            }
            if (p1 == 0x00 && apdu.length >= 7) { // by file id
                byte[] fid = Arrays.copyOfRange(apdu, 5, 7);
                if (Arrays.equals(fid, CC_ID) || Arrays.equals(fid, NDEF_ID)) { selected = fid; return SW_OK; }
                return SW_NOT_FOUND;
            }
            return SW_NOT_FOUND;
        }
        if (ins == 0xB0 && selected != null) { // READ BINARY
            int offset = (p1 << 8) | p2;
            int le = apdu.length > 4 ? (apdu[4] & 0xFF) : 0;
            if (le == 0) le = 256;
            byte[] file = Arrays.equals(selected, CC_ID) ? CC_FILE : ndefFile();
            if (offset >= file.length) return SW_NOT_FOUND;
            int end = Math.min(file.length, offset + le);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            out.write(file, offset, end - offset);
            out.write(SW_OK, 0, 2);
            return out.toByteArray();
        }
        return SW_UNKNOWN;
    }

    @Override
    public void onDeactivated(int reason) { selected = null; }

    /** NDEF file = 2-byte length + NDEF message (single well-known URI record). */
    private static byte[] ndefFile() {
        String url = currentUrl == null ? "https://brunocard.com" : currentUrl;
        byte prefix = 0x00; String rest = url;
        if (url.startsWith("https://www.")) { prefix = 0x02; rest = url.substring(12); }
        else if (url.startsWith("https://")) { prefix = 0x04; rest = url.substring(8); }
        else if (url.startsWith("http://www.")) { prefix = 0x01; rest = url.substring(11); }
        else if (url.startsWith("http://")) { prefix = 0x03; rest = url.substring(7); }
        byte[] uri = rest.getBytes(StandardCharsets.UTF_8);
        byte[] payload = new byte[uri.length + 1];
        payload[0] = prefix; System.arraycopy(uri, 0, payload, 1, uri.length);
        ByteArrayOutputStream rec = new ByteArrayOutputStream();
        boolean shortRec = payload.length < 256;
        rec.write(shortRec ? 0xD1 : 0xC1); // MB|ME|SR|TNF=well-known
        rec.write(0x01); // type length
        if (shortRec) rec.write(payload.length);
        else { rec.write((payload.length >> 24) & 0xFF); rec.write((payload.length >> 16) & 0xFF); rec.write((payload.length >> 8) & 0xFF); rec.write(payload.length & 0xFF); }
        rec.write('U');
        rec.write(payload, 0, payload.length);
        byte[] msg = rec.toByteArray();
        byte[] file = new byte[msg.length + 2];
        file[0] = (byte) ((msg.length >> 8) & 0xFF); file[1] = (byte) (msg.length & 0xFF);
        System.arraycopy(msg, 0, file, 2, msg.length);
        return file;
    }

    private static byte[] hex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
        return b;
    }
}
