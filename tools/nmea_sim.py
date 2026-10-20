#!/usr/bin/env python3
"""YDWG-02 gateway simulator: streams NMEA 0183 like the real gateway does on TCP port 1456,
and the same text over a WebSocket on port 1457 (so the web version can be tested on localhost).

A boat beats upwind (tacks every 90 s) in an oscillating 12 kn breeze from ~250°; prints nothing, Ctrl+C stops.
Run: python3 tools/nmea_sim.py [--tcp 1456] [--ws 1457]
In the app: Яхта → Приборы → адрес 127.0.0.1 (Android emulator: 10.0.2.2), порт 1456 (или 1457 в браузере).
"""
import argparse
import base64
import hashlib
import math
import socket
import threading
import time

VAR = 5.5  # magnetic variation, °E


def nmea(body):
    cs = 0
    for ch in body:
        cs ^= ord(ch)
    return f'${body}*{cs:02X}\r\n'


def sentences(t):
    twd = 250 + 8 * math.sin(t / 120)                 # oscillating breeze
    tws = 12 + 2 * math.sin(t / 47)
    tack = 1 if int(t // 90) % 2 == 0 else -1          # starboard / port
    hdg = (twd - tack * 42) % 360                      # close-hauled
    stw = 6.1 + 0.3 * math.sin(t / 13)
    twa = ((twd - hdg + 540) % 360) - 180              # + = wind on starboard
    # apparent wind = true wind + headwind from boat speed
    tx, ty = tws * math.sin(math.radians(twa)), tws * math.cos(math.radians(twa))
    ax, ay = tx, ty + stw
    aws, awa = math.hypot(ax, ay), math.degrees(math.atan2(ax, ay))
    depth = 18 + 6 * math.sin(t / 60)
    return [
        nmea(f'YDMWV,{awa % 360:.1f},R,{aws:.1f},N,A'),
        nmea(f'YDMWV,{twa % 360:.1f},T,{tws:.1f},N,A'),
        nmea(f'YDMWD,{twd:.1f},T,{(twd - VAR) % 360:.1f},M,{tws:.1f},N,{tws / 1.943844:.1f},M'),
        nmea(f'YDVHW,{hdg:.1f},T,{(hdg - VAR) % 360:.1f},M,{stw:.2f},N,{stw * 1.852:.2f},K'),
        nmea(f'YDHDG,{(hdg - VAR) % 360:.1f},,,{VAR:.1f},E'),
        nmea(f'YDDPT,{depth - 0.5:.1f},0.5,'),
        nmea('YDMTW,23.4,C'),
    ]


clients = []
lock = threading.Lock()


def tcp_server(port):
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('0.0.0.0', port))
    srv.listen()
    while True:
        c, _ = srv.accept()
        with lock:
            clients.append(('tcp', c))


def ws_server(port):
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('0.0.0.0', port))
    srv.listen()
    while True:
        c, _ = srv.accept()
        try:
            req = c.recv(4096).decode('latin-1')
            key = next(l.split(':', 1)[1].strip() for l in req.split('\r\n') if l.lower().startswith('sec-websocket-key'))
            acc = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
            c.sendall(f'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {acc}\r\n\r\n'.encode())
            with lock:
                clients.append(('ws', c))
        except Exception:
            c.close()


def ws_frame(text):
    data = text.encode()
    n = len(data)
    head = bytes([0x81, n]) if n < 126 else bytes([0x81, 126]) + n.to_bytes(2, 'big')
    return head + data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tcp', type=int, default=1456)
    ap.add_argument('--ws', type=int, default=1457)
    a = ap.parse_args()
    threading.Thread(target=tcp_server, args=(a.tcp,), daemon=True).start()
    threading.Thread(target=ws_server, args=(a.ws,), daemon=True).start()
    t0 = time.time()
    while True:
        text = ''.join(sentences(time.time() - t0))
        with lock:
            for kind, c in list(clients):
                try:
                    c.sendall(text.encode() if kind == 'tcp' else ws_frame(text))
                except OSError:
                    clients.remove((kind, c))
                    c.close()
        time.sleep(1)


if __name__ == '__main__':
    main()
