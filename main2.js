import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';

// --- Core Setup ---
let scene, camera, renderer, composer, clock, bloomPass, glitchPass;
let dragonfly, particles, audio, analyser, filter, targetFrequency, gridHelper, pyramids, stars, spawnedObjects;
let raycaster, groundPlane, placementMarker, playhead;
let currentObjectToAdd = null;
const mouse = new THREE.Vector2();
let isExperienceActive = false;
let synths = {};
let sequence;
const GRID_SIZE = 200;
const STEPS = 16;

const container = document.getElementById('scene-container');
const activationOverlay = document.getElementById('activation-overlay');
const activationButton = document.getElementById('activation-button');
const cursorLight = document.getElementById('cursor-light');
const aiText = document.getElementById('ai-text');
const controlsPanel = document.getElementById('controls-panel');
const shareContainer = document.getElementById('share-container');
        
const genreSelect = document.getElementById('genre-select');
const glowSlider = document.getElementById('glow-slider');
const particleColorSlider = document.getElementById('particle-color-slider');
const gridColorSlider = document.getElementById('grid-color-slider');
const dragonflyColorSlider = document.getElementById('dragonfly-color-slider');
const fogSlider = document.getElementById('fog-slider');
const mp3UploadInput = document.getElementById('upload-mp3');
        
const clearSceneButton = document.getElementById('clear-scene-button');
const sequencerToggleButton = document.getElementById('sequencer-toggle-btn');

const shareButton = document.getElementById('share-button');
const shareModal = document.getElementById('share-modal');
const shareImage = document.getElementById('share-image');
const downloadLink = document.getElementById('download-link');
const closeModalButton = document.getElementById('close-modal-button');
const copyLinkButton = document.getElementById('copy-link-button');
        
const hint1 = document.getElementById('hint1');
const hint1Ok = document.getElementById('hint1-ok');
const hint2 = document.getElementById('hint2');
const hint2Ok = document.getElementById('hint2-ok');

const audioTracks = {
    'cyber-funk': 'https://pdragonlabs.github.io/WireBaePDragonLabs/cyber-funk.mp3',
    'trap': 'https://pdragonlabs.github.io/WireBaePDragonLabs/trap.mp3',
    'lo-fi': 'https://pdragonlabs.github.io/WireBaePDragonLabs/lo-fi.mp3',
    'old-school': 'https://pdragonlabs.github.io/WireBaePDragonLabs/old-school.mp3'
};

// --- Initialization ---
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0014, 0.005);
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 35);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0a0014, 1);
    container.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();
    spawnedObjects = new THREE.Group();
    scene.add(spawnedObjects);

    setupPostProcessing();
    setupAudio();
    setupSynths();
    setupSequencer();
    createDragonfly();
    createParticles();
    createEnvironment();
    createStars();
    createPyramids();
    createPlacementMarker();
    createPlayhead();
    setupEventListeners();
    
    animate();
}

function setupPostProcessing() {
    const renderPass = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    glitchPass = new GlitchPass();
    glitchPass.enabled = false;
    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(glitchPass);
}

function setupAudio() {
    const listener = new THREE.AudioListener();
    camera.add(listener);
    audio = new THREE.Audio(listener);
    analyser = new THREE.AudioAnalyser(audio, 128);
    filter = audio.context.createBiquadFilter();
    filter.type = 'lowpass';
    targetFrequency = audio.context.sampleRate / 2;
    filter.frequency.value = targetFrequency;
    filter.Q.value = 1;
    audio.setFilter(filter);
}

function setupSynths() {
    const reverb = new Tone.Reverb(2).toDestination();
    synths.kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 10, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4, attackCurve: "exponential" } }).toDestination();
    synths.hat = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination();
    synths.note = new Tone.FMSynth({ harmonicity: 3, modulationIndex: 10, detune: 0, oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 1 }, modulation: { type: "square" }, modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 } }).connect(reverb);
    synths.pad = new Tone.PolySynth(Tone.AMSynth, { harmonicity: 1.5, detune: 0, oscillator: { type: "fatsawtooth" }, envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.2 }, modulation: { type: "sine" }, modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 } }).connect(reverb);
}

function setupSequencer() {
    const steps = Array.from({ length: STEPS }, (_, i) => i);
    sequence = new Tone.Sequence((time, step) => {
        Tone.Draw.schedule(() => {
            playhead.position.x = -GRID_SIZE / 2 + (step / (STEPS - 1)) * GRID_SIZE;
        }, time);

        spawnedObjects.children.forEach(obj => {
            const objStep = Math.floor(((obj.position.x + GRID_SIZE / 2) / GRID_SIZE) * STEPS);
            if (objStep === step) {
                triggerSound(obj, time);
                Tone.Draw.schedule(() => flashObject(obj), time);
            }
        });
    }, steps, "16n");
    Tone.Transport.bpm.value = 120;
}

