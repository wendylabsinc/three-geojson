import { GeoJSONLoader } from './GeoJSONLoader.js';
import { wktToGeoJSON } from 'betterknown';
import type { ParseResult, GeoJSONObject } from './types/index.js';

export class WKTLoader extends GeoJSONLoader {

	loadAsync( url: string ): Promise<ParseResult> {

		return fetch( url, this.fetchOptions )
			.then( res => res.text() )
			.then( text => this.parse( text ) );

	}

	parse( text: string ): ParseResult {

		return super.parse( wktToGeoJSON( text ) as GeoJSONObject );

	}

}
