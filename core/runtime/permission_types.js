"use strict";
/**
 * Permission Types - 权限类型定义
 *
 * 权限系统从"开关"升级为"规则引擎"：
 * - 多级结果：allow / deny / ask
 * - 多来源合并：system / agent / workspace / local / session / user_approval
 * - 决策原因追踪（人类可解释）
 * - 精确匹配：exact / prefix / wildcard / path / mcp
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SYSTEM_RULES = exports.SOURCE_PRIORITY = exports.DANGEROUS_PATTERNS = void 0;
/** 危险命令模式（自动收紧） */
exports.DANGEROUS_PATTERNS = [
    'rm -rf',
    'rm -r',
    'rm -f',
    'chmod -R',
    'chown -R',
    'git push --force',
    'git push --force-with-lease',
    'curl * | *bash',
    'wget * | *bash',
    'curl * | *sh',
    'wget * | *sh',
    'dd if=*',
    'mkfs',
    'fdisk',
    'parted',
    'sudo *',
    'su -',
    '> /etc/*',
    '> /usr/*',
    '> /var/*',
    'echo * > /dev/*',
];
/** 权限来源优先级（数字越大优先级越高） */
exports.SOURCE_PRIORITY = {
    system: 0,
    local: 1,
    agent: 2,
    workspace: 3,
    user_approval: 4,
    session: 5,
};
/** 默认系统规则（最低优先级） */
exports.DEFAULT_SYSTEM_RULES = [
    {
        source: 'system',
        behavior: 'allow',
        tool: 'fs.read',
        reason: 'Read operations are safe by default',
    },
    {
        source: 'system',
        behavior: 'allow',
        tool: 'grep.search',
        reason: 'Search operations are safe by default',
    },
    {
        source: 'system',
        behavior: 'ask',
        tool: 'fs.write',
        reason: 'Write operations require approval',
    },
    {
        source: 'system',
        behavior: 'ask',
        tool: 'exec.run',
        reason: 'Command execution requires approval',
    },
    {
        source: 'system',
        behavior: 'deny',
        tool: 'exec.run',
        pattern: 'rm -rf /',
        reason: 'Absolute path deletion is forbidden',
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbl90eXBlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBlcm1pc3Npb25fdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUFnRUgsbUJBQW1CO0FBQ04sUUFBQSxrQkFBa0IsR0FBRztJQUNoQyxRQUFRO0lBQ1IsT0FBTztJQUNQLE9BQU87SUFDUCxVQUFVO0lBQ1YsVUFBVTtJQUNWLGtCQUFrQjtJQUNsQiw2QkFBNkI7SUFDN0IsZ0JBQWdCO0lBQ2hCLGdCQUFnQjtJQUNoQixjQUFjO0lBQ2QsY0FBYztJQUNkLFNBQVM7SUFDVCxNQUFNO0lBQ04sT0FBTztJQUNQLFFBQVE7SUFDUixRQUFRO0lBQ1IsTUFBTTtJQUNOLFVBQVU7SUFDVixVQUFVO0lBQ1YsVUFBVTtJQUNWLGlCQUFpQjtDQUNsQixDQUFDO0FBRUYseUJBQXlCO0FBQ1osUUFBQSxlQUFlLEdBQXFDO0lBQy9ELE1BQU0sRUFBRSxDQUFDO0lBQ1QsS0FBSyxFQUFFLENBQUM7SUFDUixLQUFLLEVBQUUsQ0FBQztJQUNSLFNBQVMsRUFBRSxDQUFDO0lBQ1osYUFBYSxFQUFFLENBQUM7SUFDaEIsT0FBTyxFQUFFLENBQUM7Q0FDWCxDQUFDO0FBRUYsb0JBQW9CO0FBQ1AsUUFBQSxvQkFBb0IsR0FBcUI7SUFDcEQ7UUFDRSxNQUFNLEVBQUUsUUFBUTtRQUNoQixRQUFRLEVBQUUsT0FBTztRQUNqQixJQUFJLEVBQUUsU0FBUztRQUNmLE1BQU0sRUFBRSxxQ0FBcUM7S0FDOUM7SUFDRDtRQUNFLE1BQU0sRUFBRSxRQUFRO1FBQ2hCLFFBQVEsRUFBRSxPQUFPO1FBQ2pCLElBQUksRUFBRSxhQUFhO1FBQ25CLE1BQU0sRUFBRSx1Q0FBdUM7S0FDaEQ7SUFDRDtRQUNFLE1BQU0sRUFBRSxRQUFRO1FBQ2hCLFFBQVEsRUFBRSxLQUFLO1FBQ2YsSUFBSSxFQUFFLFVBQVU7UUFDaEIsTUFBTSxFQUFFLG1DQUFtQztLQUM1QztJQUNEO1FBQ0UsTUFBTSxFQUFFLFFBQVE7UUFDaEIsUUFBUSxFQUFFLEtBQUs7UUFDZixJQUFJLEVBQUUsVUFBVTtRQUNoQixNQUFNLEVBQUUscUNBQXFDO0tBQzlDO0lBQ0Q7UUFDRSxNQUFNLEVBQUUsUUFBUTtRQUNoQixRQUFRLEVBQUUsTUFBTTtRQUNoQixJQUFJLEVBQUUsVUFBVTtRQUNoQixPQUFPLEVBQUUsVUFBVTtRQUNuQixNQUFNLEVBQUUscUNBQXFDO0tBQzlDO0NBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGVybWlzc2lvbiBUeXBlcyAtIOadg+mZkOexu+Wei+WumuS5iVxuICogXG4gKiDmnYPpmZDns7vnu5/ku45cIuW8gOWFs1wi5Y2H57qn5Li6XCLop4TliJnlvJXmk45cIu+8mlxuICogLSDlpJrnuqfnu5PmnpzvvJphbGxvdyAvIGRlbnkgLyBhc2tcbiAqIC0g5aSa5p2l5rqQ5ZCI5bm277yac3lzdGVtIC8gYWdlbnQgLyB3b3Jrc3BhY2UgLyBsb2NhbCAvIHNlc3Npb24gLyB1c2VyX2FwcHJvdmFsXG4gKiAtIOWGs+etluWOn+WboOi/vei4qu+8iOS6uuexu+WPr+ino+mHiu+8iVxuICogLSDnsr7noa7ljLnphY3vvJpleGFjdCAvIHByZWZpeCAvIHdpbGRjYXJkIC8gcGF0aCAvIG1jcFxuICovXG5cbi8qKiDmnYPpmZDooYzkuLogKi9cbmV4cG9ydCB0eXBlIFBlcm1pc3Npb25CZWhhdmlvciA9ICdhbGxvdycgfCAnZGVueScgfCAnYXNrJztcblxuLyoqIOadg+mZkOadpea6kO+8iOS8mOWFiOe6p+S7jumrmOWIsOS9ju+8iSAqL1xuZXhwb3J0IHR5cGUgUGVybWlzc2lvblNvdXJjZSA9XG4gIHwgJ3Nlc3Npb24nICAgICAgICAvLyDkvJror53nuqfopobnm5bvvIjmnIDpq5jkvJjlhYjnuqfvvIlcbiAgfCAndXNlcl9hcHByb3ZhbCcgIC8vIOeUqOaIt+S4gOasoeaAp+aJueWHhlxuICB8ICd3b3Jrc3BhY2UnICAgICAgLy8g5bel5L2c5Yy66YWN572uXG4gIHwgJ2FnZW50JyAgICAgICAgICAvLyDku6PnkIbnrZbnlaVcbiAgfCAnbG9jYWwnICAgICAgICAgIC8vIOacrOWcsOmFjee9rlxuICB8ICdzeXN0ZW0nOyAgICAgICAgLy8g57O757uf6buY6K6k77yI5pyA5L2O5LyY5YWI57qn77yJXG5cbi8qKiDmnYPpmZDop4TliJkgKi9cbmV4cG9ydCB0eXBlIFBlcm1pc3Npb25SdWxlID0ge1xuICAvKiog6KeE5YiZ5p2l5rqQICovXG4gIHNvdXJjZTogUGVybWlzc2lvblNvdXJjZTtcbiAgLyoqIOadg+mZkOihjOS4uiAqL1xuICBiZWhhdmlvcjogUGVybWlzc2lvbkJlaGF2aW9yO1xuICAvKiog5bel5YW35ZCN56ew77yI5aaCIFwiZXhlYy5ydW5cIiwgXCJmcy53cml0ZVwi77yJICovXG4gIHRvb2w6IHN0cmluZztcbiAgLyoqIOWMuemFjeaooeW8j++8iOWPr+mAie+8jOeUqOS6jiBleGVjIGNvbW1hbmQg562J77yJICovXG4gIHBhdHRlcm4/OiBzdHJpbmc7XG4gIC8qKiDkvJjlhYjnuqfvvIjlj6/pgInvvIzpu5jorqTmjIkgc291cmNl77yJICovXG4gIHByaW9yaXR5PzogbnVtYmVyO1xuICAvKiog5Y6f5Zug6K+05piO77yI55So5LqO6Kej6YeK77yJICovXG4gIHJlYXNvbj86IHN0cmluZztcbiAgLyoqIOW3peS9nOWMuui3r+W+hOiMg+WbtO+8iOWPr+mAie+8iSAqL1xuICBwYXRoU2NvcGU/OiBzdHJpbmc7XG4gIC8qKiBNQ1Agc2VydmVyIOiMg+WbtO+8iOWPr+mAie+8iSAqL1xuICBtY3BTZXJ2ZXI/OiBzdHJpbmc7XG4gIC8qKiDov4fmnJ/ml7bpl7TvvIjlj6/pgInvvIznlKjkuo7kuLTml7bmibnlh4bvvIkgKi9cbiAgZXhwaXJlc0F0PzogbnVtYmVyO1xufTtcblxuLyoqIOadg+mZkOajgOafpei+k+WFpSAqL1xuZXhwb3J0IHR5cGUgUGVybWlzc2lvbkNoZWNrSW5wdXQgPSB7XG4gIC8qKiDlt6XlhbflkI3np7AgKi9cbiAgdG9vbDogc3RyaW5nO1xuICAvKiog5Yqo5L2c77yI5Y+v6YCJ77yM5aaCIFwicmVhZFwiIC8gXCJ3cml0ZVwiIC8gXCJkZWxldGVcIu+8iSAqL1xuICBhY3Rpb24/OiBzdHJpbmc7XG4gIC8qKiDnm67moIfvvIjlj6/pgInvvIzlpoLmlofku7bot6/lvoTjgIHlkb3ku6TvvIkgKi9cbiAgdGFyZ2V0Pzogc3RyaW5nO1xuICAvKiog6LSf6L2977yI5Y+v6YCJ77yM5a6M5pW06L6T5YWl5Y+C5pWw77yJICovXG4gIHBheWxvYWQ/OiB1bmtub3duO1xuICAvKiog5b2T5YmN5bel5L2c5Yy66Lev5b6EICovXG4gIGN3ZD86IHN0cmluZztcbn07XG5cbi8qKiDmnYPpmZDlhrPnrZbnu5PmnpwgKi9cbmV4cG9ydCB0eXBlIFBlcm1pc3Npb25EZWNpc2lvbiA9IHtcbiAgLyoqIOaYr+WQpuWFgeiuuCAqL1xuICBhbGxvd2VkOiBib29sZWFuO1xuICAvKiog5p2D6ZmQ6KGM5Li6ICovXG4gIGJlaGF2aW9yOiBQZXJtaXNzaW9uQmVoYXZpb3I7XG4gIC8qKiDlkb3kuK3nmoTop4TliJnvvIjlj6/pgInvvIkgKi9cbiAgbWF0Y2hlZFJ1bGU/OiBQZXJtaXNzaW9uUnVsZTtcbiAgLyoqIOaYr+WQpumcgOimgeWuoeaJuSAqL1xuICByZXF1aXJlc0FwcHJvdmFsOiBib29sZWFuO1xuICAvKiog5Lq657G75Y+v6Kej6YeK55qE5Y6f5ZugICovXG4gIGV4cGxhbmF0aW9uOiBzdHJpbmc7XG59O1xuXG4vKiog5Y2x6Zmp5ZG95Luk5qih5byP77yI6Ieq5Yqo5pS257Sn77yJICovXG5leHBvcnQgY29uc3QgREFOR0VST1VTX1BBVFRFUk5TID0gW1xuICAncm0gLXJmJyxcbiAgJ3JtIC1yJyxcbiAgJ3JtIC1mJyxcbiAgJ2NobW9kIC1SJyxcbiAgJ2Nob3duIC1SJyxcbiAgJ2dpdCBwdXNoIC0tZm9yY2UnLFxuICAnZ2l0IHB1c2ggLS1mb3JjZS13aXRoLWxlYXNlJyxcbiAgJ2N1cmwgKiB8ICpiYXNoJyxcbiAgJ3dnZXQgKiB8ICpiYXNoJyxcbiAgJ2N1cmwgKiB8ICpzaCcsXG4gICd3Z2V0ICogfCAqc2gnLFxuICAnZGQgaWY9KicsXG4gICdta2ZzJyxcbiAgJ2ZkaXNrJyxcbiAgJ3BhcnRlZCcsXG4gICdzdWRvIConLFxuICAnc3UgLScsXG4gICc+IC9ldGMvKicsXG4gICc+IC91c3IvKicsXG4gICc+IC92YXIvKicsXG4gICdlY2hvICogPiAvZGV2LyonLFxuXTtcblxuLyoqIOadg+mZkOadpea6kOS8mOWFiOe6p++8iOaVsOWtl+i2iuWkp+S8mOWFiOe6p+i2iumrmO+8iSAqL1xuZXhwb3J0IGNvbnN0IFNPVVJDRV9QUklPUklUWTogUmVjb3JkPFBlcm1pc3Npb25Tb3VyY2UsIG51bWJlcj4gPSB7XG4gIHN5c3RlbTogMCxcbiAgbG9jYWw6IDEsXG4gIGFnZW50OiAyLFxuICB3b3Jrc3BhY2U6IDMsXG4gIHVzZXJfYXBwcm92YWw6IDQsXG4gIHNlc3Npb246IDUsXG59O1xuXG4vKiog6buY6K6k57O757uf6KeE5YiZ77yI5pyA5L2O5LyY5YWI57qn77yJICovXG5leHBvcnQgY29uc3QgREVGQVVMVF9TWVNURU1fUlVMRVM6IFBlcm1pc3Npb25SdWxlW10gPSBbXG4gIHtcbiAgICBzb3VyY2U6ICdzeXN0ZW0nLFxuICAgIGJlaGF2aW9yOiAnYWxsb3cnLFxuICAgIHRvb2w6ICdmcy5yZWFkJyxcbiAgICByZWFzb246ICdSZWFkIG9wZXJhdGlvbnMgYXJlIHNhZmUgYnkgZGVmYXVsdCcsXG4gIH0sXG4gIHtcbiAgICBzb3VyY2U6ICdzeXN0ZW0nLFxuICAgIGJlaGF2aW9yOiAnYWxsb3cnLFxuICAgIHRvb2w6ICdncmVwLnNlYXJjaCcsXG4gICAgcmVhc29uOiAnU2VhcmNoIG9wZXJhdGlvbnMgYXJlIHNhZmUgYnkgZGVmYXVsdCcsXG4gIH0sXG4gIHtcbiAgICBzb3VyY2U6ICdzeXN0ZW0nLFxuICAgIGJlaGF2aW9yOiAnYXNrJyxcbiAgICB0b29sOiAnZnMud3JpdGUnLFxuICAgIHJlYXNvbjogJ1dyaXRlIG9wZXJhdGlvbnMgcmVxdWlyZSBhcHByb3ZhbCcsXG4gIH0sXG4gIHtcbiAgICBzb3VyY2U6ICdzeXN0ZW0nLFxuICAgIGJlaGF2aW9yOiAnYXNrJyxcbiAgICB0b29sOiAnZXhlYy5ydW4nLFxuICAgIHJlYXNvbjogJ0NvbW1hbmQgZXhlY3V0aW9uIHJlcXVpcmVzIGFwcHJvdmFsJyxcbiAgfSxcbiAge1xuICAgIHNvdXJjZTogJ3N5c3RlbScsXG4gICAgYmVoYXZpb3I6ICdkZW55JyxcbiAgICB0b29sOiAnZXhlYy5ydW4nLFxuICAgIHBhdHRlcm46ICdybSAtcmYgLycsXG4gICAgcmVhc29uOiAnQWJzb2x1dGUgcGF0aCBkZWxldGlvbiBpcyBmb3JiaWRkZW4nLFxuICB9LFxuXTtcbiJdfQ==