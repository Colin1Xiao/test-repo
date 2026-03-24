# 在 live_executor.py 的 execute_signal 返回前添加:
# 
# from core.latency_stats import get_latency_stats
# stats = get_latency_stats()
# stats.add_sample(profile.to_dict(), actual_slippage)
# print(stats.report())
