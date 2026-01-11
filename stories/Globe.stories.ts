import type { Meta, StoryObj } from '@storybook/html';
import { MeshStandardMaterial, SphereGeometry, Mesh, LineBasicMaterial } from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { GeoJSONLoader } from '../dist/index.js';
import { createThreeScene, centerAndScaleGroup } from './utils/createThreeScene.js';

interface GlobeArgs {
	country: string;
	thickness: number;
	resolution: number;
}

const meta: Meta<GlobeArgs> = {
	title: 'Examples/Globe',
	argTypes: {
		country: { control: 'text' },
		thickness: { control: { type: 'range', min: 0, max: 100000, step: 1000 } },
		resolution: { control: { type: 'range', min: 0.5, max: 10, step: 0.5 } },
	},
	args: {
		country: 'Japan',
		thickness: 50000,
		resolution: 2.5,
	},
};

export default meta;
type Story = StoryObj<GlobeArgs>;

export const Default: Story = {
	render: ( args ) => {

		const container = document.createElement( 'div' );
		container.style.width = '100%';
		container.style.height = '100vh';

		const { group, controls, cleanup } = createThreeScene( container );
		group.rotation.x = - Math.PI / 2;
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.5;

		// Add globe base
		const globeBase = new Mesh(
			new SphereGeometry( 1, 100, 50 ),
			new MeshStandardMaterial( {
				color: 0x222222,
				transparent: true,
				opacity: 0.75,
				depthWrite: false,
			} )
		);
		globeBase.scale.copy( WGS84_ELLIPSOID.radius );
		group.add( globeBase );

		// Load GeoJSON
		fetch( new URL( '../example/world.geojson', import.meta.url ).href )
			.then( res => res.json() )
			.then( json => {

				const loader = new GeoJSONLoader();
				const result = loader.parse( json );
				const countryRegex = new RegExp( args.country, 'i' );

				result.polygons.forEach( geom => {

					const feature = geom.feature;
					const name = feature?.properties?.name as string | undefined;
					const isTarget = name && countryRegex.test( name );

					if ( isTarget ) {

						const mesh = geom.getMeshObject( {
							ellipsoid: WGS84_ELLIPSOID,
							thickness: args.thickness,
							resolution: args.resolution,
						} );
						mesh.material = new MeshStandardMaterial( {
							polygonOffset: true,
							polygonOffsetFactor: - 1,
							polygonOffsetUnits: - 1,
						} );
						group.add( mesh );

					} else {

						const line = geom.getLineObject( {
							ellipsoid: WGS84_ELLIPSOID,
							resolution: args.resolution,
						} );
						( line.material as LineBasicMaterial ).color.set( 0x888888 );
						group.add( line );

					}

				} );

				centerAndScaleGroup( group, 1.5 );

			} );

		( container as HTMLElement & { __cleanup?: () => void } ).__cleanup = cleanup;
		return container;

	},
};
