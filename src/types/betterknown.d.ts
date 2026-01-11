declare module 'betterknown' {
	import type { GeoJSON } from 'geojson';

	export function wktToGeoJSON(wkt: string): GeoJSON;
	export function geoJSONToWkt(geojson: GeoJSON): string;
}
