(() => {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
  
    // ---- Réglages Étoiles ----
    const CONFIG = {
      particleCount: 150,           // Nombre d'étoiles
      particleColor: 'rgba(255, 255, 255, OPACITY)',
      particleSize: [0.5, 2],       // Taille min/max pour donner un effet de profondeur
      speed: 0.05,                  // Vitesse de dérive (très lente)
      mouseRadius: 100,             // Rayon d'interaction avec la souris
      mouseRepel: true,             // Les étoiles s'écartent très légèrement au passage
    };
    // -----------------------------------
  
    let particles = [];
    let mouse = { x: null, y: null };
  
    function resize() {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
  
    function createParticles() {
      particles = [];
      const count = Math.floor(
        CONFIG.particleCount * (window.innerWidth * window.innerHeight) / (1440 * 900)
      );
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * CONFIG.speed,
          vy: (Math.random() - 0.5) * CONFIG.speed,
          r: CONFIG.particleSize[0] + Math.random() * (CONFIG.particleSize[1] - CONFIG.particleSize[0]),
          alpha: 0.2 + Math.random() * 0.8, // Opacité de base de l'étoile
        });
      }
    }
  
    function step() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  
      for (const p of particles) {
        // Déplacement lent
        p.x += p.vx;
        p.y += p.vy;
  
        // Si l'étoile sort de l'écran, elle rebondit doucement
        if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;
  
        // Interaction légère avec la souris
        if (mouse.x !== null) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONFIG.mouseRadius) {
            const force = (1 - dist / CONFIG.mouseRadius) * 0.2; // Force réduite pour plus de douceur
            const dir = CONFIG.mouseRepel ? 1 : -1;
            p.x += (dx / dist) * force * dir;
            p.y += (dy / dist) * force * dir;
          }
        }
  
        // Dessin de l'étoile
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.particleColor.replace('OPACITY', p.alpha);
        ctx.fill();
      }
  
      requestAnimationFrame(step);
    }
  
    window.addEventListener('resize', () => { resize(); createParticles(); });
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });
  
    resize();
    createParticles();
    step();
  })();