function triggerSound(obj, time) {
    const pitch = 1 - ((obj.position.z + GRID_SIZE / 2) / GRID_SIZE); // 0 to 1
    switch (obj.userData.type) {
        case 'cube': synths.kick.triggerAttackRelease("C1", "8n", time); break;
        case 'pyramid': synths.hat.triggerAttackRelease("C4", "16n", time); break;
        case 'sphere': synths.note.triggerAttackRelease(200 + pitch * 800, "8n", time); break;
        case 'torus': synths.pad.triggerAttackRelease(["C2", "E2", "G2"], "4n", time); break;
    }
}

function flashObject(obj) {
    obj.userData.isFlashing = true;
    obj.material.emissiveIntensity = 5;
    setTimeout(() => { 
        obj.material.emissiveIntensity = 1;
        obj.userData.isFlashing = false;
    }, 100);
}

function loadAudio(trackUrl, isCustom = false) {
    if (audio.isPlaying) audio.stop();
    const audioLoader = new THREE.AudioLoader();
    aiText.textContent = "Loading new vibe...";
    audioLoader.load(trackUrl, (buffer) => {
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(0.5);
        if (isExperienceActive) audio.play();
        aiText.textContent = "Vibe loaded. Systems nominal.";

        if (isCustom) {
            let customOption = genreSelect.querySelector('option[value="custom"]');
            if (!customOption) {
                customOption = document.createElement('option');
                customOption.value = 'custom';
                customOption.textContent = 'Custom Track';
                genreSelect.prepend(customOption);
            }
            customOption.selected = true;
        }
    }, undefined, (err) => {
        console.error('An error happened while loading audio.', err);
        aiText.textContent = "Audio failed to load.";
    });
}

function createDragonfly() {
    dragonfly = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 2, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 3, 4, 16), bodyMaterial);
    body.rotation.x = Math.PI / 2;
    dragonfly.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 3, metalness: 0.5, roughness: 0.1 }));
    head.position.z = 2;
    dragonfly.add(head);
    const createWing = () => {
        const shape = new THREE.Shape().moveTo(0, 0).bezierCurveTo(2, 2, 8, 2, 10, 0).bezierCurveTo(8, -1.5, 2, -1.5, 0, 0);
        const geometry = new THREE.ShapeGeometry(shape, 30);
        geometry.setAttribute('originalPosition', geometry.attributes.position.clone());
        return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.7 }));
    };
    const wing1 = createWing(); wing1.position.set(0.5, 0, 0); wing1.rotation.y = Math.PI;
    const wing2 = createWing(); wing2.position.set(-0.5, 0, 0);
    const wingGroup = new THREE.Group(); wingGroup.add(wing1, wing2); wingGroup.position.z = -1;
    dragonfly.add(wingGroup);
    scene.add(dragonfly);
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(5000 * 3);
    for (let i = 0; i < positions.length; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;
        positions[i + 1] = (Math.random() - 0.5) * 200;
        positions[i + 2] = (Math.random() - 0.5) * 200;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xaa00ff, size: 0.1, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
    scene.add(particles);
}

function createEnvironment() {
    gridHelper = new THREE.GridHelper(GRID_SIZE, STEPS, 0xaa00ff, 0x444444);
    gridHelper.position.y = -20;
    scene.add(gridHelper);
    groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE), new THREE.MeshBasicMaterial({ visible: false }));
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -20;
    scene.add(groundPlane);
}

function createStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(10000 * 3);
    for (let i = 0; i < positions.length; i += 3) {
        positions[i] = (Math.random() - 0.5) * 2000;
        positions[i + 1] = (Math.random() - 0.5) * 2000;
        positions[i + 2] = (Math.random() - 0.5) * 2000;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.8 }));
    scene.add(stars);
}

function createPyramids() {
    pyramids = new THREE.Group();
    const pyramidGeometry = new THREE.ConeGeometry(2, 4, 4);
    const pyramidMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 1, metalness: 0.8, roughness: 0.2 });
    for (let i = 0; i < 20; i++) {
        const pyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial.clone());
        pyramid.position.set((Math.random() - 0.5) * 150, -18, (Math.random() - 0.5) * 150);
        pyramids.add(pyramid);
    }
    scene.add(pyramids);
}

