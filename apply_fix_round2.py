from pathlib import Path

def patch_file(path_str, transforms):
    path = Path(path_str)
    text = path.read_text(encoding="utf-8")
    original = text
    for fn in transforms:
        text = fn(text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"[PATCHED] {path_str}")
    else:
        print(f"[NOCHANGE] {path_str}")

def patch_adapter(text):
    if "DEFAULT_DIAG_SYMBOL" not in text:
        insert_after = "GLOBAL_PROXIES = {\n 'http': 'http://127.0.0.1:7890',\n 'https': 'http://127.0.0.1:7890',\n}\n"
        repl = insert_after + "\nDEFAULT_DIAG_SYMBOL = 'BTC/USDT:USDT-SWAP'\n"
        text = text.replace(insert_after, repl)
    text = text.replace('ticker = await self.get_ticker("BTC/USDT")', 'ticker = await self.get_ticker(DEFAULT_DIAG_SYMBOL)')
    text = text.replace("'defaultType': 'spot'", "'defaultType': 'swap'")
    return text

def patch_v2(text):
    text = text.replace("'BTC/USDT:USDT', # 主力", "'BTC/USDT:USDT-SWAP', # 主力")
    text = text.replace("'ETH/USDT:USDT', # 主力", "'ETH/USDT:USDT-SWAP', # 主力")
    text = text.replace("'SOL/USDT:USDT', # 高波动", "'SOL/USDT:USDT-SWAP', # 高波动")
    return text

def patch_v3(text):
    text = text.replace("'BTC/USDT:USDT', # 主力", "'BTC/USDT:USDT-SWAP', # 主力")
    text = text.replace("'ETH/USDT:USDT', # 主力", "'ETH/USDT:USDT-SWAP', # 主力")
    text = text.replace("'SOL/USDT:USDT', # 高波动", "'SOL/USDT:USDT-SWAP', # 高波动")
    return text

patch_file("multi_exchange_adapter.py", [patch_adapter])
patch_file("auto_monitor_v2.py", [patch_v2])
patch_file("auto_monitor_v3.py", [patch_v3])
print("修复完成")
