#!/usr/bin/env python3
"""Dev server: static files with caching disabled (ES modules otherwise go stale)."""
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8640
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
