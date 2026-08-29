# Admin CRUD API 文档

轻量级后台管理 API，支持作品信息、Watch Source、评分的增删改查。所有变更自动触发重算（Golden Dataset、Ranking Readiness）。

---

## 基础信息

- **Base URL**: `https://ai-film-chart-api.906402759lex.workers.dev` (生产) / `http://localhost:8787` (本地)
- **Content-Type**: `application/json`

---

## 作品管理

### 1. 获取所有作品列表

```
GET /api/admin/works
```

**响应示例**:
```json
{
  "success": true,
  "works": [
    {
      "id": 57,
      "canonical_title": "Total Pixel Space",
      "creator_name": "Jacob Adler",
      "eligibility_status": "approved",
      "review_origin": "SYNTHETIC_TEST",
      "human_quality_rating": 4,
      "validation_eligible": 0,
      "watch_sources": [
        {
          "id": 1,
          "url": "https://www.youtube.com/watch?v=JANjV6Sg5TM",
          "source_role": "WATCH",
          "watch_status": "ACTIVE"
        }
      ]
    }
  ]
}
```

---

### 2. 修改作品信息

```
PUT /api/admin/works/{workId}
```

**请求体**:
```json
{
  "canonical_title": "新标题",
  "creator_name": "新创作者",
  "synopsis": "新简介",
  "type": "SHORT_FILM",
  "original_language": "English",
  "country": "United States",
  "release_year": 2026,
  "duration_seconds": 300,
  "admin_id": "admin"
}
```

**说明**: 只传需要修改的字段，未传的字段保持不变。

**响应示例**:
```json
{
  "success": true,
  "message": "Work updated successfully"
}
```

---

### 3. 软删除作品（下架）

```
DELETE /api/admin/works/{workId}
```

**请求体**:
```json
{
  "admin_id": "admin",
  "reason": "重复作品 / 版权争议 / 其他原因"
}
```

**效果**:
- `eligibility_status` 变为 `removed`
- 自动从 Golden Dataset 中移除
- 自动从 Ranking 中移除
- 保留历史数据，可恢复

**响应示例**:
```json
{
  "success": true,
  "message": "Work soft deleted. Removed from rankings.",
  "recalculated": {
    "goldenDatasetUpdated": true,
    "rankingReadinessUpdated": true
  }
}
```

---

### 4. 恢复已删除作品

```
POST /api/admin/works/{workId}/restore
```

**请求体**:
```json
{
  "admin_id": "admin"
}
```

**效果**:
- `eligibility_status` 恢复为 `approved`
- 自动重新计算 Golden Dataset 资格

---

## Watch Source 管理

### 5. 添加 Watch Source

```
POST /api/admin/watch-sources
```

**请求体**:
```json
{
  "work_id": 57,
  "source_type": "YOUTUBE",
  "url": "https://www.youtube.com/watch?v=JANjV6Sg5TM",
  "source_role": "WATCH",
  "source_priority": "OFFICIAL",
  "watch_status": "ACTIVE",
  "discovered_from": "Runway screening room redirect",
  "check_result": "VERIFIED_REDIRECT",
  "admin_id": "admin"
}
```

**字段说明**:
| 字段 | 必填 | 说明 |
|------|------|------|
| work_id | ✅ | 作品 ID |
| source_type | ✅ | 类型: YOUTUBE / VIMEO / RUNWAY / OFFICIAL / OTHER |
| url | ✅ | 链接地址 |
| source_role | ❌ | WATCH / METADATA / RECOGNITION，默认 WATCH |
| source_priority | ❌ | OFFICIAL / CREATOR / VIMEO / YOUTUBE / FESTIVAL / OTHER |
| watch_status | ❌ | ACTIVE / PENDING / BROKEN，默认 ACTIVE |
| discovered_from | ❌ | 来源说明 |
| check_result | ❌ | 验证结果 |

**效果**: 如果 `source_role = WATCH`，自动触发 Golden Dataset 重算。

---

### 6. 修改 Watch Source

```
PUT /api/admin/watch-sources/{sourceId}
```

**请求体**:
```json
{
  "url": "https://www.youtube.com/watch?v=NEW_ID",
  "watch_status": "BROKEN",
  "check_result": "LINK_DEAD",
  "admin_id": "admin"
}
```

**说明**: 只传需要修改的字段。

---

### 7. 删除 Watch Source

```
DELETE /api/admin/watch-sources/{sourceId}
```

**请求体**:
```json
{
  "admin_id": "admin"
}
```

**效果**: 自动触发 Golden Dataset 重算（如果删除的是唯一的 WATCH source，该作品会从 Golden Dataset 中移除）。

---

## 评分管理

### 8. 修改/提交评分

```
PUT /api/admin/works/{workId}/review
```

**请求体**:
```json
{
  "human_quality_rating": 5,
  "human_classification": "KEEP",
  "review_notes": "Excellent work, strong emotional impact",
  "reviewer_id": "admin",
  "review_origin": "HUMAN",
  "admin_id": "admin"
}
```

**字段说明**:
| 字段 | 必填 | 说明 |
|------|------|------|
| human_quality_rating | ❌ | 1-5 分 |
| human_classification | ❌ | KEEP / REVIEW / REJECT |
| review_notes | ❌ | 评语 |
| reviewer_id | ❌ | 评分人 ID |
| review_origin | ❌ | HUMAN / SYNTHETIC_TEST / IMPORTED / UNKNOWN |

