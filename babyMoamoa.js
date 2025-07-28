class BabyMoamoa {
  constructor() {
    this.canvas = document.getElementById('waveCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.status = document.getElementById('status');
    this.analyser = null;
    this.dataArray = null;
    // 環境判別（横幅やUAチェックでも良い）
    const isMobile = window.innerWidth < 600; // 例: 600px未満をモバイル判定
    
    this.moamoa = {
      cx: window.innerWidth / 2,
      cy: window.innerHeight / 2,
      displayRadius: Math.min(window.innerWidth, window.innerHeight) * (isMobile ? 0.17 : 0.3), // モバイル用に調整
      vy: 0,
      baseRadius: Math.min(window.innerWidth, window.innerHeight) * (isMobile ? 0.17 : 0.3), // モバイル用に調整
      spring: 0.09,     // もっと小さく
      friction: 0.85,   // もっと大きく
      color: [200, 200, 210] // グレー系
    };
    this.touchRipples = [];
    this.touchPoints = []; // タッチポイント（避けるべき位置）
    this.isLongPress = false;
    this.longPressTimer = null;
    this.time = 0;
    this.hasTouched = false;

    // パープル粒子
    this.particles = [];
    this.numParticles = 40; // 3D円盤状に配置
    this.initParticles();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('pointerdown', e => this.startLongPress(e));
    this.canvas.addEventListener('pointerup', e => this.endLongPress(e));
    this.canvas.addEventListener('pointerleave', e => this.endLongPress(e));
    this.canvas.addEventListener('pointermove', e => this.handlePointer(e));
    this.canvas.addEventListener('touchmove', e => {
      for(const t of e.touches) this.handlePointer(t);
    }, {passive: false});
    
    // タッチイベントを明示的に追加（バイブ機能のため）
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this.handlePointer(e.touches[0]);
    }, {passive: false});

    this.setupMic();
    this.animate();
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.moamoa.cx = window.innerWidth / 2;
    this.moamoa.cy = window.innerHeight / 2;
    // 環境判別（横幅やUAチェックでも良い）
    const isMobile = window.innerWidth < 600; // 例: 600px未満をモバイル判定
    // スマホサイズに応じて半径を調整
    this.moamoa.displayRadius = Math.min(window.innerWidth, window.innerHeight) * (isMobile ? 0.17 : 0.3);
    this.moamoa.baseRadius = Math.min(window.innerWidth, window.innerHeight) * (isMobile ? 0.17 : 0.3);
    this.initParticles();
  }
  initParticles() {
    this.particles = [];
    const cx = this.moamoa.cx;
    const cy = this.moamoa.cy;
    const baseRadius = this.moamoa.displayRadius * 0.35;
    
    for (let i = 0; i < this.numParticles; i++) {
      // 3D円盤状に配置
      const angle = Math.random() * 2 * Math.PI; // ぐるっとランダム角度
      const spread = 0.5 + Math.random() * 0.5; // 円盤のばらけ具合（0.5～1.0倍半径）
      
      this.particles.push({
        x: cx + Math.cos(angle) * baseRadius * spread,
        y: cy + Math.sin(angle) * baseRadius * spread,
        targetX: cx + Math.cos(angle) * baseRadius * spread,
        targetY: cy + Math.sin(angle) * baseRadius * spread,
        vx: 0,
        vy: 0,
        size: 7,
        angle: angle,
        baseRadius: baseRadius,
        spread: spread,
        spring: 0.07 + Math.random() * 0.03,
        friction: 0.91 + Math.random() * 0.07,
        flowPhase: Math.random() * Math.PI * 2
      });
    }
  }
  async setupMic() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const startAudio = async () => {
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }
      };
      this.canvas.addEventListener('pointerdown', startAudio, { once: true });

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let stream = await navigator.mediaDevices.getUserMedia({audio:true});
      let src = this.audioCtx.createMediaStreamSource(stream);
      src.connect(this.analyser);

      this.status.textContent = "音＋タッチ&スワイプでやさしいもわもわ遊び!";
    } catch (error) {
      this.status.textContent = "マイク許可なし（タッチ&スワイプのみ反応）";
    }
  }
  animate() {
    this.time += 16;
    requestAnimationFrame(() => this.animate());
    this.draw();
  }
  draw() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0,0,w,h);

    // 音声反応
    let vol = 0;
    if (this.analyser && this.dataArray && this.audioCtx && this.audioCtx.state === 'running') {
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      for(let x=0; x<this.dataArray.length; ++x) sum += this.dataArray[x];
      vol = sum / this.dataArray.length / 255;
      const target = this.moamoa.baseRadius + vol * 38; // 150→38程度
      const dy = target - this.moamoa.displayRadius;
      this.moamoa.vy += dy * this.moamoa.spring;
      this.moamoa.vy *= this.moamoa.friction;
      this.moamoa.displayRadius += this.moamoa.vy;
      this.updateParticleTargets(vol);
    } else {
      this.moamoa.displayRadius += (this.moamoa.baseRadius-this.moamoa.displayRadius)*0.08;
      this.moamoa.vy *= 0.5;
    }

    // タッチ波紋を削除 - ブラー効果なし

    // 背景の半透明円を削除 - 粒子のみで構成

    // 粒子描画
    this.updateParticles();
    this.drawParticles();
  }
  handlePointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX || e.touches?.[0]?.clientX)-rect.left;
    const py = (e.clientY || e.touches?.[0]?.clientY)-rect.top;
    if (isNaN(px)||isNaN(py)) return;
    if (!this.hasTouched) {
      this.hasTouched = true;
      this.status.style.opacity = '0';
    }
    
    // タッチポイントを記録（避けるべき位置）
    this.touchPoints.push({
      x: px,
      y: py,
      age: 0,
      radius: 60
    });
    
    // バイブ効果（手動操作時）- より確実に動作
    if (navigator.vibrate) {
      try {
        navigator.vibrate(20);
        // デバッグ用（開発時のみ）
        // console.log('バイブ実行');
      } catch (error) {
        // バイブが失敗した場合のフォールバック
        try {
          navigator.vibrate(10);
        } catch (e) {
          // バイブ機能が完全に利用できない場合
        }
      }
    }
    
    // タッチ波紋を削除
    // ドラッグ機能を削除 - 中心位置は固定
    this.updateParticleTargets(0.3); // 強度も控えめに
  }
  updateParticleTargets(intensity = 0) {
    const cx = this.moamoa.cx, cy = this.moamoa.cy, radius = this.moamoa.displayRadius;
    
    // タッチポイントの年齢を更新
    this.touchPoints.forEach(point => {
      point.age += 0.02;
    });
    this.touchPoints = this.touchPoints.filter(point => point.age < 2.0);
    
    this.particles.forEach((particle, i) => {
      // 手前から後ろへの流れアニメーション（軽量化）
      const timeScale = this.time / 4000; // よりゆっくり
      const flowTime = this.time / 3500 + particle.flowPhase;
      
      // 3D円盤回転
      const spinSpeed = 0.013; // 3D回転速度
      particle.angle += spinSpeed; // 角度を回す
      
      // 3D座標（z）→2D投影
      let x3d = Math.cos(particle.angle) * particle.baseRadius * particle.spread;
      let y3d = Math.sin(particle.angle) * particle.baseRadius * particle.spread;
      let z = Math.sin(particle.angle); // -1:奥, 0:側面, 1:手前
      
      // 2D画面へ投影（y軸を少し圧縮＝斜め視点感）
      let targetX = cx + x3d;
      let targetY = cy + y3d * 0.55;
      
      // 音声反応（より小さく）
      if (intensity > 0) {
        const soundWave1 = Math.sin(this.time / 9000 + i * 0.02) * intensity * 1.2; // より小さく
        const soundWave2 = Math.cos(this.time / 10000 + i * 0.018) * intensity * 1.1; // より小さく
        targetX += soundWave1;
        targetY += soundWave2;
      }
      
      // タッチポイントを避ける（軽量化）
      this.touchPoints.forEach(point => {
        const dx = targetX - point.x;
        const dy = targetY - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const avoidRadius = point.radius * (1 - point.age / 2.0);
        
        if (distance < avoidRadius) {
          const force = Math.pow((avoidRadius - distance) / avoidRadius, 2);
          const angle = Math.atan2(dy, dx);
          targetX += Math.cos(angle) * force * 25; // 避ける力を半分に抑制
          targetY += Math.sin(angle) * force * 25;
        }
      });
      
      particle.targetX = targetX;
      particle.targetY = targetY;
    });
  }
  updateParticles() {
    this.particles.forEach(particle => {
      const dx = particle.targetX - particle.x;
      const dy = particle.targetY - particle.y;
      particle.vx += dx * particle.spring;
      particle.vy += dy * particle.spring;
      particle.vx *= particle.friction;
      particle.vy *= particle.friction;
      
      // 軽量化のためランダム要素を削除
      particle.x += particle.vx;
      particle.y += particle.vy;
    });
  }
  drawParticles() {
    const ctx = this.ctx;
    const cx = this.moamoa.cx;
    const cy = this.moamoa.cy;
    const baseRadius = this.moamoa.displayRadius * 0.35;
    
    // 粒ごとに角度・3D座標を計算
    let renderList = [];
    for (let particle of this.particles) {
      // 3D座標（z）→2D投影
      let x3d = Math.cos(particle.angle) * baseRadius * particle.spread;
      let y3d = Math.sin(particle.angle) * baseRadius * particle.spread;
      let z = Math.sin(particle.angle); // -1:奥・0:側面・1:手前
      
      // 投影
      let scale = 1 + z * 0.45;
      let px = cx + x3d;
      let py = cy + y3d * 0.54;
      
      renderList.push({
        z: z,
        x: px,
        y: py,
        scale: scale,
        alpha: 0.37 + z * 0.43,
        shadow: 0.08 + z * 0.25,
      });
    }
    
    // z値（奥行き）で手前から奥になるよう配列をソート
    renderList.sort((a, b) => a.z - b.z);
    
    // 描画
    for (let o of renderList) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(o.x, o.y, 7 * o.scale, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(180,180,210,${o.alpha})`;
      ctx.shadowBlur = 13 * o.scale;
      ctx.shadowColor = `rgba(140,140,170,${o.shadow})`;
      ctx.fill();
      ctx.restore();
    }
  }
  startLongPress(e) {
    this.longPressTimer = setTimeout(()=>{
      this.isLongPress = true;
      // 色変更を削除 - グレー系を維持
      this.moamoa.displayRadius *= 1.19;
      // タッチ波紋も削除
    }, 650);
  }
  endLongPress(e) {
    clearTimeout(this.longPressTimer);
    if(this.isLongPress) {
      this.isLongPress = false;
    }else{
      this.handlePointer(e);
    }
  }
}
window.addEventListener('DOMContentLoaded', ()=>{ new BabyMoamoa(); });
  