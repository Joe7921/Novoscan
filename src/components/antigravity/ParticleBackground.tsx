'use client';

import { useEffect, useRef } from 'react';
import { ANTIGRAVITY_COLORS } from '@/lib/constants/theme';

class Particle {
    x: number;
    y: number;
    basePathX: number;
    basePathY: number;
    size: number;
    color: string;
    vx: number;
    vy: number;
    density: number;
    canvasWidth: number;
    canvasHeight: number;

    constructor(x: number, y: number, color: string, canvasWidth: number, canvasHeight: number) {
        this.x = x;
        this.y = y;
        this.basePathX = x;
        this.basePathY = y;
        // Base speed increased by 10% (0.5 -> 0.55)
        this.vx = (Math.random() - 0.5) * 0.55;
        this.vy = (Math.random() - 0.5) * 0.55;
        // Smaller particles for minimal look
        this.size = Math.random() * 2 + 0.5;
        this.color = color;
        this.density = (Math.random() * 30) + 1;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }

    update(mouse: { x: number | null, y: number | null, radius: number }, particles: Particle[]) {
        // Always update the base path drift
        this.basePathX += this.vx;
        this.basePathY += this.vy;

        // Wrap base path around edges to match canvas behavior
        if (this.basePathX < 0) this.basePathX = this.canvasWidth;
        else if (this.basePathX > this.canvasWidth) this.basePathX = 0;

        if (this.basePathY < 0) this.basePathY = this.canvasHeight;
        else if (this.basePathY > this.canvasHeight) this.basePathY = 0;

        let isInteracting = false;

        if (mouse.x != null && mouse.y != null) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Interaction within influence radius
            if (distance < mouse.radius) {
                isInteracting = true;
                // Fluid Gravity interaction
                // Attract particles very gently towards mouse
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;

                // Max distance, past that the pull is 0
                const force = (mouse.radius - distance) / mouse.radius;

                // Create a vortex / orbital swirling effect
                const swirlForceX = -forceDirectionY; // Tangential force
                const swirlForceY = forceDirectionX;

                // Adjust strength of orbit vs inward pull
                const pullStrength = 0.5 * this.density * 0.05;
                const swirlStrength = 1.0 * this.density * 0.05;

                this.x += forceDirectionX * force * pullStrength + swirlForceX * force * swirlStrength;
                this.y += forceDirectionY * force * pullStrength + swirlForceY * force * swirlStrength;

                // Repulsion close to the exact cursor point to create a hollow eye for the cursor
                if (distance < 30) {
                    this.x -= forceDirectionX * (30 - distance) * 0.2;
                    this.y -= forceDirectionY * (30 - distance) * 0.2;
                }
            }
        }

        // Apply visual repulsion to prevent clumps (only when interacting to save performance)
        if (isInteracting) {
            // Optimization: Fast bounding box check and sampling to reduce O(N^2) bottleneck
            for (let i = 0; i < particles.length; i += 3) {
                const other = particles[i];
                if (other === this) continue;

                const pdx = this.x - other.x;
                if (Math.abs(pdx) > 12) continue; // Fast bounding box check

                const pdy = this.y - other.y;
                if (Math.abs(pdy) > 12) continue;

                const distSq = pdx * pdx + pdy * pdy;
                const minDist = 12; // Minimum distance between particles

                if (distSq < minDist * minDist && distSq > 0) {
                    const pDist = Math.sqrt(distSq);
                    const force = (minDist - pDist) / minDist;
                    this.x += (pdx / pDist) * force * 1.5;
                    this.y += (pdy / pDist) * force * 1.5;
                }
            }
        }

        if (!isInteracting) {
            // Smoothly spring back to the base path drift when not interacting
            const backDx = this.basePathX - this.x;
            const backDy = this.basePathY - this.y;
            this.x += backDx * 0.05; // Gentle spring factor
            this.y += backDy * 0.05;
        }

        // Wrap actual position around edges
        if (this.x < 0) this.x = this.canvasWidth;
        else if (this.x > this.canvasWidth) this.x = 0;

        if (this.y < 0) this.y = this.canvasHeight;
        else if (this.y > this.canvasHeight) this.y = 0;
    }
}

export default function ParticleBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particlesArray: Particle[] = [];
        let animationFrameId: number;

        const brandColors = Object.values(ANTIGRAVITY_COLORS.brand);

        const mouse = {
            x: null as number | null,
            y: null as number | null,
            radius: 200, // 性能优化：从 300 缩减到 200，减少碰撞检测范围
        };

        const handleMouseMove = (event: MouseEvent) => {
            mouse.x = event.x;
            mouse.y = event.y;
        };

        const handleMouseLeave = () => {
            mouse.x = null;
            mouse.y = null;
        };

        // Add touch support
        const handleTouchMove = (event: TouchEvent) => {
            mouse.x = event.touches[0].clientX;
            mouse.y = event.touches[0].clientY;
        };

        // Smooth reset on resize
        let resizeTimeout: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                init();
            }, 200);
        };

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('resize', handleResize);

        // 性能优化：移动端降低粒子密度和更新频率
        const isMobile = window.innerWidth < 768;

        function init() {
            if (!canvas) return;
            particlesArray = [];
            // 移动端进一步减少粒子数
            const densityDivisor = isMobile ? 18000 : 9000;
            const numberOfParticles = (canvas.width * canvas.height) / densityDivisor;
            for (let i = 0; i < numberOfParticles; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const color = brandColors[Math.floor(Math.random() * brandColors.length)];
                particlesArray.push(new Particle(x, y, color, canvas.width, canvas.height));
            }
        }

        // 性能优化：后台标签页暂停动画，避免无意义的 CPU/GPU 消耗
        let isPageVisible = true;
        let lastTime = 0;
        const handleVisibilityChange = () => {
            isPageVisible = !document.hidden;
            if (isPageVisible) {
                lastTime = performance.now();
                animationFrameId = requestAnimationFrame(animate);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        function animate(currentTime: number) {
            if (!ctx || !canvas || !isPageVisible) return;

            // 性能优化：全平台锁帧 30FPS
            if (currentTime - lastTime < 33) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }
            lastTime = currentTime;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].draw(ctx);
                particlesArray[i].update(mouse, particlesArray);
            }

            // Draw Constellation Mesh — 移动端跳过以节省 GPU 开销
            if (!isMobile && mouse.x != null && mouse.y != null) {
                const meshInfluenceDistance = 120;
                ctx.lineWidth = 0.5;

                for (let a = 0; a < particlesArray.length; a += 3) {
                    const p1 = particlesArray[a];

                    const d1x = mouse.x - p1.x;
                    const d1y = mouse.y - p1.y;
                    if (d1x * d1x + d1y * d1y > meshInfluenceDistance * meshInfluenceDistance) continue;

                    for (let b = a + 3; b < particlesArray.length; b += 3) {
                        const p2 = particlesArray[b];
                        const dx = p1.x - p2.x;
                        const dy = p1.y - p2.y;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < 6000) {
                            const opacity = 1 - (distSq / 6000);
                            ctx.strokeStyle = `rgba(180, 200, 240, ${opacity * 0.35})`;
                            ctx.beginPath();
                            ctx.moveTo(p1.x, p1.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.stroke();
                        }
                    }
                }
            }

            animationFrameId = requestAnimationFrame(animate);
        }

        init();
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            cancelAnimationFrame(animationFrameId);
            clearTimeout(resizeTimeout);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0 opacity-40"
            style={{ willChange: 'transform' }}
            aria-hidden="true"
        />
    );
}
