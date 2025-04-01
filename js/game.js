class NeonRunner {
    constructor() {
        // Game state
        this.score = 0;
        this.speed = 25;
        this.maxSpeed = 80;
        this.speedIncrement = 0.03;
        this.gameOver = false;
        this.trackWidth = 12;
        this.trackLength = 300;
        this.obstacleSpacing = 25;
        this.canJump = true;
        this.jumpCooldown = 0;
        this.isMobile = this.checkIfMobile();
        this.lastTouchEnd = 0;
        
        // Mobile touch variables for swipes
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 30; // Minimum distance to consider as swipe
        
        // Performance settings
        this.qualityLevel = this.isMobile ? 'low' : 'high';
        
        // Physics settings
        this.world = new CANNON.World();
        this.world.gravity.set(0, -50, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = this.isMobile ? 5 : 10; // Reduce physics iterations on mobile
        
        // Three.js setup with deeper background color
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000008); // Darker blue-black background
        this.scene.fog = new THREE.Fog(0x000008, 50, 150); // Add fog for depth and to hide track end
        this.camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        this.camera.position.set(0, 10, -15);
        this.camera.lookAt(0, 0, 30);
        
        // Renderer with optimization options
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: !this.isMobile, // Disable antialiasing on mobile
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.isMobile ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);
        
        // Track segments and obstacles with draw distance based on device
        this.trackSegments = [];
        this.obstacles = [];
        this.drawDistance = this.isMobile ? 200 : 300; // Reduce draw distance on mobile
        
        // Powerups and game enhancements
        this.powerups = [];
        this.particleGroups = [];
        this.afterImages = [];
        this.hasSuperJump = false;
        this.hasSpeedBoost = false;
        this.speedBoostTime = 0;
        this.superJumpTime = 0;
        
        // Ball setup
        this.createBall();
        this.createInitialTrack();
        
        // Add lights
        this.addLights();
        
        // Controls
        this.keys = { left: false, right: false };
        this.setupEventListeners();
        
        // UI elements
        this.scoreElement = document.getElementById('score');
        this.finalScoreElement = document.getElementById('final-score');
        this.gameOverScreen = document.getElementById('game-over');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        
        // Performance monitoring
        this.frameCounter = 0;
        this.framesPerSecond = 60;
        this.lastFpsUpdateTime = 0;
        
        // Mobile-specific setup
        if (this.isMobile) {
            this.setupMobileControls();
        }
        
        // Prevent scroll/zoom behaviors on mobile
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent double-tap zoom
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - this.lastTouchEnd <= 300) {
                e.preventDefault();
            }
            this.lastTouchEnd = now;
        }, false);
        
        // Force full screen on iOS
        if (this.isMobile && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
            window.scrollTo(0, 0);
            document.body.style.height = `${window.innerHeight}px`;
        }
        
        // Start animation loop
        this.lastTime = 0;
        this.animate();
    }
    
    checkIfMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    }
    
    setupMobileControls() {
        // Get mobile control elements
        const leftControl = document.getElementById('left-control');
        const rightControl = document.getElementById('right-control');
        const jumpControl = document.getElementById('jump-control');
        const mobileControls = document.getElementById('mobile-controls');
        
        // Make sure touch events don't affect the rest of the page
        mobileControls.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        mobileControls.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        mobileControls.addEventListener('touchend', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Left control events - INVERTED (now moves right)
        leftControl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.keys.right = true; // INVERTED: left control moves right
            this.keys.left = false;
            leftControl.classList.add('control-active');
        }, { passive: false });
        
        leftControl.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.keys.right = false; // INVERTED: left control moves right
            leftControl.classList.remove('control-active');
        }, { passive: false });
        
        // Right control events - INVERTED (now moves left)
        rightControl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.keys.left = true; // INVERTED: right control moves left
            this.keys.right = false;
            rightControl.classList.add('control-active');
        }, { passive: false });
        
        rightControl.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.keys.left = false; // INVERTED: right control moves left
            rightControl.classList.remove('control-active');
        }, { passive: false });
        
        // Jump control events - unchanged
        jumpControl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.canJump) {
                this.jump();
                jumpControl.classList.add('control-active');
                setTimeout(() => {
                    jumpControl.classList.remove('control-active');
                }, 300);
            }
        }, { passive: false });
        
        // Add swipe gesture detection to the entire document
        document.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            // Update end positions in real-time for responsive controls
            this.touchEndX = e.touches[0].clientX;
            this.touchEndY = e.touches[0].clientY;
            
            const deltaX = this.touchEndX - this.touchStartX;
            const deltaY = this.touchStartY - this.touchEndY; // Reversed Y so up is positive
            
            // Reset forces before applying new ones
            this.keys.left = false;
            this.keys.right = false;
            
            // Check horizontal swipe (real-time response) - INVERTED CONTROLS
            if (Math.abs(deltaX) > this.minSwipeDistance) {
                if (deltaX > 0) {
                    // Swipe right but move left (INVERTED)
                    this.keys.left = true;
                    rightControl.classList.add('control-active');
                    leftControl.classList.remove('control-active');
                } else {
                    // Swipe left but move right (INVERTED)
                    this.keys.right = true;
                    leftControl.classList.add('control-active');
                    rightControl.classList.remove('control-active');
                }
            } else {
                // Not swiping horizontally
                leftControl.classList.remove('control-active');
                rightControl.classList.remove('control-active');
            }
            
            // Check for upward swipe (jump) - unchanged
            if (deltaY > this.minSwipeDistance && this.canJump) {
                this.jump();
                jumpControl.classList.add('control-active');
                setTimeout(() => {
                    jumpControl.classList.remove('control-active');
                }, 300);
                
                // Reset Y to prevent multiple jumps in a single swipe
                this.touchStartY = this.touchEndY;
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            // Reset all active states
            leftControl.classList.remove('control-active');
            rightControl.classList.remove('control-active');
            
            // Reset key states when touch ends
            this.keys.left = false;
            this.keys.right = false;
            
            // Reset touch positions
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.touchEndX = 0;
            this.touchEndY = 0;
        }, { passive: true });
    }
    
    createBall() {
        // Physics body
        const radius = 1;
        const ballShape = new CANNON.Sphere(radius);
        this.ballBody = new CANNON.Body({
            mass: 5,
            shape: ballShape,
            position: new CANNON.Vec3(0, radius, 0),
            linearDamping: 0.4,
            angularDamping: 0.4
        });
        this.world.addBody(this.ballBody);
        
        // Visual mesh with quality-based settings
        const segments = this.isMobile ? 16 : 32; // Reduce geometry complexity on mobile
        const geometry = new THREE.SphereGeometry(radius, segments, segments);
        
        // Create a ball with a glowing effect and trail
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        });
        
        this.ball = new THREE.Mesh(geometry, material);
        this.scene.add(this.ball);
        
        // Add a glow effect to the ball
        const glowGeometry = new THREE.SphereGeometry(radius * 1.2, segments, segments);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        this.ballGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(this.ballGlow);
    }
    
    createTrackSegment(zPosition) {
        // Create track floor
        const segmentLength = 20;
        const segmentGeometry = new THREE.BoxGeometry(this.trackWidth, 1, segmentLength);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        const segment = new THREE.Mesh(segmentGeometry, wireframeMaterial);
        segment.position.set(0, -0.5, zPosition + segmentLength / 2);
        this.scene.add(segment);
        
        // Add physics for the floor
        const groundShape = new CANNON.Box(new CANNON.Vec3(this.trackWidth / 2, 0.5, segmentLength / 2));
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: groundShape,
            position: new CANNON.Vec3(0, -0.5, zPosition + segmentLength / 2)
        });
        this.world.addBody(groundBody);
        
        // Store track segment data
        this.trackSegments.push({
            mesh: segment,
            body: groundBody,
            position: zPosition,
            length: segmentLength
        });
        
        return {
            position: zPosition,
            length: segmentLength
        };
    }
    
    createObstacle(zPosition, xOffset = 0) {
        // Reduce ramp probability from 30% to 15%
        const type = Math.random() > 0.85 ? 'ramp' : 'cube';
        // Use the xOffset if provided, otherwise use random lane position
        const lanePosition = xOffset !== 0 ? 
            xOffset : 
            (Math.random() * 2 - 1) * (this.trackWidth / 2 - 1.5);
        
        if (type === 'cube') {
            // Cube obstacle
            const size = 1 + Math.random() * 1.5;
            const height = 1 + Math.random() * 2;
            
            // Physics body
            const boxShape = new CANNON.Box(new CANNON.Vec3(size / 2, height / 2, size / 2));
            const boxBody = new CANNON.Body({
                mass: 0,
                shape: boxShape,
                position: new CANNON.Vec3(lanePosition, height / 2, zPosition)
            });
            // Set as a trigger for collision detection, but don't let it affect physics
            boxBody.collisionResponse = 0;
            this.world.addBody(boxBody);
            
            // Visual mesh - changed to red color for danger
            const geometry = new THREE.BoxGeometry(size, height, size);
            const material = new THREE.MeshBasicMaterial({
                color: 0xff0044, // Changed from purple to red for clearer danger indication
                wireframe: true,
                transparent: true,
                opacity: 0.8
            });
            
            const cube = new THREE.Mesh(geometry, material);
            cube.position.copy(boxBody.position);
            this.scene.add(cube);
            
            this.obstacles.push({
                mesh: cube,
                body: boxBody,
                position: zPosition,
                type: 'cube'
            });
        } else {
            // Ramp obstacle
            const width = 4;
            const height = 2;
            const depth = 6;
            
            // Physics body - use a box with rotation
            const rampShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
            const rampBody = new CANNON.Body({
                mass: 0,
                shape: rampShape,
                position: new CANNON.Vec3(lanePosition, height / 2, zPosition + depth / 2)
            });
            
            // Rotate to create a ramp
            const angle = Math.PI / 8; // ~22 degrees
            rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -angle);
            this.world.addBody(rampBody);
            
            // Visual mesh - kept green but made brighter for helpful indication
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff44, // Brighter green
                wireframe: true,
                transparent: true,
                opacity: 0.8
            });
            
            const ramp = new THREE.Mesh(geometry, material);
            ramp.position.copy(rampBody.position);
            ramp.quaternion.copy(rampBody.quaternion);
            this.scene.add(ramp);
            
            this.obstacles.push({
                mesh: ramp,
                body: rampBody,
                position: zPosition,
                type: 'ramp'
            });
        }
    }
    
    createInitialTrack() {
        // Create initial track segments
        for (let z = 0; z < this.trackLength; z += 20) {
            const segment = this.createTrackSegment(z);
            
            // Add obstacles with spacing - increased frequency by changing condition
            if (z > 30 && z % 15 === 0) {  // Changed from 25 to 15 for more frequent obstacles
                this.createObstacle(z);
                
                // Add a second obstacle with offset - sometimes on the same z-coordinate
                if (Math.random() > 0.6) {
                    const offsetX = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
                    const offsetZ = Math.random() * 7;
                    this.createObstacle(z + offsetZ, offsetX);
                }
            }
        }
        
        // Add invisible walls on the sides
        const wallShape = new CANNON.Box(new CANNON.Vec3(0.5, 5, this.trackLength / 2));
        
        // Left wall
        const leftWallBody = new CANNON.Body({
            mass: 0,
            shape: wallShape,
            position: new CANNON.Vec3(-this.trackWidth / 2 - 0.5, 5, this.trackLength / 2)
        });
        this.world.addBody(leftWallBody);
        
        // Right wall
        const rightWallBody = new CANNON.Body({
            mass: 0,
            shape: wallShape,
            position: new CANNON.Vec3(this.trackWidth / 2 + 0.5, 5, this.trackLength / 2)
        });
        this.world.addBody(rightWallBody);
    }
    
    addLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);
        
        // Point lights for neon effect
        const colors = [0x00ffff, 0xff00ff, 0x00ff88];
        
        for (let i = 0; i < 3; i++) {
            const light = new THREE.PointLight(colors[i % colors.length], 1, 100);
            light.position.set(
                (Math.random() - 0.5) * 20,
                10 + Math.random() * 10,
                20 + Math.random() * 30
            );
            this.scene.add(light);
        }
    }
    
    setupEventListeners() {
        // Keyboard controls - INVERTED
        window.addEventListener('keydown', (e) => {
            // INVERTED: left arrow/A now moves right
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.right = true;
            // INVERTED: right arrow/D now moves left
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.left = true;
            // Add support for WASD and other common control schemes - INVERTED
            if (e.key === 'z' || e.key === 'Z' || e.key === 'q' || e.key === 'Q') this.keys.right = true; // INVERTED
            if (e.key === 'x' || e.key === 'X' || e.key === 'e' || e.key === 'E') this.keys.left = true; // INVERTED
            // Jump with space or up arrow - unchanged
            if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && this.canJump) {
                this.jump();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            // INVERTED: left arrow/A now moves right
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.right = false;
            // INVERTED: right arrow/D now moves left
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.left = false;
            // Add support for WASD and other common control schemes - INVERTED
            if (e.key === 'z' || e.key === 'Z' || e.key === 'q' || e.key === 'Q') this.keys.right = false; // INVERTED
            if (e.key === 'x' || e.key === 'X' || e.key === 'e' || e.key === 'E') this.keys.left = false; // INVERTED
        });
        
        // Prevent context menu on long press for mobile
        window.addEventListener('contextmenu', (e) => {
            if (this.isMobile) {
                e.preventDefault();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Update camera aspect ratio
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            
            // Update renderer
            this.renderer.setSize(width, height);
            
            // Fix for iOS height issues
            if (this.isMobile && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
                document.body.style.height = `${window.innerHeight}px`;
                window.scrollTo(0, 0);
            }
            
            // Re-check if mobile and adjust settings if needed
            const wasMobile = this.isMobile;
            this.isMobile = this.checkIfMobile();
            
            if (wasMobile !== this.isMobile) {
                // Quality settings changed, reload the page to apply properly
                window.location.reload();
            }
        });
        
        // Add mouse/click support for desktop (excluding mobile since we have dedicated controls)
        if (!this.isMobile) {
            // Add click for jumping
            document.addEventListener('click', () => {
                if (this.canJump) {
                    this.jump();
                }
            });
            
            // Mouse controls - INVERTED
            document.addEventListener('mousemove', (e) => {
                const mouseX = e.clientX / window.innerWidth;
                if (mouseX < 0.4) {
                    // Left side of screen now moves right (INVERTED)
                    this.keys.right = true;
                    this.keys.left = false;
                } 
                else if (mouseX > 0.6) {
                    // Right side of screen now moves left (INVERTED)
                    this.keys.left = true;
                    this.keys.right = false;
                } 
                else {
                    this.keys.left = false;
                    this.keys.right = false;
                }
            });
        }
    }
    
    updateTrack(deltaTime) {
        // Move the player forward
        this.ballBody.position.z += this.speed * deltaTime;
        
        // Track segment management - remove old segments and create new ones
        for (let i = this.trackSegments.length - 1; i >= 0; i--) {
            const segment = this.trackSegments[i];
            
            // If segment is far behind, remove it and create a new one at the end
            if (this.ballBody.position.z - segment.position > 40) {
                // Remove old segment
                this.scene.remove(segment.mesh);
                this.world.removeBody(segment.body);
                
                // Create new segment at the end
                const lastSegment = this.trackSegments[this.trackSegments.length - 1];
                const newPosition = lastSegment.position + lastSegment.length;
                this.createTrackSegment(newPosition);
                
                // Increased chance of obstacles from 0.5 to 0.7
                if (Math.random() > 0.3) {
                    this.createObstacle(newPosition + Math.random() * 15);
                    
                    // Add a second obstacle with offset
                    if (Math.random() > 0.5) {
                        const offsetX = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
                        const offsetZ = Math.random() * 7;
                        this.createObstacle(newPosition + offsetZ, offsetX);
                    }
                }
                
                // Remove from array
                this.trackSegments.splice(i, 1);
            }
        }
        
        // Obstacle management - remove old obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            
            // If obstacle is far behind, remove it
            if (this.ballBody.position.z - obstacle.position > 40) {
                this.scene.remove(obstacle.mesh);
                this.world.removeBody(obstacle.body);
                this.obstacles.splice(i, 1);
            }
        }
    }
    
    updateBall(deltaTime) {
        // Apply forces based on keys - increased force for more responsive controls
        const force = 300; // Increased from 200 for faster response
        
        if (this.keys.left) {
            this.ballBody.applyForce(new CANNON.Vec3(-force, 0, 0), this.ballBody.position);
        }
        if (this.keys.right) {
            this.ballBody.applyForce(new CANNON.Vec3(force, 0, 0), this.ballBody.position);
        }
        
        // Add some automatic centering when no keys are pressed for stability
        if (!this.keys.left && !this.keys.right) {
            const centeringForce = this.ballBody.position.x * -10;
            this.ballBody.applyForce(new CANNON.Vec3(centeringForce, 0, 0), this.ballBody.position);
        }
        
        // Update ball position and rotation
        this.ball.position.copy(this.ballBody.position);
        this.ball.quaternion.copy(this.ballBody.quaternion);
        
        // Update glow position
        this.ballGlow.position.copy(this.ballBody.position);
        
        // Add trail/after-image effect
        if (this.hasSpeedBoost && Math.random() > 0.6) {
            this.createAfterImage();
        }
        
        // Update powerup states
        this.updatePowerups(deltaTime);
        
        // Check if ball fell off the track
        if (this.ballBody.position.y < -10) {
            this.endGame();
        }
        
        // Jump cooldown
        if (!this.canJump) {
            this.jumpCooldown -= deltaTime;
            if (this.jumpCooldown <= 0) {
                this.canJump = true;
            }
        }
        
        // Check if ball can jump (approximately on ground)
        const groundContact = this.ballBody.position.y <= 1.1;
        if (groundContact) {
            this.canJump = true;
        }
        
        // Check for collisions with obstacles
        this.checkObstacleCollisions();
    }
    
    updateCamera() {
        // Camera follows the ball with offset
        this.camera.position.x = this.ball.position.x * 0.3;
        this.camera.position.z = this.ball.position.z - 15;
        this.camera.lookAt(
            this.ball.position.x * 0.3,
            this.ball.position.y + 3,
            this.ball.position.z + 10
        );
    }
    
    updateScore(deltaTime) {
        this.score += Math.floor(this.speed * deltaTime * 10);
        this.scoreElement.textContent = this.score;
        
        // Increase speed gradually
        if (this.speed < this.maxSpeed) {
            this.speed += this.speedIncrement;
        }
    }
    
    updatePowerups(deltaTime) {
        // Update active powerups
        if (this.hasSpeedBoost) {
            this.speedBoostTime -= deltaTime;
            if (this.speedBoostTime <= 0) {
                this.hasSpeedBoost = false;
                // Reset normal speed max
                this.maxSpeed = 80;
            }
        }
        
        if (this.hasSuperJump) {
            this.superJumpTime -= deltaTime;
            if (this.superJumpTime <= 0) {
                this.hasSuperJump = false;
            }
        }
        
        // Update visual effects for ball based on powerups
        if (this.hasSpeedBoost) {
            this.ballGlow.material.color.setHex(0x00ffaa);
            this.ballGlow.material.opacity = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
            this.ballGlow.scale.set(1.3, 1.3, 1.3);
        } else if (this.hasSuperJump) {
            this.ballGlow.material.color.setHex(0xff00ff);
            this.ballGlow.material.opacity = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
            this.ballGlow.scale.set(1.3, 1.3, 1.3);
        } else {
            this.ballGlow.material.color.setHex(0x00ffff);
            this.ballGlow.material.opacity = 0.3;
            this.ballGlow.scale.set(1, 1, 1);
        }
    }
    
    createAfterImage() {
        // Create a fading copy of the ball as a trail effect
        const geometry = new THREE.SphereGeometry(1, 8, 8); // Low poly for performance
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffaa,
            transparent: true,
            opacity: 0.5
        });
        
        const afterImage = new THREE.Mesh(geometry, material);
        afterImage.position.copy(this.ball.position);
        afterImage.scale.set(0.8, 0.8, 0.8);
        this.scene.add(afterImage);
        
        // Store with creation time
        this.afterImages.push({
            mesh: afterImage,
            creationTime: Date.now(),
            duration: 0.3 // Duration in seconds before complete fade
        });
    }
    
    updateAfterImages() {
        // Update and remove after images
        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            const image = this.afterImages[i];
            const elapsed = (Date.now() - image.creationTime) / 1000;
            
            if (elapsed >= image.duration) {
                this.scene.remove(image.mesh);
                this.afterImages.splice(i, 1);
            } else {
                // Fade out
                image.mesh.material.opacity = 0.5 * (1 - elapsed / image.duration);
                // Shrink
                const scale = 0.8 * (1 - elapsed / image.duration);
                image.mesh.scale.set(scale, scale, scale);
            }
        }
    }
    
    update(deltaTime) {
        if (this.gameOver) return;
        
        // Update physics world
        this.world.step(deltaTime);
        
        // Update game elements
        this.updateTrack(deltaTime);
        this.updateBall(deltaTime);
        this.updateCamera();
        this.updateScore(deltaTime);
        this.updateAfterImages();
        
        // Performance monitoring
        this.frameCounter++;
        const now = Date.now();
        if (now - this.lastFpsUpdateTime > 1000) { // Update every second
            this.framesPerSecond = this.frameCounter;
            this.frameCounter = 0;
            this.lastFpsUpdateTime = now;
            
            // Adjust quality settings if needed based on FPS
            this.adjustQualitySettings();
        }
    }
    
    animate(time = 0) {
        const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate.bind(this));
    }
    
    endGame() {
        this.gameOver = true;
        this.finalScoreElement.textContent = this.score;
        this.gameOverScreen.style.display = 'block';
    }
    
    restart() {
        // Clean up current game
        this.obstacles.forEach(obstacle => {
            this.scene.remove(obstacle.mesh);
            this.world.removeBody(obstacle.body);
        });
        this.trackSegments.forEach(segment => {
            this.scene.remove(segment.mesh);
            this.world.removeBody(segment.body);
        });
        this.scene.remove(this.ball);
        this.world.removeBody(this.ballBody);
        
        // Reset game state
        this.score = 0;
        this.speed = 25;
        this.gameOver = false;
        this.trackSegments = [];
        this.obstacles = [];
        this.scoreElement.textContent = '0';
        this.gameOverScreen.style.display = 'none';
        
        // Recreate game elements
        this.createBall();
        this.createInitialTrack();
    }
    
    jump() {
        // Apply upward force to ball - significantly reduced jump power
        const jumpForce = this.hasSuperJump ? 200 : 100; // Reduced from 350/200 to 250/150
        this.ballBody.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), this.ballBody.position);
        
        // Set jump cooldown
        this.canJump = false;
        this.jumpCooldown = 0.8; // Seconds before can jump again
        
        // Add jump visual effect
        this.createJumpEffect();
    }
    
    createJumpEffect() {
        // Create a ring effect at jump point
        const ringGeometry = new THREE.RingGeometry(0.5, 1.5, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(this.ball.position);
        ring.position.y -= 0.9; // Slightly below the ball
        ring.rotation.x = Math.PI / 2; // Flat on the ground
        this.scene.add(ring);
        
        // Animate and remove the ring
        const startTime = Date.now();
        const duration = 0.5; // seconds
        
        const animateRing = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            
            if (elapsed < duration) {
                // Expand the ring
                const scale = 1 + elapsed * 3;
                ring.scale.set(scale, scale, scale);
                
                // Fade out
                ring.material.opacity = 0.7 * (1 - elapsed / duration);
                
                requestAnimationFrame(animateRing);
            } else {
                this.scene.remove(ring);
            }
        };
        
        animateRing();
    }
    
    checkObstacleCollisions() {
        // Simple distance-based collision detection with obstacles
        for (const obstacle of this.obstacles) {
            // Skip ramps as they're meant to be jumped on
            if (obstacle.type === 'ramp') continue;
            
            const dx = this.ballBody.position.x - obstacle.body.position.x;
            const dy = this.ballBody.position.y - obstacle.body.position.y;
            const dz = this.ballBody.position.z - obstacle.body.position.z;
            
            // Get obstacle dimensions (half-extents from the shape)
            const obstacleSize = obstacle.body.shapes[0].halfExtents;
            
            // Calculate distance threshold based on ball radius (1) and obstacle size
            const threshold = 1 + Math.max(obstacleSize.x, obstacleSize.z);
            
            // Check if distance is less than threshold in x and z, and we're not clearly above the obstacle
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            if (horizontalDist < threshold && dy < obstacleSize.y + 0.5) {
                // Create a flash effect on collision
                this.createCollisionEffect();
                this.endGame();
                break;
            }
        }
    }
    
    createCollisionEffect() {
        // Flash the scene with a bright color
        const originalColor = this.scene.background;
        this.scene.background = new THREE.Color(0xee5555);
        
        // Return to normal after a short delay
        setTimeout(() => {
            this.scene.background = originalColor;
        }, 100);
    }
    
    adjustQualitySettings() {
        // If on mobile and FPS is low, reduce visual effects
        if (this.isMobile && this.framesPerSecond < 30) {
            // Reduce fog distance
            this.scene.fog.near = 30;
            this.scene.fog.far = 100;
            
            // Reduce number of after images
            while (this.afterImages.length > 5) {
                const image = this.afterImages.shift();
                this.scene.remove(image.mesh);
            }
        }
    }
}

// Start the game when page is loaded
window.addEventListener('load', () => {
    // Detect if device orientation is supported and request permission on iOS
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires permission to use device orientation
        document.body.addEventListener('click', () => {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        new NeonRunner();
                    }
                })
                .catch(console.error);
        }, { once: true });
    } else {
        // Start game immediately on other devices
        new NeonRunner();
    }
}); 