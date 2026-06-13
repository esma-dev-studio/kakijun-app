class Tracer {
  constructor(svgEl, player, cb) {
    this.svgEl = svgEl;
    this.player = player;
    this.cb = cb;

    this.charData = null;
    this.currentStroke = 0;
    this.totalFails = 0;
    this.strokeFails = 0;
    this.active = false;
    this.busy = false;
    this.activePt = null;
    this.collecting = null;
    this.inkPolyline = null;
    this.lastPt = null;
    this.farthestArc = 0;

    // Pointer handling
    this._pointerDown = this._pointerDown.bind(this);
    this._pointerMove = this._pointerMove.bind(this);
    this._pointerUp = this._pointerUp.bind(this);
  }

  start(charData) {
    this.charData = charData;
    this.player.reset();
    this.currentStroke = 0;
    this.totalFails = 0;
    this.strokeFails = 0;
    this.active = true;
    this.busy = false;
    this.activePt = null;

    this.svgEl.addEventListener('pointerdown', this._pointerDown);
    this.svgEl.addEventListener('pointermove', this._pointerMove);
    this.svgEl.addEventListener('pointerup', this._pointerUp);
    this.svgEl.addEventListener('pointercancel', this._pointerUp);

    this._setupStroke();
  }

  stop() {
    this.active = false;
    this.svgEl.removeEventListener('pointerdown', this._pointerDown);
    this.svgEl.removeEventListener('pointermove', this._pointerMove);
    this.svgEl.removeEventListener('pointerup', this._pointerUp);
    this.svgEl.removeEventListener('pointercancel', this._pointerUp);
    this._clearInk();
    this._clearMarkers();
  }

  restart() {
    if (this.charData) {
      this.stop();
      this.start(this.charData);
    }
  }

  dispose() {
    this.stop();
  }

  _setupStroke() {
    if (this.currentStroke >= this.player.strokeCount) return;

    this.player.markerLayer.innerHTML = '';
    const basePath = this.player.basePaths[this.currentStroke];
    if (!basePath) return;

    const len = basePath.getTotalLength();

    // Ghost preview
    const ghost = basePath.cloneNode(true);
    ghost.setAttribute('stroke', '#ffc1d0');
    ghost.setAttribute('stroke-width', '5');
    ghost.setAttribute('stroke-dasharray', '3.5 3.5');
    ghost.setAttribute('stroke-linecap', 'round');
    ghost.setAttribute('stroke-linejoin', 'round');
    this.player.markerLayer.appendChild(ghost);

    // Start marker (pulsing circle)
    const p0 = basePath.getPointAtLength(0);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p0.x);
    circle.setAttribute('cy', p0.y);
    circle.setAttribute('r', '4.5');
    circle.setAttribute('fill', '#ff3b30');
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'r');
    animate.setAttribute('values', '3.5;5;3.5');
    animate.setAttribute('dur', '1s');
    animate.setAttribute('repeatCount', 'indefinite');
    circle.appendChild(animate);
    this.player.markerLayer.appendChild(circle);

    // Direction arrow
    const p1Len = Math.min(10, len * 0.3);
    const p1 = basePath.getPointAtLength(p1Len);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Line from p0 to p1
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p0.x);
    line.setAttribute('y1', p0.y);
    line.setAttribute('x2', p1.x);
    line.setAttribute('y2', p1.y);
    line.setAttribute('stroke', '#ff3b30');
    line.setAttribute('stroke-width', '1.6');
    line.setAttribute('stroke-linecap', 'round');
    this.player.markerLayer.appendChild(line);

    // Arrow head (triangle at p1)
    const arrowSize = 3.5;
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const rad = angle * (Math.PI / 180);
    const ax = p1.x;
    const ay = p1.y;
    const baseX1 = ax - arrowSize * Math.cos(rad - Math.PI / 6);
    const baseY1 = ay - arrowSize * Math.sin(rad - Math.PI / 6);
    const baseX2 = ax - arrowSize * Math.cos(rad + Math.PI / 6);
    const baseY2 = ay - arrowSize * Math.sin(rad + Math.PI / 6);
    arrowPath.setAttribute('points', `${ax},${ay} ${baseX1},${baseY1} ${baseX2},${baseY2}`);
    arrowPath.setAttribute('fill', '#ff3b30');
    this.player.markerLayer.appendChild(arrowPath);

    // Precompute sample points (終点は必ず含める — 短い点画の到達判定に必須)
    this._samplePts = [];
    const sampleDist = 2;
    for (let s = 0; s <= len; s += sampleDist) {
      const pt = basePath.getPointAtLength(s);
      this._samplePts.push({ x: pt.x, y: pt.y, arc: s });
    }
    if (this._samplePts.length === 0 || this._samplePts[this._samplePts.length - 1].arc < len) {
      const pt = basePath.getPointAtLength(len);
      this._samplePts.push({ x: pt.x, y: pt.y, arc: len });
    }
    this._pathLen = len;
  }

  _pointerDown(e) {
    if (!this.active || this.busy) return;
    if (this.activePt !== null) return; // Multi-touch guard

    const basePath = this.player.basePaths[this.currentStroke];
    if (!basePath) return;

    const svgPt = this._toSvgPoint(e);
    const p0 = basePath.getPointAtLength(0);
    const dist = Math.sqrt((svgPt.x - p0.x) ** 2 + (svgPt.y - p0.y) ** 2);

    if (dist > 25) {
      this.cb.onMsg('あかい まるから かいてね');
      return;
    }

    this.activePt = e.pointerId;
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) { /* 合成イベント等でキャプチャ不可なら無視 */ }

    this.collecting = [svgPt];
    this.lastPt = svgPt;
    this.farthestArc = 0;

    this.inkPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    this.inkPolyline.setAttribute('points', `${svgPt.x},${svgPt.y}`);
    this.inkPolyline.setAttribute('fill', 'none');
    this.inkPolyline.setAttribute('stroke', '#ffa726');
    this.inkPolyline.setAttribute('stroke-width', '6');
    this.inkPolyline.setAttribute('stroke-linecap', 'round');
    this.inkPolyline.setAttribute('stroke-linejoin', 'round');
    this.inkPolyline.setAttribute('opacity', '0.92');
    this.player.inkLayer.appendChild(this.inkPolyline);
  }

  _pointerMove(e) {
    if (!this.active || this.activePt !== e.pointerId || !this.collecting) return;

    const svgPt = this._toSvgPoint(e);
    const dist = Math.sqrt((svgPt.x - this.lastPt.x) ** 2 + (svgPt.y - this.lastPt.y) ** 2);

    if (dist > 0.8) {
      this.collecting.push(svgPt);
      this.lastPt = svgPt;

      // Update polyline
      let pts = '';
      for (let p of this.collecting) {
        pts += `${p.x},${p.y} `;
      }
      this.inkPolyline.setAttribute('points', pts);
    }
  }

  _pointerUp(e) {
    if (!this.active || this.activePt !== e.pointerId) return;

    this.activePt = null;
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch (err) { /* キャプチャ未保持なら無視 */ }

    if (this.collecting && this.collecting.length >= 2) {
      this._judge(this.collecting); // 点のような短い画にも対応
    } else {
      this._clearInk(); // ただのタップは失敗にしない
    }
    this.collecting = null;
  }

  _judge(userPts) {
    if (this._evaluate(userPts, this._samplePts, this._pathLen)) {
      this._success();
    } else {
      this._fail();
    }
  }

  // 純粋な判定関数 (true=合格)。テスト容易性のため副作用なし。
  _evaluate(userPts, samples, len) {
    // 自己交差する画 (あ・お・ぬ等) でも誤爆しない「進捗ウィンドウ」方式。
    // 現在の進捗弧長の近傍 [progress-BACK, progress+AHEAD] にあるサンプル点
    // だけを最近点候補にし、進捗は単調に前進させる。
    const TOL = 16;    // 許容距離 (子供向けに甘め)
    const BACK = 10;   // 戻り許容
    const AHEAD = 30;  // 先読みウィンドウ

    // 速いストロークで点間が飛んでも追従できるよう線形補間
    const pts = [];
    for (let i = 0; i < userPts.length; i++) {
      const p = userPts[i];
      if (i > 0) {
        const q = userPts[i - 1];
        const d = this._dist(p, q);
        const steps = Math.floor(d / 6);
        for (let k = 1; k <= steps; k++) {
          pts.push({ x: q.x + ((p.x - q.x) * k) / (steps + 1), y: q.y + ((p.y - q.y) * k) / (steps + 1) });
        }
      }
      pts.push(p);
    }

    let progress = 0;
    let offPath = 0;
    let dirSum = 0; // 移動方向とパス接線方向の一致度 (逆走防止)
    let dirN = 0;
    for (let pi = 0; pi < pts.length; pi++) {
      const up = pts[pi];
      let best = null;
      let bestD = Infinity;
      for (const sp of samples) {
        if (sp.arc < progress - BACK || sp.arc > progress + AHEAD) continue;
        const d = this._dist(up, sp);
        if (d < bestD) { bestD = d; best = sp; }
      }
      if (best && bestD <= TOL) {
        if (best.arc > progress) progress = best.arc;
        if (pi > 0) {
          const mvx = up.x - pts[pi - 1].x;
          const mvy = up.y - pts[pi - 1].y;
          const mlen = Math.hypot(mvx, mvy);
          const idx = Math.min(samples.length - 1, Math.round(best.arc / 2));
          const a = samples[Math.max(0, idx - 1)];
          const b = samples[Math.min(samples.length - 1, idx + 1)];
          const tx = b.x - a.x;
          const ty = b.y - a.y;
          const tlen = Math.hypot(tx, ty);
          if (mlen > 0.5 && tlen > 0.5) {
            dirSum += (mvx * tx + mvy * ty) / (mlen * tlen);
            dirN++;
          }
        }
      } else {
        offPath++;
      }
    }

    // 1) 軌跡の逸脱が多すぎないか
    if (offPath / pts.length > 0.15) return false;
    // 2) 終点まで到達したか (進捗は単調なので逆行チェックは不要)
    if (progress < len * 0.82) return false;
    // 2.5) 書き方向の一致 (逆走防止)。点のような短い画 (方向サンプル不足) は免除
    if (dirN >= 4 && dirSum / dirN < 0.2) return false;
    // 3) カバレッジ: ショートカット防止
    let covered = 0;
    for (const sp of samples) {
      for (const up of pts) {
        if (this._dist(sp, up) <= TOL) { covered++; break; }
      }
    }
    if (covered / samples.length < 0.8) return false;

    return true;
  }

  async _success() {
    this.busy = true;
    const doneIndex = this.currentStroke;
    this._clearInk();
    this._clearMarkers();

    await this.player.animateStroke(doneIndex, 'fast');
    this.player.showUpTo(doneIndex + 1);

    const basePath = this.player.basePaths[doneIndex];
    const pathEnd = basePath.getPointAtLength(this._pathLen);

    this.cb.onStrokeDone(doneIndex);
    this.strokeFails = 0;
    this.currentStroke++;

    if (this.currentStroke >= this.player.strokeCount) {
      this.stop(); // マーカー類をクリアしてから完了演出へ
      this.cb.onAllDone(this.totalFails);
    } else {
      this._setupStroke(); // 次の画のマーカーを先に描く (キラキラはその上に重ねる)
      this.busy = false;
    }

    // キラキラ演出 (setupStroke のクリア後に追加するので消えない)
    for (let j = 0; j < 3; j++) {
      const sparkle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sparkle.setAttribute('x', pathEnd.x + (Math.random() - 0.5) * 10);
      sparkle.setAttribute('y', pathEnd.y + (Math.random() - 0.5) * 10);
      sparkle.setAttribute('font-size', '8');
      sparkle.textContent = '✨';
      this.player.markerLayer.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 600);
    }
  }

  _fail() {
    this._clearInk();
    this.strokeFails++;
    this.totalFails++;
    this.cb.onFail(this.currentStroke, this.strokeFails);

    if (this.strokeFails >= 2) {
      this._showHintDemo();
    } else {
      this._showMarkersAgain();
    }
  }

  async _showHintDemo() {
    this.busy = true;
    await this.player.animateStroke(this.currentStroke, 'slow');
    this.player.showUpTo(this.currentStroke);
    this._showMarkersAgain();
    this.busy = false;
  }

  _showMarkersAgain() {
    // Lazy: just re-setup (assumes markers are already in place from setup)
    // In practice, we just redraw them
    if (this.active) {
      this._setupStroke();
    }
  }

  _clearInk() {
    this.player.inkLayer.innerHTML = '';
  }

  _clearMarkers() {
    this.player.markerLayer.innerHTML = '';
  }

  _toSvgPoint(e) {
    // スクリーン座標 → viewBox座標 (getScreenCTMの逆行列を直接適用)
    const ctm = this.svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = this.svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  _dist(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }
}
