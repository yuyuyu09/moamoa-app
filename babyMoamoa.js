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
      displayRadius: 80,
      vy: 0,
      baseRadius: 80,
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
    this.numParticles = 720; // 4倍に増加
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

    this.setupMic();
    this.animate();
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.moamoa.cx = window.innerWidth / 2;
    this.moamoa.cy = window.innerHeight / 2;
    this.initParticles();
  }
  initParticles() {
    this.particles = [];
    const cx = this.moamoa.cx;
    const cy = this.moamoa.cy;
    const radius = this.moamoa.displayRadius;
    
    for (let i = 0; i < this.numParticles; i++) {
      // 円全体にランダムに点在
      const angle = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random()) * 0.9; // 中心に近いほど密度が高い
      
      this.particles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        targetX: cx + Math.cos(angle) * r,
        targetY: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        size: 2.8 + Math.random() * 3.2,
        angle: angle,
        baseRadius: r,
        spring: 0.11 + Math.random() * 0.08,
        friction: 0.81 + Math.random() * 0.1
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

    // タッチ波紋（グレー系）
    for (const ripple of this.touchRipples) {
      const alpha = 0.09 * (1 - ripple.age/1.1);
      if(alpha<=0) continue;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.r, 0, 2*Math.PI);
      ctx.fillStyle = `rgba(180,180,190,${alpha})`;
      ctx.fill();
      ripple.r += 9; ripple.age += 0.022;
    }
    this.touchRipples = this.touchRipples.filter(r=>r.age<1.1);

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
    
    // バイブ効果（手動操作時）
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
    
    this.touchRipples.push({x:px,y:py,r:18,age:0});
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
      // より品のある動き - データっぽい軌道
      const timeScale = this.time / 3000;
      const particlePhase = i * 0.1;
      
      // 複数の正弦波を組み合わせた滑らかな動き
      const wave1 = Math.sin(timeScale + particlePhase) * 0.3;
      const wave2 = Math.cos(timeScale * 0.7 + particlePhase * 1.3) * 0.2;
      const wave3 = Math.sin(timeScale * 0.5 + particlePhase * 0.7) * 0.15;
      
      const baseAngle = particle.angle + wave1 + wave2 + wave3;
      const baseR = radius * (0.6 + wave3 * 0.4);
      
      let targetX = cx + Math.cos(baseAngle) * baseR;
      let targetY = cy + Math.sin(baseAngle) * baseR;
      
      // 音声反応（より控えめに）
      if (intensity > 0) {
        const soundWave = Math.sin(this.time / 800 + i * 0.5) * intensity * 15;
        targetX += soundWave;
        targetY += soundWave * 0.7;
      }
      
      // タッチポイントを避ける（より滑らかに）
      this.touchPoints.forEach(point => {
        const dx = targetX - point.x;
        const dy = targetY - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const avoidRadius = point.radius * (1 - point.age / 2.0);
        
        if (distance < avoidRadius) {
          const force = Math.pow((avoidRadius - distance) / avoidRadius, 2); // より滑らかな力
          const angle = Math.atan2(dy, dx);
          targetX += Math.cos(angle) * force * 30;
          targetY += Math.sin(angle) * force * 30;
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
      
      // より滑らかな動きのための微細な調整
      particle.vx += (Math.random() - 0.5) * 0.1; // ランダム要素を大幅削減
      particle.vy += (Math.random() - 0.5) * 0.1;
      
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
      ctx.fillStyle = `rgba(200,200,210,0.6)`; // グレー系
      ctx.globalAlpha = 0.12 + 0.08 * Math.abs(Math.sin(this.time/1100 + i*0.4));
      ctx.shadowColor = `rgba(180,180,190,0.14)`;
      ctx.shadowBlur = 7;
      ctx.fill();
      ctx.restore();
    });
  }
  startLongPress(e) {
    this.longPressTimer = setTimeout(()=>{
      this.isLongPress = true;
      this.moamoa.color = [
        180+Math.floor(Math.random()*40),  // グレー系の範囲
        180+Math.floor(Math.random()*40),
        190+Math.floor(Math.random()*40)
      ];
      this.moamoa.displayRadius *= 1.19;
      this.touchRipples.push({x:e.clientX, y:e.clientY, r:38, age:0});
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
  