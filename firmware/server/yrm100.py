"""YRM100 (M100 chip) UHF RFID reader - setup, scan, read and write tags.

Protocol: "YRM100 user protocol/Communication user Protocol V2.1_en.docx"
Frame:    BB | type | cmd | PL(2) | params | checksum | 7E
          checksum = low byte of sum(type .. params)

Requires: pip install pyserial

Examples:
  python yrm100.py --port COM10 setup --region us --power 26
  python yrm100.py --port COM10 scan --time 3
  python yrm100.py scan --port 5                 (--port can also go after the command; 5 = COM5)
  python yrm100.py --port COM10 watch            (continuous, Ctrl+C to stop)
  python yrm100.py --port COM10 read  --epc E2801160600002... --bank user --addr 0 --words 4
  python yrm100.py --port COM10 write --epc E2801160600002... --bank user --addr 0 --data 0102030405060708
  python yrm100.py --port COM10 write-epc --epc E2801160600002... --new AABBCCDDEEFF001122334455
  python yrm100.py --port COM10 serve            (HTTP server on :8000 + ngrok tunnel for the NodeMCU)

Server endpoints (serve):
  GET /latest  -> plain text "<epc> <rssi> <tags_in_field>", or "- 0 0" when no tag is present
  GET /tags    -> JSON with every tag currently in the field
"""
import argparse
import contextlib
import json
import shutil
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial

TUNNEL_DOMAIN = "anchovy-glory-undying.ngrok-free.dev"

BANKS = {"reserved": 0, "epc": 1, "tid": 2, "user": 3}
REGIONS = {"china900": 0x01, "us": 0x02, "europe": 0x03, "china800": 0x04, "korea": 0x06}
ERRORS = {
    0x09: "read failed: no tag response / CRC error",
    0x10: "write failed: no tag response / CRC error",
    0x13: "lock/kill failed: no tag response",
    0x15: "inventory: no tag found",
    0x16: "access failed: wrong access password",
    0x17: "invalid command code",
    0x20: "frequency hopping timeout (all channels busy)",
    0xA3: "read error: memory overrun (address/length out of range)",
    0xA4: "read error: memory locked",
    0xB3: "write error: memory overrun (address/length out of range)",
    0xB4: "write error: memory locked",
    0xBB: "write error: insufficient power (move tag closer)",
}


class ReaderError(Exception):
    pass


