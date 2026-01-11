import type { Meta, StoryObj } from '@storybook/html';
import { MeshStandardMaterial, Color, SphereGeometry, Mesh } from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { GeoJSONLoader } from '../dist/index.js';
import { createThreeScene, centerAndScaleGroup } from './utils/createThreeScene.js';

interface ExtrudedArgs {
	thickness: number;
	country: string;
}

interface AllCountriesArgs {
	thickness: number;
	colorful: boolean;
}

const meta: Meta<ExtrudedArgs> = {
	title: 'Examples/Extruded',
	argTypes: {
		thickness: { control: { type: 'range', min: 0, max: 5, step: 0.1 } },
		country: { control: 'select', options: ['Japan', 'France', 'Germany', 'Italy', 'Spain', 'China', 'Brazil', 'Australia'] },
	},
	args: {
		thickness: 1,
		country: 'Japan',
	},
};

export default meta;
type Story = StoryObj<ExtrudedArgs>;

export const Default: Story = {
	render: ( args ) => {

		const container = document.createElement( 'div' );
		container.style.width = '100%';
		container.style.height = '100vh';

		const { group, cleanup } = createThreeScene( container );

		// Load GeoJSON
		fetch( new URL( '../example/world.geojson', import.meta.url ).href )
			.then( res => res.json() )
			.then( json => {

				const loader = new GeoJSONLoader();
				const result = loader.parse( json );

				result.features
					.filter( f => f.properties?.name === args.country )
					.flatMap( f => f.polygons )
					.forEach( geom => {

						const mesh = geom.getMeshObject( { thickness: args.thickness } );
						mesh.material = new MeshStandardMaterial();
						group.add( mesh );

					} );

				centerAndScaleGroup( group );

			} );

		// Store cleanup for Storybook
		( container as HTMLElement & { __cleanup?: () => void } ).__cleanup = cleanup;
		return container;

	},
};

export const AllCountries: StoryObj<AllCountriesArgs> = {
	argTypes: {
		thickness: { control: { type: 'range', min: 0, max: 5, step: 0.1 } },
		colorful: { control: 'boolean' },
	},
	args: {
		thickness: 1,
		colorful: true,
	},
	render: ( args ) => {

		const container = document.createElement( 'div' );
		container.style.width = '100%';
		container.style.height = '100vh';

		const { group, controls, cleanup } = createThreeScene( container );
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.5;

		// Load GeoJSON
		fetch( new URL( '../example/world.geojson', import.meta.url ).href )
			.then( res => res.json() )
			.then( json => {

				const loader = new GeoJSONLoader();
				const result = loader.parse( json );

				let colorIndex = 0;
				const colors = [
					0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6,
					0x1abc9c, 0xe67e22, 0x34495e, 0x16a085, 0xc0392b,
					0x27ae60, 0xd35400, 0x8e44ad, 0x2980b9, 0xf1c40f,
				];

				result.features
					.flatMap( f => f.polygons )
					.forEach( geom => {

						const mesh = geom.getMeshObject( { thickness: args.thickness } );
						const material = new MeshStandardMaterial();

						if ( args.colorful ) {

							material.color = new Color( colors[ colorIndex % colors.length ] );
							colorIndex++;

						}

						mesh.material = material;
						group.add( mesh );

					} );

				centerAndScaleGroup( group );

			} );

		( container as HTMLElement & { __cleanup?: () => void } ).__cleanup = cleanup;
		return container;

	},
};

interface Globe10mArgs {
	thickness: number;
	colorful: boolean;
	resolution: number;
}

export const AllCountries10m: StoryObj<Globe10mArgs> = {
	name: 'All Countries (10m Globe)',
	argTypes: {
		thickness: { control: { type: 'range', min: 0, max: 200000, step: 5000 } },
		colorful: { control: 'boolean' },
		resolution: { control: { type: 'range', min: 1, max: 10, step: 0.5 } },
	},
	args: {
		thickness: 50000,
		colorful: true,
		resolution: 2.5,
	},
	render: ( args ) => {

		const container = document.createElement( 'div' );
		container.style.width = '100%';
		container.style.height = '100vh';

		// Add loading indicator
		const loading = document.createElement( 'div' );
		loading.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:white;font-size:24px;z-index:100;';
		loading.textContent = 'Loading 10m resolution data (23MB)...';
		container.appendChild( loading );

		const { group, controls, cleanup } = createThreeScene( container );
		group.rotation.x = - Math.PI / 2;
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.5;

		// Add globe base
		const globeBase = new Mesh(
			new SphereGeometry( 1, 100, 50 ),
			new MeshStandardMaterial( {
				color: 0x111111,
				transparent: true,
				opacity: 0.9,
				depthWrite: false,
			} )
		);
		globeBase.scale.copy( WGS84_ELLIPSOID.radius );
		group.add( globeBase );

		const startTime = performance.now();

		// Load 10m resolution GeoJSON (Natural Earth)
		fetch( new URL( '../example/ne_10m_countries.json', import.meta.url ).href )
			.then( res => res.json() )
			.then( json => {

				const parseStart = performance.now();
				console.log( `Fetch time: ${( parseStart - startTime ).toFixed( 0 )}ms` );

				const loader = new GeoJSONLoader();
				const result = loader.parse( json );

				const meshStart = performance.now();
				console.log( `Parse time: ${( meshStart - parseStart ).toFixed( 0 )}ms` );
				console.log( `Features: ${result.features.length}, Polygons: ${result.polygons.length}` );

				let colorIndex = 0;
				const colors = [
					0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6,
					0x1abc9c, 0xe67e22, 0x34495e, 0x16a085, 0xc0392b,
					0x27ae60, 0xd35400, 0x8e44ad, 0x2980b9, 0xf1c40f,
				];

				result.features
					.flatMap( f => f.polygons )
					.forEach( geom => {

						const mesh = geom.getMeshObject( {
							thickness: args.thickness,
							ellipsoid: WGS84_ELLIPSOID,
							resolution: args.resolution,
						} );
						const material = new MeshStandardMaterial( {
							polygonOffset: true,
							polygonOffsetFactor: - 1,
							polygonOffsetUnits: - 1,
						} );

						if ( args.colorful ) {

							material.color = new Color( colors[ colorIndex % colors.length ] );
							colorIndex++;

						}

						mesh.material = material;
						group.add( mesh );

					} );

				const endTime = performance.now();
				console.log( `Mesh generation time: ${( endTime - meshStart ).toFixed( 0 )}ms` );
				console.log( `Total time: ${( endTime - startTime ).toFixed( 0 )}ms` );

				loading.remove();
				centerAndScaleGroup( group, 1.5 );

			} );

		( container as HTMLElement & { __cleanup?: () => void } ).__cleanup = cleanup;
		return container;

	},
};
