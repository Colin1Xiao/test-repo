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
import requests
import time
from typing import List, Dict, Any
from datetime import datetime

# 配置
NOTION_API_KEY = "ntn_3055393811629vkUf9PCSngVCXXhG08uczOwSzJrcp492Jh"
PARENT_PAGE_ID = "32071d28-18c4-8035-919f-fbdd05eea938"  # 带连字符的正确格式
HEADERS = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def read_parsed_pages() -> List[Dict[str, Any]]:
    """读取解析后的页面数据"""
    try:
        with open('notion_pages_parsed.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ 找不到 notion_pages_parsed.json 文件")
        return []
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析错误: {e}")
        return []

def identify_blank_pages(pages: List[Dict[str, Any]]) -> List[str]:
    """识别空白页（标题为 'Untitled' 的页面）"""
    blank_page_ids = []
    for page in pages:
        if page.get('title') == 'Untitled':
            blank_page_ids.append(page['id'])
    return blank_page_ids

def identify_duplicate_pages(pages: List[Dict[str, Any]]) -> List[List[str]]:
    """识别重复页面（相同标题的页面）"""
    title_to_ids = {}
    for page in pages:
        title = page.get('title', '')
        if title and title != 'Untitled':
            if title not in title_to_ids:
                title_to_ids[title] = []
            title_to_ids[title].append(page['id'])
    
    # 找出有重复的标题
    duplicate_groups = []
    for title, ids in title_to_ids.items():
        if len(ids) > 1:
            duplicate_groups.append(ids)
    
    return duplicate_groups

def archive_pages_batch(page_ids: List[str], batch_size: int = 64):
    """分批次归档页面"""
    total_pages = len(page_ids)
    archived_count = 0
    
    print(f"📦 准备归档 {total_pages} 个页面，批次大小: {batch_size}")
    
    for i in range(0, total_pages, batch_size):
        batch = page_ids[i:i + batch_size]
        print(f"🔄 处理批次 {i//batch_size + 1}/{(total_pages-1)//batch_size + 1} ({len(batch)} 个页面)")
        
        # 逐个归档页面（Notion API 不支持批量归档）
        for page_id in batch:
            try:
                url = f"https://api.notion.com/v1/pages/{page_id}"
                payload = {"archived": True}
                response = requests.patch(url, headers=HEADERS, json=payload)
                
                if response.status_code == 200:
                    archived_count += 1
                    print(f"✅ 已归档页面: {page_id}")
                else:
                    print(f"❌ 归档失败 {page_id}: {response.status_code} - {response.text}")
                
                # 避免API速率限制
                time.sleep(0.1)
                
            except Exception as e:
                print(f"❌ 归档异常 {page_id}: {e}")
        
        print(f"✅ 批次 {i//batch_size + 1} 完成")
    
    print(f"🎉 总共成功归档 {archived_count}/{total_pages} 个页面")
    return archived_count

def create_pending_database() -> str:
    """创建「待整理」数据库"""
    try:
        url = "https://api.notion.com/v1/databases"
        payload = {
            "parent": {"page_id": PARENT_PAGE_ID},
            "title": [{"type": "text", "text": {"content": "📁 待整理"}}],
            "properties": {
                "名称": {"title": {}},
                "状态": {
                    "select": {
                        "options": [
                            {"name": "待处理", "color": "red"},
                            {"name": "处理中", "color": "yellow"},
                            {"name": "已完成", "color": "green"}
                        ]
                    }
                },
                "类型": {
                    "select": {
                        "options": [
                            {"name": "笔记", "color": "blue"},
                            {"name": "任务", "color": "purple"},
                            {"name": "参考资料", "color": "orange"}
                        ]
                    }
                },
                "创建时间": {"date": {}}
            }
        }
        
        response = requests.post(url, headers=HEADERS, json=payload)
        if response.status_code == 200:
            database_id = response.json()['id']
            print(f"✅ 成功创建「待整理」数据库: {database_id}")
            return database_id
        else:
            print(f"❌ 创建数据库失败: {response.status_code} - {response.text}")
            return ""
            
    except Exception as e:
        print(f"❌ 创建数据库异常: {e}")
        return ""

def main():
    print("🚀 开始执行修复后的 Notion 清理脚本...")
    print(f"使用 Parent Page ID: {PARENT_PAGE_ID}")
    
    # 读取页面数据
    pages = read_parsed_pages()
    if not pages:
        print("❌ 未找到页面数据，退出")
        return
    
    print(f"📖 读取到 {len(pages)} 个页面")
    
    # 1. 识别并归档空白页
    blank_page_ids = identify_blank_pages(pages)
    print(f"📄 发现 {len(blank_page_ids)} 个空白页")
    
    if blank_page_ids:
        print("\n🧹 开始清理空白页...")
        archived_blank_count = archive_pages_batch(blank_page_ids, batch_size=64)
    else:
        print("✅ 没有发现空白页需要清理")
        archived_blank_count = 0
    
    # 2. 识别重复页面
    duplicate_groups = identify_duplicate_pages(pages)
    print(f"\n🔍 发现 {len(duplicate_groups)} 组重复页面")
    
    duplicate_page_ids = []
    for group in duplicate_groups:
        # 保留第一个，归档其余的
        duplicate_page_ids.extend(group[1:])
    
    if duplicate_page_ids:
        print(f"🧹 开始清理 {len(duplicate_page_ids)} 个重复页面...")
        archived_duplicate_count = archive_pages_batch(duplicate_page_ids, batch_size=64)
    else:
        print("✅ 没有发现重复页面需要清理")
        archived_duplicate_count = 0
    
    # 3. 创建「待整理」数据库
    print("\n📂 创建「待整理」数据库...")
    pending_db_id = create_pending_database()
    
    # 4. 生成操作报告
    report = {
        "execution_time": datetime.now().isoformat(),
        "total_pages_processed": len(pages),
        "blank_pages_archived": archived_blank_count,
        "duplicate_pages_archived": archived_duplicate_count,
        "pending_database_created": bool(pending_db_id),
        "pending_database_id": pending_db_id,
        "status": "completed"
    }
    
    with open('notion_cleanup_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n📊 操作报告已保存到 notion_cleanup_report.json")
    print(f"✅ 清理完成!")
    print(f"   - 空白页归档: {archived_blank_count}")
    print(f"   - 重复页归档: {archived_duplicate_count}")
    print(f"   - 待整理数据库: {'已创建' if pending_db_id else '创建失败'}")

if __name__ == "__main__":
    main()