class YRM100:
    def __init__(self, port, baud=115200, timeout=1.0):
        self.ser = serial.Serial(port, baud, timeout=timeout)
        self.ser.reset_input_buffer()

    def close(self):
        self.ser.close()

    # ---- framing ----
    @staticmethod
    def build(cmd, params=b""):
        body = bytes([0x00, cmd, len(params) >> 8, len(params) & 0xFF]) + bytes(params)
        return b"\xBB" + body + bytes([sum(body) & 0xFF, 0x7E])

    def read_frame(self, timeout=1.0):
        """Return (type, cmd, params) or None on timeout."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            b = self.ser.read(1)
            if b != b"\xBB":
                continue
            hdr = self.ser.read(4)
            if len(hdr) < 4:
                continue
            ftype, cmd, pl = hdr[0], hdr[1], (hdr[2] << 8) | hdr[3]
            rest = self.ser.read(pl + 2)
            if len(rest) < pl + 2 or rest[-1] != 0x7E:
                continue
            params, chk = rest[:pl], rest[pl]
            if (sum(hdr) + sum(params)) & 0xFF != chk:
                continue
            return ftype, cmd, params
        return None

    def command(self, cmd, params=b"", timeout=1.0):
        """Send a command and wait for its response frame. Raises ReaderError on failure."""
        self.ser.write(self.build(cmd, params))
        deadline = time.time() + timeout
        while time.time() < deadline:
            frame = self.read_frame(deadline - time.time())
            if frame is None:
                break
            ftype, rcmd, data = frame
            if ftype == 0x01 and rcmd == cmd:
                return data
            if ftype == 0x01 and rcmd == 0xFF:
                code = data[0]
                raise ReaderError(f"0x{code:02X}: {ERRORS.get(code, 'unknown error')}")
        raise ReaderError(f"no response to command 0x{cmd:02X} (check port / wiring / baud)")

    # ---- module config ----
    def info(self):
        out = {}
        for key, sel in (("hardware", 0), ("software", 1), ("manufacturer", 2)):
            out[key] = self.command(0x03, [sel])[1:].decode("ascii", "replace")
        return out

    def set_region(self, region_code):
        self.command(0x07, [region_code])

    def get_region(self):
        code = self.command(0x08)[0]
        return next((k for k, v in REGIONS.items() if v == code), f"0x{code:02X}")

    def set_power(self, dbm):
        val = int(round(dbm * 100))
        self.command(0xB6, [val >> 8, val & 0xFF])

    def get_power(self):
        d = self.command(0xB7)
        return ((d[0] << 8) | d[1]) / 100

    def set_hopping(self, enabled=True):
        self.command(0xAD, [0xFF if enabled else 0x00])

    # ---- tag operations ----
    def stream(self, seconds=None):
        """Run multiple inventory and yield (epc_hex, rssi_dbm) for every tag read.
        Yields (None, None) about every 0.2 s while idle so callers can do housekeeping.
        Runs forever if `seconds` is None; always stops the reader on exit."""
        start = lambda: self.ser.write(self.build(0x27, [0x22, 0xFF, 0xFF]))
        start()
        end = None if seconds is None else time.time() + seconds
        last_frame = time.time()
        try:
            while end is None or time.time() < end:
                frame = self.read_frame(0.2)
                if frame is None:
                    # 65535-round inventory finished (or module hiccup): restart it
                    if time.time() - last_frame > 1.0:
                        start()
                        last_frame = time.time()
                    yield None, None
                    continue
                last_frame = time.time()
                if frame[0] == 0x02 and frame[1] == 0x22:
                    d = frame[2]
                    rssi = d[0] - 256 if d[0] > 127 else d[0]
                    yield d[3:-2].hex().upper(), rssi
                else:
                    yield None, None
        finally:
            self._stop_inventory()

    def scan(self, seconds=2.0):
        """Multiple inventory for `seconds`. Returns {epc_hex: (count, best_rssi_dbm)}."""
        tags = {}
        for epc, rssi in self.stream(seconds):
            if epc:
                n, best = tags.get(epc, (0, -999))
                tags[epc] = (n + 1, max(best, rssi))
        return tags

    def _stop_inventory(self):
        self.ser.write(self.build(0x28))
        # drain until stop is acknowledged
        t = time.time() + 1.0
        while time.time() < t:
            f = self.read_frame(0.3)
            if f is None or (f[0] == 0x01 and f[1] == 0x28):
                break
        self.ser.reset_input_buffer()

    def select(self, epc_hex):
        """Target a single tag by EPC for subsequent read/write/lock."""
        epc = bytes.fromhex(epc_hex)
        params = bytes([0x01]) + (0x20).to_bytes(4, "big") + bytes([len(epc) * 8, 0x00]) + epc
        self.command(0x0C, params)
        self.command(0x12, [0x02])  # send Select before every op except inventory

    def read(self, epc_hex, bank, addr, words, password=0):
        self.select(epc_hex)
        params = password.to_bytes(4, "big") + bytes([bank]) + addr.to_bytes(2, "big") + words.to_bytes(2, "big")
        d = self.command(0x39, params, timeout=2.0)
        ul = d[0]  # PC+EPC length, then data
        return d[1 + ul:]

    def write(self, epc_hex, bank, addr, data, password=0):
        if len(data) % 2:
            raise ValueError("data must be a whole number of 16-bit words (even number of bytes)")
        if len(data) > 64:
            raise ValueError("max 32 words (64 bytes) per write")
        self.select(epc_hex)
        params = (password.to_bytes(4, "big") + bytes([bank]) + addr.to_bytes(2, "big")
                  + (len(data) // 2).to_bytes(2, "big") + data)
        d = self.command(0x49, params, timeout=2.0)
        if d[-1] != 0x00:
            raise ReaderError(f"write returned status 0x{d[-1]:02X}")

    def write_epc(self, old_epc_hex, new_epc_hex, password=0):
        """Rewrite a tag's EPC (also updates the PC length bits if the size changes)."""
        new = bytes.fromhex(new_epc_hex)
        if len(new) % 2:
            raise ValueError("EPC must be an even number of bytes")
        pc = int.from_bytes(self.read(old_epc_hex, BANKS["epc"], 1, 1, password), "big")
        new_pc = (pc & 0x07FF) | ((len(new) // 2) << 11)
        # EPC bank: word 0 = CRC, word 1 = PC, word 2.. = EPC
        self.write(old_epc_hex, BANKS["epc"], 1, new_pc.to_bytes(2, "big") + new, password)


def watch(r, gone_after=4.0, every=False, confirm=3, window=1.0, min_rssi=None, smooth=0.2):
    """Continuously inventory and print tags entering/leaving the field until Ctrl+C.

    Debounced so tags moving at the edge of range don't flicker:
      - a tag is reported NEW only after `confirm` reads within `window` seconds
        (and, if `min_rssi` is set, those reads must be at least that strong)
      - once present, ANY read keeps it alive (hysteresis); it is reported GONE
        only after `gone_after` seconds with no reads at all
      - RSSI is shown as an exponential moving average (`smooth` = weight of new read)
    """
    pending = {}  # epc -> list of recent qualifying read times
    present = {}  # epc -> [first_seen, last_seen, reads, avg_rssi]

    def line(text, end="\n"):
        # \r + padding overwrites the live status line; works in any Windows console
        print("\r" + text.ljust(100), end=end, flush=True)

    stamp = lambda: time.strftime("%H:%M:%S")
    status_at = 0.0
    rule = f"confirm {confirm} reads/{window:g}s" + (f", min {min_rssi} dBm" if min_rssi is not None else "")
    print(f"Watching for tags... ({rule}, gone after {gone_after:g}s; Ctrl+C to stop)")
    try:
        with contextlib.closing(r.stream()) as reads:
            for epc, rssi in reads:
                now = time.time()
                if epc:
                    if every:
                        line(f"{stamp()}    read  {epc}  rssi={rssi} dBm")
                    if epc in present:
                        t = present[epc]
                        t[1], t[2] = now, t[2] + 1
                        t[3] += smooth * (rssi - t[3])
                    elif min_rssi is None or rssi >= min_rssi:
                        hits = [h for h in pending.get(epc, []) if now - h <= window] + [now]
                        if len(hits) >= confirm:
                            pending.pop(epc, None)
                            present[epc] = [now, now, len(hits), float(rssi)]
                            line(f"{stamp()}  + NEW   {epc}  rssi={rssi} dBm")
                        else:
                            pending[epc] = hits
                for e, (first, last, n, avg) in list(present.items()):
                    if now - last > gone_after:
                        line(f"{stamp()}  - GONE  {e}  ({n} reads over {last - first:.1f}s, avg {avg:.0f} dBm)")
                        del present[e]
                for e in [e for e, hits in pending.items() if now - hits[-1] > window]:
                    del pending[e]  # never confirmed: stray read, drop silently
                if not every and now - status_at > 0.5:
                    status_at = now
                    live = "  ".join(f"...{e[-8:]}({v[3]:.0f}dBm)" for e, v in present.items()) or "-"
                    line(f"  in field: {len(present)}  {live}", end="")
    except KeyboardInterrupt:
        print("\nStopped.")


def serve(r, http_port=8000, tunnel=TUNNEL_DOMAIN, gone_after=4.0, confirm=3, window=1.0,
          min_rssi=None, smooth=0.2):
    """Inventory continuously in a background thread and publish the tags in the field over HTTP.

    Uses the same debouncing as `watch`. If `tunnel` is set, also starts
    `ngrok http --url=<tunnel> <http_port>` so the NodeMCU can reach it from anywhere.
    """
    lock = threading.Lock()
    stop = threading.Event()
    present = {}  # epc -> [first_seen, last_seen, reads, avg_rssi]
    pending = {}  # epc -> list of recent qualifying read times
    stamp = lambda: time.strftime("%H:%M:%S")

    def reader():
        with contextlib.closing(r.stream()) as reads:
            for epc, rssi in reads:
                if stop.is_set():
                    break
                now = time.time()
                with lock:
                    if epc in present:
                        t = present[epc]
                        t[1], t[2] = now, t[2] + 1
                        t[3] += smooth * (rssi - t[3])
                    elif epc and (min_rssi is None or rssi >= min_rssi):
                        hits = [h for h in pending.get(epc, []) if now - h <= window] + [now]
                        if len(hits) >= confirm:
                            pending.pop(epc, None)
                            present[epc] = [now, now, len(hits), float(rssi)]
                            print(f"{stamp()}  + NEW   {epc}  rssi={rssi} dBm", flush=True)
                        else:
                            pending[epc] = hits
                    for e, (first, last, n, avg) in list(present.items()):
                        if now - last > gone_after:
                            print(f"{stamp()}  - GONE  {e}  ({n} reads, avg {avg:.0f} dBm)", flush=True)
                            del present[e]
                    for e in [e for e, hits in pending.items() if now - hits[-1] > window]:
                        del pending[e]

    def snapshot():
        """Tags in the field, most recently seen first."""
        with lock:
            items = [(e, list(v)) for e, v in present.items()]
        return sorted(items, key=lambda t: -t[1][1])

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            tags = snapshot()
            path = self.path.split("?")[0].rstrip("/")
            if path == "/latest":
                if tags:
                    epc, (_, _, _, avg) = tags[0]
                    body, ctype = f"{epc} {avg:.0f} {len(tags)}", "text/plain"
                else:
                    body, ctype = "- 0 0", "text/plain"
            elif path in ("", "/tags"):
                body = json.dumps({"time": time.time(), "tags": [
                    {"epc": e, "rssi": round(avg), "reads": n, "first_seen": first, "last_seen": last}
                    for e, (first, last, n, avg) in tags]})
                ctype = "application/json"
            else:
                self.send_error(404)
                return
            data = body.encode()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass  # keep the console for tag events

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()
    httpd = ThreadingHTTPServer(("0.0.0.0", http_port), Handler)
    ngrok = None
    if tunnel:
        if shutil.which("ngrok") is None:
            print("WARNING: ngrok not found in PATH; serving locally only", file=sys.stderr)
        else:
            ngrok = subprocess.Popen(["ngrok", "http", f"--url={tunnel}", str(http_port), "--log=stdout"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"Tunnel:  https://{tunnel}/latest")
    print(f"Serving: http://localhost:{http_port}/latest  and  /tags  (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()
        stop.set()
        thread.join(timeout=2.0)
        if ngrok:
            ngrok.terminate()


def port_name(value):
    """Accept 'COM5', 'com5' or just '5' (-> COM5); other names (e.g. /dev/ttyUSB0) pass through."""
    if value.isdigit():
        return f"COM{value}"
    return value.upper() if value.lower().startswith("com") else value


def main():
    ap = argparse.ArgumentParser(description="YRM100 UHF RFID reader tool")
    ap.add_argument("--port", type=port_name, default="COM10",
                    help="serial port, e.g. COM5 or just 5 (default COM10)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--password", default="00000000", help="tag access password, hex (default 00000000)")
    # same options again on every subcommand, so `scan --port COM5` works too
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--port", type=port_name, default=argparse.SUPPRESS,
                        help="serial port, e.g. COM5 or just 5")
    common.add_argument("--baud", type=int, default=argparse.SUPPRESS)
    common.add_argument("--password", default=argparse.SUPPRESS, help="tag access password, hex")
    sub = ap.add_subparsers(dest="cmd", required=True)
    _add_parser = sub.add_parser
    sub.add_parser = lambda *a, **kw: _add_parser(*a, parents=[common], **kw)

    sp = sub.add_parser("setup", help="print module info and configure region/power/hopping")
    sp.add_argument("--region", choices=REGIONS, default="us",
                    help="us = 902-928 MHz (USA/Mexico/Americas); default us")
    sp.add_argument("--power", type=float, help="TX power in dBm, e.g. 20 or 26 (omit to keep current)")
    sp.add_argument("--no-hopping", action="store_true")

    sp = sub.add_parser("scan", help="inventory tags in range")
    sp.add_argument("--time", type=float, default=2.0)

    sp = sub.add_parser("watch", help="read continuously until Ctrl+C")
    sp.add_argument("--gone", type=float, default=4.0,
                    help="seconds without any read before a tag is reported gone (default 4)")
    sp.add_argument("--confirm", type=int, default=3,
                    help="reads needed within --window before a tag counts as present (default 3)")
    sp.add_argument("--window", type=float, default=1.0, help="confirmation window in seconds (default 1)")
    sp.add_argument("--min-rssi", type=int,
                    help="ignore reads weaker than this (dBm, e.g. -65) when admitting a NEW tag")
    sp.add_argument("--every", action="store_true", help="also print every single raw read")

    sp = sub.add_parser("serve", help="read continuously and publish tags over HTTP (+ ngrok tunnel)")
    sp.add_argument("--http-port", type=int, default=8000, help="local HTTP port (default 8000)")
    sp.add_argument("--tunnel", default=TUNNEL_DOMAIN, help=f"ngrok domain (default {TUNNEL_DOMAIN})")
    sp.add_argument("--no-tunnel", action="store_true", help="serve on the local network only")
    sp.add_argument("--gone", type=float, default=4.0, help="seconds without reads before a tag is gone")
    sp.add_argument("--confirm", type=int, default=3, help="reads needed within --window to admit a tag")
    sp.add_argument("--window", type=float, default=1.0, help="confirmation window in seconds")
    sp.add_argument("--min-rssi", type=int, help="ignore reads weaker than this (dBm) when admitting a tag")

    for name in ("read", "write"):
        sp = sub.add_parser(name, help=f"{name} a tag memory bank")
        sp.add_argument("--epc", required=True, help="EPC of target tag (hex, from scan)")
        sp.add_argument("--bank", choices=BANKS, default="user")
        sp.add_argument("--addr", type=int, default=0, help="start address in 16-bit words")
        if name == "read":
            sp.add_argument("--words", type=int, default=4)
        else:
            sp.add_argument("--data", required=True, help="hex data, even number of bytes")

    sp = sub.add_parser("write-epc", help="change a tag's EPC")
    sp.add_argument("--epc", required=True, help="current EPC (hex)")
    sp.add_argument("--new", required=True, help="new EPC (hex)")

    args = ap.parse_args()
    pwd = int(args.password, 16)
    try:
        r = YRM100(args.port, args.baud)
    except serial.SerialException as e:
        from serial.tools import list_ports
        ports = ", ".join(p.device for p in list_ports.comports()) or "none found"
        print(f"ERROR: cannot open {args.port}: {e}\nAvailable ports: {ports}", file=sys.stderr)
        sys.exit(1)
    try:
        if args.cmd == "setup":
            for k, v in r.info().items():
                print(f"{k:13}: {v}")
            r.set_region(REGIONS[args.region])
            r.set_hopping(not args.no_hopping)
            if args.power is not None:
                r.set_power(args.power)
            print(f"{'region':13}: {r.get_region()}")
            print(f"{'hopping':13}: {'off' if args.no_hopping else 'on'}")
            print(f"{'tx power':13}: {r.get_power():.2f} dBm")
            print("Setup OK.")
        elif args.cmd == "scan":
            tags = r.scan(args.time)
            if not tags:
                print("No tags found.")
            for epc, (n, rssi) in sorted(tags.items(), key=lambda t: -t[1][1]):
                print(f"{epc}  reads={n:<4} rssi={rssi} dBm")
        elif args.cmd == "watch":
            watch(r, args.gone, args.every, args.confirm, args.window, args.min_rssi)
        elif args.cmd == "serve":
            serve(r, args.http_port, None if args.no_tunnel else args.tunnel,
                  args.gone, args.confirm, args.window, args.min_rssi)
        elif args.cmd == "read":
            data = r.read(args.epc, BANKS[args.bank], args.addr, args.words, pwd)
            print(data.hex().upper())
        elif args.cmd == "write":
            r.write(args.epc, BANKS[args.bank], args.addr, bytes.fromhex(args.data), pwd)
            print("Write OK. Verify:", r.read(args.epc, BANKS[args.bank], args.addr,
                                              len(bytes.fromhex(args.data)) // 2, pwd).hex().upper())
        elif args.cmd == "write-epc":
            r.write_epc(args.epc, args.new, pwd)
            print("EPC written. Rescan to confirm:")
            for epc in r.scan(1.5):
                print(" ", epc)
    except (ReaderError, ValueError) as e:
        print("ERROR:", e, file=sys.stderr)
        sys.exit(1)
    finally:
        r.close()


if __name__ == "__main__":
    main()
