/* ============================================================
   gamify.js — やる気のしくみ
   レベル/XP・ストリーク・きょうの目標・くり返しメダル・バッジ(約100種)
   storage を受け取り達成状況を計算/更新する純粋ロジック層 (UI非依存)。
   ============================================================ */
const Gamify = (() => {
  // --- XP 配分 ---
  const XP_BASE = 12;        // なぞり完成の基本XP
  const XP_PER_STAR = 6;     // 星1つあたり (1〜3)
  const XP_FIRST_TIME = 10;  // はじめての文字ボーナス
  const XP_MEDAL = { bronze: 20, silver: 30, gold: 50 }; // メダル昇格ボーナス

  function xpForNext(level) { return 40 + (level - 1) * 15; }
  function levelInfo(xp) {
    let level = 1;
    let rem = Math.max(0, xp || 0);
    while (rem >= xpForNext(level)) { rem -= xpForNext(level); level++; }
    const need = xpForNext(level);
    return { level, into: rem, need, pct: Math.round((rem / need) * 100) };
  }

  // --- 日付 (ローカル) ---
  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function parseDate(str) { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d); }
  function dayDiff(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }

  // --- カテゴリ情報 (app から注入) ---
  let CTX = { cats: {}, total: 0 };
  function init(categoryChars) {
    CTX.cats = categoryChars || {};
    CTX.total = Object.values(CTX.cats).reduce((n, arr) => n + arr.length, 0);
  }

  // --- 統計ヘルパ ---
  function doneCount(s) { return Object.keys(s.done || {}).length; }
  function totalStars(s) { return Object.values(s.stars || {}).reduce((a, b) => a + (b || 0), 0); }
  function perfectCount(s) { return Object.values(s.stars || {}).filter((v) => v >= 3).length; }
  function catCount(s, cat) {
    const arr = CTX.cats[cat] || [];
    return arr.filter((c) => s.done && s.done[c]).length;
  }
  function playsOf(s) { return s.plays || {}; }
  function maxPlays(s) {
    const p = playsOf(s); let m = 0;
    for (const k in p) if (p[k] > m) m = p[k];
    return m;
  }
  function countPlaysAtLeast(s, n) {
    const p = playsOf(s); let c = 0;
    for (const k in p) if (p[k] >= n) c++;
    return c;
  }
  function totalTraced(s) { return s.totalTraced || 0; }
  function goalDays(s) { return s.goalDays || 0; }
  function currentStreak(s) {
    if (!s.lastPlayDate) return 0;
    return dayDiff(s.lastPlayDate, todayStr()) <= 1 ? (s.streakDays || 0) : 0;
  }
  function todayCount(s) { return s.lastPlayDate === todayStr() ? (s.todayCount || 0) : 0; }
  function dailyGoal(s) { return s.dailyGoal || 3; }

  // くり返しメダルの段階
  function charTier(p) {
    if (p >= 10) return 'gold';
    if (p >= 5) return 'silver';
    if (p >= 3) return 'bronze';
    if (p >= 1) return 'done';
    return 'none';
  }
  const TIER_RANK = { none: 0, done: 1, bronze: 2, silver: 3, gold: 4 };
  const TIER_INFO = {
    bronze: { icon: '🥉', label: 'ブロンズ' },
    silver: { icon: '🥈', label: 'シルバー' },
    gold:   { icon: '🥇', label: 'ゴールド' },
  };

  // ============================================================
  // バッジ生成 (約100種) — 9系統を体系的に
  // ============================================================
  const BADGES = [];
  function add(group, id, icon, name, desc, check) {
    BADGES.push({ group, id, icon, name, desc, check });
  }
  function addTiers(group, idPrefix, thresholds, icons, nameFn, descFn, checkFn) {
    thresholds.forEach((n, i) => {
      add(group, idPrefix + n, icons[i] || icons[icons.length - 1], nameFn(n), descFn(n), (s) => checkFn(s, n));
    });
  }

  // (A) もじすう
  addTiers('char', 'done_',
    [1, 5, 10, 20, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300],
    ['🌱', '🌿', '✏️', '📒', '📓', '📚', '📗', '📘', '📙', '💯', '🎈', '🎀', '🎁', '🏵️', '🌟', '💎'],
    (n) => `${n}もじ`, (n) => `${n}もじ なぞれた`,
    (s, n) => doneCount(s) >= n);
  add('char', 'done_all', '👑', 'ぜんぶ せいは', '332もじ ぜんぶ', (s) => doneCount(s) >= CTX.total);

  // (B) カテゴリ
  const CAT_DEFS = [
    { key: 'hiragana', label: 'ひらがな',    icons: ['🌷', '🌸', '💮', '👑'] },
    { key: 'katakana', label: 'カタカナ',    icons: ['💧', '🌊', '🐳', '👑'] },
    { key: 'kanji1',   label: '1ねんかんじ', icons: ['☘️', '🍀', '🌳', '👑'] },
    { key: 'kanji2',   label: '2ねんかんじ', icons: ['🍂', '🍁', '🌰', '👑'] },
  ];
  CAT_DEFS.forEach((cd) => {
    const total = (CTX.cats[cd.key] || []).length || { hiragana: 46, katakana: 46, kanji1: 80, kanji2: 160 }[cd.key];
    const qs = [Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total];
    qs.forEach((n, i) => {
      add('cat', `${cd.key}_${n}`, cd.icons[i],
        i === 3 ? `${cd.label} マスター` : `${cd.label} ${n}もじ`,
        i === 3 ? `${cd.label} ぜんぶ` : `${cd.label}を ${n}もじ`,
        (s) => catCount(s, cd.key) >= n);
    });
  });

  // (C) ほし
  addTiers('star', 'star_',
    [10, 25, 50, 75, 100, 150, 200, 300, 400, 500],
    ['⭐', '✨', '🌟', '💫', '⭐', '✨', '🌟', '💫', '🌠', '👑'],
    (n) => `ほし ${n}こ`, (n) => `★を ${n}こ あつめた`,
    (s, n) => totalStars(s) >= n);

  // (D) パーフェクト (★★★)
  addTiers('perfect', 'perfect_',
    [1, 5, 10, 20, 30, 50, 75, 100],
    ['🎯', '🎯', '🏅', '🏅', '🎖️', '🎖️', '🏆', '👑'],
    (n) => `パーフェクト ${n}`, (n) => `★★★を ${n}もじ`,
    (s, n) => perfectCount(s) >= n);

  // (E) くりかえし (同じ字 / メダル数)
  addTiers('repeat', 'rep_',
    [2, 3, 5, 10],
    ['🔁', '🔁', '🔂', '♾️'],
    (n) => `おなじ字 ${n}かい`, (n) => `おなじ字を ${n}かい クリア`,
    (s, n) => maxPlays(s) >= n);
  addTiers('repeat', 'bronze_', [1, 5, 20], ['🥉', '🥉', '🥉'],
    (n) => `ブロンズ ${n}こ`, (n) => `ブロンズいじょう ${n}もじ`,
    (s, n) => countPlaysAtLeast(s, 3) >= n);
  addTiers('repeat', 'silver_', [1, 5, 20], ['🥈', '🥈', '🥈'],
    (n) => `シルバー ${n}こ`, (n) => `シルバーいじょう ${n}もじ`,
    (s, n) => countPlaysAtLeast(s, 5) >= n);
  addTiers('repeat', 'gold_', [1, 5, 20], ['🥇', '🥇', '🥇'],
    (n) => `ゴールド ${n}こ`, (n) => `ゴールド ${n}もじ`,
    (s, n) => countPlaysAtLeast(s, 10) >= n);

  // (F) れんぞく
  addTiers('streak', 'streak_',
    [2, 3, 5, 7, 10, 14, 21, 30, 50, 100],
    ['🔥', '🔥', '🔥', '🏕️', '🏕️', '⛺', '🏆', '🏆', '💎', '👑'],
    (n) => `れんぞく ${n}にち`, (n) => `${n}にち つづけた`,
    (s, n) => (s.bestStreak || 0) >= n);

  // (G) レベル
  addTiers('level', 'level_',
    [2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50],
    ['⬆️', '🚀', '🚀', '🎓', '🎓', '⭐', '🌟', '💫', '🏆', '💎', '👑'],
    (n) => `レベル ${n}`, (n) => `レベル${n}に なった`,
    (s, n) => levelInfo(s.xp || 0).level >= n);

  // (H) れんしゅう (のべ回数)
  addTiers('trace', 'trace_',
    [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000],
    ['💪', '💪', '✊', '🏃', '🏃', '🏋️', '🥋', '🏆', '💎', '👑'],
    (n) => `れんしゅう ${n}かい`, (n) => `${n}かい なぞった`,
    (s, n) => totalTraced(s) >= n);

  // (I) まいにち (もくひょう達成日数)
  addTiers('daily', 'goal_',
    [1, 3, 7, 14, 30],
    ['✅', '📅', '📅', '🗓️', '👑'],
    (n) => `もくひょう ${n}にち`, (n) => `きょうのもくひょうを ${n}にち`,
    (s, n) => goalDays(s) >= n);

  // 系統の表示順・ラベル
  const GROUPS = [
    { key: 'char',    label: 'もじすう' },
    { key: 'cat',     label: 'カテゴリ' },
    { key: 'star',    label: 'ほし' },
    { key: 'perfect', label: 'パーフェクト' },
    { key: 'repeat',  label: 'くりかえし' },
    { key: 'streak',  label: 'れんぞく' },
    { key: 'level',   label: 'レベル' },
    { key: 'trace',   label: 'れんしゅう' },
    { key: 'daily',   label: 'まいにち' },
  ];

  // 現行バッジIDのみを数える (旧バージョンの孤立IDを除外)
  const BADGE_IDS = new Set(BADGES.map((b) => b.id));
  function badgeCount(s) {
    return Object.keys(s.badges || {}).filter((id) => BADGE_IDS.has(id)).length;
  }

  // 日付をまたいだらストリーク/きょうのカウントを更新
  function touchDay(s) {
    const today = todayStr();
    if (s.lastPlayDate !== today) {
      if (s.lastPlayDate && dayDiff(s.lastPlayDate, today) === 1) {
        s.streakDays = (s.streakDays || 0) + 1;
      } else {
        s.streakDays = 1;
      }
      s.lastPlayDate = today;
      s.todayCount = 0;
      s.bestStreak = Math.max(s.bestStreak || 0, s.streakDays);
    }
  }

  /* なぞり完成を記録。s を更新しサマリを返す。
     { xpGain, firstTime, playCount, tier, tierUp, medal, leveledUp, level, levelInfo, newBadges, goalReached } */
  function recordCompletion(s, char, stars) {
    s.done = s.done || {};
    s.stars = s.stars || {};
    s.badges = s.badges || {};
    s.plays = s.plays || {};

    const firstTime = !s.done[char];
    s.done[char] = true;
    s.stars[char] = Math.max(s.stars[char] || 0, stars);

    // くり返し回数・メダル昇格
    const prevPlays = s.plays[char] || 0;
    const playCount = prevPlays + 1;
    s.plays[char] = playCount;
    const prevTier = charTier(prevPlays);
    const tier = charTier(playCount);
    const tierUp = TIER_RANK[tier] > TIER_RANK[prevTier] && tier !== 'done';
    const medal = tierUp ? tier : null;

    // 日付・きょうの目標
    touchDay(s);
    const goalBefore = (s.todayCount || 0) >= dailyGoal(s);
    s.todayCount = (s.todayCount || 0) + 1;
    s.totalTraced = (s.totalTraced || 0) + 1;
    const goalReached = !goalBefore && s.todayCount >= dailyGoal(s);
    if (goalReached) s.goalDays = (s.goalDays || 0) + 1;

    // XP / レベル
    let xpGain = XP_BASE + stars * XP_PER_STAR + (firstTime ? XP_FIRST_TIME : 0);
    if (medal) xpGain += XP_MEDAL[medal] || 0;
    const before = levelInfo(s.xp || 0);
    s.xp = (s.xp || 0) + xpGain;
    const after = levelInfo(s.xp);

    // バッジ (各種カウンタ更新後に判定)
    const newBadges = [];
    for (const b of BADGES) {
      if (!s.badges[b.id] && b.check(s)) {
        s.badges[b.id] = todayStr();
        newBadges.push(b);
      }
    }

    return {
      xpGain, firstTime, playCount, tier, tierUp, medal,
      leveledUp: after.level > before.level,
      level: after.level, levelInfo: after,
      newBadges, goalReached,
    };
  }

  /* 既存データの遡及反映 (アップデート後の初回など)。何か変われば true。 */
  function reconcile(s) {
    s.done = s.done || {};
    s.stars = s.stars || {};
    s.badges = s.badges || {};
    s.plays = s.plays || {};
    let changed = false;

    // XP 未記録なら達成ずみ文字から再構成
    if (!s.xp) {
      let xp = 0;
      for (const ch of Object.keys(s.done)) {
        xp += XP_BASE + (s.stars[ch] || 1) * XP_PER_STAR + XP_FIRST_TIME;
      }
      if (xp > 0) { s.xp = xp; changed = true; }
    }
    // 完成ずみ文字に最低1プレイを付与 (メダル段階の土台)
    for (const ch of Object.keys(s.done)) {
      if (!s.plays[ch]) { s.plays[ch] = 1; changed = true; }
    }
    // 達成ずみバッジを付与
    for (const b of BADGES) {
      if (!s.badges[b.id] && b.check(s)) { s.badges[b.id] = todayStr(); changed = true; }
    }
    return changed;
  }

  return {
    init,
    reconcile,
    BADGES,
    GROUPS,
    TIER_INFO,
    levelInfo,
    charTier,
    recordCompletion,
    stats: (s) => ({
      level: levelInfo(s.xp || 0).level,
      levelInfo: levelInfo(s.xp || 0),
      streak: currentStreak(s),
      stars: totalStars(s),
      done: doneCount(s),
      total: CTX.total,
      badges: badgeCount(s),
      badgeTotal: BADGES.length,
      todayCount: todayCount(s),
      dailyGoal: dailyGoal(s),
    }),
    playsOf: (s, ch) => (s.plays && s.plays[ch]) || 0,
    isBadgeEarned: (s, id) => !!(s.badges && s.badges[id]),
    badgeDate: (s, id) => (s.badges && s.badges[id]) || null,
  };
})();
