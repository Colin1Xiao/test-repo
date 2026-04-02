#!/usr/bin/env node

/**
 * 按 model_name 分组计数日志
 * 用法：node count-by-model.js [logfile] [--json] [--sort asc|desc]
 */

const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);
const configFile = args.find(a => !a.startsWith('--'));
const jsonOutput = args.includes('--json');
const sortArg = args.find(a => a.startsWith('--sort='))?.split('=')[1] || 'desc';

// 从日志行中提取 model_name 的正则表达式
const modelPatterns = [
  /model_name["']?\s*[:=]\s*["']?([^"'\s,}]+)/i,
  /model["']?\s*[:=]\s*["']?([^"'\s,}]+)/i,
  /"model_name"\s*:\s*"([^"]+)"/i,
  /model_name=([^\s,]+)/i,
];

function extractModelName(line) {
  for (const pattern of modelPatterns) {
    const match = line.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function countByModel(logContent) {
  const counts = new Map();
  const lines = logContent.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const modelName = extractModelName(line);
    if (modelName) {
      counts.set(modelName, (counts.get(modelName) || 0) + 1);
    }
  }
  
  return counts;
}

function formatOutput(counts, sortBy = 'desc') {
  const entries = Array.from(counts.entries());
  
  // 排序
  entries.sort((a, b) => {
    return sortBy === 'desc' ? b[1] - a[1] : a[1] - b[1];
  });
  
  if (jsonOutput) {
    const obj = Object.fromEntries(entries);
    return JSON.stringify(obj, null, 2);
  }
  
  // 格式化表格输出
  const maxNameLen = Math.max(...entries.map(([name]) => name.length), 15);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  
  let output = '\n';
  output += '═'.repeat(maxNameLen + 20) + '\n';
  output += `│ ${'model_name'.padEnd(maxNameLen)} │ ${'count'.padStart(6)} │ ${'percentage'.padStart(10)} │\n`;
  output += '─'.repeat(maxNameLen + 20) + '\n';
  
  for (const [name, count] of entries) {
    const percentage = ((count / total) * 100).toFixed(2) + '%';
    output += `│ ${name.padEnd(maxNameLen)} │ ${count.toString().padStart(6)} │ ${percentage.padStart(10)} │\n`;
  }
  
  output += '─'.repeat(maxNameLen + 20) + '\n';
  output += `│ ${'TOTAL'.padEnd(maxNameLen)} │ ${total.toString().padStart(6)} │ ${'100%'.padStart(10)} │\n`;
  output += '═'.repeat(maxNameLen + 20) + '\n';
  
  return output;
}

// 主程序
async function main() {
  let logContent;
  
  if (configFile) {
    // 从文件读取
    const filePath = path.resolve(configFile);
    if (!fs.existsSync(filePath)) {
      console.error(`错误：文件不存在 - ${filePath}`);
      process.exit(1);
    }
    logContent = fs.readFileSync(filePath, 'utf-8');
  } else {
    // 从 stdin 读取
    logContent = fs.readFileSync(0, 'utf-8');
  }
  
  const counts = countByModel(logContent);
  
  if (counts.size === 0) {
    console.log('未找到任何 model_name 字段');
    process.exit(0);
  }
  
  console.log(formatOutput(counts, sortArg));
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
