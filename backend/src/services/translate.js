/**
 * Polymarket 市场数据英译中服务
 * 
 * 策略：模式匹配（高频句式，零延迟）+ API 兜底（低频句式，保证覆盖）
 * 翻译结果缓存，避免重复请求
 */

const axios = require('axios');

// ========== 词典 ==========

// 国家/地区名称
const COUNTRY_MAP = {
  'United States': '美国', 'USA': '美国', 'US': '美国', 'U.S.': '美国',
  'China': '中国', 'Chinese': '中国',
  'Russia': '俄罗斯', 'Russian': '俄罗斯',
  'Ukraine': '乌克兰',
  'India': '印度',
  'Japan': '日本', 'Japanese': '日本',
  'South Korea': '韩国', 'Korea': '韩国', 'North Korea': '朝鲜',
  'United Kingdom': '英国', 'UK': '英国', 'Britain': '英国', 'British': '英国',
  'France': '法国', 'French': '法国',
  'Germany': '德国', 'German': '德国',
  'Italy': '意大利', 'Italian': '意大利',
  'Spain': '西班牙', 'Spanish': '西班牙',
  'Portugal': '葡萄牙', 'Portuguese': '葡萄牙',
  'Netherlands': '荷兰', 'Dutch': '荷兰',
  'Belgium': '比利时',
  'Switzerland': '瑞士',
  'Sweden': '瑞典',
  'Norway': '挪威',
  'Denmark': '丹麦',
  'Finland': '芬兰',
  'Poland': '波兰',
  'Austria': '奥地利',
  'Greece': '希腊',
  'Turkey': '土耳其', 'Turkish': '土耳其',
  'Iran': '伊朗', 'Iranian': '伊朗',
  'Iraq': '伊拉克',
  'Saudi Arabia': '沙特阿拉伯', 'Saudi': '沙特',
  'UAE': '阿联酋', 'United Arab Emirates': '阿联酋',
  'Qatar': '卡塔尔',
  'Israel': '以色列', 'Israeli': '以色列',
  'Palestine': '巴勒斯坦',
  'Egypt': '埃及',
  'South Africa': '南非',
  'Nigeria': '尼日利亚',
  'Kenya': '肯尼亚',
  'Ethiopia': '埃塞俄比亚',
  'Ghana': '加纳',
  'Senegal': '塞内加尔',
  'Morocco': '摩洛哥',
  'Algeria': '阿尔及利亚',
  'Cameroon': '喀麦隆',
  'Ivory Coast': '科特迪瓦', "Côte d'Ivoire": '科特迪瓦',
  'Tunisia': '突尼斯',
  'Cape Verde': '佛得角',
  'Canada': '加拿大',
  'Mexico': '墨西哥', 'Mexican': '墨西哥',
  'Brazil': '巴西', 'Brazilian': '巴西',
  'Argentina': '阿根廷', 'Argentine': '阿根廷',
  'Colombia': '哥伦比亚',
  'Chile': '智利',
  'Peru': '秘鲁',
  'Ecuador': '厄瓜多尔',
  'Venezuela': '委内瑞拉',
  'Uruguay': '乌拉圭',
  'Paraguay': '巴拉圭',
  'Bolivia': '玻利维亚',
  'Panama': '巴拿马',
  'Costa Rica': '哥斯达黎加',
  'Honduras': '洪都拉斯',
  'Jamaica': '牙买加',
  'Cuba': '古巴',
  'Haiti': '海地',
  'Australia': '澳大利亚', 'Australian': '澳大利亚',
  'New Zealand': '新西兰',
  'Indonesia': '印度尼西亚',
  'Malaysia': '马来西亚',
  'Philippines': '菲律宾',
  'Thailand': '泰国',
  'Vietnam': '越南',
  'Singapore': '新加坡',
  'Taiwan': '中国台湾',
  'Hong Kong': '中国香港',
  'Macau': '中国澳门', 'Macao': '中国澳门',
  'Pakistan': '巴基斯坦',
  'Bangladesh': '孟加拉国',
  'Serbia': '塞尔维亚',
  'Croatia': '克罗地亚',
  'Czech Republic': '捷克',
  'Hungary': '匈牙利',
  'Romania': '罗马尼亚',
  'Bulgaria': '保加利亚',
  'Slovakia': '斯洛伐克',
  'Slovenia': '斯洛文尼亚',
  'Lithuania': '立陶宛',
  'Latvia': '拉脱维亚',
  'Estonia': '爱沙尼亚',
  'Iceland': '冰岛',
  'Ireland': '爱尔兰',
  'Scotland': '苏格兰',
  'Wales': '威尔士',
  'Syria': '叙利亚',
  'Yemen': '也门',
  'Libya': '利比亚',
  'Sudan': '苏丹',
  'Congo': '刚果',
  'Zimbabwe': '津巴布韦',
  'Myanmar': '缅甸',
  'Afghanistan': '阿富汗',
  'Belarus': '白俄罗斯',
  'Kazakhstan': '哈萨克斯坦',
  'Uzbekistan': '乌兹别克斯坦',
};

