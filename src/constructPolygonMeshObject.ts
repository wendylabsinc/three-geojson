import { BufferAttribute, MathUtils, Mesh, ShapeUtils, Vector2, Vector3 } from 'three';
import { correctPolygonWinding, dedupePolygonPoints, getPolygonBounds, splitPolygon } from './PolygonUtils.js';
import { resampleLine } from './GeoJSONShapeUtils.js';
import { getLoopEdges, triangulate } from './triangulate.js';
import { getCenter, offsetPoints, transformToEllipsoid } from './FlatVertexBufferUtils.js';
import type { Coordinate, Polygon, MeshObjectOptions, TriangulationResult } from './types/index.js';

const _vec = /* @__PURE__ */ new Vector3();
const _dir1 = /* @__PURE__ */ new Vector3();
const _dir2 = /* @__PURE__ */ new Vector3();
const _min = /* @__PURE__ */ new Vector3();
const _max = /* @__PURE__ */ new Vector3();

interface SegmentInfo {
	point: Coordinate;
	slope: number;
	minx: number;
	maxx: number;
	miny: number;
	maxy: number;
}

// takes set of segment info from below and checks if a polygon lies on any of the segments
function isPointOnPolygonEdge( segmentInfo: SegmentInfo[], x: number, y: number ): boolean {

	for ( let i = 0, li = segmentInfo.length; i < li; i ++ ) {

		const { minx, maxx, miny, maxy, slope, point } = segmentInfo[ i ];
		if ( x < minx || x > maxx || y < miny || y > maxy ) {

			continue;

		}

		const dx1 = x - point[ 0 ];
		const dy1 = y - point[ 1 ];
		if ( slope === dy1 / dx1 ) {

			return true;

		}

	}

	return false;

}

type ResampleMode = 'grid' | 'ellipsoid';

function getInnerPoints( polygon: Polygon, resolution: number, mode: ResampleMode = 'grid' ): Coordinate[] {

	getPolygonBounds( polygon, _min, _max );

	// align all points to a common grid so other polygons will line up
	const startX = Math.sign( _min.x ) * Math.ceil( Math.abs( _min.x / resolution ) ) * resolution;
	const startY = Math.sign( _min.y ) * Math.ceil( Math.abs( _min.y / resolution ) ) * resolution;
	const z = ( _max.z + _min.z ) * 0.5;
	const dimension = polygon[ 0 ][ 0 ].length;

	// if we know there are no iterations to be done then exit early
	if ( startX > _max.x && startY > _max.y ) {

		return [];

	}

	// cache a set of info to accelerate the checks for point on polygon line
	const segmentInfo: SegmentInfo[] = polygon.flatMap( loop => {

		const res: SegmentInfo[] = [];
		for ( let i = 0, l = loop.length; i < l; i ++ ) {

			const ni = ( i + 1 ) % l;
			const c0 = loop[ i ];
			const c1 = loop[ ni ];

			const [ cx0, cy0 ] = c0;
			const [ cx1, cy1 ] = c1;
			const dx0 = cx1 - cx0;
			const dy0 = cy1 - cy0;
			const slope = dy0 / dx0;

			const minx = Math.min( cx0, cx1 );
			const maxx = Math.max( cx0, cx1 );
			const miny = Math.min( cy0, cy1 );
			const maxy = Math.max( cy0, cy1 );

			res.push( {
				point: c0,
				slope,
				minx, maxx,
				miny, maxy,
			} );

		}

		return res;

	} );

	const result: Coordinate[] = [];
	for ( let y = startY, ly = _max.y; y < ly; y += resolution ) {

		const xScalar = mode === 'grid' ? 1 : Math.sin( Math.PI / 2 + MathUtils.DEG2RAD * y );
		const xStride = resolution / xScalar;
		const loopStartX = Math.sign( _min.x ) * Math.ceil( Math.abs( _min.x / xStride ) ) * xStride;
		for ( let x = loopStartX, lx = _max.x; x < lx; x += resolution / xScalar ) {

			if ( ! isPointOnPolygonEdge( segmentInfo, x, y ) ) {

				result.push( dimension === 2 ? [ x, y ] : [ x, y, z ] );

			}

		}

	}

	return result;

}

function addFaceNormals( index: number, posArray: number[], normalArray: Float32Array ): void {

	_vec.fromArray( posArray, index );
	_dir1.fromArray( posArray, index + 3 ).sub( _vec );
	_dir2.fromArray( posArray, index + 6 ).sub( _vec );

	_vec.crossVectors( _dir1, _dir2 ).normalize();
	_vec.toArray( normalArray, index );
	_vec.toArray( normalArray, index + 3 );
	_vec.toArray( normalArray, index + 6 );

}

