# three-geojson

> **Fork Notice:** This is a TypeScript fork of [gkjohnson/three-geojson](https://github.com/gkjohnson/three-geojson) with added type definitions and Storybook examples.

[![build](https://img.shields.io/github/actions/workflow/status/wendylabsinc/three-geojson/node.js.yml?style=flat-square&label=build&branch=main)](https://github.com/wendylabsinc/three-geojson/actions)
[![github](https://flat.badgen.net/badge/icon/github?icon=github&label)](https://github.com/wendylabsinc/three-geojson/)

![](./docs/banner.png)

Three.js shape loaders for [GeoJSON](https://geojson.org/) ([readable html](https://stevage.github.io/geojson-spec/)) and [WKT](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry) formats. Supports generation of three.js line geometry in addition to flat and extruded triangulated meshes. All generated geometry are transformed and centered using 64-bit Javascript floating point operations with meshes are offset to retain precision in GPU operations.

## What's Different in This Fork

- **Full TypeScript support** with strict type definitions
- **Storybook examples** for interactive demos
- **Type exports** for all parsed geometry types (`ParsedPolygon`, `ParsedFeature`, etc.)
- **Type-safe options** for `getLineObject()` and `getMeshObject()`

## Installation

```bash
npm install github:wendylabsinc/three-geojson
```

## Quick Start

```ts
import { GeoJSONLoader } from 'three-geojson';
import type { ParseResult, ParsedPolygon } from 'three-geojson';

const loader = new GeoJSONLoader();
const result: ParseResult = await loader.loadAsync('path/to/data.geojson');

result.polygons.forEach((polygon: ParsedPolygon) => {
  const mesh = polygon.getMeshObject({ thickness: 1 });
  scene.add(mesh);
});
```

## Storybook Examples

Run the interactive examples:

```bash
npm install
npm run build
npm run storybook
```

Visit http://localhost:6006 to see:
- **Extruded** - Single country extrusion
- **All Countries** - All countries extruded (flat)
- **All Countries (10m Globe)** - High-resolution 10m data on WGS84 ellipsoid
- **Globe** - Globe with country highlighting
- **WKT** - WKT format example

---

## Original Documentation

Uses [@turfjs/unkink-polygon](https://www.npmjs.com/package/@turf/unkink-polygon), [@mapbox/delaunator](https://github.com/mapbox/delaunator), [@kninnug/constrainautor](https://github.com/kninnug/Constrainautor), and [@placemark/betterknown](https://github.com/placemark/betterknown) packages for polygon triangulation and WKT parsing. World GeoJSON file courtesy of [geojson-maps](https://geojson-maps.kyd.au/).

Some key features supported by this project:
- Support for detecting and fixing self-intersecting polygons so they triangulate correctly.
- Uses constrained delaunay triangulation for correct, high quality triangulation and support for inner vertices.
- Smooth surface normals are generated for ellipsoid-projected shapes.
- Outputs centered geometry with and matrix transform offset to avoid precision-related artifacts on CPU and GPU when processing high-detail shapes.
- Supports altitude values.

# API

## GeoJSONResult

```ts
interface ParseResult {
  features: ParsedFeature[];
  geometries: ParsedGeometry[];
  polygons: ParsedPolygonGeometry[];
  lines: ParsedLine[];
  points: ParsedPoint[];
}
```

**ParsedFeature**

Definition of a feature that includes properties originally defined in the GeoJSON file.

```ts
interface ParsedFeature {
  type: 'Feature';
  id: string | number | null;
  properties: Record<string, unknown> | null;
  geometries: ParsedGeometry[];
  polygons: ParsedPolygonGeometry[];
  lines: ParsedLine[];
  points: ParsedPoint[];
}
```

**ParsedPolygon**

Definition of a parsed polygon geometry.

```ts
interface ParsedPolygon {
  type: 'Polygon';
  feature: ParsedFeature | null;
  data: Polygon[];
  dimension: number | null;
  getLineObject(options?: LineObjectOptions): LineSegments;
  getMeshObject(options?: MeshObjectOptions): Mesh;
}
```

**LineObjectOptions**

```ts
interface LineObjectOptions {
  offset?: number;           // Z-axis offset (default: 0)
  altitudeScale?: number;    // Scale for altitude values (default: 1)
  flat?: boolean;            // Ignore altitude/z-values (default: false)
  ellipsoid?: Ellipsoid;     // Project onto ellipsoid surface
  resolution?: number;       // Edge resampling spacing
}
```

**MeshObjectOptions**

```ts
interface MeshObjectOptions extends LineObjectOptions {
  thickness?: number;                  // Z-axis thickness (default: 0)
  useEarcut?: boolean;                 // Use earcut algorithm (default: false)
  detectSelfIntersection?: boolean;    // Check for self-intersections (default: true)
}
```

## GeoJSONLoader

### fetchOptions

```ts
fetchOptions: RequestInit = {}
```

Options passed to fetch.

### loadAsync

```ts
loadAsync(url: string): Promise<ParseResult>
```

Loads and parses a GeoJSON file.

### parse

```ts
parse(content: string | object): ParseResult
```

Parses GeoJSON content. Takes a raw or stringified JSON object.

### static getMeshObject

```ts
static getMeshObject(objects: ParsedPolygonGeometry[], options?: MeshObjectOptions): Mesh
```

Returns a mesh that merges the result of all the provided Polygons.

### static getLineObject

```ts
static getLineObject(objects: (ParsedLine | ParsedPolygonGeometry)[], options?: LineObjectOptions): LineSegments
```

Returns a line that merges the result of all the provided Polygons and LineStrings.

## WKTLoader

*extends GeoJSONLoader*

Loads and converts WKT files to GeoJSON using the [betterknown](https://github.com/placemark/betterknown) package, then parses using GeoJSONLoader.

```ts
import { WKTLoader } from 'three-geojson';

const loader = new WKTLoader();
const result = await loader.loadAsync('path/to/data.wkt');
```

---

## Credits

Original library by [Garrett Johnson](https://github.com/gkjohnson). TypeScript conversion and Storybook by [Wendy Labs](https://github.com/wendylabsinc).
