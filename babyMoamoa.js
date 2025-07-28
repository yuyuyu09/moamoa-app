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
      color: [120, 180, 255]
    };
    this.touchRipples = []; // タッチ波紋
    this.isLongPress = false;
    this.longPressTimer = null;
    this.time = 0; // 時間管理を最適化
    this.hasTouched = false; // タッチしたかどうかのフラグ
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // タッチ＆マウス押下
    this.canvas.addEventListener('pointerdown', e => this.startLongPress(e));
    this.canvas.addEventListener('pointerup', e => this.endLongPress(e));
    this.canvas.addEventListener('pointerleave', e => this.endLongPress(e));
    this.canvas.addEventListener('pointermove', e => this.handlePointer(e));
    // マルチタッチ追従
    this.canvas.addEventListener('touchmove', e => {
      for(const t of e.touches) this.handlePointer(t);
    }, {passive: false});

    this.setupMic(); // 常時マイクON
    this.animate();
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.moamoa.cx = window.innerWidth / 2;
    this.moamoa.cy = window.innerHeight / 2;
  }
  async setupMic() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = audioCtx.createAnalyser();
      this.analyser.fftSize = 256; // 512から256に削減
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let stream = await navigator.mediaDevices.getUserMedia({audio:true});
      let src = audioCtx.createMediaStreamSource(stream);
      src.connect(this.analyser);
      this.status.textContent = "音や声＋タッチ・スワイプ 両方でモワモワが動くよ！";
    } catch {
      this.status.textContent = "マイク許可がありません（タッチ・スワイプのみ反応します）";
    }
  }
  animate() {
    this.time += 16; // 約60fps
    requestAnimationFrame(() => this.animate());
    this.draw();
  }
  draw() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0,0,w,h);
    
    // 音声レベル取得
    let vol = 0;
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      for(let x=0; x<this.dataArray.length; ++x) sum += this.dataArray[x];
      vol = sum / this.dataArray.length / 255;
      // モワモワに（バネ物理＋イージング）
      const target = this.moamoa.baseRadius + vol*150;
      const dy = target - this.moamoa.displayRadius;
      this.moamoa.vy += dy * this.moamoa.spring;
      this.moamoa.vy *= this.moamoa.friction;
      this.moamoa.displayRadius += this.moamoa.vy;
    } else {
      this.moamoa.displayRadius += (this.moamoa.baseRadius-this.moamoa.displayRadius)*0.07;
      this.moamoa.vy *= 0.51;
    }
    
    // タッチ波紋描画（最適化）
    for (const ripple of this.touchRipples) {
      const alpha = 0.24 * (1-ripple.age/1.1);
      if(alpha<=0) continue;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.r, 0, 2*Math.PI);
      ctx.fillStyle = `rgba(120,180,255,${alpha})`;
      ctx.fill();
      ripple.r += 9; ripple.age += 0.022;
    }
    this.touchRipples = this.touchRipples.filter(r=>r.age<1.1);

    // モワモワ多重グラデ（最適化）
    const cx = this.moamoa.cx, cy = this.moamoa.cy, col = this.moamoa.color;
    for(let i=4;i>=1;--i){ // 6から4に削減
      const r = this.moamoa.displayRadius*i*0.32+38;
      const grad = ctx.createRadialGradient(cx,cy,r*0.33,cx,cy,r);
      const alpha = 0.10+0.04*i+0.15*Math.sin(this.time/830+i);
      grad.addColorStop(0,`rgba(${col[0]},${col[1]},${col[2]},${alpha})`);
      grad.addColorStop(0.68,`rgba(${col[0]},${col[1]},${col[2]},0.0)`);
      grad.addColorStop(1,"rgba(255,255,255,0)");
      ctx.globalCompositeOperation='lighter';
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,2*Math.PI);
      ctx.fillStyle=grad;
      ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
    
    // メイン円
    ctx.beginPath();
    ctx.arc(cx, cy, this.moamoa.displayRadius, 0, 2*Math.PI);
    ctx.shadowColor = 'rgba(120,180,255,0.28)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.72)`;
    ctx.fill();

    // 粒子（最適化）
    const numParticles = 25; // 35から25に削減
    const r = this.moamoa.displayRadius+16;
    for(let i=0;i<numParticles;++i){
      const ang = (2*Math.PI/numParticles)*i + this.time/2500 + Math.sin(i);
      const px = cx + Math.cos(ang)*r + Math.sin(this.time/700+ang)*7;
      const py = cy + Math.sin(ang)*r + Math.cos(this.time/910+ang)*7;
      const alpha = 0.6+0.3*Math.sin(this.time/900+i);
      ctx.beginPath();
      ctx.arc(px,py, 3+Math.abs(Math.sin(this.time/1700+i))*2, 0, 2*Math.PI);
      ctx.fillStyle = `rgba(255,255,255,${alpha*0.23})`;
      ctx.shadowColor = `rgba(120,180,255,${alpha*0.4})`;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
  }
  handlePointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX || e.touches?.[0]?.clientX)-rect.left;
    const py = (e.clientY || e.touches?.[0]?.clientY)-rect.top;
    // タッチ位置に波紋と、メイン円をよせる
    if (isNaN(px)||isNaN(py)) return;
    
    // 初回タッチでステータステキストを非表示
    if (!this.hasTouched) {
      this.hasTouched = true;
      this.status.style.opacity = '0';
      this.status.style.transition = 'opacity 0.5s ease';
    }
    
    this.touchRipples.push({x:px,y:py,r:18,age:0});
    // 中心円もタッチした方向にゆっくり近づける
    this.moamoa.cx += (px-this.moamoa.cx)*0.15;
    this.moamoa.cy += (py-this.moamoa.cy)*0.15;
  }

  startLongPress(e) {
    // 長押し判定
    this.longPressTimer = setTimeout(()=>{
      this.isLongPress = true;
      // 例：色変更＆拡大
      this.moamoa.color = [
        80+Math.floor(Math.random()*70),
        100+Math.floor(Math.random()*120),
        200+Math.floor(Math.random()*45)
      ];
      this.moamoa.displayRadius *= 1.25;
      this.touchRipples.push({x:e.clientX, y:e.clientY, r:38, age:0}); //でかい波紋
    }, 600);
  }

  endLongPress(e) {
    clearTimeout(this.longPressTimer);
    if(this.isLongPress){
      this.isLongPress = false;
      // オプション:長押し解除で何らかのリアクション
    }else{
      // 通常の短押し波紋
      this.handlePointer(e);
    }
  }
}
window.addEventListener('DOMContentLoaded', ()=>{ new BabyMoamoa(); });
  