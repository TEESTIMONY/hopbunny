class NeonRunner {
    constructor() {
        // Game state
        this.score = 0;
        this.speed = 20;
        this.maxSpeed = 65;
        this.speedIncrement = 0.025;
        this.gameOver = false;
        this.trackWidth = 13;
        this.trackLength = 300;
        this.obstacleSpacing = 27;
        this.canJump = true;
        this.jumpCooldown = 0;
        this.isMobile = this.checkIfMobile();
        this.lastTouchEnd = 0;
        this.gameStarted = false; // Add flag to track if game has started
        this.restartListener = null; // Track restart event listener
        this.animating = true; // Track animation state
        
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
        this.scoreElement = document.getElementById('score-value');
        this.finalScoreElement = document.getElementById('final-score');
        this.gameOverScreen = document.getElementById('game-over');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        this.speedBar = document.querySelector('.speed-bar');
        
        // Performance monitoring
        this.frameCounter = 0;
        this.framesPerSecond = 60;
        this.lastFpsUpdateTime = 0;
        
        // Mobile-specific setup
        if (this.isMobile) {
            this.setupMobileControls();
            this.setupMobileViewport();
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
        
        // Start animation loop
        this.lastTime = 0;
        this.animate();
    }
    
    checkIfMobile() {
        // More comprehensive mobile detection
        const isTouchDevice = ('ontouchstart' in window) || 
                             (navigator.maxTouchPoints > 0) || 
                             (navigator.msMaxTouchPoints > 0);
        
        const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent);
        
        const isSmallScreen = window.innerWidth <= 768;
        
        // Check if device has orientation capability (most mobile devices)
        const hasOrientation = typeof window.orientation !== 'undefined' || 
                              navigator.userAgent.indexOf('IEMobile') !== -1;
        
        return (isTouchDevice && (isMobileUserAgent || isSmallScreen)) || hasOrientation;
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
            
            // Add vibration feedback if supported
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(40);
            }
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
            
            // Add vibration feedback if supported
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(40);
            }
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
                
                // Add vibration feedback if supported
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(40);
                }
                
                setTimeout(() => {
                    jumpControl.classList.remove('control-active');
                }, 300);
            }
        }, { passive: false });
        
        // Handle screen orientation changes
        window.addEventListener('orientationchange', () => {
            // Short delay to let the browser adjust
            setTimeout(() => {
                // Adjust camera and renderer
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                
                // Force redraw of UI elements
                const ui = document.getElementById('ui');
                if (ui) {
                    ui.style.display = 'none';
                    setTimeout(() => {
                        ui.style.display = 'block';
                    }, 10);
                }
                
                // Adjust mobile controls based on orientation
                if (window.orientation === 90 || window.orientation === -90) {
                    // Landscape
                    mobileControls.style.height = '100%';
                    leftControl.style.width = '40%';
                    rightControl.style.width = '40%';
                    jumpControl.style.width = '20%';
                    jumpControl.style.left = '40%';
                } else {
                    // Portrait
                    mobileControls.style.height = '33%';
                    leftControl.style.width = '33.33%';
                    rightControl.style.width = '33.33%';
                    jumpControl.style.width = '33.34%';
                    jumpControl.style.left = '33.33%';
                }
            }, 100);
        });
        
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
    
    setupMobileViewport() {
        // Find the viewport meta tag or create it if it doesn't exist
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        
        // Set optimal viewport settings for mobile
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        
        // Add apple-mobile-web-app-capable meta
        let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
        if (!appleMeta) {
            appleMeta = document.createElement('meta');
            appleMeta.name = 'apple-mobile-web-app-capable';
            appleMeta.content = 'yes';
            document.head.appendChild(appleMeta);
        }
        
        // Fix for iOS height issues
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            document.body.style.height = `${window.innerHeight}px`;
            window.scrollTo(0, 0);
            
            // Apply fullscreen fixes for iOS
            if (document.body.requestFullscreen) {
                document.body.requestFullscreen().catch(e => {
                    console.log('Fullscreen request failed:', e);
                });
            }
        }
    }
    
    createBall() {
        // Physics body - keep the same collision shape for simplicity
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
        
        // Create a bunny instead of a sphere
        this.createBunnyModel();
    }
    
    createBunnyModel() {
        // Create a group to hold the bunny sprite
        this.bunnyGroup = new THREE.Group();
        
        // Load the bunny image from img1.png
        const textureLoader = new THREE.TextureLoader();
        const bunnyTexture = textureLoader.load('img/img1.png', (texture) => {
            console.log('Bunny texture loaded successfully');
        }, undefined, (err) => {
            console.error('Error loading bunny texture:', err);
        });
        
        // Create a sprite material using the loaded texture
        const bunnyMaterial = new THREE.SpriteMaterial({ 
            map: bunnyTexture,
            transparent: true
        });
        
        // Create the sprite with the bunny image
        const bunnySprite = new THREE.Sprite(bunnyMaterial);
        
        // Scale the sprite appropriately - making it bigger
        bunnySprite.scale.set(6, 6, 1);
        
        // Add the sprite to the group
        this.bunnyGroup.add(bunnySprite);
        
        // Position the group
        this.bunnyGroup.position.set(0, 0, 0);
        
        // Add the bunny to the scene
        this.scene.add(this.bunnyGroup);
        
        // This replaces the ball reference for other functions
        this.ball = this.bunnyGroup;
        
        // Add a subtle glow effect around the bunny
        const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
        const glowMaterialBunny = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        this.ballGlow = new THREE.Mesh(glowGeometry, glowMaterialBunny);
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
        // Reduce ramp probability to 15% (fewer ramps = harder)
        const type = Math.random() > 0.85 ? 'ramp' : 'cube';
        // Use the xOffset if provided, otherwise use random lane position with more constraint
        // Keep obstacles more toward the middle to make it harder
        const lanePosition = xOffset !== 0 ? 
            xOffset : 
            (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 4);
        
        if (type === 'cube') {
            // Cube obstacle
            const size = 1 + Math.random() * 1.5; // Back to medium size
            const height = 1 + Math.random() * 1.8; // Medium height
            
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
            
            // Add obstacles with spacing - medium frequency
            if (z > 35 && z % 20 === 0) {  // Start at 35 and every 20 units (medium frequency)
                this.createObstacle(z);
                
                // Add a second obstacle with offset - medium probability
                if (Math.random() > 0.65) { // 35% chance for a second obstacle
                    const offsetX = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
                    const offsetZ = Math.random() * 8; // Medium spacing
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
                
                // Medium chance of obstacles
                if (Math.random() > 0.4) { // 60% chance (medium)
                    this.createObstacle(newPosition + Math.random() * 15);
                    
                    // Add a second obstacle with offset - medium probability
                    if (Math.random() > 0.55) { // 45% chance (medium)
                        const offsetX = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
                        const offsetZ = Math.random() * 8; // Medium spacing
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
        // Apply forces based on keys - medium responsiveness
        const force = 320; // Medium control responsiveness
        
        if (this.keys.left) {
            this.ballBody.applyForce(new CANNON.Vec3(-force, 0, 0), this.ballBody.position);
        }
        if (this.keys.right) {
            this.ballBody.applyForce(new CANNON.Vec3(force, 0, 0), this.ballBody.position);
        }
        
        // Add some automatic centering when no keys are pressed for stability
        if (!this.keys.left && !this.keys.right) {
            const centeringForce = this.ballBody.position.x * -12; // Medium centering
            this.ballBody.applyForce(new CANNON.Vec3(centeringForce, 0, 0), this.ballBody.position);
        }
        
        // Update bunny position to match physics body
        if (this.bunnyGroup) {
            this.bunnyGroup.position.copy(this.ballBody.position);
            // Adjust the height to make the sprite hover slightly above ground
            this.bunnyGroup.position.y += 2.0;
            
            // Tilt the sprite based on horizontal movement
            const tiltAmount = this.ballBody.velocity.x * 0.03;
            this.bunnyGroup.rotation.z = -tiltAmount;
            
            // Always face the camera
            this.bunnyGroup.rotation.y = Math.atan2(
                -(this.camera.position.x - this.bunnyGroup.position.x),
                -(this.camera.position.z - this.bunnyGroup.position.z)
            );
            
            // Bounce effect when jumping or running
            if (this.canJump) {
                // Subtle bouncing effect when on ground
                this.bunnyGroup.position.y += Math.sin(Date.now() * 0.01) * 0.15;
            } else {
                // Tilt forward slightly when in the air
                this.bunnyGroup.rotation.x = 0.2;
            }
        }
        
        // Update glow position
        this.ballGlow.position.copy(this.ballBody.position);
        this.ballGlow.position.y += 2.0;
        
        // Add trail/after-image effect
        if (this.hasSpeedBoost && Math.random() > 0.6) {
            this.createAfterImage();
        }
        
        // Update powerup states
        this.updatePowerups(deltaTime);
        
        // Check if bunny fell off the track
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
        
        // Check if bunny can jump (approximately on ground)
        const groundContact = this.ballBody.position.y <= 1.1;
        if (groundContact) {
            this.canJump = true;
        }
        
        // Check for collisions with obstacles
        this.checkObstacleCollisions();
    }
    
    updateCamera() {
        // Camera follows the bunny with improved offset and angle
        const idealHeight = 8;
        const lookAheadDistance = 15;
        
        this.camera.position.x = this.ball.position.x * 0.3;
        this.camera.position.y = this.ball.position.y + idealHeight;
        this.camera.position.z = this.ball.position.z - 20;
        
        // Look ahead of the bunny to see more of the track
        this.camera.lookAt(
            this.ball.position.x * 0.3,
            this.ball.position.y + 2,
            this.ball.position.z + lookAheadDistance
        );
    }
    
    updateScore(deltaTime) {
        this.score += Math.floor(this.speed * deltaTime * 10);
        this.scoreElement.textContent = this.score;
        
        // Update speed indicator bar
        const speedPercentage = (this.speed / this.maxSpeed) * 100;
        this.speedBar.style.width = `${speedPercentage}%`;
        
        // Change color based on speed
        if (speedPercentage > 75) {
            this.speedBar.style.background = 'linear-gradient(90deg, rgba(255, 0, 255, 0.7) 0%, rgba(255, 0, 255, 1) 100%)';
        } else if (speedPercentage > 50) {
            this.speedBar.style.background = 'linear-gradient(90deg, rgba(0, 255, 255, 0.7) 0%, rgba(255, 0, 255, 0.8) 100%)';
        }
        
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
                this.maxSpeed = 70;
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
        if (this.gameOver) {
            // Even when game over, we want to update particle effects
            this.updateParticles(deltaTime);
            return;
        }
        
        // Update physics world
        this.world.step(deltaTime);
        
        // Update game elements
        this.updateTrack(deltaTime);
        this.updateBall(deltaTime);
        this.updateCamera();
        this.updateScore(deltaTime);
        this.updateAfterImages();
        this.updateParticles(deltaTime);
        
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
        if (this.gameOver) {
            this.animating = false;
            return;
        }
        
        this.animating = true;
        requestAnimationFrame((t) => this.animate(t));
        
        // Calculate delta time
        const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1); // Cap delta time to avoid large jumps
        this.lastTime = time;
        
        // Only update game logic if the game has started
        if (this.gameStarted) {
            this.update(deltaTime);
        }
        
        // Always render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    endGame() {
        this.gameOver = true;
        this.finalScoreElement.textContent = this.score;
        
        // Add dramatic game over effect
        this.createGameOverEffect();
        
        // Show game over screen with a slight delay for dramatic effect
        this.gameOverOverlay.style.display = 'block';
        this.gameOverOverlay.style.opacity = '0';
        
        // Animate the overlay fade in
        setTimeout(() => {
            this.gameOverOverlay.style.transition = 'opacity 0.5s ease-in';
            this.gameOverOverlay.style.opacity = '1';
            
            setTimeout(() => {
                this.gameOverScreen.style.display = 'block';
                
                // Get the restart button and ensure it's clickable
                const restartBtn = document.getElementById('restart-btn');
                
                // Remove any existing event listeners to prevent duplicates
                if (this.restartListener) {
                    restartBtn.removeEventListener('click', this.restartListener);
                }
                
                // Create a new restart listener that's properly bound to this instance
                this.restartListener = this.restart.bind(this);
                
                // Add the event listener
                restartBtn.addEventListener('click', this.restartListener);
                
                // Make sure the button is clickable
                restartBtn.style.pointerEvents = 'auto';
            }, 500);
        }, 300);
    }
    
    createGameOverEffect() {
        // Create explosion effect at bunny position
        const explosionColors = [0x00ffff, 0xff00ff, 0xffffff];
        const particleCount = this.isMobile ? 30 : 60;
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: explosionColors[Math.floor(Math.random() * explosionColors.length)],
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(geometry, material);
            // Use the bunny position for particles
            if (this.bunnyGroup) {
                particle.position.copy(this.bunnyGroup.position);
                // Add some height to the particle origin
                particle.position.y += 1;
            } else {
                particle.position.copy(this.ball.position);
            }
            
            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                Math.random() * 15,
                (Math.random() - 0.5) * 20
            );
            
            this.scene.add(particle);
            
            // Add to particles array
            this.particleGroups.push({
                mesh: particle,
                velocity: velocity,
                gravity: 0.2,
                lifetime: 1 + Math.random(),
                created: Date.now() / 1000
            });
        }
        
        // Hide the bunny
        if (this.bunnyGroup) {
            this.bunnyGroup.visible = false;
        }
        this.ballGlow.visible = false;
        
        // Create shockwave
        const shockwaveGeometry = new THREE.RingGeometry(0.1, 0.5, 32);
        const shockwaveMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
        if (this.bunnyGroup) {
            shockwave.position.copy(this.bunnyGroup.position);
        } else {
            shockwave.position.copy(this.ball.position);
        }
        shockwave.rotation.x = Math.PI / 2;
        this.scene.add(shockwave);
        
        // Animate shockwave
        const startTime = Date.now();
        const expandShockwave = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            
            if (elapsed < 1) {
                const scale = 1 + elapsed * 20;
                shockwave.scale.set(scale, scale, scale);
                shockwave.material.opacity = 0.7 * (1 - elapsed);
                
                requestAnimationFrame(expandShockwave);
            } else {
                this.scene.remove(shockwave);
            }
        };
        
        expandShockwave();
        
        // Create a flash effect
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = '#fff';
        overlay.style.opacity = '0.8';
        overlay.style.zIndex = '25';
        overlay.style.pointerEvents = 'none';
        overlay.style.transition = 'opacity 0.5s ease-out';
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 500);
        }, 100);
    }
    
    restart() {
        console.log('Game restart method called');
        
        // Reset all game state
        this.gameOver = false;
        this.gameStarted = true; // Ensure the game starts when restarting
        this.score = 0;
        this.speed = 22; // Match constructor's speed
        
        // Clear all game objects
        this.trackSegments = [];
        this.obstacles = [];
        this.powerups = []; // Clear powerups
        this.particleGroups = []; // Clear particles
        this.afterImages = []; // Clear after images
        
        // Reset UI
        this.scoreElement.textContent = '0';
        
        // Hide game over overlay and screen
        this.gameOverOverlay.style.display = 'none';
        this.gameOverOverlay.style.opacity = '0';
        this.gameOverScreen.style.display = 'none';
        
        // Reset the speed indicator
        this.speedBar.style.width = '30%';
        this.speedBar.style.background = 'linear-gradient(90deg, rgba(0, 255, 255, 0.5) 0%, rgba(0, 255, 255, 0.8) 50%, rgba(255, 0, 255, 0.8) 100%)';
        
        // Add restart transition effect
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = '#0ff';
        overlay.style.opacity = '0.3';
        overlay.style.zIndex = '30';
        overlay.style.pointerEvents = 'none';
        overlay.style.transition = 'opacity 0.5s ease-out';
        
        document.body.appendChild(overlay);
        
        // Create a flash effect
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 500);
        }, 100);
        
        // Cleanup old objects from scene
        // Remove all existing meshes/bodies before creating new ones
        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            const object = this.scene.children[i];
            if (object.type === 'Mesh' || object.type === 'Points') {
                this.scene.remove(object);
            }
        }
        
        // Recreate game elements
        this.createBall();
        this.createInitialTrack();
        
        // Restart animation loop if it was stopped
        if (!this.animating) {
            this.animating = true;
            this.lastTime = Date.now();
            this.animate();
        }
    }
    
    jump() {
        // Apply upward force to bunny - medium jump power
        const jumpForce = this.hasSuperJump ? 220 : 130; // Medium jump height
        this.ballBody.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), this.ballBody.position);
        
        // Set jump cooldown - medium cooldown
        this.canJump = false;
        this.jumpCooldown = 0.7; // Medium cooldown
        
        // Add jump visual effect
        this.createJumpEffect();
        
        // Add a temporary upward rotation to the sprite when jumping
        if (this.bunnyGroup && this.bunnyGroup.children[0]) {
            // Tilt slightly backwards when jumping
            this.bunnyGroup.rotation.x = -0.2;
            
            // After a short time, reset rotation
            setTimeout(() => {
                if (this.bunnyGroup) {
                    this.bunnyGroup.rotation.x = 0;
                }
            }, 300);
        }
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
            // Medium collision threshold
            const threshold = 1 + Math.max(obstacleSize.x, obstacleSize.z);
            
            // Check if distance is less than threshold in x and z, and we're not clearly above the obstacle
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            if (horizontalDist < threshold && dy < obstacleSize.y + 0.45) { // Medium collision forgiveness
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
    
    // New method to start the game
    startGame() {
        this.gameStarted = true;
    }
    
    updateParticles(deltaTime) {
        // Update all particle effects
        const now = Date.now() / 1000;
        
        for (let i = this.particleGroups.length - 1; i >= 0; i--) {
            const particle = this.particleGroups[i];
            
            // Check if particle has expired
            if (now - particle.created > particle.lifetime) {
                this.scene.remove(particle.mesh);
                this.particleGroups.splice(i, 1);
                continue;
            }
            
            // Apply velocity and gravity
            particle.velocity.y -= particle.gravity;
            particle.mesh.position.x += particle.velocity.x * deltaTime;
            particle.mesh.position.y += particle.velocity.y * deltaTime;
            particle.mesh.position.z += particle.velocity.z * deltaTime;
            
            // Fade out over lifetime
            const age = now - particle.created;
            const opacity = 1 - (age / particle.lifetime);
            particle.mesh.material.opacity = opacity;
        }
    }
}

// Initialize the game but don't start it yet
const game = new NeonRunner();

// Expose the game and startGame method globally
window.game = game;
window.startGame = function() {
    game.startGame();
}; 