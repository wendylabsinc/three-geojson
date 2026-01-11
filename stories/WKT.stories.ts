import type { Meta, StoryObj } from '@storybook/html';
import { MeshStandardMaterial, LineBasicMaterial } from 'three';
import { WKTLoader } from '../dist/index.js';
import { createThreeScene, centerAndScaleGroup } from './utils/createThreeScene.js';

interface WKTArgs {
	thickness: number;
	showOutlines: boolean;
}

const meta: Meta<WKTArgs> = {
	title: 'Examples/WKT',
	argTypes: {
		thickness: { control: { type: 'range', min: 0, max: 5, step: 0.1 } },
		showOutlines: { control: 'boolean' },
	},
	args: {
		thickness: 1,
		showOutlines: true,
	},
};

export default meta;
type Story = StoryObj<WKTArgs>;

export const California: Story = {
	render: ( args ) => {

		const container = document.createElement( 'div' );
		container.style.width = '100%';
		container.style.height = '100vh';

		const { group, controls, cleanup } = createThreeScene( container );
		controls.autoRotate = true;
		controls.autoRotateSpeed = 1;

		// Load WKT
		fetch( new URL( '../example/california.wkt', import.meta.url ).href )
			.then( res => res.text() )
			.then( wkt => {

				const loader = new WKTLoader();
				const result = loader.parse( wkt );

				result.polygons.forEach( geom => {

					const mesh = geom.getMeshObject( { thickness: args.thickness } );
					mesh.material = new MeshStandardMaterial( {
						polygonOffset: true,
						polygonOffsetFactor: 1,
						polygonOffsetUnits: 1,
					} );
					group.add( mesh );

					if ( args.showOutlines ) {

						const lineBottom = geom.getLineObject( { offset: - 0.5 } );
						( lineBottom.material as LineBasicMaterial ).color.set( 0xffffff );
						const lineTop = geom.getLineObject( { offset: args.thickness + 0.5 } );
						( lineTop.material as LineBasicMaterial ).color.set( 0xffffff );
						group.add( lineBottom, lineTop );

					}

				} );

				centerAndScaleGroup( group );

			} );

		( container as HTMLElement & { __cleanup?: () => void } ).__cleanup = cleanup;
		return container;

	},
};
