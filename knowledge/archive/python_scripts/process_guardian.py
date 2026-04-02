#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
进程守护系统
确保监控系统 24 小时不间断运行
自动检测并修复问题
"""

import subprocess
import os
import time
import json
from datetime import datetime
from okx_api_client import OKXClient

# 配置
GUARDIAN_CONFIG = {
    'check_interval': 60,  # 每 60 秒检查一次
    'processes': {
        'auto_monitor_fixed.py': {
            'command': ['python3', 'auto_monitor_fixed.py'],
            'log_file': 'monitor_live.log',
            'critical': True,
            'max_restarts': 5,  # 最多重启 5 次
            'restart_window': 300,  # 5 分钟内
        },
    },
    'api_checks': {
        'okx_api': {
            'check_function': 'check_okx_api',
            'critical': True,
            'max_failures': 3,
        },
    },
    'log_monitor': {
        'enabled': True,
        'log_file': 'monitor_live.log',
        'error_patterns': [
            '❌',
            'ERROR',
            'failed',
            'exception',
        ],
        'critical_patterns': [
            '连续失败',
            'API 连接失败',
            '进程退出',
        ],
    },
    'alerts': {
        'telegram_enabled': True,
        'chat_id': '5885419859',
    }
}

class ProcessGuardian:
    """进程守护系统"""
    
    def __init__(self):
        self.workspace = '/Users/colin/.openclaw/workspace'
        self.restart_counts = {}
        self.last_restart_time = {}
        self.api_failure_counts = {}
        self.start_time = datetime.now()
        
    def log(self, message, level='INFO'):
        """日志记录"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        emoji = {
            'INFO': 'ℹ️',
            'SUCCESS': '✅',
            'WARNING': '⚠️',
            'ERROR': '❌',
            'CRITICAL': '🔴'
        }.get(level, 'ℹ️')
        
        log_msg = f"[{timestamp}] {emoji} {message}"
        print(log_msg)
        
        # 写入日志文件
        log_file = os.path.join(self.workspace, 'guardian.log')
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_msg + '\n')
    
    def check_process(self, process_name):
        """检查进程是否运行"""
        try:
            result = subprocess.run(
                ['pgrep', '-f', process_name],
                capture_output=True,
                text=True,
                cwd=self.workspace
            )
            return result.returncode == 0
        except Exception as e:
            self.log(f"检查进程 {process_name} 失败：{e}", 'ERROR')
            return False
    
    def start_process(self, process_name, config):
        """启动进程"""
        try:
            log_file = os.path.join(self.workspace, config['log_file'])
            
            # 启动进程
            process = subprocess.Popen(
                config['command'],
                cwd=self.workspace,
                stdout=open(log_file, 'a'),
                stderr=subprocess.STDOUT
            )
            
            self.log(f"已启动进程 {process_name} (PID: {process.pid})", 'SUCCESS')
            return True
            
        except Exception as e:
            self.log(f"启动进程 {process_name} 失败：{e}", 'ERROR')
            return False
    
    def restart_process(self, process_name, config):
        """重启进程"""
        current_time = time.time()
        
        # 检查重启频率
        if process_name in self.last_restart_time:
            time_since_last = current_time - self.last_restart_time[process_name]
            if time_since_last < 60:  # 1 分钟内不重复重启
                self.log(f"{process_name} 1 分钟内已重启过，跳过", 'WARNING')
                return False
        
        # 检查重启次数
        if process_name not in self.restart_counts:
            self.restart_counts[process_name] = 0
        
        self.restart_counts[process_name] += 1
        
        # 检查是否超过最大重启次数
        if self.restart_counts[process_name] > config['max_restarts']:
            # 检查是否在时间窗口内
            if process_name in self.last_restart_time:
                window_start = current_time - config['restart_window']
                if self.last_restart_time[process_name] > window_start:
                    self.log(f"{process_name} 在{config['restart_window']}秒内重启{self.restart_counts[process_name]}次，停止重启", 'CRITICAL')
                    return False
        
        # 重置计数器（如果超过时间窗口）
        if process_name in self.last_restart_time:
            window_start = current_time - config['restart_window']
            if self.last_restart_time[process_name] < window_start:
                self.restart_counts[process_name] = 1
        
        self.last_restart_time[process_name] = current_time
        
        # 停止旧进程
        self.log(f"停止旧进程 {process_name}...", 'WARNING')
        subprocess.run(['pkill', '-f', process_name], capture_output=True)
        time.sleep(2)
        
        # 启动新进程
        self.log(f"重启进程 {process_name}...", 'WARNING')
        return self.start_process(process_name, config)
    
    def check_okx_api(self):
        """检查 OKX API"""
        try:
            client = OKXClient()
            result = client.fetch_time()
            return result['success']
        except Exception as e:
            return False
    
    def check_api_health(self, api_name, config):
        """检查 API 健康"""
        if api_name == 'okx_api':
            success = self.check_okx_api()
        else:
            success = False
        
        if not success:
            if api_name not in self.api_failure_counts:
                self.api_failure_counts[api_name] = 0
            self.api_failure_counts[api_name] += 1
            
            if self.api_failure_counts[api_name] >= config['max_failures']:
                self.log(f"{api_name} 连续失败{self.api_failure_counts[api_name]}次", 'ERROR')
                
                # 如果 API 失败，重启监控系统
                if config['critical']:
                    self.log("API 严重失败，重启监控系统...", 'CRITICAL')
                    for proc_name, proc_config in GUARDIAN_CONFIG['processes'].items():
                        if self.check_process(proc_name):
                            self.restart_process(proc_name, proc_config)
                
                # 重置计数器
                self.api_failure_counts[api_name] = 0
        else:
            if api_name in self.api_failure_counts:
                self.api_failure_counts[api_name] = 0
    
    def monitor_logs(self):
        """监控日志文件"""
        config = GUARDIAN_CONFIG['log_monitor']
        if not config['enabled']:
            return
        
        log_file = os.path.join(self.workspace, config['log_file'])
        if not os.path.exists(log_file):
            return
        
        try:
            # 读取最后 100 行
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()[-100:]
            
            error_count = 0
            critical_count = 0
            
            for line in lines:
                for pattern in config['error_patterns']:
                    if pattern in line:
                        error_count += 1
                        break
                
                for pattern in config['critical_patterns']:
                    if pattern in line:
                        critical_count += 1
                        break
            
            if critical_count > 0:
                self.log(f"日志中发现{critical_count}个严重错误", 'CRITICAL')
                
                # 重启监控系统
                for proc_name, proc_config in GUARDIAN_CONFIG['processes'].items():
                    if self.check_process(proc_name):
                        self.restart_process(proc_name, proc_config)
            
            elif error_count > 10:  # 100 行中有超过 10 个错误
                self.log(f"日志中发现{error_count}个错误", 'WARNING')
                
        except Exception as e:
            self.log(f"监控日志失败：{e}", 'ERROR')
    
    def send_alert(self, message, level='INFO'):
        """发送告警"""
        self.log(f"[ALERT] {message}", level)
        
        # TODO: 实现 Telegram 告警
        # 可以调用 Telegram API 发送消息
    
    def generate_status_report(self):
        """生成状态报告"""
        status = {
            'timestamp': datetime.now().isoformat(),
            'uptime': str(datetime.now() - self.start_time),
            'processes': {},
            'apis': {},
            'restart_counts': self.restart_counts,
            'api_failure_counts': self.api_failure_counts,
        }
        
        # 检查进程状态
        for proc_name, proc_config in GUARDIAN_CONFIG['processes'].items():
            status['processes'][proc_name] = self.check_process(proc_name)
        
        # 检查 API 状态
        for api_name, api_config in GUARDIAN_CONFIG['api_checks'].items():
            if api_name == 'okx_api':
                status['apis'][api_name] = self.check_okx_api()
        
        # 保存状态
        status_file = os.path.join(self.workspace, 'guardian_status.json')
        with open(status_file, 'w', encoding='utf-8') as f:
            json.dump(status, f, indent=2, ensure_ascii=False)
        
        return status
    
    def run(self):
        """运行守护进程"""
        self.log("🛡️ 进程守护系统启动", 'SUCCESS')
        self.log(f"检查间隔：{GUARDIAN_CONFIG['check_interval']}秒", 'INFO')
        
        # 初始检查：确保所有进程都在运行
        self.log("初始检查：确保所有关键进程运行中...")
        for proc_name, proc_config in GUARDIAN_CONFIG['processes'].items():
            if proc_config['critical']:
                if not self.check_process(proc_name):
                    self.log(f"关键进程 {proc_name} 未运行，启动...", 'WARNING')
                    self.start_process(proc_name, proc_config)
                else:
                    self.log(f"✅ {proc_name} 运行正常", 'SUCCESS')
        
        # 主循环
        while True:
            try:
                # 1. 检查进程
                for proc_name, proc_config in GUARDIAN_CONFIG['processes'].items():
                    if self.check_process(proc_name):
                        self.log(f"✅ {proc_name} 运行正常", 'SUCCESS')
                    else:
                        if proc_config['critical']:
                            self.log(f"❌ {proc_name} 未运行 (关键进程)", 'ERROR')
                            self.restart_process(proc_name, proc_config)
                        else:
                            self.log(f"⚠️ {proc_name} 未运行", 'WARNING')
                
                # 2. 检查 API 健康
                for api_name, api_config in GUARDIAN_CONFIG['api_checks'].items():
                    self.check_api_health(api_name, api_config)
                
                # 3. 监控日志
                self.monitor_logs()
                
                # 4. 生成状态报告
                status = self.generate_status_report()
                
                # 5. 发送告警（如果有严重问题）
                # TODO: 实现告警逻辑
                
                self.log(f"下次检查：{GUARDIAN_CONFIG['check_interval']}秒后", 'INFO')
                self.log("="*60, 'INFO')
                
                time.sleep(GUARDIAN_CONFIG['check_interval'])
                
            except KeyboardInterrupt:
                self.log("⛔ 守护进程已停止", 'WARNING')
                break
            except Exception as e:
                self.log(f"守护进程异常：{e}", 'ERROR')
                time.sleep(10)
        
        self.log("", 'INFO')

if __name__ == '__main__':
    guardian = ProcessGuardian()
    guardian.run()
