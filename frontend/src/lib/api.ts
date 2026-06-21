import type {
  ApiResponse,
  Market,
  Event,
  Tag,
  Category,
  OrderBook,
  PricePoint,
  Trade,
  MarketConfig,
  PlatformTrade,
  User,
  BalanceInfo,
  Deposit,
  Withdraw,
  Transaction,
  AdminOverview,
  RevenueRecord,
  PositionType,
  SettlementSummary,
  SettlementRecord,
  SettleResult,
  AutoCheckResult,
  MarketResolution,
  SettlementStats,
  ComboBet,
  ComboTemplate,
  Comment,
  CommentStats,
  PriceAlert,
  OHLCData,
  SmartMoneyWhale,
  SmartMoneyWallet,
  SmartMoneySignal,
  SentimentData,
  LeaderboardEntry,
  ReferralData,
  WorldCupMatch,
  FeeInfo,
  SuccessResponse,
  AuthResponse,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // 通用
  get: <T>(endpoint: string) =>
    fetchAPI<T>(endpoint),
  post: <T>(endpoint: string, body?: any) =>
    fetchAPI<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // 市场
  getMarkets: (params?: Record<string, string>) =>
    fetchAPI<ApiResponse<Market[]>>(`/markets?${new URLSearchParams(params).toString()}`),

  getMarket: (id: string) =>
    fetchAPI<ApiResponse<Market>>(`/markets/${id}`),

  getCategories: () =>
    fetchAPI<ApiResponse<Category[]>>('/categories'),

  getEvents: (params?: Record<string, string>) =>
    fetchAPI<ApiResponse<Event[]>>(`/events?${new URLSearchParams(params).toString()}`),

  getEvent: (id: string) =>
    fetchAPI<ApiResponse<Event>>(`/events/${id}`),

  search: (q: string) =>
    fetchAPI<ApiResponse<Market[]>>(`/search?q=${encodeURIComponent(q)}`),

  getOrderBook: (tokenId: string) =>
    fetchAPI<ApiResponse<OrderBook>>(`/orderbook/${tokenId}`),

  getPriceHistory: (tokenId: string, interval?: string) =>
    fetchAPI<ApiResponse<PricePoint[]>>(`/price-history/${tokenId}?interval=${interval || '1h'}`),

  getTrades: (tokenId: string) =>
    fetchAPI<ApiResponse<Trade[]>>(`/trades/${tokenId}`),

  getMarketConfig: (tokenId: string) =>
    fetchAPI<ApiResponse<MarketConfig>>(`/markets/${tokenId}/config`),

  getWorldCupMarkets: (params?: Record<string, string>) =>
    fetchAPI<ApiResponse<Market[]>>(`/world-cup/markets?${new URLSearchParams(params).toString()}`),

  getWorldCupSchedule: () =>
    fetchAPI<ApiResponse<WorldCupMatch[]>>('/world-cup/schedule'),

  getTrendingTags: () =>
    fetchAPI<ApiResponse<Tag[]>>('/trending-tags'),

  // 交易
  placeOrder: (payload: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    size?: number;
    price?: number;
    amount?: number;
    orderType?: string;
    tags?: string[];
  }) =>
    fetchAPI<ApiResponse<PlatformTrade>>('/order', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelOrder: (orderId: string) =>
    fetchAPI<ApiResponse<SuccessResponse>>(`/order/${orderId}`, { method: 'DELETE' }),

  getOrders: (params?: { status?: string; orderType?: string; limit?: number; offset?: number }) => {
    const query = params ? Object.entries(params)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&') : '';
    return fetchAPI<ApiResponse<PlatformTrade[]>>(`/orders${query ? '?' + query : ''}`);
  },

  getFeeInfo: (tags?: string) =>
    fetchAPI<ApiResponse<FeeInfo>>(`/fee-info${tags ? `?tags=${encodeURIComponent(tags)}` : ''}`),

  // 认证
  login: (walletAddress: string) =>
    fetchAPI<ApiResponse<AuthResponse>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
    }),

  register: (email: string, password: string, username?: string) =>
    fetchAPI<ApiResponse<AuthResponse>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    }),

  loginWithEmail: (email: string, password: string) =>
    fetchAPI<ApiResponse<AuthResponse>>('/auth/login/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () =>
    fetchAPI<ApiResponse<User>>('/auth/me'),

  bindWallet: (walletAddress: string) =>
    fetchAPI<ApiResponse<AuthResponse>>('/auth/bind-wallet', {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
    }),

  // 余额
  getBalance: () =>
    fetchAPI<ApiResponse<BalanceInfo>>('/balance'),

  deposit: (txHash: string, amount: number) =>
    fetchAPI<ApiResponse<Deposit>>('/balance/deposit', {
      method: 'POST',
      body: JSON.stringify({ txHash, amount }),
    }),

  withdraw: (toAddress: string, amount: number) =>
    fetchAPI<ApiResponse<Withdraw>>('/balance/withdraw', {
      method: 'POST',
      body: JSON.stringify({ toAddress, amount }),
    }),

  getTransactions: (limit?: number) =>
    fetchAPI<ApiResponse<Transaction[]>>(`/balance/transactions?limit=${limit || 50}`),

  // 管理后台
  getAdminOverview: () =>
    fetchAPI<ApiResponse<AdminOverview>>('/admin/overview'),

  getAdminRevenue: (days?: number) =>
    fetchAPI<ApiResponse<RevenueRecord[]>>(`/admin/revenue?days=${days || 30}`),

  getAdminTrades: (page?: number, limit?: number, status?: string) =>
    fetchAPI<ApiResponse<PlatformTrade[]>>(`/admin/trades?page=${page || 1}&limit=${limit || 50}${status ? `&status=${status}` : ''}`),

  getAdminUsers: (page?: number, limit?: number) =>
    fetchAPI<ApiResponse<User[]>>(`/admin/users?page=${page || 1}&limit=${limit || 50}`),

  getAdminWithdraws: (status?: string) =>
    fetchAPI<ApiResponse<Withdraw[]>>(`/admin/withdraws${status ? `?status=${status}` : ''}`),

  processWithdraw: (withdrawId: string, action: 'complete' | 'reject', txHash?: string) =>
    fetchAPI<ApiResponse<Withdraw>>(`/admin/withdraws/${withdrawId}/process`, {
      method: 'POST',
      body: JSON.stringify({ action, txHash }),
    }),

  // 结算 & 持仓
  getPositions: () =>
    fetchAPI<ApiResponse<PositionType[]>>('/positions'),

  getAllPositions: () =>
    fetchAPI<ApiResponse<PositionType[]>>('/positions/all'),

  getSettlementSummary: () =>
    fetchAPI<ApiResponse<SettlementSummary>>('/settlements/summary'),

  getSettlements: (page?: number, limit?: number) =>
    fetchAPI<ApiResponse<SettlementRecord[]>>(`/settlements?page=${page || 1}&limit=${limit || 20}`),

  // 管理 - 结算
  adminSettle: (payload: {
    marketId: string;
    outcomeTokenId: string;
    outcomeLabel?: string;
    question?: string;
    payoutPerShare?: number;
  }) =>
    fetchAPI<ApiResponse<SettleResult>>('/admin/settle', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminAutoCheckSettle: () =>
    fetchAPI<ApiResponse<AutoCheckResult>>('/admin/settle/auto-check', {
      method: 'POST',
    }),

  getAdminSettlementMarkets: (page?: number, limit?: number) =>
    fetchAPI<ApiResponse<MarketResolution[]>>(`/admin/settlements/markets?page=${page || 1}&limit=${limit || 20}`),

  getAdminSettlements: (page?: number, limit?: number) =>
    fetchAPI<ApiResponse<SettlementRecord[]>>(`/admin/settlements?page=${page || 1}&limit=${limit || 50}`),

  getAdminSettlementStats: () =>
    fetchAPI<ApiResponse<SettlementStats>>('/admin/settlements/stats'),

  // 聪明钱追踪
  getSmartMoneyWhales: (limit?: number) =>
    fetchAPI<ApiResponse<SmartMoneyWhale[]>>(`/smart-money/whales?limit=${limit || 20}`),

  getSmartMoneyWallets: (limit?: number) =>
    fetchAPI<ApiResponse<SmartMoneyWallet[]>>(`/smart-money/wallets?limit=${limit || 20}`),

  getSmartMoneySignals: () =>
    fetchAPI<ApiResponse<SmartMoneySignal[]>>('/smart-money/signals'),

  getSentiment: () =>
    fetchAPI<ApiResponse<SentimentData>>('/smart-money/sentiment'),

  // ========== 组合押注 ==========
  createCombo: (payload: {
    name: string;
    legs: { tokenId: string; marketId: string; question: string; outcome: string; price: number }[];
    totalStake: number;
  }) =>
    fetchAPI<ApiResponse<ComboBet>>('/combo', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCombos: () =>
    fetchAPI<ApiResponse<ComboBet[]>>('/combo/mine'),

  getCombo: (id: string) =>
    fetchAPI<ApiResponse<ComboBet>>(`/combo/${id}`),

  cancelCombo: (id: string) =>
    fetchAPI<ApiResponse<SuccessResponse>>(`/combo/${id}/cancel`, { method: 'POST' }),

  getComboTemplates: () =>
    fetchAPI<ApiResponse<ComboTemplate[]>>('/combo/templates'),

  // ========== 社区评论 ==========
  getComments: (marketId: string, page?: number, limit?: number, sort?: string) =>
    fetchAPI<ApiResponse<Comment[]>>(`/comments/${marketId}?page=${page || 1}&limit=${limit || 20}${sort ? `&sort=${sort}` : ''}`),

  createComment: (payload: { marketId: string; content: string; parentId?: string | null }) =>
    fetchAPI<ApiResponse<Comment>>('/comments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteComment: (id: string) =>
    fetchAPI<ApiResponse<SuccessResponse>>(`/comments/${id}`, { method: 'DELETE' }),

  likeComment: (id: string) =>
    fetchAPI<ApiResponse<{ likes: number }>>(`/comments/${id}/like`, { method: 'POST' }),

  reportComment: (id: string, reason?: string) =>
    fetchAPI<ApiResponse<SuccessResponse>>(`/comments/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getCommentStats: (marketId: string) =>
    fetchAPI<ApiResponse<CommentStats>>(`/comments/${marketId}/stats`),

  // ========== K线/价格图表 ==========
  getOHLC: (tokenId: string, interval?: string, limit?: number) =>
    fetchAPI<ApiResponse<OHLCData[]>>(`/price-history/${tokenId}/ohlc?interval=${interval || '1h'}&limit=${limit || 100}`),

  getRecentPrices: (tokenId: string, limit?: number) =>
    fetchAPI<ApiResponse<PricePoint[]>>(`/price-history/${tokenId}/recent?limit=${limit || 200}`),

  // ========== 价格提醒 ==========
  createAlert: (payload: {
    tokenId: string;
    marketId: string;
    question: string;
    outcome: string;
    direction: 'above' | 'below';
    targetPrice: number;
  }) =>
    fetchAPI<ApiResponse<PriceAlert>>('/alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAlerts: (status?: string) =>
    fetchAPI<ApiResponse<PriceAlert[]>>(`/alerts${status ? `?status=${status}` : ''}`),

  deleteAlert: (id: string) =>
    fetchAPI<ApiResponse<SuccessResponse>>(`/alerts/${id}`, { method: 'DELETE' }),

  dismissAlert: (id: string) =>
    fetchAPI<ApiResponse<PriceAlert>>(`/alerts/${id}/dismiss`, { method: 'POST' }),

  // ========== 排行榜 ==========
  getLeaderboard: (period?: string) =>
    fetchAPI<ApiResponse<LeaderboardEntry[]>>(`/leaderboard?period=${period || 'all'}`),

  // ========== 推荐奖励 ==========
  getReferral: () =>
    fetchAPI<ApiResponse<ReferralData>>('/referral'),
  getReferralLeaderboard: (period?: string) =>
    fetchAPI<ApiResponse<LeaderboardEntry[]>>(`/referral/leaderboard?period=${period || 'all'}`),
  generateReferralCode: () =>
    fetchAPI<ApiResponse<{ code: string }>>('/referral/generate-code', { method: 'POST' }),
  lookupReferral: (code: string) =>
    fetchAPI<ApiResponse<ReferralData>>(`/referral/lookup/${code}`),
};
