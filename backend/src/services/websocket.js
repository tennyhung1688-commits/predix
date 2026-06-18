const WebSocket = require('ws');
const config = require('../config');

class PolymarketWebSocket {
  constructor() {
    this.ws = null;
    this.subscriptions = new Map();  // assetId -> true
    this.listeners = new Map();      // eventType -> [callback]
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 50;  // 提高上限，避免过早放弃
    this.heartbeatTimer = null;
    this.pongTimer = null;
    this.pongTimeout = 15_000;       // 15 秒无 PONG 则认为连接已死
    this.stableSince = null;
    this.isManuallyClosed = false;
  }

  connect() {
    if (this.isManuallyClosed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    // 清理旧连接
    this._clearHeartbeat();
    if (this.ws) {
      try { this.ws.removeAllListeners(); } catch {}
      this.ws = null;
    }

    this.ws = new WebSocket(config.polymarket.wsUrl);

    this.ws.on('open', () => {
      console.log('[WS] Connected to Polymarket');
      this.stableSince = Date.now();

      // 重置重连计数器（稳定连接后清零，确保下次断连从 0 开始退避）
      this.reconnectAttempts = 0;

      // 启动心跳：Polymarket 要求 10 秒一次 PING
      this._startHeartbeat();

      // 重新订阅所有已记录的资产（需要 operation: 'subscribe'）
      if (this.subscriptions.size > 0) {
        const assetIds = Array.from(this.subscriptions.keys());
        this._send({
          assets_ids: assetIds,
          type: 'market',
          operation: 'subscribe',
        });
        console.log(`[WS] Resubscribed to ${assetIds.length} assets`);
      }
    });

    this.ws.on('message', (raw) => {
      const str = typeof raw === 'string' ? raw : raw.toString();

      // PONG 心跳响应：重置超时计时
      if (str === 'PONG') {
        this._onPongReceived();
        return;
      }

      try {
        const msg = JSON.parse(str);

        // Polymarket 推送的事件类型: book, price_change, last_trade_price, tick_size_change
        const eventTypes = ['book', 'price_change', 'last_trade_price', 'tick_size_change'];

        for (const eventType of eventTypes) {
          if (msg.event_type === eventType) {
            const listeners = this.listeners.get(eventType);
            if (listeners) {
              listeners.forEach(cb => cb(msg));
            }

            // 也通知通配符监听器
            const allListeners = this.listeners.get('*');
            if (allListeners) {
              allListeners.forEach(cb => cb(msg));
            }
            break;
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    this.ws.on('close', (code, reason) => {
      const reasonStr = reason?.toString() || '';
      this._clearHeartbeat();

      // 标记连接不稳定
      if (this.stableSince && Date.now() - this.stableSince < 5000) {
        console.log(`[WS] Unstable connection (closed <5s after open), code=${code} reason="${reasonStr}"`);
      } else {
        console.log(`[WS] Disconnected (code=${code} reason="${reasonStr}"), reconnecting...`);
      }
      this.stableSince = null;

      this._reconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
    });
  }

  _startHeartbeat() {
    this._clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('PING');
        // 每次发送 PING 后启动 PONG 超时检测
        this._resetPongTimeout();
      }
    }, 10_000); // 10 秒一次，匹配 Polymarket 的要求
  }

  _clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  _resetPongTimeout() {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => {
      console.warn('[WS] PONG timeout — no response in ' + (this.pongTimeout / 1000) + 's, closing zombie connection');
      if (this.ws) {
        try { this.ws.terminate(); } catch {}
      }
    }, this.pongTimeout);
  }

  _onPongReceived() {
    // 收到 PONG，清除超时计时
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  _reconnect() {
    if (this.isManuallyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached, giving up');
      return;
    }
    this.reconnectAttempts++;
    // 指数退避：2s → 4s → 8s → 16s → 30s (cap)
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 30_000);
    console.log(`[WS] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  _send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * 订阅资产的市场数据
   * @param {string|string[]} assetIds - Polymarket token ID(s)
   */
  subscribe(assetIds) {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    const newIds = ids.filter(id => !this.subscriptions.has(id));
    if (newIds.length === 0) return;

    // 先记录，再发送
    newIds.forEach(id => this.subscriptions.set(id, true));

    if (this.ws?.readyState === WebSocket.OPEN) {
      // 已连接：增量订阅
      this._send({
        assets_ids: newIds,
        type: 'market',
        operation: 'subscribe',
      });
    }
    // 否则：已记录，重连时会一并订阅
  }

  /**
   * 取消订阅
   * @param {string|string[]} assetIds
   */
  unsubscribe(assetIds) {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    const existing = ids.filter(id => this.subscriptions.has(id));
    if (existing.length === 0) return;

    existing.forEach(id => this.subscriptions.delete(id));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this._send({
        assets_ids: existing,
        type: 'market',
        operation: 'unsubscribe',
      });
    }
  }

  /**
   * 按事件类型注册监听器
   * @param {'book'|'price_change'|'last_trade_price'|'tick_size_change'|'*'} eventType
   * @param {Function} callback
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    }
  }

  close() {
    this.isManuallyClosed = true;
    this._clearHeartbeat();
    if (this.ws) {
      try { this.ws.removeAllListeners(); } catch {}
      this.ws.close();
      this.ws = null;
    }
  }
}

// 单例
const wsService = new PolymarketWebSocket();

module.exports = wsService;
