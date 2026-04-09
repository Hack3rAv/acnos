// ==========================================
// 1. SCROLL ENGINE (LENIS)
// ==========================================
const lenis = new Lenis({
    duration: 1.5,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => { lenis.raf(time * 1000); });
gsap.ticker.lagSmoothing(0);

// ==========================================
// 2. MASTER THREE.JS STAGE
// ==========================================
const canvasContainer = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030305, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Performance optimization
canvasContainer.appendChild(renderer.domElement);

// Global Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0x00ffcc, 2, 50);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// Master Animation Loop
// We will push objects into this array from specific sections to animate them
const updatableObjects = []; 

function animate() {
    requestAnimationFrame(animate);
    
    // Run specific animations for injected 3D models
    updatableObjects.forEach(obj => {
        if(obj.update) obj.update();
    });

    // Subtle base camera movement tied to scroll
    const scrollY = window.scrollY;
    camera.position.y = -scrollY * 0.002;

    renderer.render(scene, camera);
}
animate();

// Handle Window Resize perfectly
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 3. GLOBAL HELPER FUNCTIONS FOR SECTIONS
// ==========================================
// This will be called whenever we inject a new section to trigger text reveals
window.initRevealAnimations = function() {
    const reveals = document.querySelectorAll('.reveal-up');
    reveals.forEach((el) => {
        gsap.to(el, {
            scrollTrigger: {
                trigger: el,
                start: "top 85%",
                toggleActions: "play reverse play reverse"
            },
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "power4.out"
        });
    });
};









// ==========================================
// SECTION 1: 3D INTERACTIVE MESH NETWORK
// ==========================================
const s1Group = new THREE.Group();
scene.add(s1Group);

// Create Particles (Network Nodes)
const particleCount = 150;
const particlesGeo = new THREE.BufferGeometry();
const particlePos = new Float32Array(particleCount * 3);
const particleVelocities = [];

for(let i = 0; i < particleCount; i++) {
    // Spread nodes across a wide area
    particlePos[i*3] = (Math.random() - 0.5) * 40;     // x
    particlePos[i*3+1] = (Math.random() - 0.5) * 40;   // y
    particlePos[i*3+2] = (Math.random() - 0.5) * 20 - 10; // z (pushed back a bit)

    // Give each node a slow drifting velocity
    particleVelocities.push({
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
    });
}

particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

// Material for nodes
const particleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    transparent: true,
    opacity: 0.8
});

const particles = new THREE.Points(particlesGeo, particleMat);
s1Group.add(particles);

// Create Lines (Mesh Connections)
const linesGeo = new THREE.BufferGeometry();
const lineMat = new THREE.LineBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.15
});
// We'll update the lines dynamically in the animation loop
const linesMesh = new THREE.LineSegments(linesGeo, lineMat);
s1Group.add(linesMesh);

