#!/usr/bin/env python3
import os
import argparse
import json

def find_skills(keyword=None):
    # Locate the skills root directory (assuming structure: .trae/skills/find-skills/scripts/find.py)
    # So we go up 3 levels to reach .trae/skills
    skills_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
    found_skills = []
    
    if os.path.exists(skills_dir):
        for name in os.listdir(skills_dir):
            if name.startswith('.'): continue
            
            skill_path = os.path.join(skills_dir, name)
            if os.path.isdir(skill_path):
                desc = "No description"
                md_path = os.path.join(skill_path, 'SKILL.md')
                if os.path.exists(md_path):
                    with open(md_path, 'r', errors='ignore') as f:
                        for line in f:
                            if line.startswith('description:'):
                                desc = line.replace('description:', '').strip()
                                break
                
                if not keyword or keyword.lower() in name.lower() or keyword.lower() in desc.lower():
                    found_skills.append({
                        'name': name,
                        'description': desc,
                        'path': skill_path
                    })
    
    return found_skills

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Find available skills in the workspace.')
    parser.add_argument('keyword', nargs='?', help='Search keyword (optional)')
    args = parser.parse_args()
    
    results = find_skills(args.keyword)
    
    if results:
        print(f"Found {len(results)} skills:")
        print(f"{'NAME':<30} {'DESCRIPTION'}")
        print("-" * 80)
        for skill in results:
            # Truncate desc for display
            desc = (skill['description'][:45] + '...') if len(skill['description']) > 45 else skill['description']
            print(f"{skill['name']:<30} {desc}")
    else:
        print("No skills found.")
