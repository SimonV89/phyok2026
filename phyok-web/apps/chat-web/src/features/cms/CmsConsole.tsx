"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OverviewData = {
  totalUsers: number;
  paidUsers: number;
  complaintCount: number;
  auditEventCount: number;
};

type BillingOverviewData = {
  plan?: string;
  quotaState?: string;
  scene?: string;
};

type PaymentPreviewData = {
  orderNo: string;
  productCode: string;
  amountFen: number;
  currency: string;
};

type AuditItem = {
  id: string;
  userId: string;
  eventType: string;
  sourceService: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  payloadJson?: string;
};

type AuditPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: AuditItem[];
};

type UserItem = {
  userId: string;
  tenantId: string;
  appId: string;
  email: string | null;
  displayName: string | null;
  status: string;
  registerSource: string | null;
  deleted: boolean;
  version: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
  latestSessionExpiresAt: string | null;
};

type UserPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: UserItem[];
};

type PaymentOrderItem = {
  orderNo: string;
  userEmail: string | null;
  planId: string;
  subject: string;
  amountFen: number;
  quota: number;
  status: string;
  paymentChannel: string;
  paymentMode: string;
  tradeNo: string | null;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
};

type PaymentOrderPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: PaymentOrderItem[];
};

type ComplaintItem = {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  contactEmail?: string | null;
  conversationId?: string | null;
  category: string;
  content: string;
  status: string;
  replyContent?: string | null;
  replyBy?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComplaintPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: ComplaintItem[];
};