// Mouse interaction setup
const mouse = new THREE.Vector2(999, 999); // Start off-screen
window.addEventListener('mousemove', (event) => {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Create a raycaster to project mouse into 3D space
const raycaster = new THREE.Raycaster();
const mouse3D = new THREE.Vector3();

// Animation Logic for Section 1
const s1Animation = {
    update: function() {
        // Rotate the whole network slowly
        s1Group.rotation.y += 0.001;
        s1Group.rotation.x += 0.0005;

        // Project mouse into 3D space at z=0 plane
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), mouse3D);

        const positions = particles.geometry.attributes.position.array;
        
        // Arrays to hold dynamic line connections
        const linePositions = [];

        for(let i = 0; i < particleCount; i++) {
            // Move particles by their velocity
            positions[i*3] += particleVelocities[i].x;
            positions[i*3+1] += particleVelocities[i].y;
            positions[i*3+2] += particleVelocities[i].z;

            // Keep them inside a bounding box
            if(Math.abs(positions[i*3]) > 20) particleVelocities[i].x *= -1;
            if(Math.abs(positions[i*3+1]) > 20) particleVelocities[i].y *= -1;
            if(Math.abs(positions[i*3+2]) > 20) particleVelocities[i].z *= -1;

            // Current particle Vector
            const p1 = new THREE.Vector3(positions[i*3], positions[i*3+1], positions[i*3+2]);
            
            // Transform p1 to world space to check against mouse
            const p1World = p1.clone().applyMatrix4(s1Group.matrixWorld);
            const distToMouse = p1World.distanceTo(mouse3D);

            // If mouse is close, node gets pulled slightly towards it (Interactive Network)
            if(distToMouse < 5) {
                positions[i*3] += (mouse3D.x - p1World.x) * 0.01;
                positions[i*3+1] += (mouse3D.y - p1World.y) * 0.01;
            }

            // Check distance to other particles to draw connecting lines
            for(let j = i + 1; j < particleCount; j++) {
                const p2 = new THREE.Vector3(positions[j*3], positions[j*3+1], positions[j*3+2]);
                const dist = p1.distanceTo(p2);

                if(dist < 3.5) { // Connection threshold
                    linePositions.push(
                        p1.x, p1.y, p1.z,
                        p2.x, p2.y, p2.z
                    );
                }
            }
        }

        particles.geometry.attributes.position.needsUpdate = true;
        
        // Update lines
        linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    }
};

// Add this animation to the master loop
updatableObjects.push(s1Animation);

// Trigger GSAP Reveals
window.initRevealAnimations();


// ==========================================
// SECTION 1.5: THE ACNOS MASTER TOWER 
// ==========================================
// Group to hold the entire tower structure
const towerGroup = new THREE.Group();

// Move the tower to the right side of the screen on desktop
towerGroup.position.x = window.innerWidth > 900 ? 6 : 0;
towerGroup.position.y = -4; // Pull it down slightly so the core is visible
scene.add(towerGroup);

// Tower Materials (using our custom ACNOS cyan #00ffcc)
const coreMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x111111, 
    metalness: 0.9, 
    roughness: 0.1,
    wireframe: false
});

const glowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ffcc, 
    wireframe: true,
    transparent: true,
    opacity: 0.5
});

// The Main Mast
const mastGeo = new THREE.CylinderGeometry(0.3, 1.2, 25, 8);
const mast = new THREE.Mesh(mastGeo, coreMaterial);
towerGroup.add(mast);

// Glowing Core Node at the top
const coreGeo = new THREE.OctahedronGeometry(1.8, 0);
const core = new THREE.Mesh(coreGeo, glowMaterial);
core.position.y = 12;
towerGroup.add(core);

// Internal Solid Core
const innerCoreGeo = new THREE.OctahedronGeometry(1.0, 0);
const innerCore = new THREE.Mesh(innerCoreGeo, new THREE.MeshBasicMaterial({color: 0xffffff}));
innerCore.position.y = 12;
towerGroup.add(innerCore);

// Signal Rings (representing ACNOS mesh waves blasting out)
const rings = [];
for(let i=0; i<4; i++) {
    const ringGeo = new THREE.TorusGeometry(3 + (i*1.5), 0.05, 16, 100);
    const ring = new THREE.Mesh(ringGeo, glowMaterial);
    ring.position.y = 12;
    ring.rotation.x = Math.PI / 2;
    towerGroup.add(ring);
    rings.push(ring);
}

// Adjust global camera to fit the massive tower and the text properly
camera.position.z = 18;
camera.position.y = 2;

// Keep tower positioned correctly if the user resizes the window
window.addEventListener('resize', () => {
    towerGroup.position.x = window.innerWidth > 900 ? 6 : 0;
});

// Tower Animation Logic
const clock = new THREE.Clock();

