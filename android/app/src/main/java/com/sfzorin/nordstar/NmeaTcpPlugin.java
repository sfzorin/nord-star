package com.sfzorin.nordstar;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

/**
 * Reads NMEA 0183 text from a TCP server (Yacht Devices YDWG-02: 192.168.4.1:1456) and passes it to the web
 * layer in batches ("data" events, every ~200 ms). Reconnects by itself; reports "status" events.
 */
@CapacitorPlugin(name = "NmeaTcp")
public class NmeaTcpPlugin extends Plugin {
    private volatile boolean running;
    private volatile Socket socket;
    private Thread worker;

    @PluginMethod
    public void connect(PluginCall call) {
        String host = call.getString("host", "192.168.4.1");
        int port = call.getInt("port", 1456);
        stopWorker();
        running = true;
        worker = new Thread(() -> loop(host, port), "nmea-tcp");
        worker.setDaemon(true);
        worker.start();
        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        stopWorker();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopWorker();
    }

    private void stopWorker() {
        running = false;
        Socket s = socket;
        if (s != null) {
            try { s.close(); } catch (IOException ignored) { }
        }
        if (worker != null) worker.interrupt();
        worker = null;
    }

    private void status(String state, String message) {
        JSObject o = new JSObject();
        o.put("state", state);
        o.put("message", message);
        notifyListeners("status", o);
    }

    private void flush(StringBuilder pending) {
        if (pending.length() == 0) return;
        JSObject o = new JSObject();
        o.put("text", pending.toString());
        notifyListeners("data", o);
        pending.setLength(0);
    }

    /** The gateway's Wi-Fi has no internet, so Android may prefer mobile data: bind the socket to Wi-Fi. */
    private void bindToWifi(Socket s) {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;
            for (Network n : cm.getAllNetworks()) {
                NetworkCapabilities nc = cm.getNetworkCapabilities(n);
                if (nc != null && nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    n.bindSocket(s);
                    return;
                }
            }
        } catch (Exception ignored) {
            // fall back to the default route
        }
    }

    private void loop(String host, int port) {
        char[] buf = new char[4096];
        StringBuilder pending = new StringBuilder();
        String where = host + ":" + port;
        while (running) {
            status("connecting", where);
            try (Socket s = new Socket()) {
                socket = s;
                bindToWifi(s);
                s.connect(new InetSocketAddress(host, port), 4000);
                s.setSoTimeout(1000);
                status("on", where);
                Reader r = new InputStreamReader(s.getInputStream(), StandardCharsets.US_ASCII);
                long lastFlush = System.currentTimeMillis(), lastData = lastFlush;
                while (running) {
                    long now;
                    try {
                        int n = r.read(buf);
                        if (n < 0) break;
                        pending.append(buf, 0, n);
                        now = System.currentTimeMillis();
                        lastData = now;
                    } catch (SocketTimeoutException idle) {
                        now = System.currentTimeMillis();
                        if (now - lastData > 15000) break; // silent for 15 s: reconnect
                    }
                    if (now - lastFlush >= 200 || pending.length() > 8000) {
                        flush(pending);
                        lastFlush = now;
                    }
                }
                flush(pending);
                if (running) status("error", "нет данных от " + where);
            } catch (IOException e) {
                if (running) status("error", "нет связи с " + where + " — планшет в Wi-Fi шлюза?");
            } finally {
                socket = null;
            }
            if (!running) break;
            try { Thread.sleep(3000); } catch (InterruptedException e) { break; }
        }
        status("off", "");
    }
}
