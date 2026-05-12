import http.server
import socketserver

PORT = 8080

Handler = http.server.SimpleHTTPRequestHandler

def main():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    main()
