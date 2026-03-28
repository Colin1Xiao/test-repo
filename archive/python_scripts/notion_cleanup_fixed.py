#!/usr/bin/env python3
"""
修复后的 Notion 清理脚本
功能：
1. 使用正确的 UUID 格式（带连字符）
2. 通过 PATCH 请求设置 archived:true
3. 分批次处理64个空白页
4. 合并重复页面
5. 创建「待整理」数据库
"""

import json
import os
import time
from typing import List, Dict, Any
import requests

# 配置文件路径
NOTION_PAGES_FILE = "notion_pages.json"
NOTION_CONFIG_FILE = "notion_config.json"
NOTION_DATABASE_IDS_FILE = "notion_database_ids.json"
CLEANUP_RESULTS_FILE = "notion_cleanup_results_fixed.json"

def read_jsonl_file(filepath: str) -> List[Dict[str, Any]]:
    """读取 JSONL 格式的文件（每行一个 JSON 对象）"""
    pages = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        page = json.loads(line)
                        pages.append(page)
                    except json.JSONDecodeError as e:
                        print(f"跳过无效的 JSON 行: {line[:50]}... 错误: {e}")
                        continue
    except FileNotFoundError:
        print(f"文件未找到: {filepath}")
        return []
    return pages

def ensure_uuid_format(page_id: str) -> str:
    """确保页面 ID 是正确的 UUID 格式（带连字符）"""
    if '-' in page_id:
        return page_id
    # 如果没有连字符，尝试添加标准的连字符位置
    if len(page_id) == 32:
        return f"{page_id[:8]}-{page_id[8:12]}-{page_id[12:16]}-{page_id[16:20]}-{page_id[20:]}"
    return page_id

def archive_page(page_id: str, notion_api_key: str) -> bool:
    """归档页面（设置 archived=true）"""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    headers = {
        "Authorization": f"Bearer {notion_api_key}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    data = {
        "archived": True
    }
    
    try:
        response = requests.patch(url, headers=headers, json=data)
        if response.status_code == 200:
            print(f"✅ 成功归档页面: {page_id}")
            return True
        else:
            print(f"❌ 归档页面失败 {page_id}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ 归档页面异常 {page_id}: {e}")
        return False

