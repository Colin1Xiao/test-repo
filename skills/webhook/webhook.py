#!/usr/bin/env python3
"""
Webhook Skill - HTTP请求技能
支持POST/GET/PUT/DELETE/PATCH，用于集成外部服务
"""

import os
import sys
import json
import urllib.request
import urllib.error
import ssl
from pathlib import Path
from urllib.parse import urlencode

class WebhookClient:
    def __init__(self, config_path=None):
        self.config = self._load_config(config_path)
        
    def _load_config(self, config_path):
        """加载配置文件"""
        default_config = {
            'timeout': 30,
            'retry': 3,
            'allowlist': [],
            'denylist': [
                'http://localhost:*',
                'http://127.0.0.1:*',
                'http://192.168.*',
                'http://10.*',
                'http://0.0.0.0:*',
                'https://localhost:*',
                'https://127.0.0.1:*'
            ],
            'defaultHeaders': {
                'User-Agent': 'OpenClaw-Webhook/1.0'
            }
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path) as f:
                return {**default_config, **json.load(f)}
        
        user_config = Path('~/.openclaw/webhook/config.json').expanduser()
        if user_config.exists():
            with open(user_config) as f:
                return {**default_config, **json.load(f)}
        
        return default_config
    
    def _is_url_allowed(self, url):
        """检查URL是否允许访问"""
        from fnmatch import fnmatch
        
        # 检查黑名单
        for pattern in self.config['denylist']:
            if fnmatch(url, pattern):
                return False, f"URL匹配黑名单: {pattern}"
        
        # 检查白名单（如果配置了）
        if self.config['allowlist']:
            allowed = any(fnmatch(url, pattern) for pattern in self.config['allowlist'])
            if not allowed:
                return False, "URL不在白名单中"
        
        return True, None
    
    def _make_request(self, method, url, data=None, headers=None, timeout=None):
        """发送HTTP请求"""
        # 检查URL
        allowed, reason = self._is_url_allowed(url)
        if not allowed:
            raise PermissionError(f"访问被拒绝: {reason}")
        
        # 合并headers
        req_headers = self.config['defaultHeaders'].copy()
        if headers:
            req_headers.update(headers)
        
        # 准备数据
        if data and isinstance(data, dict):
            if req_headers.get('Content-Type') == 'application/json':
                data = json.dumps(data).encode('utf-8')
            else:
                data = urlencode(data).encode('utf-8')
        elif data and isinstance(data, str):
            data = data.encode('utf-8')
        
        # 创建请求
        req = urllib.request.Request(
            url,
            data=data,
            headers=req_headers,
            method=method
        )
        
        # 发送请求
        timeout = timeout or self.config['timeout']
        
        # 创建SSL上下文（允许自签名证书）
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
                return {
                    'status': response.status,
                    'headers': dict(response.headers),
                    'body': response.read().decode('utf-8')
                }
        except urllib.error.HTTPError as e:
            return {
                'status': e.code,
                'headers': dict(e.headers),
                'body': e.read().decode('utf-8'),
                'error': str(e)
            }
        except urllib.error.URLError as e:
            raise ConnectionError(f"请求失败: {e.reason}")
    
    def get(self, url, headers=None, timeout=None):
        """GET请求"""
        print(f"🌐 GET {url}")
        result = self._make_request('GET', url, headers=headers, timeout=timeout)
        self._print_result(result)
        return result
    
    def post(self, url, data=None, json_data=None, headers=None, timeout=None):
        """POST请求"""
        print(f"🌐 POST {url}")
        
        req_headers = headers or {}
        if json_data:
            data = json.dumps(json_data)
            req_headers['Content-Type'] = 'application/json'
        
        result = self._make_request('POST', url, data=data, headers=req_headers, timeout=timeout)
        self._print_result(result)
        return result
    
    def put(self, url, data=None, json_data=None, headers=None, timeout=None):
        """PUT请求"""
        print(f"🌐 PUT {url}")
        
        req_headers = headers or {}
        if json_data:
            data = json.dumps(json_data)
            req_headers['Content-Type'] = 'application/json'
        
        result = self._make_request('PUT', url, data=data, headers=req_headers, timeout=timeout)
        self._print_result(result)
        return result
    
    def delete(self, url, headers=None, timeout=None):
        """DELETE请求"""
        print(f"🌐 DELETE {url}")
        result = self._make_request('DELETE', url, headers=headers, timeout=timeout)
        self._print_result(result)
        return result
    
    def patch(self, url, data=None, json_data=None, headers=None, timeout=None):
        """PATCH请求"""
        print(f"🌐 PATCH {url}")
        
        req_headers = headers or {}
        if json_data:
            data = json.dumps(json_data)
            req_headers['Content-Type'] = 'application/json'
        
        result = self._make_request('PATCH', url, data=data, headers=req_headers, timeout=timeout)
        self._print_result(result)
        return result
    
    def _print_result(self, result):
        """打印结果"""
        status = result.get('status', 'N/A')
        if 200 <= status < 300:
            print(f"✅ HTTP {status}")
        elif 400 <= status < 500:
            print(f"⚠️  HTTP {status}")
        else:
            print(f"❌ HTTP {status}")
        
        # 尝试解析JSON
        body = result.get('body', '')
        if body:
            try:
                json_body = json.loads(body)
                print(f"📤 响应 (JSON):\n{json.dumps(json_body, indent=2, ensure_ascii=False)[:500]}")
            except json.JSONDecodeError:
                print(f"📤 响应:\n{body[:500]}")
    
    def send_slack(self, webhook_url, message, channel=None):
        """发送Slack消息"""
        payload = {'text': message}
        if channel:
            payload['channel'] = channel
        
        return self.post(webhook_url, json_data=payload)
    
    def send_discord(self, webhook_url, content, username=None):
        """发送Discord消息"""
        payload = {'content': content}
        if username:
            payload['username'] = username
        
        return self.post(webhook_url, json_data=payload)


def main():
    if len(sys.argv) < 3:
        print("Usage: webhook.py <method> <url> [options]")
        print("Methods: get, post, put, delete, patch")
        print("Options:")
        print("  --data '<json>'     - JSON数据")
        print("  --header 'Key:Val'  - 自定义header")
        print("  --timeout 30        - 超时时间")
        print()
        print("Examples:")
        print("  webhook.py get https://api.example.com/status")
        print("  webhook.py post https://hooks.slack.com/xxx --data '{\"text\":\"Hello\"}'")
        sys.exit(1)
    
    method = sys.argv[1].lower()
    url = sys.argv[2]
    
    # 解析参数
    data = None
    headers = {}
    timeout = None
    
    i = 3
    while i < len(sys.argv):
        if sys.argv[i] == '--data' and i + 1 < len(sys.argv):
            data = json.loads(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--header' and i + 1 < len(sys.argv):