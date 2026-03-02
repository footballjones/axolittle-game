import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.mjs'):
            return 'application/javascript'
        return super().guess_type(path)

print("Serving Axolittle on http://localhost:3000")
http.server.HTTPServer(('', 3000), Handler).serve_forever()
