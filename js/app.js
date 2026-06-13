(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  // Category definitions
  const CATEGORIES = {
    hiragana: { name: 'ひらがな', data: HIRAGANA_DATA, kind: 'kana' },
    katakana: { name: 'カタカナ', data: KATAKANA_DATA, kind: 'kana' },
    kanji1: { name: 'かんじ 1ねんせい', data: KANJI1_DATA, kind: 'kanji' },
    kanji2: { name: 'かんじ 2ねんせい', data: KANJI2_DATA, kind: 'kanji' },
  };

  // DOM elements
  const screenHome = document.getElementById('screen-home');
  const screenList = document.getElementById('screen-list');
  const screenPractice = document.getElementById('screen-practice');
  const btnCatHiragana = document.getElementById('btn-cat-hiragana');
  const btnCatKatakana = document.getElementById('btn-cat-katakana');
  const btnCatKanji1 = document.getElementById('btn-cat-kanji1');
  const btnCatKanji2 = document.getElementById('btn-cat-kanji2');
  const btnSound = document.getElementById('btn-sound');
  const btnListBack = document.getElementById('btn-list-back');
  const listTitle = document.getElementById('list-title');
  const charGrid = document.getElementById('char-grid');
  const btnPracticeBack = document.getElementById('btn-practice-back');
  const btnPrevChar = document.getElementById('btn-prev-char');
  const btnNextChar = document.getElementById('btn-next-char');
  const practiceCharLabel = document.getElementById('practice-char-label');
  const practiceStrokeCount = document.getElementById('practice-stroke-count');
  const tabWatch = document.getElementById('tab-watch');
  const tabTrace = document.getElementById('tab-trace');
  const stageEl = document.getElementById('stage');
  const traceMsg = document.getElementById('trace-msg');
  const watchControls = document.getElementById('watch-controls');
  const traceControls = document.getElementById('trace-controls');
  const btnPlay = document.getElementById('btn-play');
  const btnStepPrev = document.getElementById('btn-step-prev');
  const btnStepNext = document.getElementById('btn-step-next');
  const speedBtns = document.querySelectorAll('.speed-btn');
  const btnNumbers = document.getElementById('btn-numbers');
  const btnTraceRestart = document.getElementById('btn-trace-restart');
  const overlayCelebrate = document.getElementById('overlay-celebrate');
  const celebrateText = document.getElementById('celebrate-text');
  const celebrateStars = document.getElementById('celebrate-stars');
  const btnCelebrateAgain = document.getElementById('btn-celebrate-again');
  const btnCelebrateNext = document.getElementById('btn-celebrate-next');
  const confettiBox = document.getElementById('confetti-box');
  const celebrateRewards = document.getElementById('celebrate-rewards');
  // ダッシュボード
  const levelRing = document.getElementById('level-ring');
  const playerLevelEl = document.getElementById('player-level');
  const xpTextEl = document.getElementById('xp-text');
  const xpFillEl = document.getElementById('xp-fill');
  const dailyDotsEl = document.getElementById('daily-dots');
  const statStreakEl = document.getElementById('stat-streak');
  const statStarsEl = document.getElementById('stat-stars');
  const statBadgesEl = document.getElementById('stat-badges');
  // バッジ画面
  const btnBadges = document.getElementById('btn-badges');
  const btnBadgesBack = document.getElementById('btn-badges-back');
  const badgesSummary = document.getElementById('badges-summary');
  const badgeGrid = document.getElementById('badge-grid');

  // State
  let state = {
    cat: null,
    char: null,
    mode: 'watch',
    speed: 'normal',
  };
  let watchPlayTimer = null; // みるモードの自動再生タイマー

  // Player and Tracer
  let player = new StrokePlayer(stageEl);
  let tracer = new Tracer(stageEl, player, {
    onMsg: setMsg,
    onStrokeDone: onStrokeDone,
    onFail: onFail,
    onAllDone: onAllDone,
  });

  // Storage helpers
  const STORAGE_KEY = 'kakijun-master-v1';

  const loadStorage = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { soundOn: true, done: {}, stars: {} };
    } catch {
      return { soundOn: true, done: {}, stars: {} };
    }
  };

  const saveStorage = (storage) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    } catch {}
  };

  let storage = loadStorage();

  // Initialize
  function init() {
    // Gamify にカテゴリの文字リストを渡す
    Gamify.init({
      hiragana: Object.keys(HIRAGANA_DATA),
      katakana: Object.keys(KATAKANA_DATA),
      kanji1: Object.keys(KANJI1_DATA),
      kanji2: Object.keys(KANJI2_DATA),
    });
    // 旧バージョンの進捗があれば XP・バッジを遡って反映
    if (Gamify.reconcile(storage)) {
      saveStorage(storage);
    }

    Sounds.setOn(storage.soundOn !== false);
    updateSoundBtn();

    document.addEventListener('pointerdown', () => Sounds.ensure(), { once: true });

    // Category buttons
    btnCatHiragana.addEventListener('click', () => openCategory('hiragana'));
    btnCatKatakana.addEventListener('click', () => openCategory('katakana'));
    btnCatKanji1.addEventListener('click', () => openCategory('kanji1'));
    btnCatKanji2.addEventListener('click', () => openCategory('kanji2'));

    // List screen
    btnListBack.addEventListener('click', () => {
      showScreen('screen-home');
    });

    // Badges screen
    btnBadges.addEventListener('click', openBadges);
    btnBadgesBack.addEventListener('click', () => showScreen('screen-home'));

    // Practice screen
    btnPracticeBack.addEventListener('click', () => {
      cancelWatchPlay();
      tracer.stop();
      player.stop();
      openCategory(state.cat);
    });
    btnPrevChar.addEventListener('click', prevChar);
    btnNextChar.addEventListener('click', nextChar);

    // Mode tabs
    tabWatch.addEventListener('click', switchToWatch);
    tabTrace.addEventListener('click', switchToTrace);

    // Watch controls
    btnPlay.addEventListener('click', () => {
      Sounds.play('tap');
      player.play(state.speed);
    });
    btnStepPrev.addEventListener('click', () => {
      player.stop();
      player.showUpTo(Math.max(0, player.shownCount - 1));
      Sounds.play('tap');
    });
    btnStepNext.addEventListener('click', () => {
      player.stop();
      player.showUpTo(Math.min(player.strokeCount, player.shownCount + 1));
      Sounds.play('tap');
    });
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        speedBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.speed = btn.dataset.speed;
        Sounds.play('tap');
      });
    });
    btnNumbers.addEventListener('click', () => {
      btnNumbers.classList.toggle('active');
      const visible = btnNumbers.classList.contains('active');
      player.setNumbersVisible(visible);
      Sounds.play('tap');
    });

    // Trace controls
    btnTraceRestart.addEventListener('click', () => {
      Sounds.play('tap');
      tracer.restart();
      setMsg('あかい まるから なぞってね!');
    });

    // Celebrate
    btnCelebrateAgain.addEventListener('click', () => {
      overlayCelebrate.classList.remove('show');
      startTrace();
    });
    btnCelebrateNext.addEventListener('click', () => {
      overlayCelebrate.classList.remove('show');
      nextChar(); // mode は 'trace' のままなので、次の字もなぞりモードで開く
    });
    overlayCelebrate.addEventListener('click', (e) => {
      if (e.target === overlayCelebrate) {
        overlayCelebrate.classList.remove('show');
      }
    });

    // Sound button
    btnSound.addEventListener('click', () => {
      const on = Sounds.toggle();
      storage.soundOn = on;
      saveStorage(storage);
      updateSoundBtn();
      if (on) {
        Sounds.play('tap');
      }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (screenPractice.classList.contains('active')) {
        if (e.key === 'ArrowLeft') {
          prevChar();
        } else if (e.key === 'ArrowRight') {
          nextChar();
        }
      }
    });

    showScreen('screen-home');
  }

  function updateSoundBtn() {
    btnSound.textContent = Sounds.isOn() ? '🔊' : '🔇';
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) {
      screen.classList.add('active');
      if (id === 'screen-home') {
        updateCategoryProgress();
        renderDashboard();
      }
    }
  }

  function updateCategoryProgress() {
    Object.keys(CATEGORIES).forEach((catKey) => {
      const cat = CATEGORIES[catKey];
      const chars = Object.keys(cat.data);
      const doneCount = chars.filter((c) => storage.done[c]).length;
      const btn = document.querySelector(`.cat-btn[data-cat="${catKey}"]`);
      if (btn) {
        const progress = btn.querySelector('.cat-progress');
        if (progress) {
          progress.textContent = `${doneCount} / ${chars.length}`;
        }
        const fill = btn.querySelector('.cat-bar-fill');
        if (fill) {
          fill.style.width = chars.length ? `${Math.round((doneCount / chars.length) * 100)}%` : '0%';
        }
      }
    });
  }

  // ホームのダッシュボードを描画
  function renderDashboard() {
    const st = Gamify.stats(storage);
    const li = st.levelInfo;
    playerLevelEl.textContent = li.level;
    levelRing.style.background =
      `conic-gradient(var(--primary) ${li.pct * 3.6}deg, var(--line) 0deg)`;
    xpTextEl.textContent = `${li.into} / ${li.need}`;
    xpFillEl.style.width = `${li.pct}%`;
    statStreakEl.textContent = st.streak;
    statStarsEl.textContent = st.stars;
    statBadgesEl.textContent = `${st.badges}/${st.badgeTotal}`;

    // きょうのもくひょう (ドット + 達成表示)
    dailyDotsEl.innerHTML = '';
    const goal = st.dailyGoal;
    const done = Math.min(st.todayCount, goal);
    for (let i = 0; i < goal; i++) {
      const dot = document.createElement('span');
      dot.className = 'daily-dot' + (i < done ? ' on' : '');
      dailyDotsEl.appendChild(dot);
    }
    if (st.todayCount >= goal) {
      const tag = document.createElement('span');
      tag.className = 'daily-done';
      tag.textContent = 'たっせい!';
      dailyDotsEl.appendChild(tag);
    }
  }

  // バッジ画面 (系統ごとにセクション分け)
  function openBadges() {
    Sounds.play('tap');
    const st = Gamify.stats(storage);
    badgesSummary.textContent = `${st.badges} / ${st.badgeTotal} こ あつめたよ!`;
    badgeGrid.innerHTML = '';

    Gamify.GROUPS.forEach((g) => {
      const items = Gamify.BADGES.filter((b) => b.group === g.key);
      if (!items.length) return;
      const earnedN = items.filter((b) => Gamify.isBadgeEarned(storage, b.id)).length;

      const section = document.createElement('section');
      section.className = 'badge-section';
      const h = document.createElement('h3');
      h.className = 'badge-group';
      h.innerHTML = `<span>${g.label}</span><span class="badge-group-count">${earnedN} / ${items.length}</span>`;
      section.appendChild(h);

      const row = document.createElement('div');
      row.className = 'badge-row';
      items.forEach((b, i) => {
        const earned = Gamify.isBadgeEarned(storage, b.id);
        const cell = document.createElement('div');
        cell.className = 'badge-cell' + (earned ? '' : ' locked');
        cell.style.animationDelay = `${Math.min(i * 0.02, 0.3)}s`;
        const date = earned ? Gamify.badgeDate(storage, b.id) : null;
        cell.innerHTML =
          `<span class="badge-ico">${earned ? b.icon : '🔒'}</span>` +
          `<span class="badge-text">` +
          `<span class="badge-name">${b.name}</span>` +
          `<span class="badge-desc">${b.desc}</span>` +
          (date ? `<span class="badge-date">${date} に ゲット</span>` : '') +
          `</span>`;
        row.appendChild(cell);
      });
      section.appendChild(row);
      badgeGrid.appendChild(section);
    });

    showScreen('screen-badges');
  }

  function openCategory(cat) {
    Sounds.play('tap');
    state.cat = cat;
    const category = CATEGORIES[cat];
    listTitle.textContent = category.name;
    charGrid.className = category.kind;
    charGrid.dataset.cat = cat;
    charGrid.innerHTML = '';

    const chars = Object.keys(category.data);
    chars.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'char-btn';
      if (storage.done[c]) {
        btn.classList.add('done');
        const tier = Gamify.charTier(Gamify.playsOf(storage, c));
        if (tier !== 'done' && tier !== 'none') {
          btn.dataset.tier = tier; // 🥉🥈🥇 メダル表示
        }
      }
      btn.dataset.char = c;
      btn.textContent = c;
      btn.addEventListener('click', () => openChar(cat, c));
      charGrid.appendChild(btn);
    });

    showScreen('screen-list');
  }

  function openChar(cat, c) {
    state.cat = cat;
    state.char = c;
    tracer.stop();
    const catData = CATEGORIES[cat];
    const charData = catData.data[c];
    if (!charData) return;

    practiceCharLabel.textContent = c;
    player.load(charData);
    practiceStrokeCount.textContent = `ぜんぶで ${player.strokeCount}かく`;

    if (state.mode === 'watch') {
      switchToWatch();
    } else {
      switchToTrace();
    }

    showScreen('screen-practice');
  }

  function prevChar() {
    const cat = state.cat;
    const chars = Object.keys(CATEGORIES[cat].data);
    const idx = chars.indexOf(state.char);
    if (idx < 0) return;
    const newIdx = (idx - 1 + chars.length) % chars.length;
    openChar(cat, chars[newIdx]);
  }

  function nextChar() {
    const cat = state.cat;
    const chars = Object.keys(CATEGORIES[cat].data);
    const idx = chars.indexOf(state.char);
    if (idx < 0) return;
    const newIdx = (idx + 1) % chars.length;
    openChar(cat, chars[newIdx]);
  }

  // みるモードの自動再生は遅延起動するので、モード切替時に必ず取り消す
  // (これをしないと、字をひらいて すぐ「なぞる」を押したとき再生が割り込む)
  function cancelWatchPlay() {
    if (watchPlayTimer) {
      clearTimeout(watchPlayTimer);
      watchPlayTimer = null;
    }
  }

  function switchToWatch() {
    state.mode = 'watch';
    tabWatch.classList.add('active');
    tabTrace.classList.remove('active');
    watchControls.classList.remove('hidden');
    traceControls.classList.add('hidden');
    tracer.stop();
    traceMsg.textContent = '';
    player.reset();
    cancelWatchPlay();
    watchPlayTimer = setTimeout(() => {
      watchPlayTimer = null;
      player.play(state.speed);
    }, 350);
  }

  function switchToTrace() {
    cancelWatchPlay();
    state.mode = 'trace';
    tabWatch.classList.remove('active');
    tabTrace.classList.add('active');
    watchControls.classList.add('hidden');
    traceControls.classList.remove('hidden');
    startTrace();
  }

  function startTrace() {
    const catData = CATEGORIES[state.cat];
    const charData = catData.data[state.char];
    cancelWatchPlay();
    player.reset();
    tracer.start(charData);
    setMsg('あかい まるから なぞってね!');
  }

  function setMsg(text) {
    traceMsg.textContent = text;
  }

  function onStrokeDone(i) {
    Sounds.play('stroke');
    const messages = ['いいね!', 'じょうず!', 'その ちょうし!', 'うまい!'];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    setMsg(msg);
  }

  function onFail(i, fails) {
    Sounds.play('wrong');
    const msg = fails >= 2 ? 'おてほんを よく みてね' : 'おしい! もういちど!';
    setMsg(msg);
    // ステージを小さく振って「ちがうよ」を伝える
    const card = document.querySelector('.stage-card');
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth; // アニメーション再始動
      card.classList.add('shake');
      card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
    }
  }

  function onAllDone(totalFails) {
    const stars = totalFails === 0 ? 3 : totalFails <= 2 ? 2 : 1;
    // Gamify が done/stars/xp/streak/バッジ をまとめて更新
    const result = Gamify.recordCompletion(storage, state.char, stars);
    saveStorage(storage);
    Sounds.play('fanfare');
    celebrate(stars, result);

    // メダル昇格・レベルアップ・バッジ獲得は少し遅らせて専用音を重ねる
    let delay = 650;
    if (result.medal) {
      setTimeout(() => Sounds.play('badge'), delay);
      delay += 450;
    }
    if (result.leveledUp) {
      setTimeout(() => Sounds.play('levelup'), delay);
      delay += 450;
    }
    if (result.newBadges.length) {
      setTimeout(() => Sounds.play('badge'), delay);
    }
  }

  function celebrate(stars, result) {
    // メッセージは「はじめて」か「くり返し」かで変える
    let pool;
    if (result && !result.firstTime) {
      pool = ['すごい!', 'じょうず!', 'かんぺき!', 'やったね!', 'その ちょうし!'];
    } else {
      pool = ['はじめて かけたね!', 'よくできました!', 'はなまる!', 'すごい!'];
    }
    celebrateText.textContent = pool[Math.floor(Math.random() * pool.length)];

    // ★はCSSの::beforeで描画 (未獲得はグレーの★)。クラスだけ切り替える
    const starSpans = celebrateStars.querySelectorAll('.star');
    starSpans.forEach((s, i) => {
      s.textContent = '';
      s.classList.toggle('on', i < stars);
    });

    // ごほうび (XP / レベルアップ / 新バッジ)
    renderRewards(result);

    confettiBox.innerHTML = '';
    // メダル昇格・レベルアップなど特別なときは紙ふぶき増量＆金色多め
    const special = result && (result.medal || result.leveledUp);
    const colors = result && result.medal === 'gold'
      ? ['#FFD700', '#FFC53D', '#FFB84D', '#FFE08A', '#FF6B9D', '#5AC8FA']
      : ['#FF6B9D', '#FFD700', '#5AC8FA', '#7CCD7C', '#FFB84D', '#b39ddb'];
    const pieces = special ? 44 : 26;
    for (let i = 0; i < pieces; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const x = Math.random() * 100;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const d = 1.6 + Math.random() * 1.4;
      const delay = Math.random() * 0.5;
      piece.style.setProperty('--x', `${x}vw`);
      piece.style.setProperty('--c', color);
      piece.style.setProperty('--d', `${d}s`);
      piece.style.setProperty('--delay', `${delay}s`);
      confettiBox.appendChild(piece);
    }

    overlayCelebrate.classList.add('show');

    setTimeout(() => {
      confettiBox.innerHTML = '';
    }, 3500);
  }

  // おいわい内の「ごほうび」表示 (くり返し・メダル・XP・レベル・新バッジ)
  function renderRewards(result) {
    celebrateRewards.innerHTML = '';
    if (!result) return;

    // ○かいめ! (2回目以降に特別感)
    if (result.playCount >= 2) {
      const pill = document.createElement('div');
      pill.className = 'reward-count';
      pill.textContent = `${result.playCount}かいめ クリア!`;
      celebrateRewards.appendChild(pill);
    }

    // メダル昇格 (3回🥉 / 5回🥈 / 10回🥇)
    if (result.medal) {
      const info = Gamify.TIER_INFO[result.medal];
      const medal = document.createElement('div');
      medal.className = `reward-medal medal-${result.medal}`;
      medal.innerHTML = `<span class="rm-ico">${info.icon}</span>` +
        `<span>${info.label} メダル ゲット!</span>`;
      celebrateRewards.appendChild(medal);
    }

    // 獲得XP
    const xp = document.createElement('div');
    xp.className = 'reward-xp';
    xp.textContent = `+${result.xpGain} XP`;
    celebrateRewards.appendChild(xp);

    // レベルアップ
    if (result.leveledUp) {
      const lv = document.createElement('div');
      lv.className = 'reward-level';
      lv.textContent = `🎉 レベル ${result.level} に なった!`;
      celebrateRewards.appendChild(lv);
    }

    // 新バッジ
    if (result.newBadges && result.newBadges.length) {
      const wrap = document.createElement('div');
      wrap.className = 'reward-badges';
      result.newBadges.slice(0, 6).forEach((b, i) => {
        const chip = document.createElement('div');
        chip.className = 'reward-badge';
        chip.style.animationDelay = `${0.45 + i * 0.12}s`;
        chip.innerHTML =
          `<span class="rb-new">NEW</span>` +
          `<span class="rb-ico">${b.icon}</span>` +
          `<span>${b.name}</span>`;
        wrap.appendChild(chip);
      });
      if (result.newBadges.length > 6) {
        const more = document.createElement('div');
        more.className = 'reward-badge';
        more.style.animationDelay = '1.2s';
        more.innerHTML = `<span class="rb-ico">➕</span><span>ほか ${result.newBadges.length - 6}こ</span>`;
        wrap.appendChild(more);
      }
      celebrateRewards.appendChild(wrap);
    }
  }
})();