def find_blank_pages(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """查找空白页面（标题为 'Untitled' 的页面）"""
    blank_pages = []
    for page in pages:
        if page.get('title') == 'Untitled':
            blank_pages.append(page)
    return blank_pages

def find_duplicate_pages(pages: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """查找重复页面（基于标题分组）"""
    title_groups = {}
    for page in pages:
        title = page.get('title', '')
        if title and title != 'Untitled':
            if title not in title_groups:
                title_groups[title] = []
            title_groups[title].append(page)
    
    # 只返回有重复的组（2个或更多页面）
    duplicate_groups = []
    for title, group in title_groups.items():
        if len(group) > 1:
            duplicate_groups.append(group)
    
    return duplicate_groups

def process_in_batches(items: List, batch_size: int = 64):
    """分批次处理项目"""
    for i in range(0, len(items), batch_size):
        yield items[i:i + batch_size]

def create_pending_database(parent_page_id: str, notion_api_key: str) -> str:
    """创建「待整理」数据库"""
    url = "https://api.notion.com/v1/databases"
    headers = {
        "Authorization": f"Bearer {notion_api_key}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    # 确保 parent_page_id 是正确的 UUID 格式
    parent_page_id = ensure_uuid_format(parent_page_id)
    
    data = {
        "parent": {
            "type": "page_id",
            "page_id": parent_page_id
        },
        "title": [
            {
                "type": "text",
                "text": {
                    "content": "待整理"
                }
            }
        ],
        "properties": {
            "名称": {
                "title": {}
            },
            "状态": {
                "select": {
                    "options": [
                        {"name": "待处理", "color": "red"},
                        {"name": "处理中", "color": "yellow"},
                        {"name": "已完成", "color": "green"}
                    ]
                }
            },
            "来源": {
                "rich_text": {}
            },
            "创建时间": {
                "date": {}
            }
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            database = response.json()
            database_id = database['id']
            print(f"✅ 成功创建「待整理」数据库: {database_id}")
            return database_id
        else:
            print(f"❌ 创建数据库失败: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ 创建数据库异常: {e}")
        return None

def main():
    print("🚀 开始执行修复后的 Notion 清理脚本...")
    
    # 读取配置
    try:
        with open(NOTION_CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
        notion_api_key = config.get('notion_api_key')
        parent_page_id = config.get('parent_page_id')
        
        if not notion_api_key:
            print("❌ Notion API 密钥未配置")
            return
        
        # 确保 parent_page_id 是正确的 UUID 格式
        parent_page_id = ensure_uuid_format(parent_page_id)
        print(f"使用 Parent Page ID: {parent_page_id}")
        
    except FileNotFoundError:
        print(f"❌ 配置文件未找到: {NOTION_CONFIG_FILE}")
        return
    except json.JSONDecodeError as e:
        print(f"❌ 配置文件格式错误: {e}")
        return
    
    # 读取页面数据
    print("📖 读取页面数据...")
    pages = read_jsonl_file(NOTION_PAGES_FILE)
    if not pages:
        print("❌ 未找到页面数据")
        return
    
    print(f"✅ 读取到 {len(pages)} 个页面")
    
    # 查找空白页面
    print("🔍 查找空白页面...")
    blank_pages = find_blank_pages(pages)
    print(f"找到 {len(blank_pages)} 个空白页面")
    
    # 查找重复页面
    print("🔍 查找重复页面...")
    duplicate_groups = find_duplicate_pages(pages)
    total_duplicates = sum(len(group) for group in duplicate_groups)
    print(f"找到 {len(duplicate_groups)} 组重复页面，共 {total_duplicates} 个页面")
    
    # 处理空白页面（分批次，每批64个）
    results = {
        "blank_pages_archived": [],
        "duplicate_pages_merged": [],
        "pending_database_id": None,
        "errors": []
    }
    
    if blank_pages:
        print(f"🗑️  开始归档 {len(blank_pages)} 个空白页面（分批次处理）...")
        batch_count = 0
        for batch in process_in_batches(blank_pages, 64):
            batch_count += 1
            print(f"📦 处理第 {batch_count} 批次 ({len(batch)} 个页面)...")
            
            for page in batch:
                page_id = ensure_uuid_format(page['id'])
                if archive_page(page_id, notion_api_key):
                    results["blank_pages_archived"].append(page_id)
                else:
                    results["errors"].append(f"归档失败: {page_id}")
            
            # 避免 API 限流，每批之间稍作延迟
            if batch_count < (len(blank_pages) + 63) // 64:  # 不是最后一批
                time.sleep(1)
    
    # 处理重复页面（保留最新版本，归档其他）
    if duplicate_groups:
        print(f"🔄 开始合并 {len(duplicate_groups)} 组重复页面...")
        for group in duplicate_groups:
            # 按最后编辑时间排序，保留最新的
            sorted_group = sorted(group, key=lambda x: x.get('last_edited_time', ''), reverse=True)
            latest_page = sorted_group[0]
            pages_to_archive = sorted_group[1:]
            
            print(f"  保留: {latest_page['title']} (ID: {latest_page['id']})")
            for page in pages_to_archive:
                page_id = ensure_uuid_format(page['id'])
                if archive_page(page_id, notion_api_key):
                    results["duplicate_pages_merged"].append({
                        "kept": latest_page['id'],
                        "archived": page_id,
                        "title": latest_page['title']
                    })
                else:
                    results["errors"].append(f"归档重复页面失败: {page_id}")
    
    # 创建「待整理」数据库
    print("📁 创建「待整理」数据库...")
    pending_db_id = create_pending_database(parent_page_id, notion_api_key)
    if pending_db_id:
        results["pending_database_id"] = pending_db_id
    
    # 保存结果
    with open(CLEANUP_RESULTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n✅ 清理脚本执行完成！")
    print(f"📊 结果摘要:")
    print(f"  - 归档空白页面: {len(results['blank_pages_archived'])} 个")
    print(f"  - 合并重复页面: {len(results['duplicate_pages_merged'])} 个")
    print(f"  - 创建待整理数据库: {'成功' if results['pending_database_id'] else '失败'}")
    if results['errors']:
        print(f"  - 错误数量: {len(results['errors'])}")
        print("  - 详细错误已记录在结果文件中")
    
    print(f"\n📄 详细结果已保存到: {CLEANUP_RESULTS_FILE}")

if __name__ == "__main__":
    main()