type DashboardResponse = {
  session: {
    username: string;
    expiresAt: number;
  };
  generatedAt: string;
  overview: OverviewData;
  billing: BillingOverviewData | null;
  paymentPreview: PaymentPreviewData | null;
  userPage: UserPage;
  paymentOrderPage: PaymentOrderPage;
  auditPage: AuditPage;
  complaintQueue: ComplaintPage;
  errors: string[];
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatTime(value?: string | null): string {
  if (!value) {
    return "暂无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatAmountFen(value: number): string {
  return (value / 100).toFixed(2);
}

function formatComplaintCategory(category: string): string {
  switch (category) {
    case "product":
      return "产品问题";
    case "payment":
      return "支付问题";
    case "privacy":
      return "隐私与数据";
    case "experience":
      return "体验建议";
    default:
      return "其他";
  }
}

function formatComplaintStatus(status: string): string {
  return status === "REPLIED" ? "已回复" : "待回复";
}

export function CmsConsole(props: {
  authenticated: boolean;
  configured: boolean;
  initialUsername?: string | null;
}) {
  const [authenticated, setAuthenticated] = useState(props.authenticated);
  const [username, setUsername] = useState(props.initialUsername || "");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPageNo, setUserPageNo] = useState(1);
  const [orderPageNo, setOrderPageNo] = useState(1);
  const [auditPageNo, setAuditPageNo] = useState(1);
  const [complaintPageNo, setComplaintPageNo] = useState(1);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [complaintReplyDraft, setComplaintReplyDraft] = useState("");
  const [complaintActionMessage, setComplaintActionMessage] = useState<string | null>(null);
  const [replyPending, setReplyPending] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!authenticated) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/cms/api/dashboard?userPageNo=${userPageNo}&orderPageNo=${orderPageNo}&auditPageNo=${auditPageNo}&complaintPageNo=${complaintPageNo}&userPageSize=8&orderPageSize=8&auditPageSize=8&complaintPageSize=8`,
        {
          method: "GET",
          cache: "no-store"
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { code: string; message: string; data?: DashboardResponse }
        | null;
      if (!response.ok || !payload || payload.code !== "OK" || !payload.data) {
        throw new Error(payload?.message || "CMS 数据加载失败。");
      }
      setDashboard(payload.data);
      setUsername(payload.data.session.username);
    } catch (fetchError) {
      setDashboard(null);
      setError(fetchError instanceof Error ? fetchError.message : "CMS 数据加载失败。");
    } finally {
      setLoading(false);
    }
  }, [authenticated, auditPageNo, complaintPageNo, orderPageNo, userPageNo]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleLogin = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoginPending(true);
      setLoginError(null);
      try {
        const response = await fetch("/cms/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: loginName,
            password
          })
        });
        const payload = (await response.json().catch(() => null)) as { message?: string; data?: { username?: string } } | null;
        if (!response.ok) {
          throw new Error(payload?.message || "CMS 登录失败。");
        }
        setAuthenticated(true);
        setUsername(payload?.data?.username || loginName);
        setPassword("");
        await loadDashboard();
      } catch (loginErrorValue) {
        setLoginError(loginErrorValue instanceof Error ? loginErrorValue.message : "CMS 登录失败。");
      } finally {
        setLoginPending(false);
      }
    },
    [loadDashboard, loginName, password]
  );

  const handleLogout = useCallback(async () => {
    await fetch("/cms/api/logout", {
      method: "POST"
    }).catch(() => null);
    setAuthenticated(false);
    setDashboard(null);
    setUsername("");
    setUserPageNo(1);
    setOrderPageNo(1);
    setAuditPageNo(1);
    setComplaintPageNo(1);
    setSelectedComplaintId(null);
    setComplaintReplyDraft("");
    setComplaintActionMessage(null);
  }, []);

  const selectedComplaint = useMemo(() => {
    const items = dashboard?.complaintQueue.items || [];
    if (items.length === 0) {
      return null;
    }
    return items.find((item) => item.id === selectedComplaintId) || items[0];
  }, [dashboard?.complaintQueue.items, selectedComplaintId]);

  useEffect(() => {
    const items = dashboard?.complaintQueue.items || [];
    if (items.length === 0) {
      setSelectedComplaintId(null);
      return;
    }
    if (!selectedComplaintId || !items.some((item) => item.id === selectedComplaintId)) {
      setSelectedComplaintId(items[0].id);
    }
  }, [dashboard?.complaintQueue.items, selectedComplaintId]);

  useEffect(() => {
    setComplaintReplyDraft(selectedComplaint?.replyContent || "");
    setComplaintActionMessage(null);
  }, [selectedComplaint?.id, selectedComplaint?.replyContent]);

  const handleReplyComplaint = useCallback(async () => {
    if (!selectedComplaint) {
      return;
    }
    setReplyPending(true);
    setComplaintActionMessage(null);
    try {
      const response = await fetch(`/cms/api/complaints/${selectedComplaint.id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          replyContent: complaintReplyDraft
        })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message || "回复失败。");
      }
      setComplaintActionMessage("回复已保存，用户将在后续联络中看到处理结果。");
      await loadDashboard();
    } catch (replyError) {
      setComplaintActionMessage(replyError instanceof Error ? replyError.message : "回复失败。");
    } finally {
      setReplyPending(false);
    }
  }, [complaintReplyDraft, loadDashboard, selectedComplaint]);

  const metricCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    return [
      {
        label: "用户总量",
        value: formatCount(dashboard.overview.totalUsers),
        note: "来自 admin overview"
      },
      {
        label: "付费用户",
        value: formatCount(dashboard.overview.paidUsers),
        note: dashboard.billing?.plan ? `当前计费场景：${dashboard.billing.plan}` : "付费状态汇总"
      },
      {
        label: "投诉指标",
        value: formatCount(dashboard.overview.complaintCount),
        note: "当前以投诉/合规队列口径展示"
      },
      {
        label: "审计事件",
        value: formatCount(dashboard.overview.auditEventCount),
        note: dashboard.billing?.quotaState ? `额度状态：${dashboard.billing.quotaState}` : "审计系统总量"
      }
    ];
  }, [dashboard]);

  if (!props.configured) {
    return (
      <main className="cms-root">
        <section className="cms-empty">
          <div className="cms-auth-card">
            <div className="cms-auth-kicker">CMS 未配置</div>
            <h1>请先配置 CMS 管理员账号</h1>
            <p>
              需要在运行环境中设置 `CMS_ADMIN_USERNAME`、`CMS_ADMIN_PASSWORD`，建议同时设置 `CMS_AUTH_SECRET`。
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="cms-root">
        <section className="cms-empty">
          <form className="cms-auth-card" onSubmit={handleLogin}>
            <div className="cms-auth-kicker">PhyOK CMS</div>
            <h1>运营后台</h1>
            <p>查看用户、付费、投诉、审计等核心指标，并进入分页查询工作台。</p>
            <label className="cms-field">
              <span>用户名</span>
              <input value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="请输入 CMS 用户名" />
            </label>
            <label className="cms-field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入 CMS 密码"
              />
            </label>
            {loginError ? <div className="cms-login-error">{loginError}</div> : null}
            <button className="cms-primary-button" type="submit" disabled={loginPending}>
              {loginPending ? "正在登录..." : "进入 CMS"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="cms-root">
      <section className="cms-shell">
        <header className="cms-header">
          <div>
            <div className="cms-auth-kicker">PhyOK CMS</div>
            <h1>运营工作台</h1>
            <p>用于查看用户、付费、投诉/合规、审计的核心指标与分页结果。</p>
          </div>
          <div className="cms-header-actions">
            <div className="cms-operator-badge">
              <strong>{username || "CMS Admin"}</strong>
              <span>{dashboard ? `更新于 ${formatTime(dashboard.generatedAt)}` : "等待数据"}</span>
            </div>
            <button className="cms-secondary-button" type="button" onClick={() => void loadDashboard()} disabled={loading}>
              刷新
            </button>
            <button className="cms-ghost-button" type="button" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        {error ? <div className="cms-status-banner error">{error}</div> : null}
        {dashboard?.errors.length ? (
          <div className="cms-status-banner warning">部分数据源暂时不可用：{dashboard.errors.join("；")}</div>
        ) : null}

        <section className="cms-metric-grid">
          {metricCards.map((card) => (
            <article key={card.label} className="cms-metric-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.note}</p>
            </article>
          ))}
        </section>

        <section className="cms-panel-grid">
          <article className="cms-panel">
            <div className="cms-panel-head">
              <div>
                <span className="cms-panel-kicker">计费运行态</span>
                <h2>付费摘要</h2>
              </div>
            </div>
            <div className="cms-inline-stats">
              <div>
                <span>当前 plan</span>
                <strong>{dashboard?.billing?.plan || "暂无"}</strong>
              </div>
              <div>
                <span>额度状态</span>
                <strong>{dashboard?.billing?.quotaState || "未知"}</strong>
              </div>
              <div>
                <span>支付预览</span>
                <strong>
                  {dashboard?.paymentPreview ? `${(dashboard.paymentPreview.amountFen / 100).toFixed(2)} ${dashboard.paymentPreview.currency}` : "暂无"}
                </strong>
              </div>
            </div>
            {dashboard?.paymentPreview ? (
              <div className="cms-preview-order">
                <span>{dashboard.paymentPreview.productCode}</span>
                <strong>{dashboard.paymentPreview.orderNo}</strong>
              </div>
            ) : null}
          </article>

          <article className="cms-panel">
            <div className="cms-panel-head">
              <div>
                <span className="cms-panel-kicker">说明</span>
                <h2>首版范围</h2>
              </div>
            </div>
            <ul className="cms-notes">
              <li>指标卡使用 `ops-admin-service` 的 overview 汇总。</li>
              <li>审计分页使用 `audit-service` 的实时查询。</li>
              <li>投诉区展示用户在主站提交的投诉 / 反馈，并支持 CMS 内直接回复。</li>
            </ul>
          </article>
        </section>

        <section className="cms-table-panel">
          <div className="cms-panel-head">
            <div>
              <span className="cms-panel-kicker">用户</span>
              <h2>用户列表 / 搜索结果</h2>
            </div>
            <div className="cms-pagination">
              <button type="button" disabled={userPageNo <= 1 || loading} onClick={() => setUserPageNo((value) => Math.max(1, value - 1))}>
                上一页
              </button>
              <span>
                第 {dashboard?.userPage.pageNo ?? userPageNo} / {Math.max(1, Math.ceil((dashboard?.userPage.total ?? 0) / (dashboard?.userPage.pageSize ?? 8)))} 页
              </span>
              <button
                type="button"
                disabled={loading || !dashboard || dashboard.userPage.pageNo * dashboard.userPage.pageSize >= dashboard.userPage.total}
                onClick={() => setUserPageNo((value) => value + 1)}
              >
                下一页
              </button>
            </div>
          </div>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>注册时间</th>
                  <th>邮箱</th>
                  <th>昵称</th>
                  <th>状态</th>
                  <th>活跃会话</th>
                  <th>最近登录</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.userPage.items.length ? (
                  dashboard.userPage.items.map((item) => (
                    <tr key={item.userId}>
                      <td>{formatTime(item.createdAt)}</td>
                      <td>{item.email || "已清空"}</td>
                      <td>{item.displayName || "未设置"}</td>
                      <td>{item.deleted ? "已删除" : item.status}</td>
                      <td>{item.activeSessionCount}</td>
                      <td>{formatTime(item.lastLoginAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="cms-empty-row">
                      暂无用户数据。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cms-table-panel">
          <div className="cms-panel-head">
            <div>
              <span className="cms-panel-kicker">支付</span>
              <h2>支付订单分页查询</h2>
            </div>
            <div className="cms-pagination">
              <button type="button" disabled={orderPageNo <= 1 || loading} onClick={() => setOrderPageNo((value) => Math.max(1, value - 1))}>
                上一页
              </button>
              <span>
                第 {dashboard?.paymentOrderPage.pageNo ?? orderPageNo} /{" "}
                {Math.max(1, Math.ceil((dashboard?.paymentOrderPage.total ?? 0) / (dashboard?.paymentOrderPage.pageSize ?? 8)))} 页
              </span>
              <button
                type="button"
                disabled={
                  loading ||
                  !dashboard ||
                  dashboard.paymentOrderPage.pageNo * dashboard.paymentOrderPage.pageSize >= dashboard.paymentOrderPage.total
                }
                onClick={() => setOrderPageNo((value) => value + 1)}
              >
                下一页
              </button>
            </div>
          </div>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>创建时间</th>
                  <th>订单号</th>
                  <th>用户</th>
                  <th>套餐</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>支付方式</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.paymentOrderPage.items.length ? (
                  dashboard.paymentOrderPage.items.map((item) => (
                    <tr key={item.orderNo}>
                      <td>{formatTime(item.createdAt)}</td>
                      <td>{item.orderNo}</td>
                      <td>{item.userEmail || "匿名"}</td>
                      <td>{item.subject || item.planId}</td>
                      <td>{formatAmountFen(item.amountFen)}</td>
                      <td>{item.status}</td>
                      <td>{`${item.paymentChannel}/${item.paymentMode}`}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="cms-empty-row">
                      暂无支付订单。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cms-table-panel">
          <div className="cms-panel-head">
            <div>
              <span className="cms-panel-kicker">审计</span>
              <h2>审计事件分页查询</h2>
            </div>
            <div className="cms-pagination">
              <button type="button" disabled={auditPageNo <= 1 || loading} onClick={() => setAuditPageNo((value) => Math.max(1, value - 1))}>
                上一页
              </button>
              <span>
                第 {dashboard?.auditPage.pageNo ?? auditPageNo} / {Math.max(1, Math.ceil((dashboard?.auditPage.total ?? 0) / (dashboard?.auditPage.pageSize ?? 8)))} 页
              </span>
              <button
                type="button"
                disabled={loading || !dashboard || dashboard.auditPage.pageNo * dashboard.auditPage.pageSize >= dashboard.auditPage.total}
                onClick={() => setAuditPageNo((value) => value + 1)}
              >
                下一页
              </button>
            </div>
          </div>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>事件</th>
                  <th>用户</th>
                  <th>实体</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.auditPage.items.length ? (
                  dashboard.auditPage.items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatTime(item.createdAt)}</td>
                      <td>{item.eventType}</td>
                      <td>{item.userId || "匿名"}</td>
                      <td>{item.entityType}/{item.entityId}</td>
                      <td>{item.sourceService}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="cms-empty-row">
                      暂无审计事件。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cms-table-panel">
          <div className="cms-panel-head">
            <div>
              <span className="cms-panel-kicker">投诉 / 合规</span>
              <h2>投诉 / 合规工单分页查询</h2>
            </div>
            <div className="cms-pagination">
              <button
                type="button"
                disabled={complaintPageNo <= 1 || loading}
                onClick={() => setComplaintPageNo((value) => Math.max(1, value - 1))}
              >
                上一页
              </button>
              <span>
                第 {dashboard?.complaintQueue.pageNo ?? complaintPageNo} /{" "}
                {Math.max(
                  1,
                  Math.ceil((dashboard?.complaintQueue.total ?? 0) / (dashboard?.complaintQueue.pageSize ?? 8))
                )}{" "}
                页
              </span>
              <button
                type="button"
                disabled={
                  loading ||
                  !dashboard ||
                  dashboard.complaintQueue.pageNo * dashboard.complaintQueue.pageSize >= dashboard.complaintQueue.total
                }
                onClick={() => setComplaintPageNo((value) => value + 1)}
              >
                下一页
              </button>
            </div>
          </div>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>工单</th>
                  <th>用户</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>联系邮箱</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.complaintQueue.items.length ? (
                  dashboard.complaintQueue.items.map((item) => (
                    <tr key={item.id} className={selectedComplaint?.id === item.id ? "cms-row-active" : ""}>
                      <td>{item.id}</td>
                      <td>{item.userEmail || item.userId || "未指定"}</td>
                      <td>{formatComplaintCategory(item.category)}</td>
                      <td>{formatComplaintStatus(item.status)}</td>
                      <td>{item.contactEmail || "未留下"}</td>
                      <td>{formatTime(item.createdAt)}</td>
                      <td>
                        <button type="button" className="cms-ghost-button" onClick={() => setSelectedComplaintId(item.id)}>
                          查看并回复
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="cms-empty-row">
                      暂无投诉 / 反馈工单。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedComplaint ? (
          <section className="cms-panel cms-complaint-workbench">
            <div className="cms-panel-head">
              <div>
                <span className="cms-panel-kicker">投诉详情</span>
                <h2>查看并回复用户反馈</h2>
              </div>
              <div className="cms-operator-badge compact">
                <strong>{formatComplaintStatus(selectedComplaint.status)}</strong>
                <span>{formatTime(selectedComplaint.updatedAt)}</span>
              </div>
            </div>
            <div className="cms-complaint-meta">
              <div>
                <span>反馈人</span>
                <strong>{selectedComplaint.userEmail || selectedComplaint.userId || "未指定"}</strong>
              </div>
              <div>
                <span>联系邮箱</span>
                <strong>{selectedComplaint.contactEmail || "未留下"}</strong>
              </div>
              <div>
                <span>反馈类型</span>
                <strong>{formatComplaintCategory(selectedComplaint.category)}</strong>
              </div>
            </div>
            <div className="cms-complaint-content">
              <span>用户内容</span>
              <p>{selectedComplaint.content}</p>
            </div>
            <label className="cms-field">
              <span>{selectedComplaint.replyContent ? "更新回复" : "回复用户"}</span>
              <textarea
                value={complaintReplyDraft}
                onChange={(event) => setComplaintReplyDraft(event.target.value)}
                placeholder="写下处理结论、补充说明或后续动作。"
              />
            </label>
            {complaintActionMessage ? <div className="cms-status-banner warning">{complaintActionMessage}</div> : null}
            <div className="cms-header-actions">
              <button
                className="cms-primary-button"
                type="button"
                disabled={replyPending || complaintReplyDraft.trim().length < 4}
                onClick={() => void handleReplyComplaint()}
              >
                {replyPending ? "正在保存..." : selectedComplaint.replyContent ? "更新回复" : "发送回复"}
              </button>
              {selectedComplaint.replyContent ? (
                <div className="cms-inline-note">
                  最近回复人：{selectedComplaint.replyBy || "CMS"}，时间：{formatTime(selectedComplaint.repliedAt)}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
