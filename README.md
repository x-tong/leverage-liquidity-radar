# LEV / LIQ

一个给个人使用的韩股、日股、美股杠杆与流动性观测终端。它的原则是先展示来源、频率和局限，再展示指标，不输出买卖建议或跨市场黑箱评分。

## 当前覆盖

| 市场 | 核心来源 | 更新方式 | 当前状态 |
| --- | --- | --- | --- |
| 美国 | FINRA Margin Statistics、FRED | GitHub Actions 自动刷新 | 已验证 |
| 日本 | JPX Outstanding Margin Trading by Issue | GitHub Actions 自动刷新 | 已验证 |
| 韩国 | KOFIA FreeSIS | GitHub Actions 自动刷新 | 已验证 |

每个韩国 KOFIA 响应与日本 JPX XLS 都会以基准日和 SHA-256 前缀归档到 `data/raw/`。页面的审计抽屉显示完整哈希，并可直接打开已归档的原始快照。

## 指标原则

- 只在同一市场、同一口径内进行历史比较。
- 保证金、信用利差、央行资产和融资买卖余额并非同频数据，页面保留各自发布日期。
- JPX 文件以股数记录融资余额；其买卖比不代表市值，也不能与美国或韩国的金额型指标横向比较。
- 韩国使用 KOFIA 公开响应中的投资者存管金、信用交易融资、信用供与合计和委托交易未收额。它们不是强平统计，也不能推出通用的“爆仓阈值”。
- JPX 仅公开当前 XLS；终端从接入当天开始保存每个交易日的文件，不会伪造回填历史。

## 数据更新

`Refresh market snapshots` 工作流在工作日定时运行：

1. 从 FINRA 页面读取最新月度保证金统计，并从 FRED 读取高收益利差和联储资产。
2. 下载 JPX 当日 XLS，按有完整买卖余额的标的聚合，并保留“股数而非市值”的口径。
3. 从 KOFIA FreeSIS 的公开 JSON 响应读取最近 15 个交易日的市场资金与信用供与余额；先校验成功状态、日期、字段与非负数值，再归档原始响应。
4. 只在 `src/generated/` 或 `data/raw/` 有变化时提交数据快照。失败时不会覆盖上一个有效快照，GitHub Actions 会失败并留下可审计日志。

本地执行：

```bash
npm install
npm run dev
npm run build
npm run refresh:us
python -m pip install xlrd==2.0.2
npm run refresh:jp
npm run refresh:kr
```

## GitHub Pages

推送到 `main` 后，`Deploy GitHub Pages` 工作流构建并部署 `dist/`。Vite 使用相对资源路径，因此项目 Pages 和自定义子路径都可以正常加载。
