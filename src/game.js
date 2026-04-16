const TRACK = {
  outer: { x: 80, y: 60, w: 800, h: 420 },
  inner: { x: 260, y: 180, w: 440, h: 180 },
  checkpoints: [
    { x: 480, y: 110, w: 80, h: 30 },
    { x: 830, y: 260, w: 30, h: 80 },
    { x: 480, y: 430, w: 80, h: 30 },
    { x: 130, y: 260, w: 30, h: 80 }
  ],
  start: { x: 170, y: 120, w: 16, h: 70 }
};

function inRect(pt, rect) {
  return pt.x >= rect.x && pt.x <= rect.x + rect.w && pt.y >= rect.y && pt.y <= rect.y + rect.h;
}

function onRoad(pos) {
  const inOuter = inRect(pos, TRACK.outer);
  const inInner = inRect(pos, TRACK.inner);
  return inOuter && !inInner;
}

export class RacerGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.keys = new Set();
    this.reset();

    addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  reset() {
    this.car = { x: 170, y: 150, angle: -Math.PI / 2, speed: 0 };
    this.running = false;
    this.startMs = 0;
    this.timeMs = 0;
    this.lastCheckpoint = -1;
    this.replay = [];
    this.finishedLap = false;
  }

  update(dt, now) {
    const throttle = this.keys.has('w') ? 1 : 0;
    const brake = this.keys.has('s') ? 1 : 0;
    const left = this.keys.has('a') ? 1 : 0;
    const right = this.keys.has('d') ? 1 : 0;

    if (!this.running && throttle > 0) {
      this.running = true;
      this.startMs = now;
    }

    const accel = 280;
    const drag = 0.985;
    const turnRate = 2.2;

    this.car.speed += throttle * accel * dt;
    this.car.speed -= brake * accel * dt * 0.85;
    this.car.speed *= drag;
    this.car.speed = Math.max(-80, Math.min(360, this.car.speed));

    const turn = (right - left) * turnRate * dt * Math.min(1, Math.abs(this.car.speed) / 140 + 0.2);
    this.car.angle += turn;
    this.car.x += Math.cos(this.car.angle) * this.car.speed * dt;
    this.car.y += Math.sin(this.car.angle) * this.car.speed * dt;

    if (!onRoad(this.car)) {
      this.car.speed *= 0.93;
    }

    if (this.running) {
      this.timeMs = Math.max(0, Math.floor(now - this.startMs));
      this.replay.push({
        t: this.timeMs,
        x: Number(this.car.x.toFixed(2)),
        y: Number(this.car.y.toFixed(2)),
        a: Number(this.car.angle.toFixed(3))
      });
      this.checkProgress();
    }
  }

  checkProgress() {
    TRACK.checkpoints.forEach((cp, idx) => {
      if (idx === this.lastCheckpoint + 1 && inRect(this.car, cp)) {
        this.lastCheckpoint = idx;
      }
    });

    if (this.lastCheckpoint === TRACK.checkpoints.length - 1 && inRect(this.car, TRACK.start)) {
      this.finishedLap = true;
      this.running = false;
    }
  }

  draw(ghostReplay, ghostEnabled) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#1b2135';
    ctx.fillRect(TRACK.outer.x, TRACK.outer.y, TRACK.outer.w, TRACK.outer.h);

    ctx.fillStyle = '#0f1526';
    ctx.fillRect(TRACK.inner.x, TRACK.inner.y, TRACK.inner.w, TRACK.inner.h);

    ctx.fillStyle = '#2d3e81';
    ctx.fillRect(TRACK.start.x, TRACK.start.y, TRACK.start.w, TRACK.start.h);

    TRACK.checkpoints.forEach((cp, idx) => {
      ctx.fillStyle = idx <= this.lastCheckpoint ? '#3ca371' : '#45507a';
      ctx.fillRect(cp.x, cp.y, cp.w, cp.h);
    });

    if (ghostEnabled && ghostReplay?.length) {
      const frameIdx = ghostReplay.findIndex((frame) => frame.t >= this.timeMs);
      const ghostFrameIndex = frameIdx === -1 ? ghostReplay.length - 1 : frameIdx;
      const ghostFrame = ghostReplay[ghostFrameIndex] || ghostReplay[0];

      this.ctx.strokeStyle = '#96b6ff55';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      ghostReplay.slice(0, ghostFrameIndex + 1).forEach((frame, idx) => {
        if (idx === 0) {
          this.ctx.moveTo(frame.x, frame.y);
        } else {
          this.ctx.lineTo(frame.x, frame.y);
        }
      });
      this.ctx.stroke();

      if (ghostFrame) {
        this.drawCar(ghostFrame.x, ghostFrame.y, ghostFrame.a, '#96b6ffaa');
      }
    }

    this.drawCar(this.car.x, this.car.y, this.car.angle, '#ffdd57');
  }

  drawCar(x, y, angle, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-8, -5, 16, 10);
    ctx.restore();
  }

  validateRun() {
    return this.finishedLap && this.timeMs > 3000 && this.lastCheckpoint === TRACK.checkpoints.length - 1;
  }
}
