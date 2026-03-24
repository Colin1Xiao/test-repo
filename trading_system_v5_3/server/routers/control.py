"""
控制平面路由
"""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from datetime import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from server.utils import read_control_state, write_control_state

router = APIRouter(prefix="/control", tags=["Control Plane"])


@router.get("/state")
async def get_control_state():
    """获取控制状态"""
    state = read_control_state()
    return JSONResponse(content=state)


@router.post("/toggle")
async def toggle_trading(request: Request):
    """切换交易状态"""
    data = await request.json()
    state = read_control_state()
    state["enabled"] = data.get("enabled", not state.get("enabled", True))
    write_control_state(state)
    return JSONResponse(content={
        "success": True,
        "state": state
    })


@router.post("/mode")
async def set_mode(request: Request):
    """设置交易模式"""
    data = await request.json()
    mode = data.get("mode", "shadow")
    if mode not in ["shadow", "live"]:
        return JSONResponse(content={"error": "Invalid mode"}, status_code=400)
    
    state = read_control_state()
    state["mode"] = mode
    write_control_state(state)
    return JSONResponse(content={
        "success": True,
        "state": state
    })


@router.post("/freeze")
async def freeze_trading(request: Request):
    """冻结/解冻交易"""
    data = await request.json()
    state = read_control_state()
    state["frozen"] = data.get("frozen", not state.get("frozen", False))
    write_control_state(state)
    return JSONResponse(content={
        "success": True,
        "state": state
    })


@router.post("/emergency-stop")
async def emergency_stop():
    """紧急停止"""
    state = {
        "enabled": False,
        "mode": "shadow",
        "frozen": True,
        "emergency": True,
        "timestamp": datetime.now().isoformat()
    }
    write_control_state(state)
    return JSONResponse(content={
        "success": True,
        "message": "Emergency stop activated",
        "state": state
    })