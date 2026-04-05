/**
 * Phase 2E-4B: Recovery HTTP Routes
 *
 * 将 Recovery Coordinator 和 State Sequence Validator 集成到 HTTP Server
 */
import { Router } from 'express';
import { RecoveryCoordinator } from '../ownership/recovery_coordinator.js';
import { StateSequenceValidator } from '../ownership/state_sequence.js';
// ==================== Route Handlers ====================
export function createRecoveryRoutes(redis, audit, instanceId) {
    const router = Router();
    // 初始化 Recovery State
    const state = {
        coordinator: new RecoveryCoordinator(redis, audit, {}, instanceId),
        validator: new StateSequenceValidator(audit),
        instanceId,
    };
    /**
     * POST /trading/recovery/session/start
     *
     * 启动 Recovery Session
     */
    router.post('/session/start', async (_req, res) => {
        try {
            const result = await state.coordinator.startSession();
            if (result.success) {
                res.status(201).json({
                    success: true,
                    data: {
                        session_id: result.session.session_id,
                        owner_id: result.session.owner_id,
                        expires_at: result.session.expires_at,
                        status: result.session.status,
                    },
                });
            }
            else {
                res.status(409).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: String(error),
            });
        }
    });
    /**
     * POST /trading/recovery/session/:id/renew
     *
     * 续期 Session
     */
    router.post('/session/:id/renew', async (req, res) => {
        try {
            const session_id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await state.coordinator.renewSession(session_id);
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        session_id: result.session.session_id,
                        expires_at: result.session.expires_at,
                        last_heartbeat: result.session.last_heartbeat,
                    },
                });
            }
            else {
                const status = result.error === 'SESSION_NOT_FOUND' ? 404 :
                    result.error === 'NOT_OWNER' ? 403 : 400;
                res.status(status).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: String(error),
            });
        }
    });
    /**
     * POST /trading/recovery/session/:id/complete
     *
     * 完成 Session
     */
    router.post('/session/:id/complete', async (req, res) => {
        try {
            const session_id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { require_all_items_complete = false } = req.body;
            const result = await state.coordinator.completeSession(session_id, { require_all_items_complete });
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        session_id: result.session.session_id,
                        status: result.session.status,
                        items_completed: result.session.items_completed,
                    },
                });
            }
            else {
                const status = result.error === 'SESSION_NOT_FOUND' ? 404 :
                    result.error === 'NOT_OWNER' ? 403 : 400;
                res.status(status).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: String(error),
            });
        }
    });
    /**
     * POST /trading/recovery/items/:id/claim
     *
     * 声明 Item 所有权
     */
    router.post('/items/:id/claim', async (req, res) => {
        try {
            const item_id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { session_id } = req.body;
            if (!session_id) {
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_SESSION_ID',
                    message: 'session_id is required',
                });
            }
            const result = await state.coordinator.claimItem(item_id, session_id);
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        item_id: result.item.item_id,
                        item_type: result.item.item_type,
                        status: result.item.status,
                        claimed_by: result.item.claimed_by,
                        claimed_at: result.item.claimed_at,
                        expires_at: result.item.expires_at,
                    },
                });
                return;
            }
            else {
                const status = result.error === 'ITEM_NOT_FOUND' ? 404 :
                    result.error === 'SESSION_INVALID' ? 400 :
                        result.error === 'ITEM_ALREADY_CLAIMED' ? 409 : 400;
                res.status(status).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: String(error),
            });
        }
    });
    /**
     * POST /trading/recovery/items/:id/complete
     *
     * 完成 Item 处理
     */
    router.post('/items/:id/complete', async (req, res) => {
        try {
            const item_id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { session_id, success: item_success, error: item_error } = req.body;
            if (!session_id) {
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_SESSION_ID',
                    message: 'session_id is required',
                });
            }
            const result = await state.coordinator.completeItem(item_id, session_id, { success: item_success !== false, error: item_error });
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        item_id: result.item.item_id,
                        status: result.item.status,
                        retry_count: result.item.retry_count,
                    },
                });
                return;
            }
            else {
                const status = result.error === 'ITEM_NOT_FOUND' ? 404 :
                    result.error === 'NOT_OWNER' ? 403 : 400;
                res.status(status).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: String(error),
            });
        }
    });
    /**
     * POST /trading/recovery/state/transition
     *
     * 执行状态迁移（带验证）
     */
    router.post('/state/transition', async (req, res) => {
        try {
            const { object_id, machine_id, new_state, expected_version } = req.body;
            if (!object_id || !machine_id || !new_state) {
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_FIELDS',
                    message: 'object_id, machine_id, and new_state are required',
                });
            }
            // 创建临时状态对象（实际应从存储加载）
            const stateObject = state.validator.createStateObject(object_id, machine_id);
            const result = await state.validator.transition(stateObject, new_state, expected_version);
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        object_id,
                        previous_state: result.previous_state,
                        new_state: result.new_state,
                        version: stateObject.version,
                    },
                });
            }
            else {
                const status = result.error === 'STATE_NOT_FOUND' ? 404 :
                    result.error === 'INVALID_TRANSITION' ? 400 :
                        result.error === 'TERMINAL_STATE' ? 409 : 409;
                res.status(status).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                    allowed_transitions: result.allowed_transitions,
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: String(error),
            });
        }
    });
    /**
     * GET /trading/recovery/state/machines
     *
     * 列出所有状态机定义
     */
    router.get('/state/machines', (_req, res) => {
        res.json({
            success: true,
            data: {
                approvals: {
                    initial: 'pending',
                    terminal: ['resolved'],
                    transitions: {
                        pending: ['approved', 'rejected'],
                        approved: ['resolved'],
                        rejected: ['resolved', 'pending'],
                        resolved: [],
                    },
                },
                incidents: {
                    initial: 'open',
                    terminal: ['resolved'],
                    transitions: {
                        open: ['acknowledged', 'resolved'],
                        acknowledged: ['resolving', 'resolved'],
                        resolving: ['resolved', 'open'],
                        resolved: [],
                    },
                },
                risk_state: {
                    initial: 'normal',
                    terminal: [],
                    transitions: {
                        normal: ['warning'],
                        warning: ['critical', 'normal'],
                        critical: ['recovery'],
                        recovery: ['normal', 'warning'],
                    },
                },
                deployments: {
                    initial: 'planned',
                    terminal: ['completed', 'rolled_back'],
                    transitions: {
                        planned: ['in_progress'],
                        in_progress: ['validating', 'rolled_back'],
                        validating: ['completed', 'rolled_back'],
                        completed: [],
                        rolled_back: ['planned'],
                    },
                },
            },
        });
    });
    return router;
}
//# sourceMappingURL=recovery_routes.js.map