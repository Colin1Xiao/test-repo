/**
 * Jenkins Connector
 * Phase 2B-3A - Jenkins API 连接器
 * 
 * 职责：
 * - 接收 Jenkins Webhook
 * - 调用 Jenkins API (rerun/cancel/approve input)
 */

import type {
  JenkinsEvent,
  JenkinsWebhookPayload,
  JenkinsPipelineWebhookPayload,
  JenkinsInputWebhookPayload,
  JenkinsBuildInfo,
  JenkinsJobInfo,
} from './jenkins_types';

// ============================================================================
// 配置
// ============================================================================

export interface JenkinsConnectorConfig {
  baseUrl: string;
  username?: string;
  token?: string;
  webhookSecret?: string;
  timeoutMs?: number;
}

// ============================================================================
// Connector 接口
// ============================================================================

export interface JenkinsConnector {
  handleWebhook(payload: any): Promise<JenkinsEvent[]>;
  getBuildInfo(jobName: string, buildNumber: number): Promise<JenkinsBuildInfo>;
  getJobInfo(jobName: string): Promise<JenkinsJobInfo>;
  rerunBuild(jobName: string, buildNumber: number): Promise<void>;
  cancelBuild(jobName: string, buildNumber: number): Promise<void>;
  approveInput(jobName: string, buildNumber: number, inputId: string): Promise<void>;
  rejectInput(jobName: string, buildNumber: number, inputId: string, reason?: string): Promise<void>;
}

// ============================================================================
// 实现
// ============================================================================

export class JenkinsConnectorImpl implements JenkinsConnector {
  private config: Required<JenkinsConnectorConfig>;

  constructor(config: JenkinsConnectorConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // 移除末尾斜杠
      username: config.username || '',
      token: config.token || '',
      webhookSecret: config.webhookSecret || '',
      timeoutMs: config.timeoutMs || 10000,
    };
  }

  /**
   * 处理 Webhook
   */
  async handleWebhook(payload: any): Promise<JenkinsEvent[]> {
    const events: JenkinsEvent[] = [];
    const now = Date.now();

    // 检测事件类型
    if (payload.job && payload.build) {
      // Build / Pipeline 事件
      const buildEvent = this.parseBuildEvent(payload, now);
      if (buildEvent) {
        events.push(buildEvent);
      }
    }

    if (payload.input && payload.build?.phase === 'PAUSED_PENDING_INPUT') {
      // Input Step 事件
      const inputEvent = this.parseInputEvent(payload, now);
      if (inputEvent) {
        events.push(inputEvent);
      }
    }

    if (payload.run?.stages) {
      // Pipeline Stage 事件
      const pipelineEvent = this.parsePipelineEvent(payload, now);
      if (pipelineEvent) {
        events.push(pipelineEvent);
      }
    }

    return events;
  }

  /**
   * 获取构建信息
   */
  async getBuildInfo(jobName: string, buildNumber: number): Promise<JenkinsBuildInfo> {
    const path = `/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`;
    return await this.apiGet<JenkinsBuildInfo>(path);
  }

  /**
   * 获取 Job 信息
   */
  async getJobInfo(jobName: string): Promise<JenkinsJobInfo> {
    const path = `/job/${encodeURIComponent(jobName)}/api/json`;
    return await this.apiGet<JenkinsJobInfo>(path);
  }

  /**
   * 重新构建
   */
  async rerunBuild(jobName: string, buildNumber: number): Promise<void> {
    const path = `/job/${encodeURIComponent(jobName)}/${buildNumber}/rebuild`;
    await this.apiPost(path);
  }

  /**
   * 取消构建
   */
  async cancelBuild(jobName: string, buildNumber: number): Promise<void> {
    const path = `/job/${encodeURIComponent(jobName)}/${buildNumber}/stop`;
    await this.apiPost(path);
  }

  /**
   * 批准 Input
   */
  async approveInput(
    jobName: string,
    buildNumber: number,
    inputId: string
  ): Promise<void> {
    const path = `/job/${encodeURIComponent(jobName)}/${buildNumber}/input/${inputId}/proceed`;
    await this.apiPost(path, {});
  }

  /**
   * 拒绝 Input
   */
  async rejectInput(
    jobName: string,
    buildNumber: number,
    inputId: string,
    reason?: string
  ): Promise<void> {
    const path = `/job/${encodeURIComponent(jobName)}/${buildNumber}/input/${inputId}/abort`;
    await this.apiPost(path);
  }

  // ============================================================================
  // 内部方法
  // ============================================================================

  /**
   * 解析 Build 事件
   */
  private parseBuildEvent(payload: JenkinsWebhookPayload, now: number): JenkinsEvent | null {
    const status = payload.build.status || payload.build.phase === 'STARTED' ? 'IN_PROGRESS' : 'FAILURE';

    let eventType: JenkinsEventType = 'build_completed';
    if (payload.build.phase === 'STARTED') {
      eventType = 'build_started';
    } else if (status === 'FAILURE') {
      eventType = 'build_failed';
    } else if (status === 'UNSTABLE') {
      eventType = 'build_unstable';
    } else if (status === 'ABORTED') {
      eventType = 'build_aborted';
    }

    return {
      type: eventType,
      timestamp: now,
      job: {
        name: payload.job.name,
        fullName: payload.job.fullName,
        url: payload.job.url,
      },
      build: {
        number: payload.build.number,
        status,
        duration: 0,
        timestamp: now,
      },
      sender: payload.user || { userId: 'unknown' },
    };
  }

  /**
   * 解析 Pipeline 事件
   */
  private parsePipelineEvent(payload: JenkinsPipelineWebhookPayload, now: number): JenkinsEvent | null {
    const status = payload.run.status;

    let eventType: JenkinsEventType = 'pipeline_completed';
    if (status === 'FAILURE') {
      eventType = 'pipeline_failed';
    } else if (status === 'IN_PROGRESS') {
      eventType = 'pipeline_started';
    }

    return {
      type: eventType,
      timestamp: now,
      job: {
        name: payload.job.name,
        fullName: payload.job.fullName,
        url: payload.job.url,
      },
      pipeline: {
        runId: payload.run.id,
        status,
        stages: payload.run.stages,
      },
      sender: { userId: 'unknown' },
    };
  }

  /**
   * 解析 Input 事件
   */
  private parseInputEvent(payload: JenkinsInputWebhookPayload, now: number): JenkinsEvent | null {
    return {
      type: 'input_pending',
      timestamp: now,
      job: {
        name: payload.job.name,
        fullName: payload.job.fullName,
        url: payload.job.url,
      },
      build: {
        number: payload.build.number,
        status: 'IN_PROGRESS',
        duration: 0,
        timestamp: now,
      },
      input: {
        id: payload.input.id,
        message: payload.input.message,
        submitter: payload.input.submitter,
        parameters: payload.input.parameters,
      },
      sender: { userId: payload.input.submitter || 'unknown' },
    };
  }

  /**
   * GET 请求
   */
  private async apiGet<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jenkins API Error: ${response.status} ${error}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Jenkins API Request Timeout');
      }

      throw error;
    }
  }

  /**
   * POST 请求
   */
  private async apiPost(path: string, data?: any): Promise<void> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jenkins API Error: ${response.status} ${error}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Jenkins API Request Timeout');
      }

      throw error;
    }
  }

  /**
   * 获取认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.config.username && this.config.token) {
      const credentials = btoa(`${this.config.username}:${this.config.token}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createJenkinsConnector(config: JenkinsConnectorConfig): JenkinsConnector {
  return new JenkinsConnectorImpl(config);
}
