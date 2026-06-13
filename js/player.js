class StrokePlayer {
  constructor(svgEl) {
    this.svgEl = svgEl;
    this.charData = null;
    this.shownCount = 0;
    this._gen = 0;
    this.numbersVisible = true;

    // Create layer structure in z-order
    this.layerGuide = this._createLayer('layerGuide');
    this.layerBase = this._createLayer('layerBase');
    this.layerDone = this._createLayer('layerDone');
    this.layerAnim = this._createLayer('layerAnim');
    this.layerInk = this._createLayer('layerInk');
    this.layerMarkers = this._createLayer('layerMarkers');
    this.layerNumbers = this._createLayer('layerNumbers');

    // Draw static guide
    this._drawGuide();
  }

  _createLayer(id) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = id;
    this.svgEl.appendChild(g);
    return g;
  }

  _drawGuide() {
    // Outer rounded rect
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '1.5');
    rect.setAttribute('y', '1.5');
    rect.setAttribute('width', '106');
    rect.setAttribute('height', '106');
    rect.setAttribute('rx', '10');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#f0d8e2');
    rect.setAttribute('stroke-width', '1.5');
    this.layerGuide.appendChild(rect);

    // Horizontal dashed line through 54.5
    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hLine.setAttribute('x1', '0');
    hLine.setAttribute('y1', '54.5');
    hLine.setAttribute('x2', '109');
    hLine.setAttribute('y2', '54.5');
    hLine.setAttribute('stroke', '#f0d8e2');
    hLine.setAttribute('stroke-width', '1');
    hLine.setAttribute('stroke-dasharray', '4 3');
    this.layerGuide.appendChild(hLine);

    // Vertical dashed line through 54.5
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', '54.5');
    vLine.setAttribute('y1', '0');
    vLine.setAttribute('x2', '54.5');
    vLine.setAttribute('y2', '109');
    vLine.setAttribute('stroke', '#f0d8e2');
    vLine.setAttribute('stroke-width', '1');
    vLine.setAttribute('stroke-dasharray', '4 3');
    this.layerGuide.appendChild(vLine);
  }

  load(charData) {
    this.stop();
    this._clearLayer(this.layerBase);
    this._clearLayer(this.layerDone);
    this._clearLayer(this.layerAnim);
    this._clearLayer(this.layerInk);
    this._clearLayer(this.layerMarkers);
    this._clearLayer(this.layerNumbers);

    this.charData = charData;
    this.shownCount = 0;

    // Create base paths
    if (charData.strokes) {
      charData.strokes.forEach((d) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#dcdce6');
        path.setAttribute('stroke-width', '5');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        this.layerBase.appendChild(path);
      });
    }

    // Create number labels
    if (charData.numbers) {
      charData.numbers.forEach((pos, idx) => {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos[0]);
        text.setAttribute('y', pos[1]);
        text.setAttribute('font-size', '7');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#ff8c00');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = idx + 1;
        if (!this.numbersVisible) {
          text.setAttribute('visibility', 'hidden');
        }
        this.layerNumbers.appendChild(text);
      });
    }
  }

  setNumbersVisible(visible) {
    this.numbersVisible = visible;
    const texts = this.layerNumbers.querySelectorAll('text');
    texts.forEach((t) => {
      t.setAttribute('visibility', visible ? 'visible' : 'hidden');
    });
  }

  getNumbersVisible() {
    return this.numbersVisible;
  }

  get strokeCount() {
    return this.charData ? this.charData.strokes.length : 0;
  }

  get basePaths() {
    return Array.from(this.layerBase.querySelectorAll('path'));
  }

  get inkLayer() {
    return this.layerInk;
  }

  get markerLayer() {
    return this.layerMarkers;
  }

  showUpTo(n) {
    this.stop();
    const count = Math.max(0, Math.min(n, this.strokeCount));
    this._clearLayer(this.layerDone);
    this._clearLayer(this.layerAnim);

    // Draw strokes 0..n-1 in done style
    const basePaths = this.basePaths;
    for (let i = 0; i < count; i++) {
      if (basePaths[i]) {
        const pathClone = basePaths[i].cloneNode(true);
        pathClone.setAttribute('stroke', '#32324e');
        pathClone.setAttribute('stroke-width', '5');
        this.layerDone.appendChild(pathClone);
      }
    }

    this.shownCount = count;
  }

  async animateStroke(i, speed = 'normal') {
    if (i < 0 || i >= this.strokeCount) return false;

    const gen = this._gen;
    const basePath = this.basePaths[i];
    if (!basePath) return false;

    const pathClone = basePath.cloneNode(true);
    pathClone.setAttribute('stroke', '#ff5a78');
    pathClone.setAttribute('stroke-width', '5.5');
    pathClone.setAttribute('stroke-linecap', 'round');
    pathClone.setAttribute('stroke-linejoin', 'round');
    this.layerAnim.appendChild(pathClone);

    const len = pathClone.getTotalLength();
    const UPS = { slow: 35, normal: 80, fast: 170 };
    const ups = UPS[speed] || 80;
    const durationMs = Math.max(280, Math.min(2600, (len / ups) * 1000));

    pathClone.setAttribute('stroke-dasharray', len);
    pathClone.setAttribute('stroke-dashoffset', len);

    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = (now) => {
        if (gen !== this._gen) {
          pathClone.remove();
          resolve(false);
          return;
        }

        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const offset = len * (1 - t);
        pathClone.setAttribute('stroke-dashoffset', offset);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Move to done layer
          pathClone.remove();
          const donePath = basePath.cloneNode(true);
          donePath.setAttribute('stroke', '#32324e');
          donePath.setAttribute('stroke-width', '5');
          this.layerDone.appendChild(donePath);
          resolve(true);
        }
      };

      requestAnimationFrame(animate);
    });
  }

  async play(speed = 'normal') {
    this.showUpTo(0); // 内部で stop() され世代が進む
    const gen = this._gen;

    for (let i = 0; i < this.strokeCount; i++) {
      const completed = await this.animateStroke(i, speed);
      if (!completed || gen !== this._gen) return;

      this.shownCount = i + 1;

      await this._delay(260); // 画と画の間
      if (gen !== this._gen) return;
    }
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  stop() {
    this._gen++;
    this._clearLayer(this.layerAnim);
  }

  reset() {
    this.stop();
    this.showUpTo(0);
  }

  _clearLayer(layer) {
    while (layer.firstChild) {
      layer.removeChild(layer.firstChild);
    }
  }
}
