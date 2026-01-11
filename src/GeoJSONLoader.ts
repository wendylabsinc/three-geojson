import { getDimension, extractForeignKeys, traverse } from './GeoJSONShapeUtils.js';
import { parseBounds } from './ParseUtils.js';
import { constructLineObject } from './constructLineObject.js';
import { constructPolygonMeshObject } from './constructPolygonMeshObject.js';
import type {
	GeoJSONObject,
	ParseResult,
	ParsedObject,
	ParsedObjectBase,
	ParsedFeature,
	ParsedGeometry,
	ParsedPoint,
	ParsedMultiPoint,
	ParsedLineString,
	ParsedMultiLineString,
	ParsedPolygon,
	ParsedMultiPolygon,
	ParsedGeometryCollection,
	ParsedFeatureCollection,
	ParsedLine,
	ParsedPolygonGeometry,
	LineObjectOptions,
	MeshObjectOptions,
	Coordinate,
	Polygon,
	LineString,
} from './types/index.js';
import type { LineSegments, Mesh } from 'three';

// Get the base object definition for GeoJSON type
function getBase( object: GeoJSONObject ): ParsedObjectBase {

	return {
		type: object.type,
		boundingBox: parseBounds( object.bbox ),
		data: null,
		foreign: extractForeignKeys( object ),
	};

}

// Shape construction functions
function getLineObject( this: ParsedLineString | ParsedMultiLineString, options: LineObjectOptions = {} ): LineSegments {

	return constructLineObject( this.data, options );


}

function getPolygonLineObject( this: ParsedPolygon | ParsedMultiPolygon, options: LineObjectOptions = {} ): LineSegments {

	return constructLineObject( this.data.flatMap( shape => shape ), options );

}

function getPolygonMeshObject( this: ParsedPolygon | ParsedMultiPolygon, options: MeshObjectOptions = {} ): Mesh {

	return constructPolygonMeshObject( this.data, options );

}

// Parser for GeoJSON https://geojson.org/
export class GeoJSONLoader {

	fetchOptions: RequestInit;

	// Construct a merged geometry of all lines
	static getLineObject( objects: ( ParsedLine | ParsedPolygonGeometry )[], options?: LineObjectOptions ): LineSegments {

		const lines: LineString[] = [];
		const groups: number[] = [];
		objects.forEach( o => {

			if ( /LineString/.test( o.type ) ) {

				lines.push( ...( o as ParsedLine ).data );
				groups.push( ( o as ParsedLine ).data.length );

			} else if ( /Polygon/.test( o.type ) ) {

				const shapes = ( o as ParsedPolygonGeometry ).data.flatMap( shape => shape );
				lines.push( ...shapes );
				groups.push( shapes.length );

			}

		} );

		return constructLineObject( lines, {
			...options,
			groups: [],
		} );

	}

	// Construct a merged geometry of all shapes
	static getMeshObject( objects: ParsedPolygonGeometry[], options?: MeshObjectOptions ): Mesh {

		// TODO: support cap / edges group generation. Requires groups caps and edges for each individual geometry together
		const polygons: Polygon[] = [];
		const groups: number[] = [];
		objects.forEach( o => {

			if ( /Polygon/.test( o.type ) ) {

				const shapes = o.data;
				polygons.push( ...shapes );
				groups.push( shapes.length );

			}

		} );

		return constructPolygonMeshObject( polygons, {
			...options,
			groups,
		} );

	}

	constructor() {

		this.fetchOptions = {};

	}

	loadAsync( url: string ): Promise<ParseResult> {

		return fetch( url, this.fetchOptions )
			.then( res => res.json() )
			.then( json => this.parse( json ) );

	}

