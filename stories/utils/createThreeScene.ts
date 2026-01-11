import {
	PerspectiveCamera,
	Scene,
	WebGLRenderer,
	Clock,
	DirectionalLight,
	AmbientLight,
	Group,
	Box3,
	Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ThreeSceneContext {
	scene: Scene;
	camera: PerspectiveCamera;
	renderer: WebGLRenderer;
	controls: OrbitControls;
	clock: Clock;
	group: Group;
	cleanup: () => void;
}

export function createThreeScene( container: HTMLElement ): ThreeSceneContext {

	// Camera
	const camera = new PerspectiveCamera( 70, container.clientWidth / container.clientHeight, 0.01, 1000 );
	camera.position.z = 2;

	// Scene
	const scene = new Scene();

	// Renderer
	const renderer = new WebGLRenderer( { antialias: true } );
	renderer.setSize( container.clientWidth, container.clientHeight );
	renderer.setPixelRatio( window.devicePixelRatio );
	container.appendChild( renderer.domElement );

	// Controls
	const clock = new Clock();
	const controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;

	// Lights
	const directionalLight = new DirectionalLight( 0xffffff, 3.5 );
	directionalLight.position.set( 1, 2, 3 );
	const ambientLight = new AmbientLight( 0xffffff, 1.0 );
	scene.add( directionalLight, ambientLight );

	// Group
	const group = new Group();
	scene.add( group );

	// Animation loop
	let animationId: number;
	function animate(): void {

		animationId = requestAnimationFrame( animate );
		controls.update( Math.min( clock.getDelta(), 64 / 1000 ) );
		renderer.render( scene, camera );

	}

	animate();

	// Resize handler
	const resizeObserver = new ResizeObserver( () => {

		const width = container.clientWidth;
		const height = container.clientHeight;
		renderer.setSize( width, height );
		camera.aspect = width / height;
		camera.updateProjectionMatrix();

	} );
	resizeObserver.observe( container );

	// Cleanup function
	function cleanup(): void {

		cancelAnimationFrame( animationId );
		resizeObserver.disconnect();
		renderer.dispose();
		if ( renderer.domElement.parentNode ) {

			container.removeChild( renderer.domElement );

		}

	}

	return { scene, camera, renderer, controls, clock, group, cleanup };

}

export function centerAndScaleGroup( group: Group, scale = 1 ): void {

	const box = new Box3();
	box.setFromObject( group );
	box.getCenter( group.position ).multiplyScalar( - 1 );

	const size = new Vector3();
	box.getSize( size );
	group.scale.setScalar( scale / Math.max( size.x, size.y, size.z ) );
	group.position.multiplyScalar( group.scale.x );

}