const towerAnimation = {
    update: function() {
        const elapsedTime = clock.getElapsedTime();

        // Slowly rotate the massive tower structure
        towerGroup.rotation.y = elapsedTime * 0.1;

        // Animate the core pulsing and spinning in opposite directions
        core.rotation.y = elapsedTime * 0.6;
        core.rotation.x = elapsedTime * 0.3;
        innerCore.rotation.y = -elapsedTime * 0.8;

        // Animate signal rings (expanding and fading out to simulate radio waves)
        rings.forEach((ring, index) => {
            let scale = 1 + ((elapsedTime + index) % 2) * 0.6;
            ring.scale.set(scale, scale, scale);
            ring.material.opacity = 1 - ((elapsedTime + index) % 2) / 2;
        });

        // Add a slight floating hover effect to the whole tower
        towerGroup.position.y = -4 + Math.sin(elapsedTime * 0.5) * 0.5;
    }
};

// Push this into our master animation engine
updatableObjects.push(towerAnimation);





// ==========================================
// SECTION 2: THE ACNOS MICRO TOWER
// ==========================================
const s2Group = new THREE.Group();
// Position it deep down in the scene so it appears during scroll
s2Group.position.set(-5, -8, 0); 
scene.add(s2Group);

// Micro Tower Materials
const shellMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.9,
    roughness: 0.3,
    wireframe: false
});

const logicMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    wireframe: true,
    transparent: true,
    opacity: 0.8
});

const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.9, // glass effect
    transparent: true
});

// Base Unit
const microBaseGeo = new THREE.CylinderGeometry(1.5, 2, 1, 6);
const microBase = new THREE.Mesh(microBaseGeo, shellMat);
s2Group.add(microBase);

// Glass Computing Chamber
const chamberGeo = new THREE.CylinderGeometry(1.2, 1.2, 3, 16);
const chamber = new THREE.Mesh(chamberGeo, glassMat);
chamber.position.y = 2;
s2Group.add(chamber);

// The "Computing Unit / Firmware Core" inside the glass
const logicCoreGeo = new THREE.IcosahedronGeometry(0.7, 1);
const logicCore = new THREE.Mesh(logicCoreGeo, logicMat);
logicCore.position.y = 2;
s2Group.add(logicCore);

// Antenna Spire
const antennaGeo = new THREE.CylinderGeometry(0.05, 0.2, 4, 8);
const antenna = new THREE.Mesh(antennaGeo, shellMat);
antenna.position.y = 5.5;
s2Group.add(antenna);