	parse( json: string | GeoJSONObject ): ParseResult {

		let parsedJson: GeoJSONObject;
		if ( typeof json === 'string' ) {

			parsedJson = JSON.parse( json );

		} else {

			parsedJson = json;

		}

		const root = this.parseObject( parsedJson );
		const features: ParsedFeature[] = [];
		const geometries: ParsedGeometry[] = [];

		// find all features and geometries
		traverse( root as ParsedObject, object => {

			if ( object.type !== 'FeatureCollection' && object.type !== 'GeometryCollection' ) {

				if ( object.type === 'Feature' ) {

					features.push( object as ParsedFeature );

				} else {

					geometries.push( object as ParsedGeometry );

					const geom = object as ParsedGeometry;
					if ( 'feature' in geom && geom.feature ) {

						geom.feature.geometries.push( geom );

					}

				}

			}

		} );

		// collect all shapes within each feature
		features.forEach( feature => {

			const { geometries } = feature;
			feature.points = geometries.filter( object => /Point/.test( object.type ) ) as ParsedPoint[];
			feature.lines = geometries.filter( object => /Line/.test( object.type ) ) as ParsedLine[];
			feature.polygons = geometries.filter( object => /Polygon/.test( object.type ) ) as ParsedPolygonGeometry[];

		} );

		return {
			features,
			geometries,
			points: geometries.filter( object => /Point/.test( object.type ) ) as ParsedPoint[],
			lines: geometries.filter( object => /Line/.test( object.type ) ) as ParsedLine[],
			polygons: geometries.filter( object => /Polygon/.test( object.type ) ) as ParsedPolygonGeometry[],
		};

	}

	parseObject( object: GeoJSONObject, feature: ParsedFeature | null = null ): ParsedObject {

		switch ( object.type ) {

			case 'Point': {

				const result: ParsedPoint = {
					...getBase( object ),
					type: 'Point',
					feature,
					data: [ object.coordinates as Coordinate ],
					dimension: getDimension( object.coordinates as Coordinate ),
				};
				return result;

			}

			case 'MultiPoint': {

				const coords = object.coordinates as Coordinate[];
				const result: ParsedMultiPoint = {
					...getBase( object ),
					type: 'MultiPoint',
					feature,
					data: coords,
					dimension: getDimension( coords[ 0 ] ),
				};
				return result;

			}

			case 'LineString': {

				const coords = object.coordinates as Coordinate[];
				const result: ParsedLineString = {
					...getBase( object ),
					type: 'LineString',
					feature,
					data: [ coords ],
					dimension: getDimension( coords[ 0 ] ),

					getLineObject,
				};
				return result;

			}

			case 'MultiLineString': {

				const coords = object.coordinates as Coordinate[][];
				const result: ParsedMultiLineString = {
					...getBase( object ),
					type: 'MultiLineString',
					feature,
					data: coords,
					dimension: getDimension( coords[ 0 ][ 0 ] ),

					getLineObject,
				};
				return result;

			}

			case 'Polygon': {

				const coords = object.coordinates as Coordinate[][];
				const result: ParsedPolygon = {
					...getBase( object ),
					type: 'Polygon',
					feature,
					data: [ coords ],
					dimension: getDimension( coords[ 0 ][ 0 ] ),

					getLineObject: getPolygonLineObject,
					getMeshObject: getPolygonMeshObject,
				};
				return result;

			}

			case 'MultiPolygon': {

				const coords = object.coordinates as Coordinate[][][];
				const result: ParsedMultiPolygon = {
					...getBase( object ),
					type: 'MultiPolygon',
					feature,
					data: coords,
					dimension: getDimension( coords[ 0 ][ 0 ][ 0 ] ),

					getLineObject: getPolygonLineObject,
					getMeshObject: getPolygonMeshObject,
				};
				return result;

			}

			case 'GeometryCollection': {

				const geoms = object.geometries as GeoJSONObject[];
				const result: ParsedGeometryCollection = {
					...getBase( object ),
					type: 'GeometryCollection',
					feature,
					data: geoms.map( obj => this.parseObject( obj, feature ) as ParsedGeometry ),
				};
				return result;

			}

			case 'Feature': {

				const parsedFeature: ParsedFeature = {
					...getBase( object ),
					type: 'Feature',
					id: object.id ?? null,
					properties: object.properties ?? null,
					geometries: [],
					data: null,
					points: [],
					lines: [],
					polygons: [],
				};

				parsedFeature.data = this.parseObject( object.geometry as GeoJSONObject, parsedFeature ) as ParsedGeometry;
				return parsedFeature;

			}

			case 'FeatureCollection': {

				const feats = object.features as GeoJSONObject[];
				const result: ParsedFeatureCollection = {
					...getBase( object ),
					type: 'FeatureCollection',
					data: feats.map( feat => this.parseObject( feat ) as ParsedFeature ),
				};
				return result;

			}

			default:
				throw new Error( `Unknown GeoJSON type: ${ object.type }` );

		}

	}

}
