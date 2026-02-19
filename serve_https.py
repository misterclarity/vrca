# Source - https://stackoverflow.com/a/77512705
# Posted by Andrej Kesely
# Retrieved 2026-02-13, License - CC BY-SA 4.0

import http.server
import ssl
import os


def get_ssl_context(certfile, keyfile):
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile, keyfile)
    context.set_ciphers("@SECLEVEL=1:ALL")
    return context


class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)
        print(post_data.decode("utf-8"))

base_dir = os.path.dirname(os.path.abspath(__file__))

server_address = ("0.0.0.0", 5000)
httpd = http.server.HTTPServer(server_address, MyHandler)

context = get_ssl_context("certs/cert.pem", "certs/key.pem")
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

httpd.serve_forever()
