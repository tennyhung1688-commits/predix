'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { useApp } from './Providers';
import { useTranslation } from '@/i18n/I18nProvider';
import type { ComboBet, ComboLeg, Market } from '@/types';

interface ComboBuilderProps {
  onClose: () => void;
}

interface LegInput {
  tokenId: string;
  marketId: string;
  question: string;
  outcome: string;
  price: number;
}

interface ComboTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedOdds: number;
  tag: string;
}

export function ComboBuilder({ onClose }: ComboBuilderProps) {
  const { user } = useApp();
  const { t, locale } = useTranslation();

  const [tab, setTab] = useState<'builder' | 'myCombos' | 'templates'>('builder');
  const [legs, setLegs] = useState<LegInput[]>([]);
  const [stake, setStake] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 模板
  const [templates, setTemplates] = useState<ComboTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // 我的组合
  const [myCombos, setMyCombos] = useState<ComboBet[]>([]);
  const [loadingCombos, setLoadingCombos] = useState(false);

  useEffect(() => {
    if (tab === 'builder') {
      loadMarkets();
    } else if (tab === 'myCombos') {
      loadMyCombos();
    } else if (tab === 'templates') {
      loadTemplates();
    }
  }, [tab]);

  const loadMarkets = async () => {
    setLoadingMarkets(true);
    try {
      const query: Record<string, string> | undefined = searchQuery ? { q: searchQuery } : undefined;
      const res: any = await api.getMarkets(query);
      if (res.success) setMarkets(res.data || []);
    } catch { /* ignore */ }
    setLoadingMarkets(false);
  };

  const loadMyCombos = async () => {
    if (!user) return;
    setLoadingCombos(true);
    try {
      const res: any = await api.getCombos();
      if (res.success) setMyCombos(res.data || []);
    } catch { /* ignore */ }
    setLoadingCombos(false);
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res: any = await api.getComboTemplates();
      if (res.success) setTemplates(res.data || []);
    } catch {
      // Fallback templates
      setTemplates([
        { id: '1', name: '英超冠军双响炮', description: '曼城冠军 + 哈兰德金靴', category: '足球', estimatedOdds: 3.2, tag: '热门' },
        { id: '2', name: '美国大选全垒打', description: '总统 + 众议院多数党', category: '政治', estimatedOdds: 2.8, tag: '新' },
        { id: '3', name: 'BTC 牛市组合', description: 'BTC 破 10 万 + ETF 通过', category: '加密货币', estimatedOdds: 5.6, tag: '热门' },
      ]);
    }
    setLoadingTemplates(false);
  };

  const addLeg = (market: Market) => {
    const clobTokens = safeJson(market.clobTokenIds);
    const outcomes = safeJson(
      locale === 'zh'
        ? ((market as any).outcomes_zh || market.outcomes)
        : (market.outcomes || (market as any).outcomes_zh)
    );
    if (clobTokens.length === 0 || outcomes.length === 0) return;

    setLegs(prev => [...prev, {
      tokenId: clobTokens[0],
      marketId: market.id,
      question: market.question,
      outcome: outcomes[0],
      price: parseFloat(market.outcomePrices?.[0] || '0.5'),
    }]);
  };

  const removeLeg = (index: number) => {
    setLegs(prev => prev.filter((_, i) => i !== index));
  };

  const updateLegOutcome = (index: number, outcome: string) => {
    setLegs(prev => prev.map((leg, i) =>
      i === index ? { ...leg, outcome } : leg
    ));
  };

  const updateLegPrice = (index: number, price: number) => {
    setLegs(prev => prev.map((leg, i) =>
      i === index ? { ...leg, price } : leg
    ));
  };

  const totalOdds = useMemo(() => {
    if (legs.length === 0) return 0;
    return legs.reduce((odds, leg) => odds * (1 / leg.price), 1);
  }, [legs]);

  const potentialPayout = useMemo(() => {
    const s = parseFloat(stake) || 0;
    return s * totalOdds;
  }, [stake, totalOdds]);

  const handleCreate = async () => {
    if (!user) {
      setToast({ type: 'error', message: t('comments.loginFirst') });
      return;
    }
    if (legs.length < 2) {
      setToast({ type: 'error', message: t('combo.minLegs') });
      return;
    }
    const s = parseFloat(stake);
    if (!s || s <= 0) {
      setToast({ type: 'error', message: '请输入有效投注金额' });
      return;
    }

    setLoading(true);
    try {
      const res: any = await api.createCombo({
        name: name || `组合 ${Date.now().toString(36)}`,
        legs: legs.map(l => ({
          tokenId: l.tokenId,
          marketId: l.marketId,
          question: l.question,
          outcome: l.outcome,
          price: l.price,
        })),
        totalStake: s,
      });
      if (res.success) {
        setToast({ type: 'success', message: t('combo.createSuccess') });
        setLegs([]);
        setStake('');
        setName('');
        setTab('myCombos');
      } else {
        setToast({ type: 'error', message: res.error || t('combo.createFailed') });
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || t('combo.createFailed') });
    }
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t('combo.cancelConfirm'))) return;
    try {
      await api.cancelCombo(id);
      loadMyCombos();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('combo.pending'),
      filled: t('combo.filled'),
      partial: t('combo.partial'),
      cancelled: t('combo.cancelled'),
      failed: t('combo.failed'),
    };
    return map[status] || status;
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: '#f59e0b',
      filled: '#10b981',
      partial: '#3b82f6',
      cancelled: '#6b7280',
      failed: '#ef4444',
    };
    return map[status] || '#6b7280';
  };

  const safeJson = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>{t('combo.title')}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {(['builder', 'templates', 'myCombos'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{
                ...styles.tab,
                ...(tab === tabKey ? styles.tabActive : {}),
              }}
            >
              {tabKey === 'builder' ? t('combo.builder') : tabKey === 'templates' ? t('combo.templates') : t('combo.myCombos')}
            </button>
          ))}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            ...styles.toast,
            background: toast.type === 'success' ? '#065f46' : '#7f1d1d',
          }}>
            {toast.message}
            <button onClick={() => setToast(null)} style={styles.toastClose}>✕</button>
          </div>
        )}

        {/* Builder Tab */}
        {tab === 'builder' && (
          <div style={styles.content}>
            {/* Combo Name */}
            <div style={styles.field}>
              <label style={styles.label}>组合名称</label>
              <input
                style={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="可选，例如「英超冠军预测」"
              />
            </div>

            {/* Legs */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span>选项 ({legs.length}/10)</span>
                {legs.length < 2 && <span style={styles.hint}>{t('combo.minLegs')}</span>}
              </div>
              {legs.map((leg, i) => {
                const legMarket = markets.find(m => {
                  const tks = safeJson(m.clobTokenIds);
                  return tks[0] === leg.tokenId;
                });
                const outcomes = safeJson(
                  locale === 'zh'
                    ? ((legMarket as any)?.outcomes_zh || legMarket?.outcomes)
                    : (legMarket?.outcomes || (legMarket as any)?.outcomes_zh)
                );
                return (
                  <div key={i} style={styles.legCard}>
                    <div style={styles.legHeader}>
                      <span style={styles.legIndex}>#{i + 1}</span>
                      <span style={styles.legQuestion}>{leg.question}</span>
                      <button onClick={() => removeLeg(i)} style={styles.removeBtn}>✕</button>
                    </div>
                    <div style={styles.legFields}>
                      <select
                        style={styles.select}
                        value={leg.outcome}
                        onChange={e => updateLegOutcome(i, e.target.value)}
                      >
                        {outcomes.map((o: string, idx: number) => (
                          <option key={idx} value={o}>{o}</option>
                        ))}
                      </select>
                      <input
                        style={{ ...styles.input, width: 100 }}
                        type="number"
                        min="0.01"
                        max="0.99"
                        step="0.01"
                        value={leg.price}
                        onChange={e => updateLegPrice(i, parseFloat(e.target.value) || 0.5)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Market Search */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>选择市场添加到组合</div>
              <input
                style={styles.input}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadMarkets()}
                placeholder="搜索市场…"
              />
              <div style={styles.marketList}>
                {loadingMarkets ? (
                  <div style={styles.loading}>加载中…</div>
                ) : markets.slice(0, 20).map(m => {
                  const tks = safeJson(m.clobTokenIds);
                  const alreadyAdded = legs.some(l => l.tokenId === tks[0]);
                  return (
                    <button
                      key={m.id}
                      onClick={() => !alreadyAdded && addLeg(m)}
                      style={{
                        ...styles.marketItem,
                        opacity: alreadyAdded ? 0.4 : 1,
                        cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                      }}
                      disabled={alreadyAdded}
                    >
                      <span style={styles.marketQ}>{m.question}</span>
                      <span style={styles.marketPrice}>
                        {alreadyAdded ? '已添加' : `¥${parseFloat(m.outcomePrices?.[0] || '0').toFixed(2)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary & Create */}
            {legs.length >= 2 && (
              <div style={styles.summary}>
                <div style={styles.summaryRow}>
                  <span>{t('combo.totalOdds')}:</span>
                  <strong>{totalOdds.toFixed(2)}x</strong>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('combo.stake')} (USDC)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    step="1"
                    value={stake}
                    onChange={e => setStake(e.target.value)}
                    placeholder="输入投注金额"
                  />
                </div>
                <div style={styles.summaryRow}>
                  <span>{t('combo.potentialPayout')}:</span>
                  <strong style={{ color: '#10b981' }}>{potentialPayout.toFixed(2)} USDC</strong>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={loading || !stake}
                  style={{
                    ...styles.createBtn,
                    opacity: loading || !stake ? 0.5 : 1,
                  }}
                >
                  {loading ? t('combo.creating') : t('combo.createCombo')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {tab === 'templates' && (
          <div style={styles.content}>
            {loadingTemplates ? (
              <div style={styles.loading}>加载中…</div>
            ) : templates.length === 0 ? (
              <div style={styles.empty}>暂无模板</div>
            ) : (
              templates.map(tmpl => (
                <div key={tmpl.id} style={styles.templateCard}>
                  <div style={styles.templateHeader}>
                    <span style={styles.templateTag}>{tmpl.tag}</span>
                    <span style={styles.templateCat}>{tmpl.category}</span>
                  </div>
                  <div style={styles.templateName}>{tmpl.name}</div>
                  <div style={styles.templateDesc}>{tmpl.description}</div>
                  <div style={styles.templateOdds}>
                    {t('combo.estOdds')}: <strong>{tmpl.estimatedOdds}x</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* My Combos Tab */}
        {tab === 'myCombos' && (
          <div style={styles.content}>
            {!user ? (
              <div style={styles.empty}>{t('comments.loginFirst')}</div>
            ) : loadingCombos ? (
              <div style={styles.loading}>加载中…</div>
            ) : myCombos.length === 0 ? (
              <div style={styles.empty}>
                <div>{t('combo.noCombos')}</div>
                <div style={styles.emptyHint}>{t('combo.noCombosHint')}</div>
              </div>
            ) : (
              myCombos.map(combo => (
                <div key={combo.id} style={styles.comboCard}>
                  <div style={styles.comboHeader}>
                    <span style={styles.comboName}>{combo.name}</span>
                    <span style={{ ...styles.statusBadge, background: statusColor(combo.status) + '20', color: statusColor(combo.status) }}>
                      {statusLabel(combo.status)}
                    </span>
                  </div>
                  <div style={styles.comboLegs}>
                    {(combo.legs || []).map((leg: ComboLeg) => (
                      <div key={leg.id} style={styles.comboLeg}>
                        <span style={styles.comboLegQ}>{leg.question}</span>
                        <span style={styles.comboLegO}>{leg.outcome}</span>
                        <span style={styles.comboLegPrice}>@ {parseFloat(leg.price as any).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={styles.comboFooter}>
                    <span>投入: {combo.totalStake} USDC</span>
                    {combo.status === 'filled' && (
                      <span style={{ color: '#10b981' }}>回报: {combo.actualPayout} USDC</span>
                    )}
                    {combo.status === 'pending' && (
                      <span style={{ color: '#f59e0b' }}>预期: {combo.potentialPayout.toFixed(2)} USDC</span>
                    )}
                    {combo.status === 'pending' && (
                      <button onClick={() => handleCancel(combo.id)} style={styles.cancelBtn}>
                        {t('combo.cancelCombo')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#1a1a2e', borderRadius: 16, width: '90%', maxWidth: 640,
    maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    border: '1px solid #2d2d4a',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #2d2d4a',
  },
  title: { margin: 0, fontSize: 18, color: '#f0f0f0' },
  closeBtn: {
    background: 'none', border: 'none', color: '#888', fontSize: 20,
    cursor: 'pointer', padding: '4px 8px',
  },
  tabs: {
    display: 'flex', borderBottom: '1px solid #2d2d4a', padding: '0 20px',
  },
  tab: {
    flex: 1, padding: '12px 0', background: 'none', border: 'none',
    color: '#888', fontSize: 14, cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#6366f1', borderBottomColor: '#6366f1' },
  content: {
    padding: 20, overflowY: 'auto', flex: 1,
  },
  field: { marginBottom: 12 },
  label: { display: 'block', marginBottom: 4, fontSize: 13, color: '#aaa' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #3d3d5a', background: '#12122a',
    color: '#f0f0f0', fontSize: 14, boxSizing: 'border-box',
  },
  select: {
    padding: '10px 12px', borderRadius: 8, border: '1px solid #3d3d5a',
    background: '#12122a', color: '#f0f0f0', fontSize: 14, flex: 1,
  },
  section: { marginTop: 16 },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 14, color: '#ccc', marginBottom: 8,
  },
  hint: { fontSize: 12, color: '#f59e0b' },
  legCard: {
    background: '#12122a', borderRadius: 8, padding: 12,
    marginBottom: 8, border: '1px solid #2d2d4a',
  },
  legHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  legIndex: {
    background: '#6366f1', color: '#fff', fontSize: 11,
    padding: '2px 6px', borderRadius: 4, fontWeight: 'bold',
  },
  legQuestion: { flex: 1, fontSize: 13, color: '#ddd' },
  removeBtn: {
    background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
    fontSize: 14, padding: '2px 6px',
  },
  legFields: { display: 'flex', gap: 8 },
  marketList: { maxHeight: 200, overflowY: 'auto', marginTop: 8 },
  marketItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '10px 12px', background: '#12122a',
    border: '1px solid #2d2d4a', borderRadius: 8, marginBottom: 6,
    color: '#ddd', fontSize: 13, textAlign: 'left' as const,
  },
  marketQ: { flex: 1, marginRight: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  marketPrice: { color: '#6366f1', fontWeight: 'bold', whiteSpace: 'nowrap' as const },
  summary: {
    marginTop: 20, padding: 16, background: '#12122a',
    borderRadius: 12, border: '1px solid #2d2d4a',
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', marginBottom: 8,
    fontSize: 14, color: '#ccc',
  },
  createBtn: {
    width: '100%', padding: '12px', marginTop: 12,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none', borderRadius: 10, color: '#fff',
    fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
  },
  templateCard: {
    background: '#12122a', borderRadius: 10, padding: 14,
    marginBottom: 10, border: '1px solid #2d2d4a',
  },
  templateHeader: { display: 'flex', gap: 8, marginBottom: 6 },
  templateTag: {
    background: '#6366f120', color: '#6366f1', fontSize: 11,
    padding: '2px 8px', borderRadius: 4,
  },
  templateCat: { fontSize: 11, color: '#888' },
  templateName: { fontSize: 15, fontWeight: 'bold', color: '#f0f0f0', marginBottom: 4 },
  templateDesc: { fontSize: 13, color: '#aaa', marginBottom: 8 },
  templateOdds: { fontSize: 13, color: '#10b981' },
  comboCard: {
    background: '#12122a', borderRadius: 10, padding: 14,
    marginBottom: 10, border: '1px solid #2d2d4a',
  },
  comboHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  comboName: { fontSize: 15, fontWeight: 'bold', color: '#f0f0f0' },
  statusBadge: {
    fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 'bold',
  },
  comboLegs: { marginBottom: 8 },
  comboLeg: {
    display: 'flex', gap: 8, padding: '4px 0', fontSize: 12,
    color: '#aaa', borderBottom: '1px solid #1e1e36',
  },
  comboLegQ: { flex: 1 },
  comboLegO: { color: '#6366f1' },
  comboLegPrice: { color: '#888' },
  comboFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 13, color: '#ccc',
  },
  cancelBtn: {
    background: 'none', border: '1px solid #ef4444', color: '#ef4444',
    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
  loading: { textAlign: 'center', padding: 40, color: '#888' },
  empty: { textAlign: 'center', padding: 40, color: '#888' },
  emptyHint: { fontSize: 12, color: '#666', marginTop: 8 },
  toast: {
    margin: '0 20px', padding: '10px 14px', borderRadius: 8,
    color: '#fff', fontSize: 13, display: 'flex', justifyContent: 'space-between',
  },
  toastClose: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
};