export function constructPolygonMeshObject( polygons: Polygon[], options: MeshObjectOptions = {} ): Mesh {

	const {
		thickness = 0,
		offset = 0,
		flat = false,
		ellipsoid = null,
		resolution = null,
		detectSelfIntersection = true,
		altitudeScale = 1,
		useEarcut = false,
		groups = null,
	} = options;

	// clone, clean up, filter, and ensure winding order of the polygon shapes,
	// then split the polygon into separate components
	let cleanedPolygons: Polygon[] = polygons
		.map( polygon => polygon.map( loop => loop.map( coord => coord.slice() as Coordinate ) ) );

	if ( detectSelfIntersection ) {

		cleanedPolygons = cleanedPolygons
			.map( polygon => dedupePolygonPoints( polygon ) )
			.filter( polygon => polygon.length !== 0 )
			.flatMap( polygon => splitPolygon( polygon ) );

	}

	cleanedPolygons = cleanedPolygons
		.map( polygon => correctPolygonWinding( polygon ) );

	const triangulations: TriangulationResult[] = cleanedPolygons.map( polygon => {

		let innerPoints: Coordinate[] = [];
		let processedPolygon = polygon;
		if ( resolution !== null ) {

			const resampleMode: ResampleMode = ellipsoid ? 'ellipsoid' : 'grid';

			innerPoints = useEarcut ? [] : getInnerPoints( polygon, resolution, resampleMode );

			processedPolygon = polygon.map( loop => {

				return resampleLine( loop, resolution, resampleMode );

			} );

		}

		// remove the last point since it's redundant
		processedPolygon.forEach( loop => {

			loop.pop();

		} );

		const [ contour, ...holes ] = processedPolygon;
		if ( useEarcut ) {

			const indices = ShapeUtils.triangulateShape(
				contour.map( c => new Vector2( c[ 0 ], c[ 1 ] ) ),
				holes.map( hole => hole.map( c => new Vector2( c[ 0 ], c[ 1 ] ) ) ),
			).flatMap( tri => tri ).reverse();

			let edgeOffset = 0;
			const edges: [number, number][] = [];
			getLoopEdges( contour, edgeOffset, edges );
			edgeOffset += contour.length;

			holes.forEach( hole => {

				getLoopEdges( hole, edgeOffset, edges );
				edgeOffset += hole.length;

			} );

			return {
				points: [ ...contour, ...holes.flatMap( hole => hole ) ],
				indices,
				edges,
			};

		} else {

			return triangulate( contour, holes, innerPoints );

		}

	} );

	// collect the points
	let capVertices = 0;
	let edgeVertices = 0;
	const groupCapVertices: number[] = [];
	const groupEdgeVertices: number[] = [];
	triangulations.forEach( ( { indices, edges } ) => {

		capVertices += indices.length;
		edgeVertices += edges.length * 2 * 3;

		groupCapVertices.push( indices.length );
		groupEdgeVertices.push( edges.length * 2 * 3 );

	} );

	const totalVerts = thickness === 0 ? capVertices : ( 2 * capVertices + edgeVertices );
	const posArray = new Array<number>( totalVerts * 3 );
	const normalArray = new Float32Array( totalVerts * 3 );
	let topOffset = 0;
	let botOffset = capVertices * 3;
	let sideOffset = capVertices * 2 * 3;
	triangulations.forEach( ( { indices, points, edges } ) => {

		// construct cap
		const botHeight = offset;
		const topHeight = offset + thickness;

		function addPoint( pointIndex: number, zOffset: number, indexOffset: number ): void {

			const point = points[ pointIndex ];
			const z = flat ? 0 : ( point[ 2 ] || 0 );
			posArray[ indexOffset + 0 ] = point[ 0 ];
			posArray[ indexOffset + 1 ] = point[ 1 ];
			posArray[ indexOffset + 2 ] = z * altitudeScale + zOffset;

		}

		for ( let i = 0, l = indices.length; i < l; i += 3 ) {

			addPoint( indices[ i + 2 ], topHeight, topOffset + 0 );
			addPoint( indices[ i + 1 ], topHeight, topOffset + 3 );
			addPoint( indices[ i + 0 ], topHeight, topOffset + 6 );
			topOffset += 9;

			if ( thickness > 0 ) {

				addPoint( indices[ i + 0 ], botHeight, botOffset + 0 );
				addPoint( indices[ i + 1 ], botHeight, botOffset + 3 );
				addPoint( indices[ i + 2 ], botHeight, botOffset + 6 );
				botOffset += 9;

			}

		}

		// construct sides
		if ( thickness > 0 ) {

			// TODO: holes need to be added in reverse here?
			for ( let i = 0, l = edges.length; i < l; i ++ ) {

				const edge = edges[ i ];
				const i0 = edge[ 0 ];
				const i1 = edge[ 1 ];
				const i2 = i0;
				const i3 = i1;

				addPoint( i0, botHeight, sideOffset + 0 );
				addPoint( i2, topHeight, sideOffset + 3 );
				addPoint( i1, botHeight, sideOffset + 6 );
				sideOffset += 9;

				addPoint( i1, botHeight, sideOffset + 0 );
				addPoint( i2, topHeight, sideOffset + 3 );
				addPoint( i3, topHeight, sideOffset + 6 );
				sideOffset += 9;

			}

		}

	} );

	// transform the points to the ellipsoid
	if ( ellipsoid ) {

		const normalBotOffset = capVertices * 3;
		for ( let i = 0; i < capVertices * 3; i += 3 ) {

			const lon = posArray[ i + 0 ] * MathUtils.DEG2RAD;
			const lat = posArray[ i + 1 ] * MathUtils.DEG2RAD;
			ellipsoid.getCartographicToNormal( lat, lon, _vec );

			normalArray[ i + 0 ] = _vec.x;
			normalArray[ i + 1 ] = _vec.y;
			normalArray[ i + 2 ] = _vec.z;

			if ( thickness > 0 ) {

				// find the equivalent vertex in the bottom cap that using a different winding order
				const vert = i / 3;
				const triVertIndex = vert % 3;
				const reverseTriVertIndex = 2 - triVertIndex;
				const vertCorrection = - triVertIndex + reverseTriVertIndex;
				const base = normalBotOffset + i + 3 * vertCorrection;

				normalArray[ base + 0 ] = - _vec.x;
				normalArray[ base + 1 ] = - _vec.y;
				normalArray[ base + 2 ] = - _vec.z;

			}

		}

		transformToEllipsoid( posArray, ellipsoid );

	} else {

		for ( let i = 0; i < capVertices * 3; i += 3 ) {

			normalArray[ i + 0 ] = 0;
			normalArray[ i + 1 ] = 0;
			normalArray[ i + 2 ] = 1;

			if ( thickness > 0 ) {

				normalArray[ capVertices * 3 + i + 0 ] = 0;
				normalArray[ capVertices * 3 + i + 1 ] = 0;
				normalArray[ capVertices * 3 + i + 2 ] = - 1;

			}

		}

	}

	// calculate the post-transformed side normals
	if ( thickness > 0 ) {

		for ( let i = capVertices * 2 * 3; i < normalArray.length; i += 9 ) {

			addFaceNormals( i, posArray, normalArray );

		}

	}

	// center the geometry
	const mesh = new Mesh();
	getCenter( posArray, mesh.position );
	_vec.copy( mesh.position ).multiplyScalar( - 1 );
	offsetPoints( posArray, _vec.x, _vec.y, _vec.z );

	mesh.geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( posArray ), 3, false ) );
	mesh.geometry.setAttribute( 'normal', new BufferAttribute( normalArray, 3, false ) );

	if ( groups ) {

		let groupOffset = 0;
		let materialIndex = 0;

		// add first cap
		let stack = [ ...groups ];
		let vertexCounts = [ ...groupCapVertices ];
		while ( stack.length ) {

			let count = stack.shift() || 0;
			let vertexCount = 0;
			while ( count !== 0 ) {

				vertexCount += vertexCounts.shift() || 0;
				count --;

			}

			mesh.geometry.addGroup( groupOffset, vertexCount, materialIndex );
			materialIndex ++;
			groupOffset += vertexCount;

		}

		if ( thickness > 0 ) {

			// add second cap
			stack = [ ...groups ];
			vertexCounts = [ ...groupCapVertices ];
			while ( stack.length ) {

				let count = stack.shift() || 0;
				let vertexCount = 0;
				while ( count !== 0 ) {

					vertexCount += vertexCounts.shift() || 0;
					count --;

				}

				mesh.geometry.addGroup( groupOffset, vertexCount, materialIndex );
				materialIndex ++;
				groupOffset += vertexCount;

			}

			// add edge vertices
			stack = [ ...groups ];
			vertexCounts = [ ...groupEdgeVertices ];
			while ( stack.length ) {

				let count = stack.shift() || 0;
				let vertexCount = 0;
				while ( count !== 0 ) {

					vertexCount += vertexCounts.shift() || 0;
					count --;

				}

				mesh.geometry.addGroup( groupOffset, vertexCount, materialIndex );
				materialIndex ++;
				groupOffset += vertexCount;

			}

		}

	} else if ( thickness > 0 ) {

		// add groups in a top, bottom, sides order
		mesh.geometry.addGroup( 0, capVertices, 0 );
		mesh.geometry.addGroup( capVertices, capVertices, 1 );
		mesh.geometry.addGroup( capVertices * 2, edgeVertices, 2 );

	}

	return mesh;

}
