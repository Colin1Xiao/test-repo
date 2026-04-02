#!/usr/bin/env python3
"""
Docker Sandbox Skill - Docker沙箱环境
用于安全执行不可信代码、测试新技能、运行隔离任务
"""

import os
import sys
import json
import subprocess
import tempfile
import uuid
from pathlib import Path
from datetime import datetime

class DockerSandbox:
    def __init__(self, config_path=None):
        self.config = self._load_config(config_path)
        self.containers = []
        
    def _load_config(self, config_path):
        """加载配置文件"""
        default_config = {
            'defaultLimits': {
                'cpu': '1.0',
                'memory': '512m',
                'disk': '1g',
                'timeout': 300
            },
            'networkPolicy': 'isolated',
            'allowedImages': [
                'python:3.11',
                'python:3.10',
                'python:3.9',
                'node:18',
                'node:16',
                'alpine:latest',
                'ubuntu:22.04'
            ],
            'volumeMounts': []
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path) as f:
                return {**default_config, **json.load(f)}
        
        user_config = Path('~/.openclaw/docker-sandbox/config.json').expanduser()
        if user_config.exists():
            with open(user_config) as f:
                return {**default_config, **json.load(f)}
        
        return default_config
    
    def _check_docker(self):
        """检查Docker是否可用"""
        try:
            result = subprocess.run(['docker', 'info'], 
                                  capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except Exception:
            return False
    
    def run_code(self, image, code, timeout=None):
        """在沙箱中运行代码"""
        if not self._check_docker():
            raise RuntimeError("Docker 未安装或未启动")
        
        if image not in self.config['allowedImages']:
            raise ValueError(f"镜像 {image} 不在白名单中")
        
        container_id = str(uuid.uuid4())[:12]
        timeout = timeout or self.config['defaultLimits']['timeout']
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            print(f"🐳 启动沙箱容器: {container_id}")
            print(f"   镜像: {image}")
            print(f"   超时: {timeout}s")
            
            cmd = [
                'docker', 'run', '--rm',
                '--name', f'ocnmps-sandbox-{container_id}',
                '--cpus', self.config['defaultLimits']['cpu'],
                '--memory', self.config['defaultLimits']['memory'],
                '--network', 'none' if self.config['networkPolicy'] == 'isolated' else 'bridge',
                '-v', f'{temp_file}:/sandbox/code.py:ro',
                image,
                'python', '/sandbox/code.py'
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            print(f"✅ 沙箱执行完成")
            if result.stdout:
                print(f"📤 输出:\n{result.stdout}")
            if result.stderr:
                print(f"⚠️  错误:\n{result.stderr}")
            
            return {
                'container_id': container_id,
                'returncode': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr
            }
            
        finally:
            os.unlink(temp_file)
    
    def test_skill(self, skill_path, timeout=None):
        """测试新技能"""
        skill_path = Path(skill_path).expanduser().resolve()
        if not skill_path.exists():
            raise FileNotFoundError(f"技能路径不存在: {skill_path}")
        
        container_id = str(uuid.uuid4())[:12]
        timeout = timeout or self.config['defaultLimits']['timeout']
        
        print(f"🧪 测试技能: {skill_path.name}")
        print(f"   容器: {container_id}")
        print(f"   超时: {timeout}s")
        
        # 创建测试脚本
        test_script = f"""
import sys
sys.path.insert(0, '/skill')

# 验证 SKILL.md 存在
from pathlib import Path
skill_md = Path('/skill/SKILL.md')
if not skill_md.exists():
    print("❌ SKILL.md 不存在")
    sys.exit(1)

print("✅ SKILL.md 存在")

# 尝试解析 SKILL.md
with open(skill_md) as f:
    content = f.read()
    if 'name:' in content and 'description:' in content:
        print("✅ SKILL.md 格式正确")
    else:
        print("⚠️  SKILL.md 可能缺少必要字段")

print("✅ 技能测试通过")
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(test_script)
            test_file = f.name
        
        try:
            cmd = [
                'docker', 'run', '--rm',
                '--name', f'ocnmps-sandbox-{container_id}',
                '--cpus', self.config['defaultLimits']['cpu'],
                '--memory', self.config['defaultLimits']['memory'],
                '--network', 'none',
                '-v', f'{skill_path}:/skill:ro',
                '-v', f'{test_file}:/test_skill.py:ro',
                'python:3.11',
                'python', '/test_skill.py'
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            print(f"✅ 技能测试完成")
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(f"⚠️  错误: {result.stderr}")
            
            return result.returncode == 0
            
        finally:
            os.unlink(test_file)
    
    def exec_command(self, image, command, network='none', timeout=None):
        """在沙箱中执行命令"""
        if not self._check_docker():
            raise RuntimeError("Docker 未安装或未启动")
        
        if image not in self.config['allowedImages']:
            raise ValueError(f"镜像 {image} 不在白名单中")
        
        container_id = str(uuid.uuid4())[:12]
        timeout = timeout or self.config['defaultLimits']['timeout']
        
        print(f"🐳 执行命令: {' '.join(command)}")
        print(f"   容器: {container_id}")
        
        cmd = [
            'docker', 'run', '--rm',
            '--name', f'ocnmps-sandbox-{container_id}',
            '--cpus', self.config['defaultLimits']['cpu'],
            '--memory', self.config['defaultLimits']['memory'],
            '--network', network,
            image
        ] + command
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        print(f"✅ 命令执行完成")
        if result.stdout:
            print(f"📤 输出:\n{result.stdout}")
        if result.stderr:
            print(f"⚠️  错误:\n{result.stderr}")
        
        return {
            'container_id': container_id,
            'returncode': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr
        }
    
    def cleanup(self):
        """清理所有沙箱容器"""
        print("🧹 清理沙箱容器...")
        result = subprocess.run(
            ['docker', 'ps', '-aq', '--filter', 'name=ocnmps-sandbox-'],
            capture_output=True, text=True
        )
        
        if result.stdout.strip():
            containers = result.stdout.strip().split('\n')
            for container in containers:
                subprocess.run(['docker', 'rm', '-f', container], 
                             capture_output=True)
            print(f"✅ 已清理 {len(containers)} 个容器")
        else:
            print