// 常见词汇
const TERM_MAP = {
  'FIFA World Cup': '世界杯', 'World Cup': '世界杯',
  'President': '总统', 'president': '总统',
  'Prime Minister': '总理', 'prime minister': '总理',
  'election': '选举', 'Election': '选举',
  'interest rate': '利率', 'interest rates': '利率',
  'Fed': '美联储', 'Federal Reserve': '美联储',
  'bps': '个基点', 'basis points': '个基点',
  'GDP': 'GDP', 'gdp': 'GDP',
  'inflation': '通胀',
  'recession': '衰退',
  'tariff': '关税', 'tariffs': '关税',
  'sanctions': '制裁',
  'ceasefire': '停火',
  'agreement': '协议',
  'treaty': '条约',
  'summit': '峰会',
  'debate': '辩论',
  'referendum': '公投',
  'cabinet': '内阁',
  'parliament': '议会',
  'congress': '国会',
  'senate': '参议院',
  'house': '众议院',
  'supreme court': '最高法院',
  'constitution': '宪法',
  'impeachment': '弹劾',
  'resign': '辞职',
  'approval rating': '支持率',
  'poll': '民调',
  'crypto': '加密货币',
  'Bitcoin': '比特币', 'BTC': '比特币',
  'Ethereum': '以太坊', 'ETH': '以太坊',
  'stock': '股票', 'stocks': '股票',
  'S&P 500': '标普500', 'SPX': '标普500',
  'NASDAQ': '纳斯达克',
  'Dow Jones': '道琼斯',
  'gold': '黄金',
  'oil': '原油',
  'barrel': '桶',
  'ounce': '盎司',
  'market cap': '市值',
  'regulation': '监管',
  'GDPR': 'GDPR',
  'AI': '人工智能',
  'artificial intelligence': '人工智能',
  'AGI': '通用人工智能',
  'chip': '芯片',
  'semiconductor': '半导体',
  'launch': '发射',
  'satellite': '卫星',
  'missile': '导弹',
  'nuclear': '核',
  'military': '军事',
  'troops': '军队',
  'NATO': '北约',
  'EU': '欧盟', 'European Union': '欧盟',
  'UN': '联合国', 'United Nations': '联合国',
  'WHO': '世界卫生组织',
  'IMF': '国际货币基金组织',
  'OPEC': '欧佩克',
  'Oscar': '奥斯卡',
  'Grammy': '格莱美',
  'Emmy': '艾美奖',
  'NBA': 'NBA',
  'NFL': 'NFL',
  'MLB': 'MLB',
  'NHL': 'NHL',
  'UFC': 'UFC',
  'F1': 'F1',
  'Premier League': '英超',
  'La Liga': '西甲',
  'Serie A': '意甲',
  'Bundesliga': '德甲',
  'Champions League': '欧冠',
  'UEFA': '欧足联',
  'FIFA': '国际足联',
  'Olympics': '奥运会',
  'Wimbledon': '温网',
  'tournament': '锦标赛',
  'championship': '冠军赛',
  'final': '决赛',
  'semifinal': '半决赛',
  'quarterfinal': '四分之一决赛',
  'group stage': '小组赛',
  'knockout': '淘汰赛',
  'penalty': '点球',
  'overtime': '加时赛',
  'score': '比分',
  'goal': '进球',
  'title': '冠军',
  'MVP': 'MVP',
  'rookie': '新秀',
  'transfer': '转会',
  'GDP growth': 'GDP增长',
  'unemployment': '失业率',
  'CPI': 'CPI', 'consumer price index': '消费者价格指数',
  'PPI': 'PPI',
  'PMI': 'PMI',
  'trade deficit': '贸易逆差',
  'budget deficit': '预算赤字',
  'national debt': '国债',
  'yield': '收益率',
  'bond': '债券',
  'Treasury': '国债',
  'stimulus': '刺激措施',
  'bailout': '救助',
  'bankruptcy': '破产',
  'default': '违约',
  'merger': '合并',
  'acquisition': '收购',
  'IPO': 'IPO',
  'startup': '创业公司',
  'unicorn': '独角兽',
  'layoff': '裁员',
  'strike': '罢工',
  'protest': '抗议',
  'riot': '骚乱',
  'coup': '政变',
  'civil war': '内战',
  'invasion': '入侵',
  'withdrawal': '撤军',
  'peace deal': '和平协议',
  'humanitarian': '人道主义',
  'refugee': '难民',
  'border': '边境',
  'visa': '签证',
  'immigration': '移民',
  'deportation': '驱逐',
  'asylum': '庇护',
  'citizenship': '公民身份',
  'passport': '护照',
  'pandemic': '大流行病',
  'vaccine': '疫苗',
  'outbreak': '疫情爆发',
  'lockdown': '封锁',
  'climate': '气候',
  'carbon': '碳',
  'emissions': '排放',
  'renewable': '可再生能源',
  'temperature': '温度',
  'earthquake': '地震',
  'hurricane': '飓风',
  'flood': '洪水',
  'wildfire': '野火',
  'drought': '干旱',
  'melting': '融化',
  'ice cap': '冰盖',
  'sea level': '海平面',
  // 月份
  'January': '1月', 'February': '2月', 'March': '3月', 'April': '4月',
  'May': '5月', 'June': '6月', 'July': '7月', 'August': '8月',
  'September': '9月', 'October': '10月', 'November': '11月', 'December': '12月',
  // 时间
  'today': '今天', 'tomorrow': '明天', 'yesterday': '昨天',
  'this week': '本周', 'next week': '下周', 'last week': '上周',
  'this month': '本月', 'next month': '下个月',
  'this year': '今年', 'next year': '明年',
  'Monday': '周一', 'Tuesday': '周二', 'Wednesday': '周三',
  'Thursday': '周四', 'Friday': '周五', 'Saturday': '周六', 'Sunday': '周日',
  'weekend': '周末',
};

