class BabyMoamoa {
  constructor() {
    this.canvas = document.getElementById('waveCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.status = document.getElementById('status');
    this.analyser = null;
    this.dataArray = null;
    this.moamoa = {
      cx: window.innerWidth / 2,
      cy: window.innerHeight / 2,
      displayRadius: Math.min(window.innerWidth, window.innerHeight) * 0.3, // スマホサイズに応じて調整
      vy: 0,
      baseRadius: Math.min(window.innerWidth, window.innerHeight) * 0.3,
      spring: 0.21,
      friction: 0.72,
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
    this.numParticles = 300; // スマホ用に削減
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
    // スマホサイズに応じて半径を調整
    this.moamoa.displayRadius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    this.moamoa.baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    this.initParticles();
  }
  initParticles() {
    this.particles = [];
    const cx = this.moamoa.cx;
    const cy = this.moamoa.cy;
    const radius = this.moamoa.displayRadius;
    
    for (let i = 0; i < this.numParticles; i++) {
      // 手前から後ろへの流れを考慮した初期配置
      const angle = Math.random() * Math.PI * 2;
      // 中央も含めてより均等に分布（中央の空きを防ぐ）
      const r = radius * (0.1 + Math.random() * 1.8); // 中央から外側まで均等
      
      this.particles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        targetX: cx + Math.cos(angle) * r,
        targetY: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        size: 4.5 + Math.random() * 4.5, // 粒子を大きく
        angle: angle,
        baseRadius: r,
        spring: 0.11 + Math.random() * 0.08,
        friction: 0.81 + Math.random() * 0.1,
        flowPhase: Math.random() * Math.PI * 2 // 流れの位相
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
      const target = this.moamoa.baseRadius + vol*150;
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
      
      // 手前から後ろへの流れ（Y軸方向）- より激しく
      const flowY = Math.sin(flowTime) * radius * 1.2; // 流れを激しく
      
      // 回転しながら流れる動き（より激しく）
      const rotationAngle = particle.angle + timeScale * 0.8 + i * 0.01; // 回転を激しく
      const spiralEffect = Math.sin(timeScale * 0.4 + i * 0.05) * 0.4; // 螺旋効果を激しく
      
      // 中央も含めて均等に分布 - より広範囲
      const baseR = radius * (0.1 + Math.random() * 2.0 + spiralEffect);
      
      let targetX = cx + Math.cos(rotationAngle) * baseR;
      let targetY = cy + Math.sin(rotationAngle) * baseR + flowY;
      
      // 音声反応（より激しく）
      if (intensity > 0) {
        const soundWave = Math.sin(this.time / 600 + i * 0.15) * intensity * 35; // より激しく
        targetX += soundWave;
        targetY += soundWave * 0.8 + flowY * 0.5; // 流れも強化
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
          targetX += Math.cos(angle) * force * 50; // 避ける力を激しく
          targetY += Math.sin(angle) * force * 50;
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
    this.particles.forEach((particle, i) => {
      ctx.save();
      // グレー系の粒子
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, 2*Math.PI);
      ctx.fillStyle = `rgba(180,180,200,0.9)`; // グレー系を濃く
      ctx.globalAlpha = 0.25 + 0.15 * Math.abs(Math.sin(this.time/1100 + i*0.4)); // 透明度を濃く
      ctx.shadowColor = `rgba(160,160,180,0.3)`; // 影も濃く
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    });
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
  