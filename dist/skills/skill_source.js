"use strict";
/**
 * Skill Source - Skill 来源管理
 *
 * 职责：
 * 1. 统一表达 builtin / workspace / external source
 * 2. 解析 source metadata
 * 3. 区分"可直接用"和"需下载/导入"的来源
 * 4. 为 installer 提供标准 source descriptor
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSource = resolveSource;
exports.normalizeSource = normalizeSource;
exports.isBuiltinSource = isBuiltinSource;
exports.isWorkspaceSource = isWorkspaceSource;
exports.isExternalSource = isExternalSource;
exports.isBuiltinSourcePath = isBuiltinSourcePath;
exports.isWorkspaceSourcePath = isWorkspaceSourcePath;
exports.isExternalSourcePath = isExternalSourcePath;
exports.getSourceType = getSourceType;
exports.isSourceAvailable = isSourceAvailable;
exports.createBuiltinSource = createBuiltinSource;
exports.createWorkspaceSource = createWorkspaceSource;
exports.createExternalSource = createExternalSource;
// ============================================================================
// 来源解析
// ============================================================================
/**
 * 解析来源
 */
function resolveSource(input) {
    try {
        // 检查是否是 builtin
        if (isBuiltinSourcePath(input)) {
            return {
                success: true,
                source: {
                    type: 'builtin',
                    location: input,
                    origin: input,
                    fetchedAt: Date.now(),
                },
            };
        }
        // 检查是否是 workspace
        if (isWorkspaceSourcePath(input)) {
            return {
                success: true,
                source: {
                    type: 'workspace',
                    location: input,
                    origin: input,
                    fetchedAt: Date.now(),
                },
            };
        }
        // 检查是否是外部来源
        if (isExternalSourcePath(input)) {
            return {
                success: true,
                source: {
                    type: 'external',
                    location: input,
                    origin: input,
                    fetchedAt: Date.now(),
                },
            };
        }
        // 默认视为 workspace
        return {
            success: true,
            source: {
                type: 'workspace',
                location: input,
                origin: input,
                fetchedAt: Date.now(),
            },
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to resolve source: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
/**
 * 规范化来源
 */
function normalizeSource(source) {
    return {
        ...source,
        type: source.type || 'workspace',
        location: source.location?.trim() || '',
        fetchedAt: source.fetchedAt || Date.now(),
    };
}
/**
 * 检查是否是 builtin 来源
 */
function isBuiltinSource(source) {
    return source.type === 'builtin' || isBuiltinSourcePath(source.location);
}
/**
 * 检查是否是 workspace 来源
 */
function isWorkspaceSource(source) {
    return source.type === 'workspace' || isWorkspaceSourcePath(source.location);
}
/**
 * 检查是否是 external 来源
 */
function isExternalSource(source) {
    return source.type === 'external' || isExternalSourcePath(source.location);
}
// ============================================================================
// 路径检查
// ============================================================================
/**
 * 检查是否是 builtin 来源路径
 */
function isBuiltinSourcePath(path) {
    // builtin 路径通常以 ./builtin/ 或 builtin: 开头
    return path.startsWith('./builtin/') ||
        path.startsWith('builtin:') ||
        path.startsWith('@openclaw/');
}
/**
 * 检查是否是 workspace 来源路径
 */
function isWorkspaceSourcePath(path) {
    // workspace 路径通常是相对路径或绝对路径
    return path.startsWith('./skills/') ||
        path.startsWith('./workspace/skills/') ||
        path.startsWith('/') ||
        path.startsWith('../');
}
/**
 * 检查是否是 external 来源路径
 */
function isExternalSourcePath(path) {
    // external 来源通常是 URL 或 npm 包名
    return path.startsWith('http://') ||
        path.startsWith('https://') ||
        path.startsWith('npm:') ||
        path.startsWith('github:') ||
        path.startsWith('git@') ||
        path.includes('@') && !path.startsWith('./'); // npm 包名如 @org/package
}
// ============================================================================
// 来源元数据
// ============================================================================
/**
 * 获取来源类型
 */
function getSourceType(path) {
    if (isBuiltinSourcePath(path)) {
        return 'builtin';
    }
    if (isExternalSourcePath(path)) {
        return 'external';
    }
    return 'workspace';
}
/**
 * 检查来源是否可用
 */
async function isSourceAvailable(source) {
    try {
        // builtin 来源默认可用
        if (source.type === 'builtin') {
            return true;
        }
        // workspace 来源检查文件是否存在
        if (source.type === 'workspace') {
            // 简化实现：实际应该检查文件系统
            return true;
        }
        // external 来源检查 URL 是否可访问
        if (source.type === 'external') {
            // 简化实现：实际应该发起 HTTP 请求
            return true;
        }
        return false;
    }
    catch (error) {
        return false;
    }
}
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建 builtin 来源
 */
function createBuiltinSource(skillName) {
    return {
        type: 'builtin',
        location: `./builtin/${skillName}`,
        origin: `builtin:${skillName}`,
        fetchedAt: Date.now(),
    };
}
/**
 * 创建 workspace 来源
 */
function createWorkspaceSource(skillName, basePath = './skills') {
    return {
        type: 'workspace',
        location: `${basePath}/${skillName}`,
        origin: `${basePath}/${skillName}`,
        fetchedAt: Date.now(),
    };
}
/**
 * 创建 external 来源
 */
function createExternalSource(location) {
    return {
        type: 'external',
        location,
        origin: location,
        fetchedAt: Date.now(),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfc291cmNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NraWxscy9za2lsbF9zb3VyY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7OztHQVdHOztBQTZCSCxzQ0EwREM7QUFLRCwwQ0FPQztBQUtELDBDQUVDO0FBS0QsOENBRUM7QUFLRCw0Q0FFQztBQVNELGtEQUtDO0FBS0Qsc0RBTUM7QUFLRCxvREFRQztBQVNELHNDQVVDO0FBS0QsOENBd0JDO0FBU0Qsa0RBT0M7QUFLRCxzREFPQztBQUtELG9EQU9DO0FBaE9ELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsU0FBZ0IsYUFBYSxDQUFDLEtBQWE7SUFDekMsSUFBSSxDQUFDO1FBQ0gsZ0JBQWdCO1FBQ2hCLElBQUksbUJBQW1CLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMvQixPQUFPO2dCQUNMLE9BQU8sRUFBRSxJQUFJO2dCQUNiLE1BQU0sRUFBRTtvQkFDTixJQUFJLEVBQUUsU0FBUztvQkFDZixRQUFRLEVBQUUsS0FBSztvQkFDZixNQUFNLEVBQUUsS0FBSztvQkFDYixTQUFTLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDdEI7YUFDRixDQUFDO1FBQ0osQ0FBQztRQUVELGtCQUFrQjtRQUNsQixJQUFJLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDakMsT0FBTztnQkFDTCxPQUFPLEVBQUUsSUFBSTtnQkFDYixNQUFNLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFdBQVc7b0JBQ2pCLFFBQVEsRUFBRSxLQUFLO29CQUNmLE1BQU0sRUFBRSxLQUFLO29CQUNiLFNBQVMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUN0QjthQUNGLENBQUM7UUFDSixDQUFDO1FBRUQsWUFBWTtRQUNaLElBQUksb0JBQW9CLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNoQyxP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Z0IsbUJBQW1CLENBQUMsU0FBaUI7SUFDbkQsT0FBTztRQUNMLElBQUksRUFBRSxTQUFTO1FBQ2YsUUFBUSxFQUFFLGFBQWEsU0FBUyxFQUFFO1FBQ2xDLE1BQU0sRUFBRSxXQUFXLFNBQVMsRUFBRTtRQUM5QixTQUFTLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtLQUN0QixDQUFDO0FBQ0osQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IscUJBQXFCLENBQUMsU0FBaUIsRUFBRSxXQUFtQixVQUFVO0lBQ3BGLE9BQU87UUFDTCxJQUFJLEVBQUUsV0FBVztRQUNqQixRQUFRLEVBQUUsR0FBRyxRQUFRLElBQUksU0FBUyxFQUFFO1FBQ3BDLE1BQU0sRUFBRSxHQUFHLFFBQVEsSUFBSSxTQUFTLEVBQUU7UUFDbEMsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7S0FDdEIsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLFFBQWdCO0lBQ25ELE9BQU87UUFDTCxJQUFJLEVBQUUsVUFBVTtRQUNoQixRQUFRO1FBQ1IsTUFBTSxFQUFFLFFBQVE7UUFDaEIsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7S0FDdEIsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNraWxsIFNvdXJjZSAtIFNraWxsIOadpea6kOeuoeeQhlxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOe7n+S4gOihqOi+viBidWlsdGluIC8gd29ya3NwYWNlIC8gZXh0ZXJuYWwgc291cmNlXG4gKiAyLiDop6PmnpAgc291cmNlIG1ldGFkYXRhXG4gKiAzLiDljLrliIZcIuWPr+ebtOaOpeeUqFwi5ZKMXCLpnIDkuIvovb0v5a+85YWlXCLnmoTmnaXmupBcbiAqIDQuIOS4uiBpbnN0YWxsZXIg5o+Q5L6b5qCH5YeGIHNvdXJjZSBkZXNjcmlwdG9yXG4gKiBcbiAqIEB2ZXJzaW9uIHYwLjEuMFxuICogQGRhdGUgMjAyNi0wNC0wM1xuICovXG5cbmltcG9ydCB0eXBlIHsgU2tpbGxTb3VyY2VEZXNjcmlwdG9yLCBTa2lsbFNvdXJjZVR5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5p2l5rqQ6Kej5p6Q57uT5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU291cmNlUmVzb2x2ZVJlc3VsdCB7XG4gIC8qKiDmmK/lkKbmiJDlip8gKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgXG4gIC8qKiDmnaXmupDmj4/ov7DnrKbvvIjlpoLmnpzop6PmnpDmiJDlip/vvIkgKi9cbiAgc291cmNlPzogU2tpbGxTb3VyY2VEZXNjcmlwdG9yO1xuICBcbiAgLyoqIOmUmeivr+S/oeaBr++8iOWmguaenOino+aekOWksei0pe+8iSAqL1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5p2l5rqQ6Kej5p6QXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog6Kej5p6Q5p2l5rqQXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU291cmNlKGlucHV0OiBzdHJpbmcpOiBTb3VyY2VSZXNvbHZlUmVzdWx0IHtcbiAgdHJ5IHtcbiAgICAvLyDmo4Dmn6XmmK/lkKbmmK8gYnVpbHRpblxuICAgIGlmIChpc0J1aWx0aW5Tb3VyY2VQYXRoKGlucHV0KSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgdHlwZTogJ2J1aWx0aW4nLFxuICAgICAgICAgIGxvY2F0aW9uOiBpbnB1dCxcbiAgICAgICAgICBvcmlnaW46IGlucHV0LFxuICAgICAgICAgIGZldGNoZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpeaYr+WQpuaYryB3b3Jrc3BhY2VcbiAgICBpZiAoaXNXb3Jrc3BhY2VTb3VyY2VQYXRoKGlucHV0KSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgdHlwZTogJ3dvcmtzcGFjZScsXG4gICAgICAgICAgbG9jYXRpb246IGlucHV0LFxuICAgICAgICAgIG9yaWdpbjogaW5wdXQsXG4gICAgICAgICAgZmV0Y2hlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qOA5p+l5piv5ZCm5piv5aSW6YOo5p2l5rqQXG4gICAgaWYgKGlzRXh0ZXJuYWxTb3VyY2VQYXRoKGlucHV0KSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgdHlwZTogJ2V4dGVybmFsJyxcbiAgICAgICAgICBsb2NhdGlvbjogaW5wdXQsXG4gICAgICAgICAgb3JpZ2luOiBpbnB1dCxcbiAgICAgICAgICBmZXRjaGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDpu5jorqTop4bkuLogd29ya3NwYWNlXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgdHlwZTogJ3dvcmtzcGFjZScsXG4gICAgICAgIGxvY2F0aW9uOiBpbnB1dCxcbiAgICAgICAgb3JpZ2luOiBpbnB1dCxcbiAgICAgICAgZmV0Y2hlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSxcbiAgICB9O1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIGVycm9yOiBgRmFpbGVkIHRvIHJlc29sdmUgc291cmNlOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiDop4TojIPljJbmnaXmupBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVNvdXJjZShzb3VyY2U6IFNraWxsU291cmNlRGVzY3JpcHRvcik6IFNraWxsU291cmNlRGVzY3JpcHRvciB7XG4gIHJldHVybiB7XG4gICAgLi4uc291cmNlLFxuICAgIHR5cGU6IHNvdXJjZS50eXBlIHx8ICd3b3Jrc3BhY2UnLFxuICAgIGxvY2F0aW9uOiBzb3VyY2UubG9jYXRpb24/LnRyaW0oKSB8fCAnJyxcbiAgICBmZXRjaGVkQXQ6IHNvdXJjZS5mZXRjaGVkQXQgfHwgRGF0ZS5ub3coKSxcbiAgfTtcbn1cblxuLyoqXG4gKiDmo4Dmn6XmmK/lkKbmmK8gYnVpbHRpbiDmnaXmupBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQnVpbHRpblNvdXJjZShzb3VyY2U6IFNraWxsU291cmNlRGVzY3JpcHRvcik6IGJvb2xlYW4ge1xuICByZXR1cm4gc291cmNlLnR5cGUgPT09ICdidWlsdGluJyB8fCBpc0J1aWx0aW5Tb3VyY2VQYXRoKHNvdXJjZS5sb2NhdGlvbik7XG59XG5cbi8qKlxuICog5qOA5p+l5piv5ZCm5pivIHdvcmtzcGFjZSDmnaXmupBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzV29ya3NwYWNlU291cmNlKHNvdXJjZTogU2tpbGxTb3VyY2VEZXNjcmlwdG9yKTogYm9vbGVhbiB7XG4gIHJldHVybiBzb3VyY2UudHlwZSA9PT0gJ3dvcmtzcGFjZScgfHwgaXNXb3Jrc3BhY2VTb3VyY2VQYXRoKHNvdXJjZS5sb2NhdGlvbik7XG59XG5cbi8qKlxuICog5qOA5p+l5piv5ZCm5pivIGV4dGVybmFsIOadpea6kFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFeHRlcm5hbFNvdXJjZShzb3VyY2U6IFNraWxsU291cmNlRGVzY3JpcHRvcik6IGJvb2xlYW4ge1xuICByZXR1cm4gc291cmNlLnR5cGUgPT09ICdleHRlcm5hbCcgfHwgaXNFeHRlcm5hbFNvdXJjZVBhdGgoc291cmNlLmxvY2F0aW9uKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6Lev5b6E5qOA5p+lXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5qOA5p+l5piv5ZCm5pivIGJ1aWx0aW4g5p2l5rqQ6Lev5b6EXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0J1aWx0aW5Tb3VyY2VQYXRoKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAvLyBidWlsdGluIOi3r+W+hOmAmuW4uOS7pSAuL2J1aWx0aW4vIOaIliBidWlsdGluOiDlvIDlpLRcbiAgcmV0dXJuIHBhdGguc3RhcnRzV2l0aCgnLi9idWlsdGluLycpIHx8IFxuICAgICAgICAgcGF0aC5zdGFydHNXaXRoKCdidWlsdGluOicpIHx8XG4gICAgICAgICBwYXRoLnN0YXJ0c1dpdGgoJ0BvcGVuY2xhdy8nKTtcbn1cblxuLyoqXG4gKiDmo4Dmn6XmmK/lkKbmmK8gd29ya3NwYWNlIOadpea6kOi3r+W+hFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNXb3Jrc3BhY2VTb3VyY2VQYXRoKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAvLyB3b3Jrc3BhY2Ug6Lev5b6E6YCa5bi45piv55u45a+56Lev5b6E5oiW57ud5a+56Lev5b6EXG4gIHJldHVybiBwYXRoLnN0YXJ0c1dpdGgoJy4vc2tpbGxzLycpIHx8XG4gICAgICAgICBwYXRoLnN0YXJ0c1dpdGgoJy4vd29ya3NwYWNlL3NraWxscy8nKSB8fFxuICAgICAgICAgcGF0aC5zdGFydHNXaXRoKCcvJykgfHxcbiAgICAgICAgIHBhdGguc3RhcnRzV2l0aCgnLi4vJyk7XG59XG5cbi8qKlxuICog5qOA5p+l5piv5ZCm5pivIGV4dGVybmFsIOadpea6kOi3r+W+hFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFeHRlcm5hbFNvdXJjZVBhdGgocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIC8vIGV4dGVybmFsIOadpea6kOmAmuW4uOaYryBVUkwg5oiWIG5wbSDljIXlkI1cbiAgcmV0dXJuIHBhdGguc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8XG4gICAgICAgICBwYXRoLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHxcbiAgICAgICAgIHBhdGguc3RhcnRzV2l0aCgnbnBtOicpIHx8XG4gICAgICAgICBwYXRoLnN0YXJ0c1dpdGgoJ2dpdGh1YjonKSB8fFxuICAgICAgICAgcGF0aC5zdGFydHNXaXRoKCdnaXRAJykgfHxcbiAgICAgICAgIHBhdGguaW5jbHVkZXMoJ0AnKSAmJiAhcGF0aC5zdGFydHNXaXRoKCcuLycpOyAvLyBucG0g5YyF5ZCN5aaCIEBvcmcvcGFja2FnZVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDmnaXmupDlhYPmlbDmja5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDojrflj5bmnaXmupDnsbvlnotcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFNvdXJjZVR5cGUocGF0aDogc3RyaW5nKTogU2tpbGxTb3VyY2VUeXBlIHtcbiAgaWYgKGlzQnVpbHRpblNvdXJjZVBhdGgocGF0aCkpIHtcbiAgICByZXR1cm4gJ2J1aWx0aW4nO1xuICB9XG4gIFxuICBpZiAoaXNFeHRlcm5hbFNvdXJjZVBhdGgocGF0aCkpIHtcbiAgICByZXR1cm4gJ2V4dGVybmFsJztcbiAgfVxuICBcbiAgcmV0dXJuICd3b3Jrc3BhY2UnO1xufVxuXG4vKipcbiAqIOajgOafpeadpea6kOaYr+WQpuWPr+eUqFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNTb3VyY2VBdmFpbGFibGUoc291cmNlOiBTa2lsbFNvdXJjZURlc2NyaXB0b3IpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICAvLyBidWlsdGluIOadpea6kOm7mOiupOWPr+eUqFxuICAgIGlmIChzb3VyY2UudHlwZSA9PT0gJ2J1aWx0aW4nKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8gd29ya3NwYWNlIOadpea6kOajgOafpeaWh+S7tuaYr+WQpuWtmOWcqFxuICAgIGlmIChzb3VyY2UudHlwZSA9PT0gJ3dvcmtzcGFjZScpIHtcbiAgICAgIC8vIOeugOWMluWunueOsO+8muWunumZheW6lOivpeajgOafpeaWh+S7tuezu+e7n1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIC8vIGV4dGVybmFsIOadpea6kOajgOafpSBVUkwg5piv5ZCm5Y+v6K6/6ZeuXG4gICAgaWYgKHNvdXJjZS50eXBlID09PSAnZXh0ZXJuYWwnKSB7XG4gICAgICAvLyDnroDljJblrp7njrDvvJrlrp7pmYXlupTor6Xlj5HotbcgSFRUUCDor7fmsYJcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZmFsc2U7XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uiBidWlsdGluIOadpea6kFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQnVpbHRpblNvdXJjZShza2lsbE5hbWU6IHN0cmluZyk6IFNraWxsU291cmNlRGVzY3JpcHRvciB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ2J1aWx0aW4nLFxuICAgIGxvY2F0aW9uOiBgLi9idWlsdGluLyR7c2tpbGxOYW1lfWAsXG4gICAgb3JpZ2luOiBgYnVpbHRpbjoke3NraWxsTmFtZX1gLFxuICAgIGZldGNoZWRBdDogRGF0ZS5ub3coKSxcbiAgfTtcbn1cblxuLyoqXG4gKiDliJvlu7ogd29ya3NwYWNlIOadpea6kFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV29ya3NwYWNlU291cmNlKHNraWxsTmFtZTogc3RyaW5nLCBiYXNlUGF0aDogc3RyaW5nID0gJy4vc2tpbGxzJyk6IFNraWxsU291cmNlRGVzY3JpcHRvciB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ3dvcmtzcGFjZScsXG4gICAgbG9jYXRpb246IGAke2Jhc2VQYXRofS8ke3NraWxsTmFtZX1gLFxuICAgIG9yaWdpbjogYCR7YmFzZVBhdGh9LyR7c2tpbGxOYW1lfWAsXG4gICAgZmV0Y2hlZEF0OiBEYXRlLm5vdygpLFxuICB9O1xufVxuXG4vKipcbiAqIOWIm+W7uiBleHRlcm5hbCDmnaXmupBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUV4dGVybmFsU291cmNlKGxvY2F0aW9uOiBzdHJpbmcpOiBTa2lsbFNvdXJjZURlc2NyaXB0b3Ige1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdleHRlcm5hbCcsXG4gICAgbG9jYXRpb24sXG4gICAgb3JpZ2luOiBsb2NhdGlvbixcbiAgICBmZXRjaGVkQXQ6IERhdGUubm93KCksXG4gIH07XG59XG4iXX0=