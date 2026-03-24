#!/usr/bin/env python3
import os, sys, json, traceback, time

print("===== BASIC =====")
print("python =", sys.executable)
print("version =", sys.version)

for k in ["HTTP_PROXY","HTTPS_PROXY","ALL_PROXY","NO_PROXY","http_proxy","https_proxy","all_proxy","no_proxy","PYTHONPATH","VIRTUAL_ENV"]:
    if k in os.environ:
        print(f"{k}={os.environ.get(k)}")

try:
    import ccxt
    print("ccxt_version =", ccxt.__version__)
except Exception as e:
    print("ccxt import failed =", repr(e))
    raise

symbol_candidates = [
    "BTC/USDT:USDT-SWAP",
    "BTC/USDT:USDT",
    "BTC/USDT"
]

proxy_keys = ["HTTP_PROXY","HTTPS_PROXY","ALL_PROXY","http_proxy","https_proxy","all_proxy"]
proxy_val = None
for k in proxy_keys:
    v = os.environ.get(k)
    if v:
        proxy_val = v
        break

print("proxy_selected =", proxy_val)

def build_okx():
    cfg = {
        "enableRateLimit": True,
        "timeout": 10000,
        "options": {
            "defaultType": "swap"
        }
    }
    if proxy_val:
        cfg["proxies"] = {
            "http": proxy_val,
            "https": proxy_val
        }
    return ccxt.okx(cfg)

def run_step(name, fn):
    print(f"\n===== STEP: {name} =====")
    t0 = time.time()
    try:
        result = fn()
        dt = round((time.time() - t0) * 1000, 2)
        print(f"OK {name} in {dt} ms")
        if result is not None:
            print(result)
        return True, result
    except Exception as e:
        dt = round((time.time() - t0) * 1000, 2)
        print(f"FAIL {name} in {dt} ms")
        print("type =", type(e).__name__)
        print("repr =", repr(e))
        print("str =", str(e))
        traceback.print_exc()
        return False, None

ex = None

ok, _ = run_step("create_okx_client", lambda: "created")
if ok:
    ex = build_okx()
    print("exchange.id =", ex.id)
    print("exchange.options =", ex.options)

if ex is not None:
    run_step("check_required_credentials", lambda: {
        "apiKey_exists": bool(getattr(ex, "apiKey", None)),
        "secret_exists": bool(getattr(ex, "secret", None)),
        "password_exists": bool(getattr(ex, "password", None))
    })

    run_step("load_markets", lambda: f"markets_count={len(ex.load_markets())}")

    for sym in symbol_candidates:
        run_step(f"market_lookup::{sym}", lambda s=sym: str(ex.market(s)))

    for sym in symbol_candidates:
        run_step(f"fetch_ticker::{sym}", lambda s=sym: ex.fetch_ticker(s))

    run_step("fetch_balance", lambda: ex.fetch_balance())

    try:
        has_positions = getattr(ex, "has", {}).get("fetchPositions")
    except Exception:
        has_positions = None
    print("\nexchange.has.fetchPositions =", has_positions)
    if has_positions:
        run_step("fetch_positions", lambda: ex.fetch_positions())
