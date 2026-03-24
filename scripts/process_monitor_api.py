#!/usr/bin/env python3
"""进程监控 API - 为 control-ui 提供进程数据"""

import json
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time

class ProcessMonitor:
    def __init__(self):
        self.processes = []
        self.last_update = 0
        self.update_interval = 5  # seconds
    
    def get_trading_system_processes(self):
        """获取交易系统相关进程"""
        try:
            # 使用 ps 命令获取进程
            result = subprocess.run(
                ['ps', 'aux'],
                capture_output=True, text=True, timeout=5
            )
            
            lines = result.stdout.strip().split('\n')[1:]  # 跳过标题
            processes = []
            
            keywords = [
                'run_v52_live', 'panel', 'edge_validation', 
                'safety_test', 'trading_system', 'integrated_server',
                'openclaw', 'gateway'
            ]
            
            for line in lines:
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    user, pid, cpu, mem, *rest = parts
                    command = rest[-1] if len(rest) > 5 else ''
                    
                    # 检查是否是交易系统相关进程
                    if any(kw.lower() in command.lower() for kw in keywords):
                        processes.append({
                            'pid': int(pid),
                            'user': user,
                            'cpu': float(cpu),
                            'mem': float(mem),
                            'command': command[:80] + '...' if len(command) > 80 else command,
                            'status': 'running'
                        })
            
            return processes
        except Exception as e:
            return []
    
    def get_system_stats(self):
        """获取系统统计"""
        try:
            # CPU 使用率
            cpu_result = subprocess.run(['sysctl', '-n', 'hw.ncpu'], capture_output=True, text=True)
            ncpu = int(cpu_result.stdout.strip()) if cpu_result.returncode == 0 else 1
            
            # 内存
            mem_result = subprocess.run(['vm_stat'], capture_output=True, text=True)
            mem_lines = mem_result.stdout.strip().split('\n')
            
            page_size = 4096  # macOS default
            free_pages = 0
            total_pages = 0
            
            for line in mem_lines:
                if 'free' in line.lower():
                    free_pages = int(line.split(':')[1].strip().replace('.', ''))
                elif 'active' in line.lower() or 'inactive' in line.lower() or 'wired' in line.lower():
                    total_pages += int(line.split(':')[1].strip().replace('.', ''))
            
            total_pages += free_pages
            total_mem_gb = (total_pages * page_size) / (1024**3)
            free_mem_gb = (free_pages * page_size) / (1024**3)
            used_mem_gb = total_mem_gb - free_mem_gb
            mem_percent = (used_mem_gb / total_mem_gb * 100) if total_mem_gb > 0 else 0
            
            # 磁盘
            disk_result = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
            disk_lines = disk_result.stdout.strip().split('\n')
            disk_usage = 'N/A'
            if len(disk_lines) >= 2:
                parts = disk_lines[1].split()
                if len(parts) >= 5:
                    disk_usage = parts[4]
            
            return {
                'cpu_cores': ncpu,
                'memory_total_gb': round(total_mem_gb, 1),
                'memory_used_gb': round(used_mem_gb, 1),
                'memory_percent': round(mem_percent, 1),
                'disk_usage': disk_usage
            }
        except Exception as e:
            return {
                'cpu_cores': 1,
                'memory_total_gb': 0,
                'memory_used_gb': 0,
                'memory_percent': 0,
                'disk_usage': 'N/A'
            }
    
    def get_all_data(self):
        """获取所有监控数据"""
        processes = self.get_trading_system_processes()
        system = self.get_system_stats()
        
        # Edge 验证状态
        state_file = Path.home() / '.openclaw' / 'workspace' / 'trading_system_v5_3' / 'logs' / 'state_store.json'
        edge_data = {}
        try:
            if state_file.exists():
                data = json.loads(state_file.read_text())
                edge_data = {
                    'total_trades': data.get('total_trades', 0),
                    'total_pnl': data.get('total_pnl', 0),
                    'capital_state': data.get('capital', {}).get('capital_state', 'N/A')
                }
        except:
            edge_data = {'total_trades': 0, 'total_pnl': 0, 'capital_state': 'N/A'}
        
        return {
            'timestamp': time.time(),
            'processes': processes,
            'system': system,
            'edge': edge_data
        }


# 全局监控实例
monitor = ProcessMonitor()


class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/processes':
            data = monitor.get_all_data()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass  # 静默日志


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 18790), APIHandler)
    print("📊 Process Monitor API running on http://127.0.0.1:18790")
    print("   Endpoint: /api/processes")
    server.serve_forever()