// Floating Data Packets (AMP Routing visualization)
const packetGeo = new THREE.SphereGeometry(0.1, 8, 8);
const packets = [];
for(let i=0; i<8; i++) {
    const packet = new THREE.Mesh(packetGeo, new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
    s2Group.add(packet);
    packets.push({
        mesh: packet,
        angle: (i / 8) * Math.PI * 2,
        speed: 0.02 + (Math.random() * 0.02),
        radius: 3 + Math.random()
    });
}

// Interactivity logic for the Micro Tower
let isHoveringMicroTower = false;

// Raycaster setup for Section 2 interaction
const raycasterS2 = new THREE.Raycaster();
const mouseS2 = new THREE.Vector2();

window.addEventListener('mousemove', (event) => {
    mouseS2.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseS2.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Click interaction to trigger a "Mesh Shockwave"
window.addEventListener('click', () => {
    if(isHoveringMicroTower) {
        // Send a visual shockwave out of the antenna
        const shockwaveGeo = new THREE.RingGeometry(0.1, 0.3, 32);
        const shockwave = new THREE.Mesh(shockwaveGeo, new THREE.MeshBasicMaterial({
            color: 0x00ffcc, side: THREE.DoubleSide, transparent: true
        }));
        shockwave.position.set(s2Group.position.x, s2Group.position.y + 7.5, s2Group.position.z);
        shockwave.rotation.x = Math.PI / 2;
        scene.add(shockwave);

        // Animate the shockwave using GSAP
        gsap.to(shockwave.scale, { x: 30, y: 30, duration: 1.5, ease: "power2.out" });
        gsap.to(shockwave.material, { opacity: 0, duration: 1.5, ease: "power2.out", onComplete: () => {
            scene.remove(shockwave); // Cleanup
        }});
    }
});

const s2Animation = {
    update: function() {
        const time = clock.getElapsedTime();

        // Check for hover
        raycasterS2.setFromCamera(mouseS2, camera);
        const intersects = raycasterS2.intersectObject(chamber); // Detect hover on the glass chamber
        isHoveringMicroTower = intersects.length > 0;

        // Base rotation
        s2Group.rotation.y = time * 0.2;
        
        // Spin the logic core faster if hovering
        logicCore.rotation.x += isHoveringMicroTower ? 0.05 : 0.01;
        logicCore.rotation.y += isHoveringMicroTower ? 0.05 : 0.02;

        // Animate hovering data packets
        packets.forEach(p => {
            p.angle += p.speed;
            // Packets orbit the tower
            p.mesh.position.x = Math.cos(p.angle) * p.radius;
            p.mesh.position.z = Math.sin(p.angle) * p.radius;
            p.mesh.position.y = 2 + Math.sin(time * 2 + p.angle) * 1.5; // Bob up and down
            
            // Turn them red if hovering (simulating processing load)
            if(isHoveringMicroTower) {
                p.mesh.material.color.setHex(0xff3366);
                p.speed = 0.08; // speed up
            } else {
                p.mesh.material.color.setHex(0x00ffcc);
                p.speed = 0.02; // back to normal
            }
        });
        
        // Keep the tower positioned correctly on resize
        s2Group.position.x = window.innerWidth > 900 ? -6 : 0; // Left side layout
    }
};

updatableObjects.push(s2Animation);

// Re-trigger global reveal animations for newly added HTML
window.initRevealAnimations();

// ==========================================
// SECTION 3: ACNOS DRONE & IOT MESH
// ==========================================
const s3Group = new THREE.Group();
s3Group.position.set(0, -15, 0); // Positioned deep for Section 3
scene.add(s3Group);

// Materials
const droneMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
const iotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.5 });

// --- BUILD THE DRONE ---
const droneGroup = new THREE.Group();
s3Group.add(droneGroup);

// Drone Body
const bodyGeo = new THREE.BoxGeometry(2, 0.5, 2);
const droneBody = new THREE.Mesh(bodyGeo, droneMat);
droneGroup.add(droneBody);

// Drone Camera/Eye
const eyeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 16);
const droneEye = new THREE.Mesh(eyeGeo, lightMat);
droneEye.rotation.x = Math.PI / 2;
droneEye.position.set(0, -0.2, 1);
droneGroup.add(droneEye);

// Drone Arms & Propellers
const props = [];
const armPositions = [
    {x: 1.5, z: 1.5}, {x: -1.5, z: 1.5}, 
    {x: 1.5, z: -1.5}, {x: -1.5, z: -1.5}
];

armPositions.forEach(pos => {
    // Arm
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
    const arm = new THREE.Mesh(armGeo, droneMat);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = Math.atan2(pos.z, pos.x);
    arm.position.set(pos.x * 0.5, 0, pos.z * 0.5);
    droneGroup.add(arm);

    // Motor
    const motorGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16);
    const motor = new THREE.Mesh(motorGeo, droneMat);
    motor.position.set(pos.x, 0.2, pos.z);
    droneGroup.add(motor);

    // Propeller Ring
    const propGeo = new THREE.TorusGeometry(0.6, 0.05, 8, 24);
    const prop = new THREE.Mesh(propGeo, lightMat);
    prop.rotation.x = Math.PI / 2;
    prop.position.set(pos.x, 0.4, pos.z);
    droneGroup.add(prop);
    props.push(prop); // Save for animation
});

// --- BUILD IOT NODES ---
const iotNodes = [];
const iotCount = 12;

for(let i=0; i<iotCount; i++) {
    // Mix of different shapes for sensors, trackers, phones
    const isBox = Math.random() > 0.5;
    const geo = isBox ? new THREE.BoxGeometry(0.5, 0.5, 0.5) : new THREE.IcosahedronGeometry(0.3, 0);
    const node = new THREE.Mesh(geo, iotMat);
    
    // Position randomly below the drone
    node.position.set(
        (Math.random() - 0.5) * 15,
        -4 - (Math.random() * 5),
        (Math.random() - 0.5) * 10
    );
    
    // Orbit parameters
    node.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: 3 + Math.random() * 6,
        speed: (Math.random() - 0.5) * 0.02
    };

    s3Group.add(node);
    iotNodes.push(node);
}