// 翻译缓存
const cache = new Map();
const CACHE_MAX_SIZE = 10000;

function cacheKey(text) {
  return text.trim();
}

function getCached(text) {
  const key = cacheKey(text);
  return cache.get(key);
}

function setCache(text, translation) {
  const key = cacheKey(text);
  if (cache.size >= CACHE_MAX_SIZE) {
    // 清除最老的 1000 条
    const keys = [...cache.keys()].slice(0, 1000);
    keys.forEach(k => cache.delete(k));
  }
  cache.set(key, translation);
}

// ========== 模式匹配规则 ==========

/**
 * 规则引擎：将英文问题/标题翻译为中文
 * 返回 null 表示无法匹配，需要走 API 兜底
 */
function translateByPattern(text) {
  if (!text || typeof text !== 'string') return text;

  let result = text.trim();

  // ---- 二元选项 ----
  if (result === 'Yes') return '是';
  if (result === 'No') return '否';
  if (result === 'Buy') return '买入';
  if (result === 'Sell') return '卖出';

  // ---- 体育比赛 ----

  // "Will X win the 2026 FIFA World Cup?" → "X会赢得2026年世界杯吗？"
  let match = result.match(/^Will (.+?) win the (\d{4}) FIFA World Cup\??$/i);
  if (match) {
    return `${translateNames(match[1])}会赢得${match[2]}年世界杯吗？`;
  }

  // "X to win the World Cup" → "X赢得世界杯"
  match = result.match(/^(.+?) to win the (?:FIFA )?World Cup$/i);
  if (match) {
    return `${translateNames(match[1])}赢得世界杯`;
  }

  // "Will X win the [tournament]?" → "X会赢得[赛事]吗？"
  match = result.match(/^Will (.+?) win (?:the )?(.+?)\??$/i);
  if (match) {
    const team = translateNames(match[1]);
    const tournament = translateTerms(match[2]);
    return `${team}会赢得${tournament}吗？`;
  }

  // "X vs Y - Winner" → "X vs Y - 胜者"
  match = result.match(/^(.+?)\s+vs\.?\s+(.+?)\s*[-–—]\s*Winner$/i);
  if (match) {
    return `${translateNames(match[1])} vs ${translateNames(match[2])} - 胜者`;
  }

  // "X vs Y - Moneyline" → "X vs Y - 胜负盘"
  match = result.match(/^(.+?)\s+vs\.?\s+(.+?)\s*[-–—]\s*Moneyline$/i);
  if (match) {
    return `${translateNames(match[1])} vs ${translateNames(match[2])} - 胜负盘`;
  }

  // ---- 政治 ----

  // "Will X be the next Prime Minister of Y?"
  match = result.match(/^Will (.+?) be the next (Prime Minister|President|Chancellor|Mayor|Governor) of (.+?)\??$/i);
  if (match) {
    const person = translateNames(match[1]);
    const title = translateTerms(match[2]);
    const country = translateNames(match[3]);
    return `${person}会成为${country}的下一任${title}吗？`;
  }

  // "Will X be re-elected as President of Y?"
  match = result.match(/^Will (.+?) be re[- ]?elected as (?:the )?(.+?) of (.+?)\??$/i);
  if (match) {
    const person = translateNames(match[1]);
    const title = translateTerms(match[2]);
    const country = translateNames(match[3]);
    return `${person}会连任${country}${title}吗？`;
  }

  // "Will X win the Y presidential election?"
  match = result.match(/^Will (.+?) win the (.+?) presidential election\??$/i);
  if (match) {
    const person = translateNames(match[1]);
    const country = translateNames(match[2]);
    return `${person}会赢得${country}总统选举吗？`;
  }

  // ---- 经济/金融 ----

  // "Will the Fed decrease/increase/hold/cut/raise interest rates by X bps after the Y meeting?"
  match = result.match(/^Will the Fed (decrease|increase|hold|cut|raise) interest rates by (\d+\+?\s*bps) after the (.+?) meeting\??$/i);
  if (match) {
    const actions = { decrease: '降息', increase: '加息', cut: '降息', raise: '加息', hold: '维持利率不变' };
    const action = actions[match[1].toLowerCase()] || match[1];
    const bps = match[2].replace('bps', '个基点');
    const meeting = translateTerms(match[3]);
    return `美联储会在${meeting}会议后${action}${bps}吗？`;
  }

  // "Will the ECB/Fed cut rates by X bps?"
  match = result.match(/^Will (?:the )?(ECB|Fed|BOE|BOJ|PBOC|RBA|RBNZ) (cut|raise|hold) rates by (\d+)\+?\s*bps\??$/i);
  if (match) {
    const banks = { ECB: '欧洲央行', Fed: '美联储', BOE: '英国央行', BOJ: '日本央行', PBOC: '中国人民银行', RBA: '澳洲联储', RBNZ: '新西兰联储' };
    const bank = banks[match[1].toUpperCase()] || match[1];
    const actions = { cut: '降息', raise: '加息', hold: '维持利率' };
    const action = actions[match[3].toLowerCase()] || match[3];
    return `${bank}会${action}${match[2]}个基点吗？`;
  }

  // ---- 国际关系 ----

  // "X and Y sign an agreement by Z?"
  match = result.match(/^(.+?) and (.+?) sign an? (.+?) by (.+?)\??$/i);
  if (match) {
    const a = translateNames(match[1]);
    const b = translateNames(match[2]);
    const agreement = translateTerms(match[3]);
    const date = translateTerms(match[4]);
    return `${a}和${b}会在${date}前签署${agreement}吗？`;
  }

  // ---- 通用句式 ----

  // "Will X [do something]?"
  match = result.match(/^Will (.+?)$/i);
  if (match) {
    const rest = translateNames(translateTerms(match[1]));
    return `${rest}吗？`;
  }

  // "Is X going to [do something]?"
  match = result.match(/^Is (.+?) going to (.+?)\??$/i);
  if (match) {
    const subject = translateNames(translateTerms(match[1]));
    const action = translateTerms(match[2]);
    return `${subject}将会${action}吗？`;
  }

  // ---- 数量相关 ----

  // "X price above/below Y by Z?" → "X价格在Z前高于/低于Y吗？"
  match = result.match(/^(.+?) price (above|below) \$?([\d,.]+[KMB]?) by (.+?)\??$/i);
  if (match) {
    const thing = translateTerms(match[1]);
    const direction = match[2] === 'above' ? '高于' : '低于';
    const price = match[3];
    const date = translateTerms(match[4]);
    return `${thing}价格在${date}前${direction}$${price}吗？`;
  }

  // 无法匹配，返回 null（走 API 兜底）
  return null;
}

