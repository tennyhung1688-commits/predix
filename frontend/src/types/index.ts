export interface Market {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomes_zh?: string[];
  outcomePrices: string[];
  volume: string;
  volume24hr: string;
  liquidity: string;
  closed: boolean;
  endDate: string;
  tags: Tag[];
  events: Event[];
  slug: string;
  image?: string;
  clobTokenIds: string[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  volume: string;
  volume24hr: string;
  liquidity: string;
  closed: boolean;
  tags: Tag[];
  markets: Market[];
  slug: string;
  image?: string;
}

export interface Tag {
  id: string;
  label: string;
  slug: string;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  hash: string;
}

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface PricePoint {
  ts: string;
  price: number;
}

export interface Trade {
  id: string;
  side: 'BUY' | 'SELL';
  price: string;
  size: string;
  createdAt: string;
}

export interface User {
  id: string;
  walletAddress?: string;
  email?: string;
  username?: string;
  role?: string; // "user" | "admin"
  createdAt: string;
  tradeVolume: number;
  feePaid: number;
  // 平台余额系统
  balance: number;
  lockedBalance: number;
  available?: number;
  totalDeposited: number;
  totalWithdrawn: number;
  // 推荐
  referralCode?: string;
  referralEarnings?: number;
  // 游戏化
  gameStats?: GameStats;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  nextCursor?: string | null;
  hasMore?: boolean;
}

// ========== 余额/平台钱包类型 ==========

export interface BalanceInfo {
  balance: number;
  lockedBalance: number;
  available: number;
  totalDeposited: number;
  totalWithdrawn: number;
}

export interface Deposit {
  id: string;
  userId: string;
  txHash: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: string;
  confirmedAt?: string;
}

export interface Withdraw {
  id: string;
  userId: string;
  toAddress: string;
  amount: number;
  fee: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  createdAt: string;
  processedAt?: string;
}

export interface PlatformTrade {
  id: string;
  userId: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  originalPrice: number;
  executePrice: number;
  spreadFee: number;
  polymarketOrderId?: string;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balance: number;
  tradeId?: string;
  desc?: string;
  createdAt: string;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsersToday: number;
  totalTrades: number;
  totalRevenue: number;
  revenueToday: number;
  totalDeposits: number;
  pendingWithdraws: number;
}

export interface RevenueRecord {
  id: string;
  source: string;
  amount: number;
  tradeId?: string;
  userId?: string;
  createdAt: string;
}

// ========== 游戏化类型 ==========

export type LevelTier = 'novice' | 'apprentice' | 'trader' | 'pro' | 'whale' | 'legend';

export interface LevelInfo {
  tier: LevelTier;
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;    // 0-100
  target: number;
  current: number;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface GameStats {
  xp: number;
  level: LevelInfo;
  streak: number;
  longestStreak: number;
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  winRate: number;
  profitableTrades: number;
  marketsExplored: number;
  achievements: Achievement[];
  rank?: number;
  totalTraders?: number;
}

// ========== 结算/持仓类型 ==========

export interface PositionType {
  id: string;
  userId: string;
  tokenId: string;
  marketId: string;
  side: string;
  size: number;
  avgPrice: number;
  totalCost: number;
  status: 'open' | 'settled' | 'closed';
  createdAt: string;
  updatedAt: string;
  // 前端计算
  currentPrice?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface SettlementRecord {
  id: string;
  userId: string;
  resolutionId: string;
  tokenId: string;
  marketId: string;
  shares: number;
  payoutPerShare: number;
  totalPayout: number;
  totalCost: number;
  profit: number;
  status: string;
  settledAt: string;
  user?: { walletAddress: string };
}

export interface SettlementSummary {
  totalSettlements: number;
  totalPayout: number;
  totalCost: number;
  totalProfit: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface MarketResolution {
  id: string;
  marketId: string;
  outcomeTokenId?: string;
  outcomeLabel?: string;
  question?: string;
  status: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface SettlementStats {
  totalResolvedMarkets: number;
  totalSettlements: number;
  totalPayout: number;
  totalUserProfit: number;
  openPositions: number;
}

export interface SettleResult {
  marketId: string;
  outcomeTokenId: string;
  settled: number;
  totalPayout: number;
  details: {
    userId: string;
    wallet: string;
    shares: number;
    totalCost: number;
    payout: number;
    profit: number;
  }[];
}

export interface AutoCheckResult {
  checked: number;
  newlyResolved: {
    marketId: string;
    settled: number;
    totalPayout: number;
  }[];
}

// ========== 组合押注类型 ==========

export interface ComboLeg {
  id: string;
  comboBetId: string;
  tokenId: string;
  marketId: string;
  question: string;
  outcome: string;
  price: number;
  filledSize: number;
  orderId: string;
  status: 'pending' | 'filled' | 'failed';
  createdAt: string;
}

export interface ComboBet {
  id: string;
  userId: string;
  name: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed';
  totalOdds: number;
  totalStake: number;
  potentialPayout: number;
  actualPayout: number;
  legs: ComboLeg[];
  createdAt: string;
  filledAt?: string;
  cancelledAt?: string;
}

export interface ComboTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedOdds: number;
  tag: string;
}

// ========== 评论系统类型 ==========

export interface Comment {
  id: string;
  userId: string;
  username: string;
  marketId: string;
  content: string;
  likes: number;
  parentId: string | null;
  createdAt: string;
  replies?: Comment[];
}

// ========== 评论举报类型 ==========

export interface CommentReport {
  id: string;
  userId: string;
  commentId: string;
  reason?: string;
  createdAt: string;
}

// ========== 衍生品市场类型 ==========



// ========== 价格提醒类型 ==========

export interface PriceAlert {
  id: string;
  userId: string;
  tokenId: string;
  marketId: string;
  question: string;
  outcome: string;
  direction: 'above' | 'below';
  targetPrice: number;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

// ========== K线/图表类型 ==========

export interface OHLCData {
  time: number;   // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ========== 聪明钱类型 ==========

export interface SmartMoneyWhale {
  wallet: string;
  market: string;
  side: string;
  size: string;
  price: string;
  value: string;
  timestamp: string;
}

export interface SmartMoneyWallet {
  wallet: string;
  wins: number;
  losses: number;
  totalPnL: number;
  recentTrades?: SmartMoneyWhale[];
}

export interface SmartMoneySignal {
  signal: 'bullish' | 'bearish' | 'neutral';
  whaleCount: number;
  market: string;
  buyVolume: string;
  sellVolume: string;
  buyRatio: number;
  latestTrades?: { side: string; value: string }[];
}

export interface SentimentData {
  bullish: number;
  bearish: number;
  neutral: number;
}

// ========== 市场配置类型 ==========

export interface MarketConfig {
  id: string;
  tokenId: string;
  marketId: string;
  question: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  closed: boolean;
  feeRate?: number;
  minStake?: number;
  maxStake?: number;
  [key: string]: unknown;
}

// ========== 费率类型 ==========

export interface FeeInfo {
  feeRate: number;
  minFee?: number;
  maxFee?: number;
  [key: string]: unknown;
}

// ========== 世界杯类型 ==========

export interface WorldCupMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  volume?: string;
  markets?: Market[];
}

// ========== 推荐奖励类型 ==========

export interface InvitedUser {
  id: string;
  walletAddress: string;
  tradeVolume: number;
  createdAt: string;
}

export interface ReferralEarning {
  id: string;
  referrerId: string;
  referredId: string;
  tradeId?: string;
  tradeFee: number;
  commission: number;
  rate: number;
  status: string;
  createdAt: string;
}

export interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalEarnings: number;
  pendingEarnings: number;
  invitedCount: number;
  invitedUsers: InvitedUser[];
  earnings: ReferralEarning[];
}

// ========== 排行榜类型 ==========

export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  tradeVolume: number;
  feePaid: number;
  balance: number;
}

// ========== 分类类型 ==========

export interface Category {
  id: string;
  label: string;
  slug: string;
}

// ========== 评论统计类型 ==========

export interface CommentStats {
  total: number;
  [key: string]: unknown;
}

// ========== 通用简单响应类型 ==========

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
