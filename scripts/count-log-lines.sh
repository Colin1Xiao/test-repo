#!/bin/bash
#
# count-log-lines.sh - 统计日志文件行数
# 用法: ./count-log-lines.sh [选项] [文件/目录...]
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认值
SHOW_HELP=false
RECURSIVE=false
SORT_BY_SIZE=false
FORMAT="plain"
PATTERN=""

# 打印帮助信息
print_help() {
    cat << EOF
${BLUE}统计日志文件行数${NC}

用法: $0 [选项] [文件/目录...]

选项:
  -h, --help          显示帮助信息
  -r, --recursive     递归统计目录下的所有日志文件
  -s, --sort          按行数排序输出
  -f, --format FORMAT 输出格式：plain, table, json (默认：plain)
  -p, --pattern PAT   只统计匹配模式的文件 (例如：*.log)
  -v, --verbose       显示详细信息

示例:
  $0 access.log                    # 统计单个文件
  $0 -r /var/log/                  # 递归统计目录
  $0 -r -p "*.log" /var/log/       # 递归统计所有 .log 文件
  $0 -s -f table *.log             # 排序并以表格格式输出
  $0 -f json *.log                 # 以 JSON 格式输出

EOF
}

# 统计单个文件行数
count_lines() {
    local file="$1"
    if [[ -f "$file" ]]; then
        wc -l < "$file" | tr -d ' '
    else
        echo "0"
    fi
}

# 获取文件大小（字节）
get_file_size() {
    local file="$1"
    if [[ -f "$file" ]]; then
        stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# 格式化输出
format_output() {
    local file="$1"
    local lines="$2"
    local size="$3"
    
    case "$FORMAT" in
        json)
            echo "{\"file\": \"$file\", \"lines\": $lines, \"size\": $size}"
            ;;
        table)
            printf "%-60s %12s %12s\n" "$file" "$lines" "$size"
            ;;
        plain|*)
            printf "%s: %s 行 (%s 字节)\n" "$file" "$lines" "$size"
            ;;
    esac
}

# 主逻辑
main() {
    local files=()
    local total_lines=0
    local total_files=0
    local results=()
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                print_help
                exit 0
                ;;
            -r|--recursive)
                RECURSIVE=true
                shift
                ;;
            -s|--sort)
                SORT_BY_SIZE=true
                shift
                ;;
            -f|--format)
                FORMAT="$2"
                shift 2
                ;;
            -p|--pattern)
                PATTERN="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -*)
                echo -e "${RED}错误：未知选项 $1${NC}"
                print_help
                exit 1
                ;;
            *)
                files+=("$1")
                shift
                ;;
        esac
    done
    
    # 默认当前目录
    if [[ ${#files[@]} -eq 0 ]]; then
        files=(".")
    fi
    
    # 表头
    if [[ "$FORMAT" == "table" ]]; then
        printf "%-60s %12s %12s\n" "文件" "行数" "大小 (字节)"
        printf "%-60s %12s %12s\n" "------------------------------------------------------------" "------------" "------------"
    fi
    
    # 收集结果
    declare -a all_results
    
    for target in "${files[@]}"; do
        if [[ -d "$target" ]]; then
            if [[ "$RECURSIVE" == true ]]; then
                # 递归查找
                if [[ -n "$PATTERN" ]]; then
                    while IFS= read -r -d '' file; do
                        lines=$(count_lines "$file")
                        size=$(get_file_size "$file")
                        all_results+=("$lines|$file|$size")
                        total_lines=$((total_lines + lines))
                        total_files=$((total_files + 1))
                    done < <(find "$target" -type f -name "$PATTERN" -print0 2>/dev/null)
                else
                    while IFS= read -r -d '' file; do
                        lines=$(count_lines "$file")
                        size=$(get_file_size "$file")
                        all_results+=("$lines|$file|$size")
                        total_lines=$((total_lines + lines))
                        total_files=$((total_files + 1))
                    done < <(find "$target" -type f -print0 2>/dev/null)
                fi
            else
                # 仅目录下的文件
                for file in "$target"/*; do
                    if [[ -f "$file" ]]; then
                        if [[ -z "$PATTERN" ]] || [[ "$file" == $PATTERN ]]; then
                            lines=$(count_lines "$file")
                            size=$(get_file_size "$file")
                            all_results+=("$lines|$file|$size")
                            total_lines=$((total_lines + lines))
                            total_files=$((total_files + 1))
                        fi
                    fi
                done
            fi
        elif [[ -f "$target" ]]; then
            lines=$(count_lines "$target")
            size=$(get_file_size "$target")
            all_results+=("$lines|$target|$size")
            total_lines=$((total_lines + lines))
            total_files=$((total_files + 1))
        else
            echo -e "${RED}警告：$target 不存在${NC}" >&2
        fi
    done
    
    # 排序
    if [[ "$SORT_BY_SIZE" == true ]]; then
        IFS=$'\n' sorted=($(sort -t'|' -k1 -nr <<<"${all_results[*]}"))
        unset IFS
        all_results=("${sorted[@]}")
    fi
    
    # 输出结果
    for result in "${all_results[@]}"; do
        IFS='|' read -r lines file size <<< "$result"
        format_output "$file" "$lines" "$size"
    done
    
    # 总计
    if [[ "$FORMAT" == "json" ]]; then
        echo "{\"total_files\": $total_files, \"total_lines\": $total_lines}"
    elif [[ "$FORMAT" == "table" ]]; then
        printf "%-60s %12s %12s\n" "------------------------------------------------------------" "------------" "------------"
        printf "%-60s %12s %12s\n" "总计" "$total_lines" "-"
    else
        echo ""
        echo -e "${GREEN}总计：$total_files 个文件，$total_lines 行${NC}"
    fi
}

main "$@"
