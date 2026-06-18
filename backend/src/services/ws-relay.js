const WebSocket = require('ws');
const wsService = require('./websocket');

/**
 * WebSocket 中继服务
 * 
 * 架构：
 *   前端 <--ws--> 后端 (本服务) <--ws--> Polymarket
 * 
 * 负责将前端的订阅请求转发到 Polymarket，并将数据回推给前端
 */
class WsRelay {
  constructor() {
    /** @type {Map<string, Set<WebSocket>>} assetId → 订阅该资产的前端客户端 */
    this.assetSubscribers = new Map();
    this.isPolymarketListenerSetup = false;

    // 速率限制配置
    this.MAX_SUBSCRIPTIONS_PER_CLIENT = 50;
    this.MSG_RATE_LIMIT_WINDOW = 1000; // 1 秒窗口
    this.MSG_RATE_LIMIT_MAX = 10;       // 每秒最多 10 条消息

    /** @type {WeakMap<WebSocket, { msgTimestamps: number[]; subscriptionCount: number }>} */
    this.clientState = new WeakMap();
  }

  /**
   * 将中继附加到 HTTP 服务器
   * @param {import('http').Server} httpServer
   */
  attach(httpServer) {
    this.wss = new WebSocket.Server({
      server: httpServer,
      pingInterval: 30_000,   // 每 30 秒 PING 客户端，检测僵尸连接
      pingTimeout: 10_000,    // 10 秒内无 PONG 则断开
    });

    this.wss.on('connection', (clientWs) => {
      console.log('[Relay] Frontend client connected');

      // 初始化客户端状态
      this.clientState.set(clientWs, { msgTimestamps: [], subscriptionCount: 0 });

      clientWs.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this._handleClientMessage(clientWs, msg);
        } catch {
          // ignore
        }
      });

      clientWs.on('close', () => {
        console.log('[Relay] Frontend client disconnected');
        this._cleanupClient(clientWs);
      });

