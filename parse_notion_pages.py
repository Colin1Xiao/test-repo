import json
import re

def parse_notion_pages_file(file_path):
    """解析Notion页面文件"""
    pages = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 使用正则表达式匹配每个JSON对象
    json_objects = re.findall(r'\{[^{}]*\{[^{}]*\}[^{}]*\}|\{[^{}]*\}', content)
    
    for obj_str in json_objects:
        try:
            # 修复可能的格式问题
            obj_str = obj_str.strip()
            if obj_str.endswith(','):
                obj_str = obj_str[:-1]
            
            page = json.loads(obj_str)
            pages.append(page)
        except json.JSONDecodeError as e:
            print(f"跳过无效的JSON对象: {obj_str[:50]}... 错误: {e}")
            continue
    
    return pages

if __name__ == "__main__":
    pages = parse_notion_pages_file("notion_pages.json")
    print(f"成功解析 {len(pages)} 个页面")
    
    # 保存为正确的JSON格式
    with open("notion_pages_parsed.json", "w", encoding="utf-8") as f:
        json.dump(pages, f, indent=2, ensure_ascii=False)
    
    print("已保存解析后的页面数据到 notion_pages_parsed.json")