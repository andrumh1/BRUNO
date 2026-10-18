"""Servidor estático SPA con gzip (simula el hosting real). Uso: python spa_server.py <dir> <puerto>"""
import gzip, mimetypes, os, sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

ROOT, PORT = sys.argv[1], int(sys.argv[2])


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?")[0]
        fp = os.path.join(ROOT, path.lstrip("/"))
        if not os.path.isfile(fp):
            fp = os.path.join(ROOT, "index.html")
        data = open(fp, "rb").read()
        ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
        hdrs = {"Content-Type": ctype}
        if "gzip" in self.headers.get("Accept-Encoding", "") and ctype.split("/")[0] in ("text", "application") and len(data) > 1000:
            data = gzip.compress(data, 6)
            hdrs["Content-Encoding"] = "gzip"
        hdrs["Cache-Control"] = "public, max-age=31536000, immutable" if "/static/" in path else "no-cache"
        self.send_response(200)
        for k, v in hdrs.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
