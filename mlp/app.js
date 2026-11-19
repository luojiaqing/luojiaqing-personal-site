(() => {
  "use strict";

  const D = window.MLP_DATA;
  if (!D) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fmt = (v, n = 2) => Number(v).toFixed(n);
  const signed = (v, n = 2) => {
    const s = Number(v).toFixed(n);
    if (Number(v) >= 0) return "+" + s;
    return "−" + s.slice(1);
  };
  const pct = (v) => `${(Number(v) * 100).toFixed(1)}%`;

  function mix(a, b, t) {
    const A = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const B = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const c = A.map((x, i) => Math.round(x + (B[i] - x) * clamp(t, 0, 1)));
    return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  /* ----------------------------------------------------------------------
     Header / progress / reveal
  ---------------------------------------------------------------------- */
  const header = $("#siteHeader");
  const progressBar = $("#progressBar");
  const navLinks = $$(".site-nav a").filter((a) => (a.getAttribute("href") || "").startsWith("#"));
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const menuToggle = $("#menuToggle");
  let scrollTick = false;

  function updateScrollUI() {
    const y = window.scrollY || document.documentElement.scrollTop;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    if (header) header.classList.toggle("scrolled", y > 44);
    let active = null;
    for (const sec of sections) {
      if (sec.getBoundingClientRect().top <= 150) active = sec.id;
    }
    navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + active));
    scrollTick = false;
  }

  window.addEventListener("scroll", () => {
    if (!scrollTick) {
      scrollTick = true;
      requestAnimationFrame(updateScrollUI);
    }
  }, { passive: true });
  updateScrollUI();

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      document.body.classList.toggle("menu-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    });
    $$(".site-nav a").forEach((a) => a.addEventListener("click", () => {
      header.classList.remove("nav-open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "打开导航");
    }));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        document.body.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "打开导航");
      }
    });
    document.addEventListener("click", (e) => {
      if (!header.contains(e.target)) {
        header.classList.remove("nav-open");
        document.body.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "打开导航");
      }
    });
  }

  const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" })
    : null;

  if (revealObserver) {
    $$(".reveal").forEach((el) => revealObserver.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("is-visible"));
  }

  /* ----------------------------------------------------------------------
     Hero network — drawn from real trained weights
  ---------------------------------------------------------------------- */
  function drawHeroNetwork() {
    const svg = $("#heroNetwork");
    if (!svg) return;
    const W1 = D.params.W1, b1 = D.params.b1;
    const W2 = D.params.W2;
    const W3 = D.params.W3;
    const H = 8;
    const pos = {
      input: [[82, 226], [82, 334]],
      h1: Array.from({ length: H }, (_, i) => [255, 76 + i * 51.6]),
      h2: Array.from({ length: H }, (_, i) => [412, 76 + i * 51.6]),
      out: [574, 280]
    };
    const max1 = Math.max(...W1.flat().map(Math.abs), 0.001);
    const max2 = Math.max(...W2.flat().map(Math.abs), 0.001);
    const max3 = Math.max(...W3.flat().map(Math.abs), 0.001);

    svg.innerHTML = "";
    const defs = svgEl("defs");
    const glow = svgEl("filter", { id: "heroGlow", x: "-100%", y: "-100%", width: "300%", height: "300%" });
    glow.appendChild(svgEl("feGaussianBlur", { stdDeviation: "4", result: "b" }));
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "b" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);
    defs.appendChild(glow);
    svg.appendChild(defs);

    const layerLabel = (x, text, sub) => {
      const g = svgEl("g");
      const t = svgEl("text", { x, y: 32, "text-anchor": "middle", class: "hero-layer-label" });
      t.textContent = text;
      g.appendChild(t);
      const s = svgEl("text", { x, y: 46, "text-anchor": "middle", class: "hero-layer-sub" });
      s.textContent = sub;
      g.appendChild(s);
      svg.appendChild(g);
    };
    layerLabel(82, "INPUT", "2");
    layerLabel(255, "HIDDEN 1", "8 · tanh");
    layerLabel(412, "HIDDEN 2", "8 · tanh");
    layerLabel(574, "OUTPUT", "1 · sigmoid");

    function addEdge(a, b, r1, r2, weight, max, opacityBoost = 0) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const x1 = a[0] + ux * r1, y1 = a[1] + uy * r1;
      const x2 = b[0] - ux * r2, y2 = b[1] - uy * r2;
      const t = Math.min(1, Math.abs(weight) / max);
      const color = weight >= 0 ? "#2dd4bf" : "#ef7d5e";
      const line = svgEl("line", {
        x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1),
        stroke: color, "stroke-width": (0.55 + 2.8 * t).toFixed(2),
        opacity: (0.09 + 0.47 * t + opacityBoost).toFixed(2),
        "stroke-linecap": "round"
      });
      if (t > 0.72) line.classList.add("edge-strong");
      svg.appendChild(line);
    }

    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < H; k++) addEdge(pos.input[j], pos.h1[k], 18, 10, W1[k][j], max1);
    }
    for (let k = 0; k < H; k++) {
      for (let l = 0; l < H; l++) addEdge(pos.h1[k], pos.h2[l], 10, 10, W2[l][k], max2);
    }
    for (let l = 0; l < H; l++) addEdge(pos.h2[l], pos.out, 10, 22, W3[0][l], max3, 0.06);

    const node = (x, y, r, cls, label, delay = 0) => {
      const g = svgEl("g", { class: "hero-node" });
      g.style.animationDelay = `${delay}s`;
      g.appendChild(svgEl("circle", { cx: x, cy: y, r: r + 4, class: "hero-node-halo" }));
      g.appendChild(svgEl("circle", { cx: x, cy: y, r, class: cls }));
      if (label) {
        const t = svgEl("text", { x, y: y + 3.6, "text-anchor": "middle", class: "hero-node-label" });
        t.textContent = label;
        g.appendChild(t);
      }
      svg.appendChild(g);
    };

    pos.h1.forEach((p, i) => node(p[0], p[1], 9.5, "hero-hidden", i === 0 ? "h1" : i === 7 ? "h8" : "", i * 0.18));
    pos.h2.forEach((p, i) => node(p[0], p[1], 9.5, "hero-hidden", i === 0 ? "g1" : i === 7 ? "g8" : "", 0.4 + i * 0.18));
    pos.input.forEach((p, i) => node(p[0], p[1], 18, "hero-input", i === 0 ? "x1" : "x2", 0.1));
    node(pos.out[0], pos.out[1], 22, "hero-output", "p", 0.3);

    const label = (x, y, text, cls) => {
      const t = svgEl("text", { x, y, "text-anchor": "middle", class: cls });
      t.textContent = text;
      svg.appendChild(t);
    };
    label(255, 500, "每条连线 = 一个权重 w", "hero-foot-label");
    label(255, 515, "每个神经元 = 一个偏置 b", "hero-foot-label");
    label(454, 500, "颜色 = 正负", "hero-foot-label");
    label(454, 515, "粗细 = 绝对值", "hero-foot-label");
  }
  drawHeroNetwork();

  /* ----------------------------------------------------------------------
     Single neuron lab
  ---------------------------------------------------------------------- */
  const w1Range = $("#w1Range"), w2Range = $("#w2Range"), bRange = $("#bRange");
  const w1Out = $("#w1Out"), w2Out = $("#w2Out"), bOut = $("#bOut");
  const nW1Label = $("#nW1Label"), nW2Label = $("#nW2Label"), nBLabel = $("#nBLabel");
  const nLine1 = $("#nLine1"), nLine2 = $("#nLine2");
  const nALabel = $("#nALabel"), nOutput = $(".n-output");
  const zValue = $("#zValue"), aValue = $("#aValue"), aGauge = $("#aGauge");

  function updateNeuron() {
    if (!w1Range) return;
    const w1 = Number(w1Range.value), w2 = Number(w2Range.value), b = Number(bRange.value);
    const z = w1 * 1.0 + w2 * 0.5 + b;
    const a = Math.tanh(z);
    if (w1Out) w1Out.textContent = signed(w1);
    if (w2Out) w2Out.textContent = signed(w2);
    if (bOut) bOut.textContent = signed(b);
    if (nW1Label) nW1Label.textContent = `w1 = ${signed(w1)}`;
    if (nW2Label) nW2Label.textContent = `w2 = ${signed(w2)}`;
    if (nBLabel) nBLabel.textContent = `b = ${signed(b)}`;
    if (zValue) zValue.textContent = `z = ${fmt(z)}`;
    if (aValue) aValue.textContent = `a = ${fmt(a, 3)}`;
    if (nALabel) nALabel.textContent = fmt(a);
    if (aGauge) aGauge.style.left = `${clamp(((a + 1) / 2) * 100, 0, 100)}%`;
    if (nLine1) {
      nLine1.setAttribute("stroke", w1 >= 0 ? "#0f766e" : "#c2410c");
      nLine1.setAttribute("stroke-width", (1.2 + Math.min(6, Math.abs(w1) * 3)).toFixed(2));
    }
    if (nLine2) {
      nLine2.setAttribute("stroke", w2 >= 0 ? "#0f766e" : "#c2410c");
      nLine2.setAttribute("stroke-width", (1.2 + Math.min(6, Math.abs(w2) * 3)).toFixed(2));
    }
    if (nOutput) {
      nOutput.style.stroke = a >= 0 ? "#0f766e" : "#c2410c";
      nOutput.style.fill = a >= 0 ? "#e8f4f0" : "#fdece0";
    }
    if (nALabel) nALabel.style.fill = a >= 0 ? "#0b5f59" : "#b84028";
  }
  if (w1Range && w2Range && bRange) {
    [w1Range, w2Range, bRange].forEach((r) => r.addEventListener("input", updateNeuron));
    updateNeuron();
  }

  /* ----------------------------------------------------------------------
     Four training steps
  ---------------------------------------------------------------------- */
  const TRAIN = {
    forward: {
      kicker: "STEP 01 / FORWARD",
      title: "先把输入变成预测",
      text: "输入逐层乘权重、加偏置、过激活。最后用 sigmoid 把分数压到 0–1，得到“属于类别 B 的概率”。",
      formula: "z<sup>1</sup> = W<sup>1</sup>x + b<sup>1</sup> &nbsp;→&nbsp; a<sup>1</sup> = tanh(z<sup>1</sup>)",
      foot: "N = 384 个训练样本；一次全量前向，得到 384 个预测。",
      code: `<span class="c"># 2-8-8-1 的前向：只有 6 行</span>
z1 = X @ <span class="v">W1</span>.T + <span class="v">b1</span>       <span class="c"># (N, 8)</span>
a1 = np.tanh(z1)
z2 = a1 @ <span class="v">W2</span>.T + <span class="v">b2</span>      <span class="c"># (N, 8)</span>
a2 = np.tanh(z2)
p  = sigmoid(a2 @ <span class="v">W3</span>.T + <span class="v">b3</span>)  <span class="c"># (N, 1)</span>`
    },
    loss: {
      kicker: "STEP 02 / LOSS",
      title: "量出离答案有多远",
      text: "二元交叉熵 BCE 衡量预测 p 和真实标签 y 的差距。预测越接近答案，损失越小；它是一个标量，是整批样本的平均。",
      formula: "L = −1/N Σ [ y·log p + (1−y)·log(1−p) ]",
      foot: "p 是模型给出的概率，y 是 0 或 1。取平均，是为了让 batch 大小不改变损失尺度。",
      code: `<span class="c"># 二元交叉熵：越接近答案，值越小</span>
eps = <span class="n">1e-9</span>
loss = -np.mean(
    y * np.log(p + eps) +
    (<span class="n">1</span> - y) * np.log(<span class="n">1</span> - p + eps)
)`
    },
    backward: {
      kicker: "STEP 03 / BACKWARD",
      title: "把责任分回每一层",
      text: "输出层先认出自己的误差 p − y，再按 W 的比例分给上一层；上一层乘上激活函数的斜率，继续往前分。这就是链式法则。",
      formula: "δ<sup>3</sup> = p − y &nbsp;→&nbsp; δ<sup>2</sup> = (δ<sup>3</sup>W<sup>3</sup>) ⊙ (1−a<sup>2</sup>²)",
      foot: "⊙ 是逐元素乘；tanh 的局部斜率是 1−a²。梯度 = 责任 × 连接强度 × 本地斜率。",
      code: `<span class="c"># 输出层误差：sigmoid + BCE 的漂亮结果</span>
d3 = (p - y) / N
dW3, db3 = d3.T @ a2, d3.sum(<span class="n">0</span>)

d2 = (d3 @ <span class="v">W3</span>) * (<span class="n">1</span> - a2**<span class="n">2</span>)
dW2, db2 = d2.T @ a1, d2.sum(<span class="n">0</span>)
d1 = (d2 @ <span class="v">W2</span>) * (<span class="n">1</span> - a1**<span class="n">2</span>)
dW1, db1 = d1.T @ X, d1.sum(<span class="n">0</span>)`
    },
    update: {
      kicker: "STEP 04 / UPDATE",
      title: "沿着反方向走一步",
      text: "梯度指向损失上升最快的方向，所以更新要取负号。η 是学习率，控制这一步走多远；主实验用 Adam，会为每个参数自适应地缩放步长。",
      formula: "θ ← θ − η · ∇L",
      foot: "θ 包含所有 W 和 b。全量 batch 下，1200 次更新就是 1200 个 epoch。",
      code: `<span class="c"># 梯度指向上升，更新要取反方向</span>
<span class="k">for</span> k <span class="k">in</span> params:
    params[k] -= lr * grads[k]

<span class="c"># 主实验用 Adam：同样先算梯度，</span>
<span class="c"># 再用一阶 / 二阶动量自适应地走</span>`
    }
  };

  const codeBlock = $("#codeBlock");
  const trainKicker = $("#trainKicker"), trainTitle = $("#trainTitle");
  const trainText = $("#trainText"), trainFormula = $("#trainFormula"), trainFoot = $("#trainFoot");
  const trainSteps = $$(".train-step");

  function setTrainStep(key) {
    const data = TRAIN[key];
    if (!data) return;
    trainSteps.forEach((btn) => {
      const active = btn.dataset.train === key;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    if (codeBlock) codeBlock.innerHTML = data.code;
    if (trainKicker) trainKicker.textContent = data.kicker;
    if (trainTitle) trainTitle.textContent = data.title;
    if (trainText) trainText.textContent = data.text;
    if (trainFormula) trainFormula.innerHTML = data.formula;
    if (trainFoot) trainFoot.textContent = data.foot;
  }
  trainSteps.forEach((btn) => btn.addEventListener("click", () => setTrainStep(btn.dataset.train)));
  setTrainStep("forward");

  /* ----------------------------------------------------------------------
     Decision boundary + real training replay
  ---------------------------------------------------------------------- */
  const boundaryCanvas = $("#boundaryCanvas");
  const stepRange = $("#stepRange");
  const stepBadge = $("#stepBadge");
  const metricTrain = $("#metricTrain");
  const metricTest = $("#metricTest");
  const stepCaption = $("#stepCaption");
  const stepTicks = $$("#stepTicks button");
  const boundaryMeta = D.boundary;
  const captions = [
    "随机初始化：边界还没有意义",
    "开始分开：主要结构出现",
    "形状成型：两条弯月基本分开",
    "细节调整：损失继续下降",
    "边界成型，进入微调"
  ];
  const boundaryImages = boundaryMeta.map((b) => {
    const img = new Image();
    img.src = b.file;
    return img;
  });
  let boundaryIndex = 4;
  let boundaryReady = false;

  function fitCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function drawBoundary(index = boundaryIndex) {
    const fit = fitCanvas(boundaryCanvas);
    if (!fit) return;
    const { ctx, w, h } = fit;
    const item = boundaryMeta[index];
    ctx.clearRect(0, 0, w, h);
    const img = boundaryImages[index];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#f7f2e6";
      ctx.fillRect(0, 0, w, h);
    }

    const X = D.samples;
    const toX = (v) => ((v + 1.6) / 4.2) * w;
    const toY = (v) => ((2.0 - v) / 3.5) * h;
    for (let i = 0; i < X.x1.length; i++) {
      const isTest = X.split[i] === 1;
      const color = X.y[i] === 0 ? "#c2410c" : "#0f766e";
      const r = Math.max(2.6, Math.min(4.2, w / 170));
      ctx.beginPath();
      ctx.arc(toX(X.x1[i]), toY(X.x2[i]), isTest ? r + 0.8 : r, 0, Math.PI * 2);
      if (isTest) {
        ctx.fillStyle = "rgba(255,253,247,.92)";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,253,247,.9)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    if (stepBadge) stepBadge.textContent = `第 ${item.step} 步`;
    if (metricTrain) metricTrain.textContent = pct(item.trainAcc);
    if (metricTest) metricTest.textContent = pct(item.testAcc);
    if (stepCaption) stepCaption.textContent = captions[index];
    if (stepRange) stepRange.value = String(index);
    stepTicks.forEach((btn, i) => btn.classList.toggle("is-active", i === index));
  }

  function setBoundaryIndex(index) {
    boundaryIndex = clamp(Number(index), 0, boundaryMeta.length - 1);
    if (boundaryReady) drawBoundary(boundaryIndex);
  }

  if (boundaryCanvas) {
    Promise.all(boundaryImages.map((img) => new Promise((resolve) => {
      if (img.complete) resolve();
      else { img.onload = resolve; img.onerror = resolve; }
    }))).then(() => {
      boundaryReady = true;
      drawBoundary(boundaryIndex);
    });
    if (stepRange) stepRange.addEventListener("input", () => setBoundaryIndex(stepRange.value));
    stepTicks.forEach((btn) => btn.addEventListener("click", () => setBoundaryIndex(btn.dataset.index)));
    window.addEventListener("resize", () => {
      if (boundaryReady) drawBoundary(boundaryIndex);
    });
  }

  /* ----------------------------------------------------------------------
     Loss chart — real train/test curves
  ---------------------------------------------------------------------- */
  const lossCanvas = $("#lossChart");
  function drawLossChart() {
    if (!lossCanvas) return;
    const fit = fitCanvas(lossCanvas);
    if (!fit) return;
    const { ctx, w, h } = fit;
    const H = D.history;
    const pad = { l: Math.max(34, w * 0.07), r: 18, t: 16, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const xMin = 0, xMax = 1200;
    const logMin = Math.log10(0.004), logMax = Math.log10(1);
    const X = (s) => pad.l + ((s - xMin) / (xMax - xMin)) * pw;
    const Y = (v) => pad.t + (logMax - Math.log10(Math.max(v, 1e-6))) / (logMax - logMin) * ph;

    ctx.clearRect(0, 0, w, h);
    ctx.font = '9px "Cascadia Code", "Noto Sans SC", monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const grid = [1, 0.5, 0.1, 0.05, 0.01, 0.005];
    for (const v of grid) {
      const y = Y(v);
      ctx.strokeStyle = "rgba(248,241,226,.095)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(248,241,226,.34)";
      ctx.fillText(String(v), pad.l - 8, y);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const s of [0, 300, 600, 900, 1200]) {
      ctx.fillStyle = "rgba(248,241,226,.3)";
      ctx.fillText(String(s), X(s), h - pad.b + 9);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(248,241,226,.24)";
    ctx.fillText("更新步数", w - pad.r, h - 11);

    // area under train
    ctx.beginPath();
    ctx.moveTo(X(H.step[0]), h - pad.b);
    H.step.forEach((s, i) => ctx.lineTo(X(s), Y(H.loss[i])));
    ctx.lineTo(X(H.step[H.step.length - 1]), h - pad.b);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, "rgba(45,212,191,.16)");
    grad.addColorStop(1, "rgba(45,212,191,0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // test curve
    ctx.beginPath();
    H.step.forEach((s, i) => {
      const x = X(s), y = Y(H.testLoss[i]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = "#ef8a70";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // train curve
    ctx.beginPath();
    H.step.forEach((s, i) => {
      const x = X(s), y = Y(H.loss[i]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = "#2dd4bf";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 100-step marker
    ctx.beginPath();
    ctx.moveTo(X(100), pad.t);
    ctx.lineTo(X(100), h - pad.b);
    ctx.strokeStyle = "rgba(233,179,95,.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(233,179,95,.8)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("100 步", X(100) + 5, pad.t + 3);

    // endpoints
    const last = H.step.length - 1;
    ctx.beginPath();
    ctx.arc(X(H.step[last]), Y(H.loss[last]), 3, 0, Math.PI * 2);
    ctx.fillStyle = "#2dd4bf"; ctx.fill();
    ctx.beginPath();
    ctx.arc(X(H.step[last]), Y(H.testLoss[last]), 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ef8a70"; ctx.fill();

    ctx.textAlign = "right";
    ctx.font = '9px "Cascadia Code", "Noto Sans SC", monospace';
    ctx.fillStyle = "#8fded3";
    ctx.fillText("训练 0.009", X(1200) - 7, Y(H.loss[last]) + 9);
    ctx.fillStyle = "#f2a890";
    ctx.fillText("测试 0.046", X(1200) - 7, Y(H.testLoss[last]) - 13);
  }

  if (lossCanvas) {
    let lossResize = null;
    const ro = "ResizeObserver" in window ? new ResizeObserver(() => {
      if (lossResize) cancelAnimationFrame(lossResize);
      lossResize = requestAnimationFrame(drawLossChart);
    }) : null;
    if (ro && lossCanvas.parentElement) ro.observe(lossCanvas.parentElement);
    window.addEventListener("resize", drawLossChart);
    requestAnimationFrame(drawLossChart);
  }

  /* ----------------------------------------------------------------------
     Heatmap + inspector
  ---------------------------------------------------------------------- */
  const VMAX = 3.9;
  const HEAT = {
    W1: {
      rows: Array.from({ length: 8 }, (_, i) => `h${i + 1}`),
      cols: ["x1", "x2", "b1"],
      values: D.params.W1.map((row, i) => [...row, D.params.b1[i]]),
      shape: "8 行 × (2 权重 + 1 偏置)",
      cell: 84,
      label: 46,
      show: true
    },
    W2: {
      rows: Array.from({ length: 8 }, (_, i) => `g${i + 1}`),
      cols: [...Array.from({ length: 8 }, (_, i) => `h${i + 1}`), "b2"],
      values: D.params.W2.map((row, i) => [...row, D.params.b2[i]]),
      shape: "8 行 × (8 权重 + 1 偏置)",
      cell: 60,
      label: 44,
      show: false
    },
    W3: {
      rows: ["p"],
      cols: [...Array.from({ length: 8 }, (_, i) => `g${i + 1}`), "b3"],
      values: [[...D.params.W3[0], D.params.b3[0]]],
      shape: "1 行 × (8 权重 + 1 偏置)",
      cell: 60,
      label: 44,
      show: true
    }
  };
  const HEAT_DEFAULT = { W1: [2, 0], W2: [2, 1], W3: [0, 5] };
  const matrixEl = $("#matrix");
  const heatTabs = $$(".heat-tab");
  const showValues = $("#showValues");
  const heatShape = $("#heatShape");
  const heatHint = $("#heatHint");
  const inspectKicker = $("#inspectKicker");
  const inspectValue = $("#inspectValue");
  const inspectText = $("#inspectText");
  const rowTitle = $("#rowTitle");
  const rowNote = $("#rowNote");
  const rowBars = $("#rowBars");
  const rowInsight = $("#rowInsight");
  let heatKey = "W1";

  function heatColor(v) {
    const t = Math.sqrt(Math.min(1, Math.abs(v) / VMAX));
    return mix("#f4efe3", v >= 0 ? "#0f766e" : "#c2410c", 0.1 + 0.9 * t);
  }

  function heatText(v) {
    return Math.abs(v) > VMAX * 0.64 ? "#fffaf0" : "#17243c";
  }

  function rowProfile(key, row, col) {
    if (!rowBars) return;
    const model = HEAT[key];
    const values = model.values[row];
    const max = Math.max(...values.map(Math.abs), 0.001);
    rowBars.innerHTML = "";
    values.forEach((v, i) => {
      const el = document.createElement("div");
      el.className = "bar-row" + (i === col ? " is-col" : "");
      el.innerHTML = `<span>${model.cols[i]}</span><span class="bar-track"><i class="bar-fill" style="left:${v >= 0 ? 50 : 50 - (Math.abs(v) / max) * 50}%;width:${(Math.abs(v) / max) * 50}%;background:${v >= 0 ? "#2dd4bf" : "#ef7d5e"}"></i></span><span class="bar-val">${signed(v, 1)}</span>`;
      rowBars.appendChild(el);
    });
  }

  function inspectCell(key, row, col, val) {
    const model = HEAT[key];
    if (inspectKicker) inspectKicker.textContent = `${key}[${model.rows[row]}, ${model.cols[col]}]`;
    if (inspectValue) inspectValue.textContent = signed(val, 2);
    if (inspectText) {
      if (model.cols[col].startsWith("b")) {
        inspectText.textContent = `这是 ${model.rows[row]} 的偏置，把激活门槛往${val >= 0 ? "右" : "左"}推。`;
      } else {
        inspectText.textContent = `${model.rows[row]} 从 ${model.cols[col]} 接收的权重。${val >= 0 ? "正权重让这个输入更容易把它点亮。" : "负权重会压低这个输入的影响。"}`;
      }
    }
    if (rowTitle) rowTitle.textContent = `ROW ${model.rows[row]}`;
    if (rowNote) rowNote.textContent = `这一行的 ${model.values[row].length} 个数`;
    if (rowInsight) {
      const vals = model.values[row];
      const strongest = vals.reduce((best, v, i) => Math.abs(v) > Math.abs(vals[best]) ? i : best, 0);
      const pos = vals.filter((v) => v > 0).length;
      const neg = vals.filter((v) => v < 0).length;
      let insight = `这一行最敏感的是 ${model.cols[strongest]}（${signed(vals[strongest])}）；${pos} 个正、${neg} 个负，像在做“组合筛选”。`;
      if (key === "W2" && (row === 1 || row === 2)) insight += " g2 和 g3 的相关系数约 0.94，两个神经元高度冗余。";
      rowInsight.textContent = insight;
    }
    rowProfile(key, row, col);
    $$(".m-cell", matrixEl).forEach((el) => {
      const r = Number(el.dataset.row), c = Number(el.dataset.col);
      el.classList.toggle("is-row", r === row);
      el.classList.toggle("is-col", c === col);
      el.classList.toggle("is-pin", r === row && c === col);
    });
  }

  function renderMatrix() {
    if (!matrixEl) return;
    const model = HEAT[heatKey];
    const totalCols = model.cols.length;
    matrixEl.style.gridTemplateColumns = `${model.label}px repeat(${totalCols}, ${model.cell}px)`;
    matrixEl.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "m-head";
    matrixEl.appendChild(corner);
    model.cols.forEach((c) => {
      const h = document.createElement("div");
      h.className = "m-head" + (c.startsWith("b") ? " bias" : "");
      h.textContent = c;
      matrixEl.appendChild(h);
    });

    model.values.forEach((row, ri) => {
      const rh = document.createElement("div");
      rh.className = "m-row";
      rh.textContent = model.rows[ri];
      matrixEl.appendChild(rh);
      row.forEach((v, ci) => {
        const cell = document.createElement("div");
        const isBias = model.cols[ci].startsWith("b");
        cell.className = "m-cell" + (isBias ? " bias" : "");
        cell.dataset.row = String(ri);
        cell.dataset.col = String(ci);
        cell.dataset.value = String(v);
        cell.style.background = heatColor(v);
        cell.style.color = heatText(v);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `${heatKey} ${model.rows[ri]} ${model.cols[ci]} ${signed(v)}`);
        const num = document.createElement("span");
        num.className = "cell-num";
        num.textContent = fmt(v, heatKey === "W2" ? 1 : 2).replace("-", "−");
        cell.appendChild(num);
        const show = showValues ? showValues.checked : model.show;
        if (!show) cell.classList.add("no-num");
        cell.addEventListener("mouseenter", () => inspectCell(heatKey, ri, ci, v));
        cell.addEventListener("focus", () => inspectCell(heatKey, ri, ci, v));
        cell.addEventListener("click", () => inspectCell(heatKey, ri, ci, v));
        cell.tabIndex = 0;
        matrixEl.appendChild(cell);
      });
    });

    if (heatShape) heatShape.textContent = model.shape;
    if (heatHint) heatHint.textContent = heatKey === "W2" ? "64 个权重不标数字，悬停查看" : "颜色越深，绝对值越大";

    const [dr, dc] = HEAT_DEFAULT[heatKey];
    inspectCell(heatKey, dr, dc, model.values[dr][dc]);
  }

  function setHeatTab(key) {
    heatKey = key;
    heatTabs.forEach((tab) => {
      const active = tab.dataset.heat === key;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    if (showValues) showValues.checked = HEAT[key].show;
    renderMatrix();
  }
  heatTabs.forEach((tab) => tab.addEventListener("click", () => setHeatTab(tab.dataset.heat)));
  if (showValues) showValues.addEventListener("change", renderMatrix);
  renderMatrix();

  /* ----------------------------------------------------------------------
     Learning-rate valley
  ---------------------------------------------------------------------- */
  const valleySvg = $("#valleySvg");
  const etaRange = $("#etaRange");
  const etaOut = $("#etaOut");
  const lrBadge = $("#lrBadge");
  const lrTheta = $("#lrTheta");
  const lrLoss = $("#lrLoss");
  const lrSteps = $("#lrSteps");
  const lrStatus = $("#lrStatus");
  const lrNote = $("#lrNote");
  const lrRun = $("#lrRun");
  const lrReset = $("#lrReset");
  const lrPresets = $$(".lr-preset");
  const LR = { eta: 0.45, theta: -2.2, trail: [-2.2], steps: 0, diverged: false, timer: null };
  const LR_X = (t) => 54 + ((t + 3.2) / 6.4) * (640 - 54 - 24);
  const LR_Y = (l) => 330 - (l / 10.6) * 280;
  const lrGhost = valleySvg ? svgEl("g") : null;
  const lrTrail = valleySvg ? svgEl("g") : null;

  function lrColor(eta = LR.eta) {
    if (eta < 0.15) return "#e9b35f";
    if (eta <= 0.9) return "#2dd4bf";
    return "#ef7d5e";
  }

  function lrLabel(eta = LR.eta) {
    if (eta < 0.15) return "太小";
    if (eta <= 0.9) return "刚好";
    return "太大";
  }

  function trajectory(eta, n = 8) {
    const out = [-2.2];
    let th = -2.2;
    for (let i = 0; i < n; i++) {
      th = th - eta * 2 * th;
      if (!Number.isFinite(th) || Math.abs(th) > 3.2) {
        out.push(th > 0 ? 3.2 : -3.2);
        break;
      }
      out.push(th);
      if (Math.abs(th) < 0.01) break;
    }
    return out;
  }

  function drawGhosts() {
    if (!lrGhost) return;
    lrGhost.innerHTML = "";
    for (const eta of [0.03, 0.45, 1.05]) {
      const color = lrColor(eta);
      const trail = trajectory(eta, 8);
      trail.forEach((t, i) => {
        if (Math.abs(t) > 3.2) return;
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", LR_X(t));
        c.setAttribute("cy", LR_Y(t * t));
        c.setAttribute("r", i === trail.length - 1 ? "4" : "2.2");
        c.setAttribute("fill", color);
        c.setAttribute("opacity", i === trail.length - 1 ? ".34" : ".15");
        lrGhost.appendChild(c);
      });
    }
  }

  function drawValley() {
    if (!valleySvg) return;
    const NSD = NS;
    valleySvg.innerHTML = "";
    const defs = document.createElementNS(NSD, "defs");
    const grad = document.createElementNS(NSD, "linearGradient");
    grad.setAttribute("id", "valleyFill");
    grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "0"); grad.setAttribute("y2", "1");
    const s1 = document.createElementNS(NSD, "stop");
    s1.setAttribute("offset", "0"); s1.setAttribute("stop-color", "#2dd4bf"); s1.setAttribute("stop-opacity", ".16");
    const s2 = document.createElementNS(NSD, "stop");
    s2.setAttribute("offset", "1"); s2.setAttribute("stop-color", "#2dd4bf"); s2.setAttribute("stop-opacity", "0");
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad); valleySvg.appendChild(defs);

    const points = [];
    for (let i = 0; i <= 160; i++) {
      const theta = -3.2 + (6.4 * i) / 160;
      points.push(`${LR_X(theta).toFixed(1)} ${LR_Y(theta * theta).toFixed(1)}`);
    }
    const area = document.createElementNS(NSD, "path");
    area.setAttribute("d", `M ${LR_X(-3.2)} 330 L ${points.join(" L ")} L ${LR_X(3.2)} 330 Z`);
    area.setAttribute("fill", "url(#valleyFill)");
    valleySvg.appendChild(area);

    const curve = document.createElementNS(NSD, "path");
    curve.setAttribute("d", "M " + points.join(" L "));
    curve.setAttribute("fill", "none");
    curve.setAttribute("stroke", "#d9d3c5");
    curve.setAttribute("stroke-width", "2");
    curve.setAttribute("opacity", ".9");
    valleySvg.appendChild(curve);

    const axis = document.createElementNS(NSD, "line");
    axis.setAttribute("x1", "54"); axis.setAttribute("y1", "330"); axis.setAttribute("x2", "616"); axis.setAttribute("y2", "330");
    axis.setAttribute("stroke", "rgba(255,255,255,.15)"); axis.setAttribute("stroke-width", "1");
    valleySvg.appendChild(axis);

    const txt = (x, y, str, cls, extra = {}) => {
      const el = document.createElementNS(NSD, "text");
      el.setAttribute("x", x); el.setAttribute("y", y);
      el.setAttribute("class", cls);
      Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
      el.textContent = str;
      valleySvg.appendChild(el);
    };
    txt(54, 354, "参数 θ", "lr-axis", { "text-anchor": "start" });
    txt(44, 74, "损失 L", "lr-axis", { "text-anchor": "end" });
    for (const t of [-2, 0, 2]) {
      txt(LR_X(t), 354, String(t), "lr-tick", { "text-anchor": "middle" });
    }
    txt(LR_X(0), LR_Y(0) + 19, "谷底", "lr-bottom", { "text-anchor": "middle" });
    txt(LR_X(-2.2), LR_Y(4.84) - 12, "起点", "lr-start", { "text-anchor": "middle" });

    const start = document.createElementNS(NSD, "circle");
    start.setAttribute("cx", LR_X(-2.2)); start.setAttribute("cy", LR_Y(4.84));
    start.setAttribute("r", "4"); start.setAttribute("fill", "none");
    start.setAttribute("stroke", "rgba(248,241,226,.35)"); start.setAttribute("stroke-dasharray", "2 4");
    valleySvg.appendChild(start);
    const bottom = document.createElementNS(NSD, "circle");
    bottom.setAttribute("cx", LR_X(0)); bottom.setAttribute("cy", LR_Y(0));
    bottom.setAttribute("r", "3"); bottom.setAttribute("fill", "#e9b35f");
    valleySvg.appendChild(bottom);

    valleySvg.appendChild(lrGhost);
    valleySvg.appendChild(lrTrail);
    drawGhosts();
  }

  function drawLRTrail(trail = LR.trail, color = lrColor()) {
    if (!lrTrail) return;
    lrTrail.innerHTML = "";
    const points = trail.filter((t) => Math.abs(t) <= 3.2);
    points.forEach((t, i) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", LR_X(t)); c.setAttribute("cy", LR_Y(t * t));
      c.setAttribute("r", i === points.length - 1 ? "7" : "4.2");
      c.setAttribute("fill", color);
      c.setAttribute("opacity", String(0.35 + (i / Math.max(1, points.length - 1)) * 0.65));
      if (i === points.length - 1) {
        c.setAttribute("stroke", "#fffaf0"); c.setAttribute("stroke-width", "2");
      }
      lrTrail.appendChild(c);
      if (i > 0) {
        const prev = points[i - 1];
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", LR_X(prev)); line.setAttribute("y1", LR_Y(prev * prev));
        line.setAttribute("x2", LR_X(t)); line.setAttribute("y2", LR_Y(t * t));
        line.setAttribute("stroke", color); line.setAttribute("stroke-width", "1.6");
        line.setAttribute("opacity", ".6");
        lrTrail.insertBefore(line, c);
      }
    });
  }

  function updateLR() {
    if (etaRange) {
      LR.eta = Number(etaRange.value);
      etaOut.textContent = fmt(LR.eta, 2);
    }
    if (lrTheta) lrTheta.textContent = Math.abs(LR.theta) < 0.005 ? "0.00" : LR.theta.toFixed(2).replace("-", "−");
    if (lrLoss) lrLoss.textContent = fmt(LR.theta * LR.theta, 2);
    if (lrSteps) lrSteps.textContent = String(LR.steps);
    const label = LR.diverged ? "发散" : LR.steps === 0 ? "准备" : lrLabel();
    if (lrBadge) lrBadge.textContent = label;
    if (lrStatus) lrStatus.textContent = label;
    if (lrNote) {
      if (LR.diverged) lrNote.textContent = "轨迹已经飞出山谷：步长太大，参数被弹飞了。";
      else if (LR.steps === 0) lrNote.textContent = "按“播放”，看几步内的轨迹。";
      else if (LR.eta < 0.15) lrNote.textContent = "太小：方向没错，但走了很多步还没到底。";
      else if (LR.eta > 0.9) lrNote.textContent = "太大：可能跨过谷底，下一步就越走越远。";
      else lrNote.textContent = "刚好：几步接近谷底，损失稳定下降。";
    }
    lrPresets.forEach((btn) => btn.classList.toggle("is-active", Math.abs(Number(btn.dataset.eta) - LR.eta) < 0.005));
    drawLRTrail();
  }

  function stopLR() {
    if (LR.timer) { clearInterval(LR.timer); LR.timer = null; }
  }

  function resetLR(showStatic = true) {
    stopLR();
    LR.theta = -2.2; LR.steps = 0; LR.diverged = false;
    LR.trail = [-2.2];
    updateLR();
    if (showStatic) {
      const trail = [LR.theta];
      let th = LR.theta;
      for (let i = 0; i < 6; i++) {
        th = th - LR.eta * 2 * th;
        if (Math.abs(th) > 3.2) { LR.diverged = true; break; }
        trail.push(th);
        if (Math.abs(th) < 0.01) break;
      }
      LR.theta = trail[trail.length - 1];
      LR.trail = trail;
      LR.steps = trail.length - 1;
      drawLRTrail(trail);
      updateLR();
    }
  }

  function playLR() {
    if (!etaRange) return;
    stopLR();
    LR.theta = -2.2; LR.steps = 0; LR.trail = [-2.2]; LR.diverged = false;
    LR.eta = Number(etaRange.value);
    updateLR();
    LR.timer = setInterval(() => {
      const next = LR.theta - LR.eta * 2 * LR.theta;
      if (Math.abs(next) > 3.2) {
        LR.diverged = true;
        LR.trail.push(next > 0 ? 3.2 : -3.2);
        LR.steps += 1;
        drawLRTrail();
        updateLR();
        stopLR();
        return;
      }
      LR.theta = next;
      LR.steps += 1;
      LR.trail.push(next);
      drawLRTrail();
      updateLR();
      if (LR.steps >= 10 || Math.abs(next) < 0.004) stopLR();
    }, 220);
  }

  if (valleySvg) {
    drawValley();
    resetLR(true);
    etaRange.addEventListener("input", () => {
      stopLR();
      LR.eta = Number(etaRange.value);
      etaOut.textContent = fmt(LR.eta, 2);
      LR.theta = -2.2; LR.steps = 0; LR.diverged = false; LR.trail = [-2.2];
      drawLRTrail();
      updateLR();
    });
    lrPresets.forEach((btn) => btn.addEventListener("click", () => {
      etaRange.value = btn.dataset.eta;
      LR.eta = Number(btn.dataset.eta);
      etaOut.textContent = fmt(LR.eta, 2);
      resetLR(false);
      playLR();
    }));
    lrRun.addEventListener("click", playLR);
    lrReset.addEventListener("click", () => resetLR(false));
  }

  /* ----------------------------------------------------------------------
     Redraw canvas on resize (loss + boundary)
  ---------------------------------------------------------------------- */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && header) {
      header.classList.remove("nav-open");
      document.body.classList.remove("menu-open");
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (boundaryReady) drawBoundary(boundaryIndex);
      drawLossChart();
    }, 120);
  });

  if (!reduceMotion) {
    document.documentElement.style.setProperty("--motion", "on");
  }
})();