      clientWs.on('error', (err) => {
        console.error('[Relay] Client error:', err.message);
        this._cleanupClient(clientWs);
      });
    });

    // 订阅 Polymarket 数据，监听所有事件类型并转发
    this._setupPolymarketListener();

    console.log('[Relay] WebSocket relay attached');
  }

  _setupPolymarketListener() {
    if (this.isPolymarketListenerSetup) return;
    this.isPolymarketListenerSetup = true;

    // 监听所有 Polymarket 事件类型，推送给订阅的前端客户端
    const eventTypes = ['book', 'price_change', 'last_trade_price', 'tick_size_change'];

    for (const eventType of eventTypes) {
      wsService.on(eventType, (msg) => {
        const assetId = msg.asset_id;
        if (!assetId) return;

        const clients = this.assetSubscribers.get(assetId);
        if (!clients || clients.size === 0) return;

        const payload = JSON.stringify({
          channel: `book.${assetId}`,
          data: this._transformMessage(eventType, msg),
        });

        const staleClients = [];
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(payload);
            } catch {
              // send 失败（背压等），标记为过期客户端
              staleClients.push(client);
            }
          } else {
            // readyState 非 OPEN 的客户端也清理掉
            staleClients.push(client);
          }
        }
        // 批量清理过期客户端
        for (const stale of staleClients) {
          clients.delete(stale);
        }
        // 如果所有客户端都已过期，取消 Polymarket 订阅
        if (clients.size === 0) {
          this.assetSubscribers.delete(assetId);
          wsService.unsubscribe(assetId);
          console.log(`[Relay] Auto-unsubscribed from asset ${assetId} (all clients gone)`);
        }
      });
    }
  }

  _transformMessage(eventType, msg) {
    const now = Date.now();

    switch (eventType) {
      case 'book': {
        // 完整订单簿快照
        const bids = (msg.bids || []).map(b => ({
          price: parseFloat(b.price || '0'),
          size: parseFloat(b.size || '0'),
        }));
        const asks = (msg.asks || []).map(a => ({
          price: parseFloat(a.price || '0'),
          size: parseFloat(a.size || '0'),
        }));
        const bestBid = bids[0]?.price || 0;
        const bestAsk = asks[0]?.price || 0;
        return { bids, asks, spread: bestAsk - bestBid, midPrice: (bestBid + bestAsk) / 2, lastUpdate: now };
      }
      case 'price_change': {
        // 价格变动（最优买卖价）→ 转为简化订单簿兼容前端
        const bestBid = parseFloat(msg.best_bid || '0');
        const bestAsk = parseFloat(msg.best_ask || '0');
        const bidSize = parseFloat(msg.best_bid_size || '0');
        const askSize = parseFloat(msg.best_ask_size || '0');
        return {
          bids: bestBid ? [{ price: bestBid, size: bidSize }] : [],
          asks: bestAsk ? [{ price: bestAsk, size: askSize }] : [],
          spread: bestAsk - bestBid,
          midPrice: (bestBid + bestAsk) / 2 || bestBid || bestAsk,
          lastUpdate: now,
        };
      }
      case 'last_trade_price': {
        const price = parseFloat(msg.price || '0');
        return {
          bids: price ? [{ price, size: parseFloat(msg.size || '0') }] : [],
          asks: [],
          spread: 0,
          midPrice: price,
          lastTradePrice: price,
          lastTradeSide: msg.side,
          lastUpdate: now,
        };
      }
      case 'tick_size_change': {
        return {
          oldTickSize: msg.old_tick_size,
          newTickSize: msg.new_tick_size,
          lastUpdate: now,
        };
      }
      default:
        return { lastUpdate: now };
    }
  }

  _handleClientMessage(clientWs, msg) {
    // 速率限制检查
    if (!this._checkRateLimit(clientWs)) {
      console.warn('[Relay] Rate limit exceeded for client');
      return;
    }

    switch (msg.type) {
      case 'subscribe': {
        // 解析 channel: "book.${tokenId}"
        const match = msg.channel?.match(/^book\.(.+)$/);
        if (!match) return;

        const assetId = match[1];

        // 检查客户端订阅上限
        const state = this.clientState.get(clientWs);
        if (state && state.subscriptionCount >= this.MAX_SUBSCRIPTIONS_PER_CLIENT) {
          console.warn(`[Relay] Client exceeded max subscriptions (${this.MAX_SUBSCRIPTIONS_PER_CLIENT})`);
          return;
        }

        if (!this.assetSubscribers.has(assetId)) {
          this.assetSubscribers.set(assetId, new Set());
        }
        this.assetSubscribers.get(assetId).add(clientWs);

        // 更新客户端订阅计数
        if (state) state.subscriptionCount++;

        // 向 Polymarket 订阅该资产
        wsService.subscribe(assetId);

        console.log(`[Relay] Subscribed to asset ${assetId} (${this.assetSubscribers.get(assetId).size} client(s))`);
        break;
      }
      case 'unsubscribe': {
        const match = msg.channel?.match(/^book\.(.+)$/);
        if (!match) return;

        const assetId = match[1];
        const clients = this.assetSubscribers.get(assetId);
        if (clients) {
          clients.delete(clientWs);

          // 更新客户端订阅计数
          const state = this.clientState.get(clientWs);
          if (state && state.subscriptionCount > 0) state.subscriptionCount--;

          if (clients.size === 0) {
            this.assetSubscribers.delete(assetId);
            // 没有客户端订阅该资产了，向 Polymarket 取消
            wsService.unsubscribe(assetId);
            console.log(`[Relay] Unsubscribed from asset ${assetId}`);
          }
        }
        break;
      }
      default:
        // 未知消息类型，忽略
        break;
    }
  }

  /**
   * 滑动窗口速率限制
   * @param {WebSocket} clientWs
   * @returns {boolean} 是否允许该消息
   */
  _checkRateLimit(clientWs) {
    const state = this.clientState.get(clientWs);
    if (!state) return false;

    const now = Date.now();
    // 清除窗口外的旧时间戳
    state.msgTimestamps = state.msgTimestamps.filter(t => now - t < this.MSG_RATE_LIMIT_WINDOW);

    if (state.msgTimestamps.length >= this.MSG_RATE_LIMIT_MAX) {
      return false;
    }

    state.msgTimestamps.push(now);
    return true;
  }

  _cleanupClient(clientWs) {
    for (const [assetId, clients] of this.assetSubscribers.entries()) {
      clients.delete(clientWs);
      if (clients.size === 0) {
        this.assetSubscribers.delete(assetId);
        wsService.unsubscribe(assetId);
      }
    }
    // 清理客户端状态
    this.clientState.delete(clientWs);
  }
}

module.exports = new WsRelay();
