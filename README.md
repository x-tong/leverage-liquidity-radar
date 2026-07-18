# LEV / LIQ

一个给个人使用的韩股、日股、美股杠杆与流动性观测终端。它的原则是先展示来源、频率和局限，再展示指标，不输出买卖建议或跨市场黑箱评分。

## 当前覆盖

| 市场 | 核心来源 | 更新方式 | 当前状态 |
| --- | --- | --- | --- |
| 美国 | FINRA Margin Statistics、FRED | GitHub Actions 自动刷新 | 已验证 |
| 日本 | JPX Outstanding Margin Trading by Issue | GitHub Actions 自动刷新 | 已验证 |
| 韩国 | KOFIA FreeSIS、KSD SEIBro、Naver Finance KRX 指数接口 | GitHub Actions 自动刷新 | 已验证 / 供应商行情 |

每个韩国 KOFIA 响应与日本 JPX XLS 都会以基准日和 SHA-256 前缀归档到 `data/raw/`。页面的审计抽屉显示完整哈希，并可直接打开已归档的原始快照。

## 指标原则

- 只在同一市场、同一口径内进行历史比较。
- 保证金、信用利差、央行资产和融资买卖余额并非同频数据，页面保留各自发布日期。
- JPX 文件以股数记录融资余额；其买卖比不代表市值，也不能与美国或韩国的金额型指标横向比较。
- 韩国使用 KOFIA 1998 年以来的日序列：投资者存管金、信用交易融资、信用供与、实际反对卖出金额及 KOFIA 公布的强平/未收额比例。R2 与 5 日强平金额各显示 10 年历史分位；不输出通用“爆仓阈值”。
- KOFIA 的历史强平比例为其公布字段；部分日期不等于两个展示金额相除，终端不自行反算或替换其定义。
- KOSPI 与 KOSDAQ 只作为杠杆读数的市场背景：当前接入 Naver Finance 转发的 KRX 收盘价与约一年周频样本，不将其标为 KRX 原始统计或可交易执行价。
- KSD SEIBro 目前提供杠杆/反向 ETF 的产品覆盖与分类，不含可复取的全市场净申赎额；终端不会将产品数量解释为资金流或实际杠杆敞口。
- JPX 仅公开当前 XLS；终端从接入当天开始保存每个交易日的文件，不会伪造回填历史。

## 数据更新

`Refresh market snapshots` 工作流在工作日定时运行：

1. 从 FINRA 页面读取最新月度保证金统计，并从 FRED 读取高收益利差和联储资产。
2. 下载 JPX 当日 XLS，按有完整买卖余额的标的聚合，并保留“股数而非市值”的口径。
3. 从 KOFIA FreeSIS 两条公开日序列读取 1998 年以来的市场资金、信用供与与实际反对卖出数据；先校验覆盖起点、日期、字段及非负数值，再归档完整原始响应并生成可视化所需序列。
4. 从 Naver Finance 的公开 KRX 指数接口读取 KOSPI/KOSDAQ 最新收盘价与约一年周频样本；响应单独归档，不能与 KOFIA 视为同一来源。
5. 从 KSD SEIBro ETF 产品页面读取产品类别和 3 个月收益列，归档原始页面并只发布杠杆/反向产品数量。
6. 只在 `src/generated/` 或 `data/raw/` 有变化时提交数据快照。失败时不会覆盖上一个有效快照，GitHub Actions 会失败并留下可审计日志。

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
