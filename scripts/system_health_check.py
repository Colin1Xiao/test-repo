#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
系统健康检查与自愈系统
每 5 分钟自动检查所有进程、数据、链接连通性
发现问题自动修复
"""

import subprocess
import os
import time
import json
import requests
from datetime import datetime
from okx_api_client import OKXClient

# 配置
CONFIG = {
    'check_interval': 300,  # 5 分钟检查一次
    'max_retries': 3,  # 最大重试次数
    'retry_delay': 10,  # 重试间隔 (秒)
    'timeout': 30,  # 超时时间 (秒)
    'proxy': 'http://127.0.0.1:7890',
    'processes': [
        {'name': 'auto_monitor_fixed.py', 'critical': True},
        {'name': 'ClashX', 'critical': True},
    ],
    'endpoints': [
        {'name': 'OKX API', 'url': 'https://www.okx.com/api/v5/public/time', 'critical': True},
        {'name': 'Notion API', 'url': 'https://api.notion.com/v1/users', 'critical': False},
    ]
}

class SystemHealthChecker:
    """系统健康检查器"""
    
    def __init__(self):
        self.check_count = 0
        self.repair_count = 0
        self.start_time = datetime.now()
        
    def log(self, message, level='INFO'):
        """日志记录"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        emoji = {'INFO': 'ℹ️', 'WARNING': '⚠️', 'ERROR': '❌', 'SUCCESS': '✅'}.get(level, 'ℹ️')
        print(f"[{timestamp}] {emoji} {message}")
        
        # 同时写入日志文件
        with open('/Users/colin/.openclaw/workspace/health_check.log', 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {level} {message}\n")
    
    def check_process(self, process_name):
        """检查进程是否运行"""
        try:
            result = subprocess.run(
                ['pgrep', '-f', process_name],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except Exception as e:
            self.log(f"检查进程 {process_name} 失败：{e}", 'ERROR')
            return False
    
    def check_proxy(self):
        """检查代理连通性"""
        try:
            os.environ['https_proxy'] = CONFIG['proxy']
            os.environ['http_proxy'] = CONFIG['proxy']
            
            response = requests.get(
                'https://www.google.com',
                proxies={'https': CONFIG['proxy'], 'http': CONFIG['proxy']},
                timeout=CONFIG['timeout']
            )
            return response.status_code == 200
        except Exception as e:
            self.log(f"代理检查失败：{e}", 'ERROR')
            return False
    
    def check_okx_api(self):
        """检查 OKX API 连通性"""
        try:
            client = OKXClient()
            result = client.fetch_time()
            return result['success']
        except Exception as e:
            self.log(f"OKX API 检查失败：{e}", 'ERROR')
            return False
    
    def check_notion_api(self):
        """检查 Notion API 连通性"""
        try:
            # 读取 Notion token
            notion_token = "secret_0hNkVQwKlJcGzqXfLmDpEjRtYvBnMkOp"
            headers = {
                'Authorization': f'Bearer {notion_token}',
                'Notion-Version': '2022-06-28'
            }
            response = requests.get(
                'https://api.notion.com/v1/users',
                headers=headers,
                timeout=CONFIG['timeout']
            )
            return response.status_code == 200
        except Exception as e:
            self.log(f"Notion API 检查失败：{e}", 'WARNING')
            return False
    
    def repair_process(self, process_name):
        """修复进程 (重启)"""
        self.log(f"尝试修复进程：{process_name}", 'WARNING')
        
        try:
            # 先停止旧进程
            subprocess.run(['pkill', '-f', process_name], capture_output=True)
            time.sleep(2)
            
            # 启动新进程
            if process_name == 'auto_monitor_fixed.py':
                workspace = '/Users/colin/.openclaw/workspace'
                log_file = os.path.join(workspace, 'monitor_live.log')
                
                subprocess.Popen(
                    ['python3', process_name],
                    cwd=workspace,
                    stdout=open(log_file, 'a'),
                    stderr=subprocess.STDOUT
                )
                
                self.log(f"已重启 {process_name}", 'SUCCESS')
                return True
            elif process_name == 'ClashX':
                self.log("ClashX 需要手动启动", 'WARNING')
                return False
                
        except Exception as e:
            self.log(f"修复进程失败：{e}", 'ERROR')
            return False
    
    def repair_proxy(self):
        """修复代理"""
        self.log("尝试修复代理...", 'WARNING')
        
        # 检查 ClashX 是否运行
        if not self.check_process('ClashX'):
            self.log("ClashX 未运行，无法修复代理", 'ERROR')
            return False
        
        # 设置环境变量
        os.environ['https_proxy'] = CONFIG['proxy']
        os.environ['http_proxy'] = CONFIG['proxy']
        
        self.log("代理环境变量已设置", 'SUCCESS')
        return True
    
    def run_check(self):
        """执行一次完整检查"""
        self.check_count += 1
        self.log(f"=== 第 {self.check_count} 次健康检查 ===")
        
        issues = []
        
        # 1. 检查进程
        self.log("检查进程...")
        for proc in CONFIG['processes']:
            name = proc['name']
            critical = proc['critical']
            
            if self.check_process(name):
                self.log(f"✅ 进程 {name} 运行正常", 'SUCCESS')
            else:
                msg = f"❌ 进程 {name} 未运行"
                if critical:
                    msg += " (关键进程)"
                    issues.append({'type': 'process', 'name': name, 'critical': critical})
                self.log(msg, 'ERROR' if critical else 'WARNING')
        
        # 2. 检查代理
        self.log("检查代理...")
        if self.check_proxy():
            self.log("✅ 代理连通正常", 'SUCCESS')
        else:
            issues.append({'type': 'proxy', 'critical': True})
            self.log("❌ 代理连通失败", 'ERROR')
        
        # 3. 检查 OKX API
        self.log("检查 OKX API...")
        if self.check_okx_api():
            self.log("✅ OKX API 连通正常", 'SUCCESS')
        else:
            issues.append({'type': 'okx_api', 'critical': True})
            self.log("❌ OKX API 连通失败", 'ERROR')
        
        # 4. 检查 Notion API
        self.log("检查 Notion API...")
        if self.check_notion_api():
            self.log("✅ Notion API 连通正常", 'SUCCESS')
        else:
            issues.append({'type': 'notion_api', 'critical': False})
            self.log("⚠️ Notion API 连通失败 (非关键)", 'WARNING')
        
        # 5. 自动修复
        if issues:
            self.log(f"发现 {len(issues)} 个问题，开始修复...", 'WARNING')
            
            for issue in issues:
                if issue['type'] == 'process':
                    if self.repair_process(issue['name']):
                        self.repair_count += 1
                elif issue['type'] == 'proxy':
                    if self.repair_proxy():
                        self.repair_count += 1
                elif issue['type'] == 'okx_api':
                    # OKX API 失败时重启监控系统
                    if self.repair_process('auto_monitor_fixed.py'):
                        self.repair_count += 1
            
            self.log(f"修复完成，共修复 {self.repair_count} 个问题", 'SUCCESS')
        else:
            self.log("✅ 所有检查通过，系统健康", 'SUCCESS')
        
        # 6. 生成报告
        self.generate_report(issues)
        
        self.log("===========================================", 'INFO')
        self.log(f"下次检查时间：{datetime.now().strftime('%H:%M:%S')} + {CONFIG['check_interval']}秒", 'INFO')
    
    def generate_report(self, issues):
        """生成健康报告"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'check_count': self.check_count,
            'repair_count': self.repair_count,
            'uptime': str(datetime.now() - self.start_time),
            'issues': issues,
            'status': 'HEALTHY' if not issues else 'ISSUES_FOUND'
        }
        
        # 保存报告
        report_file = '/Users/colin/.openclaw/workspace/health_report.json'
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # 保存最新状态
        status_file = '/Users/colin/.openclaw/workspace/system_status.json'
        status = {
            'last_check': datetime.now().isoformat(),
            'status': 'HEALTHY' if not issues else 'ISSUES_FOUND',
            'issues_count': len(issues),
            'processes': {p['name']: self.check_process(p['name']) for p in CONFIG['processes']},
            'apis': {
                'okx': self.check_okx_api(),
                'notion': self.check_notion_api()
            }
        }
        with open(status_file, 'w', encoding='utf-8') as f:
            json.dump(status, f, indent=2, ensure_ascii=False)
    
    def run(self):
        """运行健康检查循环"""
        self.log("🔧 系统健康检查与自愈系统启动", 'SUCCESS')
        self.log(f"检查间隔：{CONFIG['check_interval']}秒 ({CONFIG['check_interval']/60}分钟)")
        self.log(f"最大重试：{CONFIG['max_retries']}次")
        self.log()
        
        while True:
            try:
                self.run_check()
                time.sleep(CONFIG['check_interval'])
            except KeyboardInterrupt:
                self.log("⛔ 健康检查已停止", 'WARNING')
                break
            except Exception as e:
                self.log(f"检查循环异常：{e}", 'ERROR')
                time.sleep(60)  # 异常时等待 1 分钟

if __name__ == '__main__':
    checker = SystemHealthChecker()
    checker.run()
