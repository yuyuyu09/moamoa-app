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
      color: [228, 220, 255] // より淡いパープル
    };
    this.touchRipples = [];
    this.isLongPress = false;
    this.longPressTimer = null;
    this.time = 0;
    this.hasTouched = false;

    // パープル粒子
    this.particles = [];
    this.numParticles = 180;
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
      const angle = (Math.PI * 2 * i) / this.numParticles;
      const r = radius * (0.8 + Math.random() * 0.4);
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

    // タッチ波紋（パステルパープル）
    for (const ripple of this.touchRipples) {
      const alpha = 0.09 * (1 - ripple.age/1.1);
      if(alpha<=0) continue;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.r, 0, 2*Math.PI);
      ctx.fillStyle = `rgba(198,180,255,${alpha})`;
      ctx.fill();
      ripple.r += 9; ripple.age += 0.022;
    }
    this.touchRipples = this.touchRipples.filter(r=>r.age<1.1);

    // モワモワ多重グラデーション
    const cx = this.moamoa.cx, cy = this.moamoa.cy, col = this.moamoa.color;
    for(let i=3; i>=1; --i){
      const r = this.moamoa.displayRadius*i*0.25+20;
      const grad = ctx.createRadialGradient(cx,cy,r*0.45,cx,cy,r);
      // 淡い青紫と白のなめらかグラデに
      const hue = 252 + 7*Math.sin(this.time/1500+i*1.7);
      const pastel = `hsl(${hue},52%,85%)`;
      const alpha = 0.05+0.03*i+0.08*Math.sin(this.time/980+i);
      grad.addColorStop(0,pastel);
      grad.addColorStop(0.67,`rgba(224,214,255,${alpha})`);
      grad.addColorStop(1,"rgba(250,250,255,0)");
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,2*Math.PI);
      ctx.globalAlpha = alpha;
      ctx.fillStyle=grad;
      ctx.filter = `blur(${8+2*i}px)`;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.filter = 'none';
    }

    // パープルメイン円
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx,cy,this.moamoa.displayRadius,0,2*Math.PI);
    ctx.shadowColor = 'rgba(200,180,250,0.15)';
    ctx.shadowBlur = 17;
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.25)`;
    ctx.fill();
    ctx.restore();

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
    this.touchRipples.push({x:px,y:py,r:18,age:0});
    this.moamoa.cx += (px-this.moamoa.cx)*0.15;
    this.moamoa.cy += (py-this.moamoa.cy)*0.15;
    this.updateParticleTargets(0.33);
  }
  updateParticleTargets(intensity = 0) {
    const cx = this.moamoa.cx, cy = this.moamoa.cy, radius = this.moamoa.displayRadius;
    this.particles.forEach((particle, i) => {
      const angle = particle.angle + this.time / 2600 + Math.sin(this.time / 1100 + i) * 0.08;
      const r = radius * (0.85 + Math.sin(this.time/2300 + i*0.7) * 0.14) + intensity * 18;
      particle.targetX = cx + Math.cos(angle) * r;
      particle.targetY = cy + Math.sin(angle) * r;
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
      particle.x += particle.vx;
      particle.y += particle.vy;
    });
  }
  drawParticles() {
    const ctx = this.ctx;
    this.particles.forEach((particle, i) => {
      ctx.save();
      // パステルパープル＋グレー寄りも混ぜる
      const hue = 252 + 8*Math.sin(this.time/1000 + i*0.207);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, 2*Math.PI);
      ctx.fillStyle = `hsl(${hue}, 40%, 89%)`; // 極淡
      ctx.globalAlpha = 0.12 + 0.08 * Math.abs(Math.sin(this.time/1100 + i*0.4));
      ctx.shadowColor = `rgba(200,190,255,0.14)`;
      ctx.shadowBlur = 7;
      ctx.fill();
      ctx.restore();
    });
  }
  startLongPress(e) {
    this.longPressTimer = setTimeout(()=>{
      this.isLongPress = true;
      this.moamoa.color = [
        180+Math.floor(Math.random()*35),  // 赤〜青紫の間
        169+Math.floor(Math.random()*18),
        240+Math.floor(Math.random()*25)
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
  