// --- MESH CONNECTIONS (LASERS) ---
const meshLinesGeo = new THREE.BufferGeometry();
const meshLinesMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3 });
const meshLines = new THREE.LineSegments(meshLinesGeo, meshLinesMat);
s3Group.add(meshLines);

// Mouse tracking for Drone
const mouseS3 = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mouseS3.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseS3.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Animation Logic
const s3Animation = {
    update: function() {
        const time = clock.getElapsedTime();

        // 1. Drone Hover & Tilt (tracks mouse)
        // Smooth interpolation towards mouse position
        const targetRotX = mouseS3.y * 0.5;
        const targetRotZ = -mouseS3.x * 0.5;
        const targetRotY = -mouseS3.x * 0.3;

        droneGroup.rotation.x += (targetRotX - droneGroup.rotation.x) * 0.05;
        droneGroup.rotation.z += (targetRotZ - droneGroup.rotation.z) * 0.05;
        droneGroup.rotation.y += (targetRotY - droneGroup.rotation.y) * 0.05;

        // Bobbing effect
        droneGroup.position.y = Math.sin(time * 2) * 0.5;

        // 2. Spin Propellers
        props.forEach(prop => {
            prop.rotation.z += 0.5; // High speed spin
        });

        // 3. Orbit IoT Nodes
        iotNodes.forEach(node => {
            node.userData.angle += node.userData.speed;
            node.position.x = Math.cos(node.userData.angle) * node.userData.radius;
            node.position.z = Math.sin(node.userData.angle) * node.userData.radius;
            node.rotation.x += 0.01;
            node.rotation.y += 0.01;
        });

        // 4. Draw dynamic mesh lines from Drone to IoT nodes
        const linePositions = [];
        const dronePos = droneGroup.position.clone();
        
        iotNodes.forEach(node => {
            const dist = dronePos.distanceTo(node.position);
            if(dist < 10) { // Connect if close enough
                linePositions.push(
                    dronePos.x, dronePos.y - 0.5, dronePos.z, // Start from drone belly
                    node.position.x, node.position.y, node.position.z
                );
            }
        });

        meshLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

        // Keep group positioned based on screen size (Center it for this section)
        s3Group.position.x = window.innerWidth > 900 ? 3 : 0;
    }
};

updatableObjects.push(s3Animation);

// Re-trigger global reveal animations
window.initRevealAnimations();



// ==========================================
// SECTION 4: THE ACNOS GLOBAL SATELLITE MESH
// ==========================================
const s4Group = new THREE.Group();
s4Group.position.set(0, -22, 0); // Positioned deep for Section 4
scene.add(s4Group);

// Materials for the Globe
const earthSolidMat = new THREE.MeshStandardMaterial({ 
    color: 0x050508, 
    metalness: 0.8, 
    roughness: 0.5 
});
const earthWireMat = new THREE.MeshBasicMaterial({ 
    color: 0x004433, // Very dark cyan
    wireframe: true, 
    transparent: true, 
    opacity: 0.1 
});
const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

// 1. Base Earth Sphere
const earthRadius = 6;
const earthGeo = new THREE.SphereGeometry(earthRadius, 32, 32);
const earthSolid = new THREE.Mesh(earthGeo, earthSolidMat);
s4Group.add(earthSolid);

// 2. Holographic Wireframe Overlay
const earthWire = new THREE.Mesh(earthGeo, earthWireMat);
earthWire.scale.set(1.01, 1.01, 1.01);
s4Group.add(earthWire);