**效果**:
- 更新作品评分
- 如果 `review_origin = HUMAN`，同时写入 `human_baseline_rankings` 表
- 自动触发 Golden Dataset 重算

---

### 9. 清除评分

```
DELETE /api/admin/works/{workId}/review
```

**请求体**:
```json
{
  "admin_id": "admin"
}
```

**效果**:
- 清空 `human_quality_rating`、`human_classification`、`review_notes` 等字段
- `review_origin` 重置为 `UNKNOWN`
- 自动从 Golden Dataset 中移除

---

## 审计日志

### 10. 查看作品操作日志

```
GET /api/admin/works/{workId}/audit-log
```

**响应示例**:
```json
{
  "success": true,
  "logs": [
    {
      "id": 1,
      "admin_id": "admin",
      "action": "UPDATE_WATCH_SOURCE",
      "entity_type": "watch_source",
      "old_value": "{\"url\": \"old-link\"}",
      "new_value": "{\"url\": \"new-link\"}",
      "created_at": "2026-08-28 22:00:00"
    }
  ]
}
```

---

## 自动重算机制

所有以下操作都会**自动触发**重算：

| 操作 | 重算内容 |
|------|----------|
| 修改 Watch Source | Golden Dataset、Ranking Readiness |
| 添加 Watch Source | Golden Dataset、Ranking Readiness |
| 删除 Watch Source | Golden Dataset、Ranking Readiness |
| 修改评分 | Golden Dataset、Ranking Readiness |
| 清除评分 | Golden Dataset、Ranking Readiness |
| 软删除作品 | Golden Dataset、Ranking Readiness |
| 恢复作品 | Golden Dataset、Ranking Readiness |

**重算逻辑**:
1. 检查作品是否满足 Golden Dataset 条件:
   - `authenticity_status = VERIFIED`
   - 至少一个 `source_role = WATCH` 的 watch source
   - `human_quality_rating IS NOT NULL`
   - `review_origin = HUMAN`
2. 更新 `validation_eligible` 字段
3. 更新 Ranking Readiness 状态

---

## 前端 Admin 页面设计建议

### 页面结构

```
Admin Page
├── Dashboard (数据面板)
├── Works (作品管理) ⭐ 新增
│   ├── 作品列表 (表格展示)
│   │   ├── 搜索/筛选
│   │   ├── 编辑按钮 → 弹出编辑表单
│   │   ├── Watch Sources 列 (显示链接数)
│   │   └── 操作: 编辑 / 下架 / 查看日志
│   ├── 编辑作品 (表单)
│   │   ├── 基本信息: 标题、创作者、简介、类型
│   │   ├── 元数据: 语言、国家、年份、时长
│   │   └── 保存 / 取消
│   └── Watch Source 管理
│       ├── 当前链接列表
│       ├── 添加链接 (表单)
│       ├── 编辑链接
│       └── 删除链接
├── Review Queue (评分队列) ⭐ 已有
│   └── 作品列表 → 评分按钮 → 提交评分
├── Candidates (候选作品)
├── Jobs (任务队列)
└── Audit Log (审计日志) ⭐ 新增
    └── 按作品筛选操作记录
```

### 组件建议

1. **WorksTable**: 可排序、可筛选的作品表格
2. **WorkEditModal**: 编辑作品的弹窗表单
3. **WatchSourceList**: 管理单个作品的 watch sources
4. **ReviewForm**: 评分表单（Blind Mode）
5. **AuditLogViewer**: 审计日志查看器

---

## 快速测试脚本

```bash
# 1. 获取作品列表
curl http://localhost:8787/api/admin/works

# 2. 修改作品信息
curl -X PUT http://localhost:8787/api/admin/works/57 \
  -H "Content-Type: application/json" \
  -d '{"synopsis": "新简介", "admin_id": "admin"}'

# 3. 添加 YouTube 链接
curl -X POST http://localhost:8787/api/admin/watch-sources \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": 60,
    "source_type": "YOUTUBE",
    "url": "https://www.youtube.com/watch?v=xxxx",
    "source_role": "WATCH",
    "admin_id": "admin"
  }'

# 4. 提交真实评分
curl -X PUT http://localhost:8787/api/admin/works/57/review \
  -H "Content-Type: application/json" \
  -d '{
    "human_quality_rating": 5,
    "human_classification": "KEEP",
    "review_origin": "HUMAN",
    "admin_id": "admin"
  }'

# 5. 软删除作品
curl -X DELETE http://localhost:8787/api/admin/works/32 \
  -H "Content-Type: application/json" \
  -d '{"reason": "重复作品", "admin_id": "admin"}'

# 6. 恢复作品
curl -X POST http://localhost:8787/api/admin/works/32/restore \
  -H "Content-Type: application/json" \
  -d '{"admin_id": "admin"}'

# 7. 查看审计日志
curl http://localhost:8787/api/admin/works/57/audit-log
```

---

## 数据安全原则

1. **永不硬删除**: 作品使用软删除（`eligibility_status = removed`）
2. **全量审计**: 所有变更记录到 `admin_audit_log` 表
3. **自动重算**: 数据变更后自动更新下游数据（Golden Dataset、Ranking）
4. ** review_origin 隔离**: SYNTHETIC_TEST 评分永不进入 Golden Dataset
