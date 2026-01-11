import type { Box3, LineSegments, Mesh, Vector3 } from 'three';

// Coordinate types
export type Coordinate2D = [number, number];
export type Coordinate3D = [number, number, number];
export type Coordinate = Coordinate2D | Coordinate3D;

// Loop/Ring types for polygons
export type CoordinateLoop = Coordinate[];
export type Polygon = CoordinateLoop[]; // [contour, ...holes]
export type MultiPolygon = Polygon[];

// Line types
export type LineString = Coordinate[];
export type MultiLineString = LineString[];

// Ellipsoid interface (compatible with 3d-tiles-renderer)
export interface Ellipsoid {
	radius: { x: number; y: number; z: number };
	getCartographicToPosition(lat: number, lon: number, alt: number, target: Vector3): void;
	getCartographicToNormal(lat: number, lon: number, target: Vector3): void;
}

// Options for line object construction
export interface LineObjectOptions {
	flat?: boolean;
	offset?: number;
	ellipsoid?: Ellipsoid | null;
	resolution?: number | null;
	altitudeScale?: number;
	groups?: number[] | null;
}

// Options for mesh object construction
export interface MeshObjectOptions extends LineObjectOptions {
	thickness?: number;
	detectSelfIntersection?: boolean;
	useEarcut?: boolean;
}

// Foreign keys extracted from GeoJSON
export type ForeignKeys = Record<string, unknown>;

// Base parsed object
export interface ParsedObjectBase {
	type: string;
	boundingBox: Box3 | null;
	data: unknown;
	foreign: ForeignKeys;
}

// Forward declaration for circular references
export interface ParsedFeature extends ParsedObjectBase {
	type: 'Feature';
	id: string | number | null;
	properties: Record<string, unknown> | null;
	data: ParsedGeometry | null;
	geometries: ParsedGeometry[];
	points: ParsedPoint[];
	lines: ParsedLine[];
	polygons: ParsedPolygonGeometry[];
}

// Parsed geometry types
export interface ParsedPoint extends ParsedObjectBase {
	type: 'Point';
	data: [Coordinate];
	dimension: number | null;
	feature: ParsedFeature | null;
}

export interface ParsedMultiPoint extends ParsedObjectBase {
	type: 'MultiPoint';
	data: Coordinate[];
	dimension: number | null;
	feature: ParsedFeature | null;
}

export interface ParsedLineString extends ParsedObjectBase {
	type: 'LineString';
	data: LineString[];
	dimension: number | null;
	feature: ParsedFeature | null;
	getLineObject(options?: LineObjectOptions): LineSegments;
}

export interface ParsedMultiLineString extends ParsedObjectBase {
	type: 'MultiLineString';
	data: MultiLineString;
	dimension: number | null;
	feature: ParsedFeature | null;
	getLineObject(options?: LineObjectOptions): LineSegments;
}

export interface ParsedPolygon extends ParsedObjectBase {
	type: 'Polygon';
	data: Polygon[];
	dimension: number | null;
	feature: ParsedFeature | null;
	getLineObject(options?: LineObjectOptions): LineSegments;
	getMeshObject(options?: MeshObjectOptions): Mesh;
}

export interface ParsedMultiPolygon extends ParsedObjectBase {
	type: 'MultiPolygon';
	data: MultiPolygon;
	dimension: number | null;
	feature: ParsedFeature | null;
	getLineObject(options?: LineObjectOptions): LineSegments;
	getMeshObject(options?: MeshObjectOptions): Mesh;
}

export interface ParsedGeometryCollection extends ParsedObjectBase {
	type: 'GeometryCollection';
	data: ParsedGeometry[];
	feature: ParsedFeature | null;
}

export interface ParsedFeatureCollection extends ParsedObjectBase {
	type: 'FeatureCollection';
	data: ParsedFeature[];
}

// Union types for convenience
export type ParsedLine = ParsedLineString | ParsedMultiLineString;
export type ParsedPolygonGeometry = ParsedPolygon | ParsedMultiPolygon;
export type ParsedGeometry =
	| ParsedPoint
	| ParsedMultiPoint
	| ParsedLineString
	| ParsedMultiLineString
	| ParsedPolygon
	| ParsedMultiPolygon
	| ParsedGeometryCollection;

export type ParsedObject =
	| ParsedGeometry
	| ParsedFeature
	| ParsedFeatureCollection;

// Parse result returned by GeoJSONLoader.parse()
export interface ParseResult {
	features: ParsedFeature[];
	geometries: ParsedGeometry[];
	points: ParsedPoint[];
	lines: ParsedLine[];
	polygons: ParsedPolygonGeometry[];
}

// Triangulation result
export interface TriangulationResult {
	indices: number[];
	edges: [number, number][];
	points: Coordinate[];
}

// GeoJSON input types (simplified, compatible with @types/geojson)
export interface GeoJSONObject {
	type: string;
	bbox?: number[];
	coordinates?: unknown;
	geometries?: GeoJSONObject[];
	geometry?: GeoJSONObject;
	properties?: Record<string, unknown> | null;
	features?: GeoJSONObject[];
	id?: string | number;
	[key: string]: unknown;
}