function translateNames(text) {
  let result = text;
  // 按长度降序替换，避免短词覆盖长词
  const sortedKeys = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, COUNTRY_MAP[key]);
  }
  return result;
}

function translateTerms(text) {
  let result = text;
  const sortedKeys = Object.keys(TERM_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(regex, TERM_MAP[key]);
  }
  return result;
}

/**
 * 主要翻译函数
 * @param {string} text - 要翻译的英文文本
 * @param {Object} options
 * @param {boolean} options.useApi - 是否使用 API 兜底（默认 true）
 * @returns {Promise<string>}
 */
async function translateText(text, options = {}) {
  if (!text || typeof text !== 'string') return text || '';

  // 检查缓存
  const cached = getCached(text);
  if (cached !== undefined) return cached;

  // 尝试规则翻译
  const patternResult = translateByPattern(text);
  if (patternResult !== null) {
    setCache(text, patternResult);
    return patternResult;
  }

  // 应用词典翻译（作为基础兜底）
  let dictResult = translateNames(translateTerms(text));
  if (dictResult !== text) {
    setCache(text, dictResult);
    return dictResult;
  }

  // API 兜底（默认开启）
  if (options.useApi !== false) {
    try {
      const apiResult = await translateViaApi(text);
      if (apiResult) {
        setCache(text, apiResult);
        return apiResult;
      }
    } catch {
      // API 失败，返回原文
    }
  }

  // 完全无法翻译，返回原文
  setCache(text, text);
  return text;
}

