/* ============================================================
   gamify.js — やる気のしくみ (レベル / XP / ストリーク / バッジ)
   storage オブジェクトを受け取り、達成状況を計算・更新する。
   UI には依存しない純粋ロジック層。
   ============================================================ */
const Gamify = (() => {
  // --- XP 配分 ---
  const XP_BASE = 12;        // なぞり完成の基本XP
  const XP_PER_STAR = 6;     // 星1つあたりのボーナス (1〜3)
  const XP_FIRST_TIME = 10;  // はじめての文字ボーナス

  // レベル L→L+1 に必要なXP (ゆるやかに増える)
  function xpForNext(level) {
    return 40 + (level - 1) * 15;
  }

  // 累計XP → {level, into(今のレベル内の獲得), need(次まで), pct}
  function levelInfo(xp) {
    let level = 1;
    let rem = Math.max(0, xp || 0);
    while (rem >= xpForNext(level)) {
      rem -= xpForNext(level);
      level++;
    }
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
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function dayDiff(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }

  // --- カテゴリ情報 (app から注入) ---
  let CTX = { cats: {}, total: 0 };
  function init(categoryChars) {
    CTX.cats = categoryChars || {};
    CTX.total = Object.values(CTX.cats).reduce((n, arr) => n + arr.length, 0);
  }

  // --- 統計 ---
  function doneCount(s) { return Object.keys(s.done || {}).length; }
  function totalStars(s) {
    return Object.values(s.stars || {}).reduce((a, b) => a + (b || 0), 0);
  }
  function perfectCount(s) {
    return Object.values(s.stars || {}).filter((v) => v >= 3).length;
  }
  function catDone(s, cat) {
    const arr = CTX.cats[cat] || [];
    return arr.length > 0 && arr.every((c) => s.done && s.done[c]);
  }
  function currentStreak(s) {
    if (!s.lastPlayDate) return 0;
    const diff = dayDiff(s.lastPlayDate, todayStr());
    return diff <= 1 ? (s.streakDays || 0) : 0; // きょう/きのう なら継続中
  }
  function todayCount(s) {
    return s.lastPlayDate === todayStr() ? (s.todayCount || 0) : 0;
  }
  function dailyGoal(s) {
    return s.dailyGoal || 3;
  }

  // --- バッジ定義 (16種) ---
  const BADGES = [
    { id: 'first',    icon: '🌱', name: 'はじめの いっぽ', desc: 'はじめて なぞれた',     check: (s) => doneCount(s) >= 1 },
    { id: 'ten',      icon: '✏️', name: '10もじ',          desc: '10もじ なぞれた',       check: (s) => doneCount(s) >= 10 },
    { id: 'fifty',    icon: '📗', name: '50もじ',          desc: '50もじ なぞれた',       check: (s) => doneCount(s) >= 50 },
    { id: 'hundred',  icon: '💯', name: '100もじ',         desc: '100もじ なぞれた',      check: (s) => doneCount(s) >= 100 },
    { id: 'allchars', icon: '👑', name: 'ぜんぶ せいは',    desc: '332もじ ぜんぶ',        check: (s) => doneCount(s) >= CTX.total },
    { id: 'hira',     icon: '🌸', name: 'ひらがな マスター', desc: 'ひらがな ぜんぶ',       check: (s) => catDone(s, 'hiragana') },
    { id: 'kata',     icon: '🌊', name: 'カタカナ マスター', desc: 'カタカナ ぜんぶ',       check: (s) => catDone(s, 'katakana') },
    { id: 'kanji1',   icon: '🍀', name: '1ねん せいは',     desc: '1ねんの かんじ ぜんぶ',  check: (s) => catDone(s, 'kanji1') },
    { id: 'kanji2',   icon: '🍁', name: '2ねん せいは',     desc: '2ねんの かんじ ぜんぶ',  check: (s) => catDone(s, 'kanji2') },
    { id: 'star10',   icon: '✨', name: 'ほし 10こ',       desc: '★を 10こ あつめた',     check: (s) => totalStars(s) >= 10 },
    { id: 'star50',   icon: '🌟', name: 'ほし 50こ',       desc: '★を 50こ あつめた',     check: (s) => totalStars(s) >= 50 },
    { id: 'perfect',  icon: '🎯', name: 'パーフェクト',     desc: '★★★を 10こ',          check: (s) => perfectCount(s) >= 10 },
    { id: 'streak3',  icon: '🔥', name: '3にち つづけた',   desc: '3にち れんぞく',        check: (s) => (s.bestStreak || 0) >= 3 },
    { id: 'streak7',  icon: '🏆', name: '1しゅうかん',      desc: '7にち れんぞく',        check: (s) => (s.bestStreak || 0) >= 7 },
    { id: 'level5',   icon: '🚀', name: 'レベル5',         desc: 'レベル5に なった',      check: (s) => levelInfo(s.xp || 0).level >= 5 },
    { id: 'level10',  icon: '🎓', name: 'レベル10',        desc: 'レベル10に なった',     check: (s) => levelInfo(s.xp || 0).level >= 10 },
  ];

  function badgeCount(s) {
    return Object.keys(s.badges || {}).length;
  }

  // 日付をまたいだらストリーク/きょうのカウントを更新 (s を変更)
  function touchDay(s) {
    const today = todayStr();
    if (s.lastPlayDate !== today) {
      if (s.lastPlayDate && dayDiff(s.lastPlayDate, today) === 1) {
        s.streakDays = (s.streakDays || 0) + 1; // 連続
      } else {
        s.streakDays = 1; // とぎれた / はじめて
      }
      s.lastPlayDate = today;
      s.todayCount = 0;
      s.bestStreak = Math.max(s.bestStreak || 0, s.streakDays);
    }
  }

  /* なぞり完成を記録。s を更新し、変化のサマリを返す。
     return { xpGain, leveledUp, level, newBadges:[badge], goalReached } */
  function recordCompletion(s, char, stars) {
    s.done = s.done || {};
    s.stars = s.stars || {};
    s.badges = s.badges || {};

    const firstTime = !s.done[char];
    s.done[char] = true;
    s.stars[char] = Math.max(s.stars[char] || 0, stars);

    // 日付・きょうの目標
    touchDay(s);
    const goalBefore = (s.todayCount || 0) >= dailyGoal(s);
    s.todayCount = (s.todayCount || 0) + 1;
    s.totalTraced = (s.totalTraced || 0) + 1;
    const goalReached = !goalBefore && s.todayCount >= dailyGoal(s);

    // XP / レベル
    const xpGain = XP_BASE + stars * XP_PER_STAR + (firstTime ? XP_FIRST_TIME : 0);
    const before = levelInfo(s.xp || 0);
    s.xp = (s.xp || 0) + xpGain;
    const after = levelInfo(s.xp);

    // バッジ (xp/streak 更新後に判定)
    const newBadges = [];
    for (const b of BADGES) {
      if (!s.badges[b.id] && b.check(s)) {
        s.badges[b.id] = todayStr();
        newBadges.push(b);
      }
    }

    return {
      xpGain,
      firstTime,
      leveledUp: after.level > before.level,
      level: after.level,
      levelInfo: after,
      newBadges,
      goalReached,
    };
  }

  /* 既存データの遡及反映 (アップデート後の初回など)。
     XP未記録なら達成ずみ文字からXPを再構成し、達成ずみバッジを付与する。
     何か変化したら true。 */
  function reconcile(s) {
    s.done = s.done || {};
    s.stars = s.stars || {};
    s.badges = s.badges || {};
    let changed = false;

    if (!s.xp) {
      let xp = 0;
      for (const ch of Object.keys(s.done)) {
        xp += XP_BASE + (s.stars[ch] || 1) * XP_PER_STAR + XP_FIRST_TIME;
      }
      if (xp > 0) { s.xp = xp; changed = true; }
    }

    for (const b of BADGES) {
      if (!s.badges[b.id] && b.check(s)) {
        s.badges[b.id] = todayStr();
        changed = true;
      }
    }
    return changed;
  }

  return {
    init,
    reconcile,
    BADGES,
    levelInfo,
    recordCompletion,
    // 表示用
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
    isBadgeEarned: (s, id) => !!(s.badges && s.badges[id]),
    badgeDate: (s, id) => (s.badges && s.badges[id]) || null,
  };
})();