// 3. Terrestrial ACNOS Nodes (On the surface)
const surfaceNodes = [];
for (let i = 0; i < 40; i++) {
    // Generate random points on a sphere
    const phi = Math.acos(-1 + (2 * i) / 40);
    const theta = Math.sqrt(40 * Math.PI) * phi;
    
    const node = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), nodeMat);
    node.position.setFromSphericalCoords(earthRadius + 0.05, phi, theta);
    
    // Make them face outward
    node.lookAt(0, 0, 0);
    earthSolid.add(node); // Add to earth so they rotate with it
    surfaceNodes.push(node.position.clone());
}

// 4. Orbiting ACNOS Satellites
const satellites = [];
const satCount = 5;
const satGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
const panelGeo = new THREE.BoxGeometry(0.8, 0.05, 0.4);

for(let i=0; i<satCount; i++) {
    const satGroup = new THREE.Group();
    
    // Core body
    const satBody = new THREE.Mesh(satGeo, new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 1}));
    satGroup.add(satBody);
    
    // Solar panels
    const satPanels = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({color: 0x00aaff, wireframe: true}));
    satGroup.add(satPanels);

    // Initial position logic
    satGroup.userData = {
        orbitRadius: earthRadius + 3 + Math.random(),
        orbitSpeed: 0.005 + Math.random() * 0.005,
        angle: (i / satCount) * Math.PI * 2,
        axisX: Math.random() - 0.5,
        axisZ: Math.random() - 0.5
    };
    
    // Normalize axis
    const length = Math.sqrt(satGroup.userData.axisX**2 + satGroup.userData.axisZ**2);
    satGroup.userData.axisX /= length;
    satGroup.userData.axisZ /= length;

    s4Group.add(satGroup);
    satellites.push(satGroup);
}

// 5. Laser Data Beams (Satellite to Ground)
const beamGeo = new THREE.BufferGeometry();
const beamMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.4 });
const beamLines = new THREE.LineSegments(beamGeo, beamMat);
s4Group.add(beamLines);

// Mouse tracking for Globe Rotation
const mouseS4 = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mouseS4.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseS4.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Animation Logic
const s4Animation = {
    update: function() {
        // Subtle ambient rotation
        earthSolid.rotation.y += 0.002;
        earthSolid.rotation.x += 0.001;

        // Interactive tilt based on mouse position
        const targetRotX = mouseS4.y * 0.3;
        const targetRotY = mouseS4.x * 0.3;
        s4Group.rotation.x += (targetRotX - s4Group.rotation.x) * 0.05;
        s4Group.rotation.y += (targetRotY - s4Group.rotation.y) * 0.05;

        // Update Satellite Orbits
        const beamPositions = [];
        satellites.forEach(sat => {
            sat.userData.angle += sat.userData.orbitSpeed;
            
            // Calculate 3D orbital position
            const x = Math.cos(sat.userData.angle) * sat.userData.orbitRadius;
            const z = Math.sin(sat.userData.angle) * sat.userData.orbitRadius;
            
            sat.position.set(
                x * sat.userData.axisX,
                z,
                x * sat.userData.axisZ
            );
            
            // Make satellite always face the Earth
            sat.lookAt(s4Group.position);

            // Connect laser to the nearest surface node
            let closestDist = Infinity;
            let closestNode = null;

            // Transform earth matrix to get world positions of surface nodes
            earthSolid.updateMatrixWorld();

            for(let i=0; i<surfaceNodes.length; i++) {
                const nodeWorldPos = surfaceNodes[i].clone().applyMatrix4(earthSolid.matrixWorld);
                const localNodePos = s4Group.worldToLocal(nodeWorldPos);
                
                const dist = sat.position.distanceTo(localNodePos);
                if(dist < closestDist) {
                    closestDist = dist;
                    closestNode = localNodePos;
                }
            }

            if(closestNode) {
                beamPositions.push(
                    sat.position.x, sat.position.y, sat.position.z,
                    closestNode.x, closestNode.y, closestNode.z
                );
            }
        });

        // Update laser geometry
        beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(beamPositions, 3));

        // Adjust layout position based on screen width
        s4Group.position.x = window.innerWidth > 900 ? -4 : 0;
    }
};

updatableObjects.push(s4Animation);

// Re-trigger global reveal animations
window.initRevealAnimations();