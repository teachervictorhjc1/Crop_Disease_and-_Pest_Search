"""本機開發伺服器。

用法：
    uv run scripts/serve.py            # http://localhost:8000
    uv run scripts/serve.py --port 9000

說明：
    Windows 登錄檔有時會把 .js 對應成 text/plain，導致瀏覽器拒絕載入 ES module，
    因此這裡強制指定正確的 MIME 類型，並關閉快取以方便開發。
"""

from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent.parent / "web"

MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    """指定 MIME 並停用快取的靜態檔案處理器。"""

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **MIME}

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> None:
    parser = argparse.ArgumentParser(description="作物病蟲害檢索 本機伺服器")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1", help="要讓同網段手機測試可改成 0.0.0.0")
    args = parser.parse_args()

    handler = functools.partial(Handler, directory=str(WEB_ROOT))
    with ThreadingServer((args.host, args.port), handler) as httpd:
        print(f"伺服器啟動：http://localhost:{args.port}  （根目錄：{WEB_ROOT}）")
        print("按 Ctrl+C 停止")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止")


if __name__ == "__main__":
    main()
