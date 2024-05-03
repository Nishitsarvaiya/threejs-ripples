import { OrbitControls } from "three/examples/jsm/Addons.js";
import "../style.css";

import {
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	Vector4,
	WebGLRenderer,
	SRGBColorSpace,
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
	TextureLoader,
	AdditiveBlending,
	OrthographicCamera,
	WebGLRenderTarget,
	LinearFilter,
	RGBAFormat,
} from "three";
import fragment from "./shader/fragment.glsl";
import vertex from "./shader/vertex.glsl";

export default class Sketch {
	constructor(options) {
		this.scene = new Scene();
		this.baseScene = new Scene();

		this.container = options.dom;
		this.width = this.container.offsetWidth;
		this.height = this.container.offsetHeight;
		this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setSize(this.width, this.height);
		this.renderer.setClearColor(0x121212, 1);
		this.renderer.physicallyCorrectLights = true;
		this.renderer.outputColorSpace = SRGBColorSpace;

		this.container.appendChild(this.renderer.domElement);

		// this.camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
		var frustumSize = this.height;
		var aspect = this.width / this.height;
		this.camera = new OrthographicCamera(
			(frustumSize * aspect) / -2,
			(frustumSize * aspect) / 2,
			frustumSize / 2,
			frustumSize / -2,
			-1000,
			1000
		);
		this.camera.position.set(0, 0, 2);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		this.baseTexture = new WebGLRenderTarget(this.width, this.height, {
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			format: RGBAFormat,
		});

		this.time = 0;
		this.mouse = {
			x: 0,
			y: 0,
			prevX: 0,
			prevY: 0,
			vX: 0,
			vY: 0,
		};
		this.currentRipple = 0;

		this.isPlaying = true;
		this.addObjects();
		this.resize();
		this.render();
		this.setupResize();
		this.mouseEvents();
	}

	mouseEvents() {
		window.addEventListener("mousemove", (e) => {
			this.mouse.prevX = this.mouse.x;
			this.mouse.prevY = this.mouse.y;
			this.mouse.x = e.clientX - this.width / 2;
			this.mouse.y = this.height / 2 - e.clientY;

			// console.log(this.mouse.x,this.mouse.y)

			// this.mouse.vX = this.mouse.x - this.mouse.prevX;
			// this.mouse.vY = this.mouse.y - this.mouse.prevY;

			// console.log(this.mouse.vX,'vx')
		});
	}

	setupResize() {
		window.addEventListener("resize", this.resize.bind(this));
	}

	resize() {
		this.width = this.container.offsetWidth;
		this.height = this.container.offsetHeight;
		this.renderer.setSize(this.width, this.height);
		this.camera.aspect = this.width / this.height;

		// image cover
		this.imageAspect = 2400 / 1920;
		let a1;
		let a2;
		if (this.height / this.width > this.imageAspect) {
			a1 = (this.width / this.height) * this.imageAspect;
			a2 = 1;
		} else {
			a1 = 1;
			a2 = this.height / this.width / this.imageAspect;
		}

		this.material.uniforms.resolution.value.x = this.width;
		this.material.uniforms.resolution.value.y = this.height;
		this.material.uniforms.resolution.value.z = a1;
		this.material.uniforms.resolution.value.w = a2;

		this.camera.updateProjectionMatrix();
	}

	addObjects() {
		this.material = new ShaderMaterial({
			extensions: {
				derivatives: "#extension GL_OES_standard_derivatives : enable",
			},
			side: DoubleSide,
			uniforms: {
				time: {
					value: 0,
				},
				uDisplacement: {
					value: null,
				},
				uTexture: {
					value: new TextureLoader().load("/bg.jpg"),
				},
				resolution: {
					value: new Vector4(),
				},
			},
			vertexShader: vertex,
			fragmentShader: fragment,
		});

		this.max = 100;

		this.ripple = new TextureLoader().load("/ripple.png");
		this.geometry = new PlaneGeometry(40, 40, 1, 1);
		this.geometryFullScreen = new PlaneGeometry(this.width, this.height, 1, 1);
		this.rippleMeshes = [];

		for (let i = 0; i < this.max; i++) {
			let material = new MeshBasicMaterial({
				transparent: true,
				blending: AdditiveBlending,
				map: this.ripple,
				depthTest: false,
				depthWrite: false,
			});

			let mesh = new Mesh(this.geometry, material);
			mesh.visible = false;
			mesh.rotation.z = 2 * Math.PI * Math.random();
			this.scene.add(mesh);
			this.rippleMeshes.push(mesh);
		}

		this.bg = new Mesh(this.geometryFullScreen, this.material);
		this.baseScene.add(this.bg);
	}

	createNewRipple(x, y, idx) {
		let mesh = this.rippleMeshes[idx];
		mesh.visible = true;
		mesh.position.x = x;
		mesh.position.y = y;
		mesh.material.opacity = 1;
		mesh.scale.x = mesh.scale.y = 0.1;
	}

	trackMousePosition() {
		if (Math.abs(this.mouse.x - this.mouse.prevX) > 4 || Math.abs(this.mouse.y - this.mouse.prevY) > 4) {
			this.currentRipple = (this.currentRipple + 1) % this.max;
			this.createNewRipple(this.mouse.x, this.mouse.y, this.currentRipple);
		}
	}

	render() {
		this.trackMousePosition();
		if (!this.isPlaying) return;
		this.time += 0.05;
		this.material.uniforms.time.value = this.time;
		requestAnimationFrame(this.render.bind(this));

		this.renderer.setRenderTarget(this.baseTexture);
		this.renderer.render(this.scene, this.camera);
		this.material.uniforms.uDisplacement.value = this.baseTexture.texture;
		this.renderer.setRenderTarget(null);
		this.renderer.clear();
		this.renderer.render(this.baseScene, this.camera);

		this.rippleMeshes.forEach((mesh) => {
			if (mesh.visible) {
				mesh.rotation.z += 0.024;
				mesh.material.opacity *= 0.96;
				mesh.scale.x = 0.98 * mesh.scale.x + 0.2;
				mesh.scale.y = mesh.scale.x;
				if (mesh.material.opacity < 0.02) mesh.visible = false;
			}
			// mesh.position.x = this.mouse.x;
			// mesh.position.y = this.mouse.y;
		});
	}
}

new Sketch({
	dom: document.getElementById("app"),
});
