// Estrely Golden Stardust & Constellation Canvas
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('stardust-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouse = { x: null, y: null, radius: 110 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
  });

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
  });
  resizeCanvas();

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.6 + 0.6;
      this.speedX = Math.random() * 0.4 - 0.2;
      this.speedY = Math.random() * 0.6 + 0.2;
      this.opacity = Math.random() * 0.6 + 0.2;
      this.color = Math.random() > 0.35 
        ? `rgba(212, 175, 55, ${this.opacity})` 
        : `rgba(255, 235, 170, ${this.opacity * 0.8})`;
      this.time = Math.random() * 100;
    }

    update() {
      this.time += 0.015;
      this.x += this.speedX + Math.sin(this.time) * 0.25;
      this.y -= this.speedY + Math.cos(this.time) * 0.2;

      if (mouse.x !== null && mouse.y !== null) {
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < mouse.radius) {
          const force = (mouse.radius - distance) / mouse.radius;
          this.x -= (dx / distance) * force * 2.5;
          this.y -= (dy / distance) * force * 2.5;
        }
      }

      if (this.y < 0) this.y = canvas.height;
      if (this.y > canvas.height) this.y = 0;
      if (this.x < 0) this.x = canvas.width;
      if (this.x > canvas.width) this.x = 0;
    }

    draw() {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function initParticles() {
    particles = [];
    let count = Math.floor((window.innerWidth * window.innerHeight) / 10000);
    count = Math.max(35, Math.min(count, 130));
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }
  initParticles();

  function connect() {
    let maxDistance = 110;
    for (let a = 0; a < particles.length; a++) {
      for (let b = a + 1; b < particles.length; b++) {
        let dx = particles[a].x - particles[b].x;
        let dy = particles[a].y - particles[b].y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < maxDistance) {
          let opacity = (1 - distance / maxDistance) * 0.25;
          ctx.strokeStyle = `rgba(212, 175, 55, ${opacity})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
    connect();
    requestAnimationFrame(animateParticles);
  }
  animateParticles();
});