function createPlacementMarker() {
    const markerGeometry = new THREE.TorusGeometry(2.5, 0.1, 16, 100);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
    placementMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    placementMarker.rotation.x = Math.PI / 2;
    placementMarker.visible = false;
    scene.add(placementMarker);
}

function createPlayhead() {
    const geometry = new THREE.PlaneGeometry(0.5, GRID_SIZE);
    const material = new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending });
    playhead = new THREE.Mesh(geometry, material);
    playhead.rotation.x = -Math.PI / 2;
    playhead.position.y = -19.8;
    playhead.visible = false;
    scene.add(playhead);
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onSceneClick);
    activationButton.addEventListener('click', startExperience);
    
    genreSelect.addEventListener('change', (e) => {
        if (e.target.value !== 'custom') {
            loadAudio(audioTracks[e.target.value]);
        }
    });

    mp3UploadInput.addEventListener('change', handleFileUpload);
    glowSlider.addEventListener('input', (e) => { if (bloomPass) bloomPass.strength = e.target.value; });
    particleColorSlider.addEventListener('input', (e) => { if (particles) particles.material.color.setHSL(e.target.value, 1.0, 0.5); });
    gridColorSlider.addEventListener('input', (e) => { if (gridHelper) gridHelper.material.color.setHSL(e.target.value, 1.0, 0.5); });
    dragonflyColorSlider.addEventListener('input', (e) => { if (dragonfly) { const c = new THREE.Color().setHSL(e.target.value, 1.0, 0.5); dragonfly.children[0].material.color.copy(c); dragonfly.children[0].material.emissive.copy(c); } });
    fogSlider.addEventListener('input', (e) => { if (scene.fog) scene.fog.density = parseFloat(e.target.value); });
    
    document.querySelectorAll('.obj-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            setObjectToAdd(event.target.dataset.type);
        });
    });
    
    sequencerToggleButton.addEventListener('click', () => {
        if (Tone.Transport.state === 'started') {
            Tone.Transport.stop();
            sequence.stop();
            playhead.visible = false;
            sequencerToggleButton.textContent = 'Start Sequencer';
        } else {
            Tone.Transport.start();
            sequence.start(0);
            playhead.visible = true;
            sequencerToggleButton.textContent = 'Stop Sequencer';
        }
    });

    clearSceneButton.addEventListener('click', () => {
        while(spawnedObjects.children.length > 0){
            const obj = spawnedObjects.children[0];
            spawnedObjects.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }
    });

    shareButton.addEventListener('click', takeScreenshot);
    closeModalButton.addEventListener('click', () => { shareModal.style.display = 'none'; });
    copyLinkButton.addEventListener('click', () => copyToClipboard('https://pdragonlabs.github.io/WireBaePDragonLabs/'));
    hint1Ok.addEventListener('click', () => {
        hint1.classList.remove('visible');
        setTimeout(() => hint2.classList.add('visible'), 500);
    });
    hint2Ok.addEventListener('click', () => hint2.classList.remove('visible'));
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === 'audio/mpeg') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataURL = e.target.result;
            loadAudio(dataURL, true);
        };
        reader.readAsDataURL(file);
    }
}

function setObjectToAdd(type) {
    currentObjectToAdd = type === currentObjectToAdd ? null : type;
    document.querySelectorAll('.obj-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === currentObjectToAdd);
    });
    placementMarker.visible = !!currentObjectToAdd;
    container.style.cursor = currentObjectToAdd ? 'crosshair' : 'none';
}

function onSceneClick(event) {
    if (!isExperienceActive || !currentObjectToAdd) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(groundPlane);
    if (intersects.length > 0) {
        spawnObject(intersects[0].point);
    }
}

function spawnObject(position) {
    let geometry;
    const yOffset = -18;
    switch(currentObjectToAdd) {
        case 'cube': geometry = new THREE.BoxGeometry(4, 4, 4); break;
        case 'sphere': geometry = new THREE.SphereGeometry(2, 32, 32); break;
        case 'torus': geometry = new THREE.TorusGeometry(2, 0.8, 16, 100); break;
        case 'pyramid': geometry = new THREE.ConeGeometry(3, 5, 4); break;
    }
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1,
        metalness: 0.8,
        roughness: 0.2
    });
    material.color.setHSL(Math.random(), 1.0, 0.5);
    material.emissive.copy(material.color);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y = yOffset + (geometry.parameters.height || 4) / 2;
    mesh.userData.type = currentObjectToAdd;
    spawnedObjects.add(mesh);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    if (isExperienceActive) {
        cursorLight.style.left = `${event.clientX}px`;
        cursorLight.style.top = `${event.clientY}px`;
        if (filter) {
            const minFreq = 200;
            const maxFreq = audio.context.sampleRate / 2;
            targetFrequency = minFreq * Math.pow(maxFreq / minFreq, (mouse.y + 1) / 2);
        }
        if (audio) {
            const minRate = 0.75, maxRate = 1.25;
            audio.setPlaybackRate(minRate + ((mouse.x + 1) / 2) * (maxRate - minRate));
        }
    }
}

