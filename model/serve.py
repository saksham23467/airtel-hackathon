"""Local scoring server. It does not call a network model or a government API."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import joblib

sys.path.insert(0, str(Path(__file__).resolve().parent))

import recommender as reco

PORT = 43124


def load_runtime():
    products = reco.load_catalogue()
    registry = reco.load_registry(reco.DATA / "mock_gstin_registry.csv")
    artifact = reco.ARTIFACTS / "ranker.joblib"
    blob = joblib.load(artifact)
    return {
        "products": products,
        "registry": registry,
        "model": blob["model"],
        "categories": blob["categories"],
        "segment_rates": blob["segment_rates"],
        "global_rates": blob["global_rates"],
    }


class Handler(BaseHTTPRequestHandler):
    runtime = None

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/health"):
            self._send(200, {"ok": True, "engine": "hist_gradient_boosting", "case_clock": reco.CASE_TODAY.isoformat()})
            return
        if self.path.startswith("/metrics"):
            path = reco.ARTIFACTS / "metrics.json"
            self._send(200, json.loads(path.read_text()) if path.exists() else {"error": "metrics not trained"})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if not self.path.startswith("/recommend"):
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            self._send(400, {"error": "invalid json"})
            return
        profile = reco.profile_from_request(payload, self.runtime["registry"])
        result = reco.recommend_with_model(
            self.runtime["model"],
            profile,
            self.runtime["products"],
            self.runtime["categories"],
            self.runtime["segment_rates"],
            self.runtime["global_rates"],
        )
        result["case_clock"] = reco.CASE_TODAY.isoformat()
        self._send(200, result)

    def log_message(self, fmt: str, *args) -> None:
        # Path and status only. Request bodies can contain a GSTIN.
        sys.stderr.write("model %s\n" % (fmt % args))


def main() -> None:
    Handler.runtime = load_runtime()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"model server on 127.0.0.1:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
