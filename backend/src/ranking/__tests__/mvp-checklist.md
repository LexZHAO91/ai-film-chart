# MVP v0.1 完成标准检查清单

## Phase 1: Mock E2E 跑通
- [x] Seed Mock Data API (`POST /api/admin/seed-mock-data`)
- [x] Metrics 生成（每个 mock film 有多条历史 metrics）
- [x] AI Analysis 生成（mock AI analysis 数据）
- [x] Ranking 计算（`POST /api/admin/run-ranking`）
- [x] TOP 100 Snapshot 生成
- [x] RISING 50 Snapshot 生成（按 momentum 排序）
- [x] NEW 50 Snapshot 生成（按 created_at 排序）
- [x] Film Detail API (`GET /api/films/:id`)
- [x] Admin Dashboard 可查看 pipeline 状态

## Phase 2: Ranking Engine Validation
- [x] 13 个自动化测试全部通过
- [x] 测试报告生成脚本 (`ranking-report.ts`)
- [x] 覆盖 10 种典型场景：
  - 高播放 + 高评分
  - 高播放 + 低评分
  - 低播放 + 高评分
  - 新作品高速增长
  - 老作品长期稳定
  - 极少评分样本
  - 高点赞率
  - 高评论率
  - 高播放但明显低质量
  - 小众但高质量

## Phase 3: Discovery Score
- [x] DiscoveryScoreService 独立模块
- [x] 评分维度：popularity, engagement, freshness, growth
- [x] 基础阈值过滤（MIN_VIEWS, MIN_DURATION, MAX_DURATION）
- [x] 不与最终 AI Cinema Score 混淆

## Phase 4: Candidate Pipeline
- [x] 完整 Pipeline 实现：Search → Deduplication → Discovery Score → Rule Filter
- [x] 支持 batch 处理
- [x] 支持 cursor（通过 pageToken）
- [x] 支持 retry（withRetry 工具）
- [x] 单条失败不阻塞 batch
- [x] source_video_id 唯一性检查
- [x] 记录 reject_reason

## Phase 5: AI Analysis Validation
- [x] CloudflareWorkersAIClassifier 支持 Workers AI binding 优先
- [x] 所有模型输出严格 JSON
- [x] System prompt 禁止 reasoning
- [x] 控制 input 长度（title 200, description 800）
- [x] 控制 output 长度（max_tokens 512）
- [x] 保存 model_name
- [x] 保存 model_version
- [x] 保存 prompt_version
- [x] AI 失败时 retry（最多 2 次）
- [x] JSON 非法时只允许一次 repair
- [x] AI 只负责分类，不直接决定排名

## Phase 6: Metric History
- [x] film_metrics 保存每次抓取的历史数据
- [x] 不覆盖旧数据
- [x] 支持计算：24h/48h/7d/14d growth
- [x] 支持计算：absolute growth, growth rate, growth acceleration
- [x] Momentum 小样本保护（baseViews < 100 或 < 1000 时 cap growth）
- [x] Data confidence 计算

## Phase 7: Ranking Engine v0.1
- [x] 权重参数化：Popularity 35%, Momentum 25%, Engagement 15%, Audience 15%, Quality 10%
- [x] 所有参数从 ranking_configs 读取
- [x] data_confidence 保存（用于调试，不直接加入权重）
- [x] Quality 只占辅助权重

## Phase 8: Ranking Lifecycle
- [x] Quality 长期稳定（基于 story_completeness + ai_generation_level）
- [x] Popularity 长期影响（基于 views log-normalization）
- [x] Momentum 短期动态（基于 growth metrics）
- [x] 热度下降不意味着 Quality 下降

## Phase 9: NEW 定义
- [x] NEW = 本期第一次进入 Candidate Pool 的作品
- [x] 不按 YouTube 发布日期判断
- [x] 老作品但本期首次进入系统也显示 NEW

## Phase 10: Admin Override
- [x] exclude: 管理员排除作品（不删除数据）
- [x] restore: 恢复被排除的作品
- [x] reject: 拒绝候选作品
- [x] approve: 批准候选作品
- [x] 保存 reason, operator, timestamp
- [x] Admin Audit Log 模型和 API

## Phase 11: Real YouTube Test
- [x] 只接入 YouTube（暂时不接 TikTok/Vimeo/Instagram）
- [x] AI relevance pre-filter（标题/描述匹配 AI 相关关键词）
- [x] 每周目标 20-30 个候选
- [x] 质量优先，不强制凑够 100
- [x] 更具体的搜索 queries

## Phase 12: Manual Ranking Audit
- [x] 人工审核模板 (`manual-audit-template.ts`)
- [x] 评分标准：Excellent / Good / Average / Bad / Wrong Category
- [x] precision@10 / precision@20 / precision@50 计算
- [x] 报告生成格式

## Phase 13: 完成标准
- [x] Mock E2E 跑通
- [x] Ranking 自动测试通过
- [x] YouTube 数据能够进入系统
- [x] AI 自动完成分类
- [x] Metrics 历史快照正常
- [x] Ranking 自动生成
- [x] Snapshot 正常（TOP 100 / RISING 50 / NEW 50）
- [x] 网站正常展示
- [x] Admin 可以查看 pipeline 状态
- [x] 整个任务可以失败后断点继续（Job 系统支持 cursor 和状态追踪）
- [x] AI quota 不会失控（AIUsageService 预算控制）
- [ ] 至少有一批真实 AI Films 成功进入榜单（需要部署后验证）

## 已知限制 / 待部署后验证
1. 真实 YouTube API 调用需要有效 API Key
2. Cloudflare Workers AI binding 需要在 wrangler.jsonc 中配置
3. D1 数据库需要创建并应用 migrations
4. 真实 AI 分类效果需要人工审核验证
5. Ranking 参数可能需要根据真实数据调优

## 部署检查清单
- [ ] 创建 Cloudflare D1 数据库
- [ ] 应用 schema migrations
- [ ] 配置 wrangler.jsonc（database_id, crons）
- [ ] 设置 secrets（YOUTUBE_API_KEY, ADMIN_SECRET）
- [ ] 部署 backend（wrangler deploy）
- [ ] 部署 frontend（Cloudflare Pages 或 Vercel）
- [ ] 验证 Admin 页面可访问
- [ ] 运行一次完整的 Mock E2E 流程
- [ ] 配置 Cron trigger（每周运行一次 pipeline）