async function startExperience() {
    if (isExperienceActive) return;
    await Tone.start();
    if (audio.context.state === 'suspended') audio.context.resume();
    isExperienceActive = true;
    activationOverlay.style.opacity = '0';
    activationOverlay.style.pointerEvents = 'none';
    cursorLight.style.opacity = '1';
    controlsPanel.style.opacity = '1';
    shareContainer.style.opacity = '1';
    loadAudio(audioTracks[genreSelect.value]);
    setTimeout(() => hint1.classList.add('visible'), 1000);
}

function displayShareModal(dataURL) {
    shareImage.src = dataURL;
    downloadLink.href = dataURL;
    shareModal.style.display = 'flex';
}

function copyToClipboard(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        const originalText = copyLinkButton.textContent;
        copyLinkButton.textContent = 'Copied!';
        setTimeout(() => { copyLinkButton.textContent = originalText; }, 2000);
    } catch (err) { console.error('Fallback: Oops, unable to copy', err); }
    document.body.removeChild(ta);
}

async function takeScreenshot() {
    composer.render();
    const dataURL = renderer.domElement.toDataURL('image/png');
    const projectUrl = 'https://pdragonlabs.github.io/WireBaePDragonLabs/';
    try {
        const blob = await (await fetch(dataURL)).blob();
        const file = new File([blob], 'wire-bae-vibe.png', { type: blob.type });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Wire Bae Vibe', text: 'Check out my vibe on Wire Bae!', url: projectUrl });
        } else {
            displayShareModal(dataURL);
        }
    } catch (error) {
        console.error('Error sharing:', error);
        displayShareModal(dataURL);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    let bass = 0, mids = 0, highs = 0;

    if (isExperienceActive) {
        if (analyser) {
            const freqData = analyser.getFrequencyData();
            bass = freqData[2] / 255; 
            mids = freqData[30] / 255;
            highs = freqData[60] / 255;
        }
        if (filter) filter.frequency.setTargetAtTime(targetFrequency, audio.context.currentTime, 0.05);
        if (bass > 0.9 && !glitchPass.enabled) {
            glitchPass.enabled = true;
            setTimeout(() => { glitchPass.enabled = false; }, 100);
        }
        if (placementMarker.visible) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(groundPlane);
            if (intersects.length > 0) {
                placementMarker.position.copy(intersects[0].point);
                placementMarker.position.y = -19.9;
            }
        }
    }

    if (dragonfly) {
        dragonfly.position.set(Math.sin(time * 0.3) * 10, Math.cos(time * 0.5) * 5, Math.cos(time * 0.2) * 10);
        const lookAtPosition = new THREE.Vector3(Math.sin((time + 0.1) * 0.3) * 10, Math.cos((time + 0.1) * 0.5) * 5, Math.cos((time + 0.1) * 0.2) * 10);
        dragonfly.lookAt(lookAtPosition);
        const wingGroup = dragonfly.children[2];
        if (wingGroup) {
            const flapSpeed = 2 + bass * 10;
            wingGroup.children[0].rotation.z = Math.sin(time * flapSpeed) * 0.5;
            wingGroup.children[1].rotation.z = -Math.sin(time * flapSpeed) * 0.5;
        }
        dragonfly.children[1].material.emissiveIntensity = 2 + bass * 5;
    }

    if (particles) {
        particles.rotation.y += delta * 0.05;
        particles.material.size = 0.1 + bass * 0.2;
        particles.material.opacity = 0.6 + highs * 0.4;
    }

    if (pyramids) {
        pyramids.children.forEach((pyramid, i) => {
            pyramid.position.y = -18 + Math.sin(time * 2 + i) * 2;
            pyramid.material.emissiveIntensity = bass * 2;
        });
    }

    if (spawnedObjects) {
         spawnedObjects.children.forEach((obj, i) => {
            obj.rotation.y += delta * 0.2 * (i % 2 === 0 ? 1 : -1);
            if (!obj.userData.isFlashing) obj.material.emissiveIntensity = 0.5 + bass * 1.5;
        });
    }
    
    composer.render(delta);
}

init();
