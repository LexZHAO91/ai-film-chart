/**
 * Manual Ranking Audit Template
 *
 * Phase 12: 在真实数据跑通以后，人工检查 TOP 10 / TOP 20 / TOP 50
 *
 * 使用说明：
 * 1. 先运行完整的 E2E Pipeline（Seed Mock Data → Metrics → AI → Ranking）
 * 2. 从 Admin 页面或 API 获取最新的 TOP 100 Snapshot
 * 3. 人工观看每部作品，根据以下标准评分：
 *    - Excellent: 真正的 AI Film，制作精良，故事完整
 *    - Good: AI Film，质量尚可，有亮点
 *    - Average: 勉强算 AI Film，质量一般
 *    - Bad: 不太像 AI Film，或者质量很差
 *    - Wrong Category: 根本不是 AI Film（教程、评测、新闻等）
 * 4. 记录 precision@10, precision@20, precision@50
 *
 * precision = (Excellent + Good) / 总数
 */

export type AuditRating = 'Excellent' | 'Good' | 'Average' | 'Bad' | 'Wrong Category';

export interface AuditEntry {
  rank: number;
  filmId: number;
  title: string;
  rating: AuditRating;
  notes?: string;
}

export interface AuditReport {
  auditor: string;
  date: string;
  snapshotId: number;
  top10: AuditEntry[];
  top20: AuditEntry[];
  top50: AuditEntry[];
  precision: {
    at10: number;
    at20: number;
    at50: number;
  };
  summary: string;
}

function calculatePrecision(entries: AuditEntry[]): number {
  const goodOnes = entries.filter(e => e.rating === 'Excellent' || e.rating === 'Good');
  return entries.length > 0 ? goodOnes.length / entries.length : 0;
}

export function generateAuditReport(report: AuditReport): string {
  let output = '\n' + '='.repeat(80) + '\n';
  output += 'MANUAL RANKING AUDIT REPORT\n';
  output += '='.repeat(80) + '\n\n';
  output += `Auditor: ${report.auditor}\n`;
  output += `Date: ${report.date}\n`;
  output += `Snapshot ID: ${report.snapshotId}\n\n`;

  output += 'PRECISION METRICS\n';
  output += '-'.repeat(40) + '\n';
  output += `precision@10:  ${(report.precision.at10 * 100).toFixed(1)}%\n`;
  output += `precision@20:  ${(report.precision.at20 * 100).toFixed(1)}%\n`;
  output += `precision@50:  ${(report.precision.at50 * 100).toFixed(1)}%\n\n`;

  const sections = [
    { label: 'TOP 10', entries: report.top10 },
    { label: 'TOP 20 (11-20)', entries: report.top20 },
    { label: 'TOP 50 (21-50)', entries: report.top50 },
  ];

  for (const section of sections) {
    output += `${section.label}\n`;
    output += '-'.repeat(40) + '\n';
    for (const entry of section.entries) {
      const emoji = {
        'Excellent': '⭐',
        'Good': '✅',
        'Average': '⚠️',
        'Bad': '❌',
        'Wrong Category': '🚫',
      }[entry.rating];

      output += `  ${emoji} #${entry.rank} [${entry.rating}] ${entry.title}\n`;
      if (entry.notes) {
        output += `     Notes: ${entry.notes}\n`;
      }
    }
    output += '\n';
  }

  output += 'SUMMARY\n';
  output += '-'.repeat(40) + '\n';
  output += `${report.summary}\n\n`;
  output += '='.repeat(80) + '\n';

  return output;
}

// Example usage (for documentation):
/*
const exampleReport: AuditReport = {
  auditor: 'Human Reviewer',
  date: '2024-01-15',
  snapshotId: 42,
  top10: [
    { rank: 1, filmId: 1, title: 'The Last Artist', rating: 'Excellent', notes: 'Beautiful AI-generated short' },
    { rank: 2, filmId: 2, title: 'Echoes of Tomorrow', rating: 'Good' },
    // ... more entries
  ],
  top20: [
    // ... entries for ranks 11-20
  ],
  top50: [
    // ... entries for ranks 21-50
  ],
  precision: {
    at10: 0.8,
    at20: 0.75,
    at50: 0.6,
  },
  summary: 'Overall quality is good. Most top-ranked films are genuine AI films. Some lower-ranked entries show signs of bought views.',
};

console.log(generateAuditReport(exampleReport));
*/

export { calculatePrecision };
