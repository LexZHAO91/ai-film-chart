import type { D1Database } from '@cloudflare/workers-types';

export interface AIUsageRecord {
  date: string;
  requests: number;
  estimatedTokens: number;
  neurons: number;
  taskType: string;
}

export class AIUsageService {
  private readonly DAILY_BUDGET = 10000; // neurons

  constructor(private db: D1Database) {}

  async recordUsage(usage: Omit<AIUsageRecord, 'date'>): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await this.db.prepare(`
      INSERT INTO ai_usage (date, requests, estimated_tokens, neurons, task_type)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date, task_type) DO UPDATE SET
        requests = requests + excluded.requests,
        estimated_tokens = estimated_tokens + excluded.estimated_tokens,
        neurons = neurons + excluded.neurons
    `).bind(today, usage.requests, usage.estimatedTokens, usage.neurons, usage.taskType).run();
  }

  async getTodayUsage(): Promise<{ totalNeurons: number; totalRequests: number }> {
    const today = new Date().toISOString().split('T')[0];

    const { results } = await this.db.prepare(`
      SELECT SUM(neurons) as total_neurons, SUM(requests) as total_requests
      FROM ai_usage
      WHERE date = ?
    `).bind(today).all<{ total_neurons: number; total_requests: number }>();

    const result = results?.[0];
    return {
      totalNeurons: result?.total_neurons || 0,
      totalRequests: result?.total_requests || 0,
    };
  }

  async getUsagePercentage(): Promise<number> {
    const { totalNeurons } = await this.getTodayUsage();
    return (totalNeurons / this.DAILY_BUDGET) * 100;
  }

  async shouldProcessTask(priority: 'high' | 'medium' | 'low'): Promise<boolean> {
    const percentage = await this.getUsagePercentage();

    if (percentage < 70) return true;
    if (percentage < 90) return priority === 'high' || priority === 'medium';
    if (percentage < 95) return priority === 'high';
    return false;
  }

  async getBudgetStatus(): Promise<{
    percentage: number;
    totalNeurons: number;
    budget: number;
    status: 'normal' | 'warning' | 'critical' | 'stopped';
  }> {
    const { totalNeurons } = await this.getTodayUsage();
    const percentage = (totalNeurons / this.DAILY_BUDGET) * 100;

    let status: 'normal' | 'warning' | 'critical' | 'stopped' = 'normal';
    if (percentage >= 95) status = 'stopped';
    else if (percentage >= 90) status = 'critical';
    else if (percentage >= 70) status = 'warning';

    return {
      percentage,
      totalNeurons,
      budget: this.DAILY_BUDGET,
      status,
    };
  }
}
