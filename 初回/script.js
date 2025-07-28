class BabyInteractiveApp {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.animationFrame = null;
        this.currentColorIndex = 0;
        this.colors = [
            'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 50%, #fed6e3 100%)',
            'linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #fcb69f 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 50%, #fad0c4 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 50%, #fed6e3 100%)'
        ];
        
        this.init();
    }
    
    init() {
        this.setupVoiceButton();
        this.setupInteractiveArea();
        this.setupControls();
        this.setupAudioContext();
        this.addTouchEffects();
    }
    
    setupVoiceButton() {
        const voiceButton = document.getElementById('voiceButton');
        const statusText = document.getElementById('statusText');
        const voiceContainer = document.querySelector('.voice-container');
        
        voiceButton.addEventListener('click', () => {
            if (!this.isRecording) {
                this.startRecording();
                statusText.textContent = '録音中... 話してみて！';
                voiceContainer.classList.add('recording');
            } else {
                this.stopRecording();
                statusText.textContent = 'タップして音声を録音';
                voiceContainer.classList.remove('recording');
            }
        });
        
        // タッチデバイス用のイベント
        voiceButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.createRippleEffect(e.touches[0].clientX, e.touches[0].clientY);
        });
    }
    
    setupInteractiveArea() {
        const interactiveArea = document.getElementById('interactiveArea');
        const bubbles = document.querySelectorAll('.bubble');
        
        // エリア全体のタッチ反応
        interactiveArea.addEventListener('click', (e) => {
            this.createBubbleEffect(e.clientX, e.clientY);
            this.playSound('pop');
        });
        
        // 個別のバブル反応
        bubbles.forEach(bubble => {
            bubble.addEventListener('click', (e) => {
                e.stopPropagation();
                this.animateBubble(bubble);
                this.playSound('ding');
            });
            
            bubble.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.animateBubble(bubble);
                this.playSound('ding');
            });
        });
    }
    
    setupControls() {
        const colorBtn = document.getElementById('colorBtn');
        const soundBtn = document.getElementById('soundBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        colorBtn.addEventListener('click', () => {
            this.changeBackgroundColor();
            this.playSound('chime');
        });
        
        soundBtn.addEventListener('click', () => {
            this.playRandomSound();
        });
        
        resetBtn.addEventListener('click', () => {
            this.resetApp();
            this.playSound('reset');
        });
    }
    
    setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
        } catch (error) {
            console.log('音声認識は利用できません:', error);
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            this.isRecording = true;
            this.analyzeAudio();
            
            // 録音開始の視覚効果
            this.createWaveEffect();
            
        } catch (error) {
            console.log('マイクへのアクセスが拒否されました:', error);
            this.showMessage('マイクの許可が必要です');
        }
    }
    
    stopRecording() {
        this.isRecording = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.microphone) {
            this.microphone.disconnect();
        }
    }
    
    analyzeAudio() {
        if (!this.isRecording) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        
        // 音声レベルを計算
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // 音声レベルに応じて波のアニメーションを調整
        this.adjustWaveAnimation(average);
        
        this.animationFrame = requestAnimationFrame(() => this.analyzeAudio());
    }
    
    adjustWaveAnimation(level) {
        const voiceContainer = document.querySelector('.voice-container');
        const levelClass = this.getLevelClass(level);
        
        voiceContainer.className = `voice-container recording ${levelClass}`;
    }
    
    getLevelClass(level) {
        if (level < 20) return 'voice-level-1';
        if (level < 40) return 'voice-level-2';
        if (level < 60) return 'voice-level-3';
        if (level < 80) return 'voice-level-4';
        return 'voice-level-5';
    }
    
    createWaveEffect() {
        const waves = document.querySelectorAll('.wave');
        waves.forEach((wave, index) => {
            wave.style.animationDelay = `${index * 0.2}s`;
        });
    }
    
    createBubbleEffect(x, y) {
        const bubble = document.createElement('div');
        bubble.className = 'temp-bubble';
        bubble.innerHTML = '💫';
        bubble.style.cssText = `
            position: fixed;
            left: ${x - 20}px;
            top: ${y - 20}px;
            font-size: 2rem;
            pointer-events: none;
            z-index: 1000;
            animation: bubble-pop 1s ease-out forwards;
        `;
        
        document.body.appendChild(bubble);
        
        setTimeout(() => {
            document.body.removeChild(bubble);
        }, 1000);
    }
    
    createRippleEffect(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.cssText = `
            position: fixed;
            left: ${x - 25}px;
            top: ${y - 25}px;
            width: 50px;
            height: 50px;
            border: 2px solid rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            animation: ripple-effect 0.6s ease-out forwards;
        `;
        
        document.body.appendChild(ripple);
        
        setTimeout(() => {
            document.body.removeChild(ripple);
        }, 600);
    }
    
    animateBubble(bubble) {
        bubble.style.transform = 'scale(1.5) rotate(360deg)';
        bubble.style.filter = 'brightness(1.5)';
        
        setTimeout(() => {
            bubble.style.transform = '';
            bubble.style.filter = '';
        }, 500);
    }
    
    changeBackgroundColor() {
        this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length;
        document.body.style.background = this.colors[this.currentColorIndex];
        
        // 色変更の視覚効果
        this.createColorTransitionEffect();
    }
    
    createColorTransitionEffect() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.3);
            pointer-events: none;
            z-index: 999;
            animation: fade-out 0.5s ease-out forwards;
        `;
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            document.body.removeChild(overlay);
        }, 500);
    }
    
    playSound(type) {
        // Web Audio APIを使用して音響効果を生成
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        switch (type) {
            case 'pop':
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
                break;
            case 'ding':
                oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
                break;
            case 'chime':
                oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime);
                break;
            case 'reset':
                oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.2);
                break;
        }
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }
    
    playRandomSound() {
        const sounds = ['pop', 'ding', 'chime'];
        const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
        this.playSound(randomSound);
    }
    
    resetApp() {
        // アプリをリセット
        this.stopRecording();
        document.body.style.background = this.colors[0];
        this.currentColorIndex = 0;
        
        const voiceContainer = document.querySelector('.voice-container');
        voiceContainer.className = 'voice-container';
        
        const statusText = document.getElementById('statusText');
        statusText.textContent = 'タップして音声を録音';
        
        // バブルをリセット
        const bubbles = document.querySelectorAll('.bubble');
        bubbles.forEach(bubble => {
            bubble.style.transform = '';
            bubble.style.filter = '';
        });
    }
    
    addTouchEffects() {
        // タッチデバイス用の追加効果
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.createRippleEffect(touch.clientX, touch.clientY);
            }
        });
    }
    
    showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 10000;
            font-size: 1.2rem;
        `;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 3000);
    }
}

// アプリの初期化
document.addEventListener('DOMContentLoaded', () => {
    new BabyInteractiveApp();
    
    // 追加のCSSアニメーション
    const style = document.createElement('style');
    style.textContent = `
        @keyframes bubble-pop {
            0% {
                transform: scale(0) rotate(0deg);
                opacity: 1;
            }
            50% {
                transform: scale(1.2) rotate(180deg);
                opacity: 0.8;
            }
            100% {
                transform: scale(0) rotate(360deg);
                opacity: 0;
            }
        }
        
        @keyframes ripple-effect {
            0% {
                transform: scale(0);
                opacity: 1;
            }
            100% {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        @keyframes fade-out {
            0% {
                opacity: 1;
            }
            100% {
                opacity: 0;
            }
        }
        
        .temp-bubble {
            pointer-events: none;
        }
        
        .ripple {
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}); 