/**
 * 通过 MyMemory 免费 API 翻译
 */
async function translateViaApi(text) {
  const { data } = await axios.get('https://api.mymemory.translated.net/get', {
    params: { q: text, langpair: 'en|zh-CN' },
    timeout: 5000,
  });

  if (data?.responseData?.translatedText) {
    const translated = data.responseData.translatedText;
    // 如果翻译结果和原文一样，说明 API 也没翻译成功
    if (translated.toLowerCase() !== text.toLowerCase()) {
      return translated;
    }
  }
  return null;
}

/**
 * 批量翻译多项文本
 */
async function translateMany(texts, options = {}) {
  if (!texts || !Array.isArray(texts)) return texts;
  const results = await Promise.all(texts.map(t => translateText(t, options)));
  return results;
}

/**
 * 翻译市场对象
 * @param {Object} market - 市场对象
 * @param {Object} options
 * @returns {Promise<Object>} 翻译后的市场对象（新增 _zh 字段，同时保留原字段）
 */
async function translateMarket(market, options = {}) {
  if (!market) return market;

  const title = market.question || market.title || '';
  const translatedTitle = await translateText(title, options);

  let translatedOutcomes = null;
  if (market.outcomes) {
    const outcomes = typeof market.outcomes === 'string'
      ? JSON.parse(market.outcomes)
      : market.outcomes;
    if (Array.isArray(outcomes)) {
      translatedOutcomes = await translateMany(outcomes, options);
    }
  }

  return {
    ...market,
    // 保留原字段
    question_zh: translatedTitle,
    title_zh: translatedTitle,
    outcomes_zh: translatedOutcomes,
  };
}

/**
 * 批量翻译市场列表（优化：先集中翻译所有文本，再组装）
 */
async function translateMarkets(markets, options = {}) {
  if (!markets || !Array.isArray(markets)) return markets;
  if (markets.length === 0) return markets;

  // 收集所有需要翻译的文本
  const textsToTranslate = [];
  const textIndices = []; // [{marketIdx, field}]

  markets.forEach((m, i) => {
    const title = m.question || m.title || '';
    if (title) {
      textIndices.push({ marketIdx: i, field: 'title', text: title });
    }

    if (m.outcomes) {
      const outcomes = typeof m.outcomes === 'string'
        ? (() => { try { return JSON.parse(m.outcomes); } catch { return []; } })()
        : m.outcomes;
      if (Array.isArray(outcomes)) {
        outcomes.forEach((o, oi) => {
          if (typeof o === 'string') {
            textIndices.push({ marketIdx: i, field: `outcome_${oi}`, text: o });
          }
        });
      }
    }
  });

  // 去重
  const uniqueTexts = [...new Set(textIndices.map(ti => ti.text))];

  // 批量翻译
  const translations = {};
  await Promise.all(uniqueTexts.map(async (t) => {
    translations[t] = await translateText(t, options);
  }));

  // 组装结果
  return markets.map((m, i) => {
    const marketTexts = textIndices.filter(ti => ti.marketIdx === i);
    const titleText = marketTexts.find(ti => ti.field === 'title');
    const outcomeTexts = marketTexts.filter(ti => ti.field.startsWith('outcome_'));

    const translatedOutcomes = outcomeTexts.length > 0
      ? outcomeTexts.map(ot => translations[ot.text] || ot.text)
      : null;

    return {
      ...m,
      question_zh: titleText ? (translations[titleText.text] || titleText.text) : undefined,
      title_zh: titleText ? (translations[titleText.text] || titleText.text) : undefined,
      outcomes_zh: translatedOutcomes,
    };
  });
}

module.exports = {
  translateText,
  translateMany,
  translateMarket,
  translateMarkets,
  translateByPattern,
  translateNames,
  translateTerms,
};
