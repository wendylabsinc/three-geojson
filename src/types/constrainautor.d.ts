declare module '@kninnug/constrainautor' {
	import Delaunator from 'delaunator';

	export default class Constrainautor {
		constructor(delaunay: Delaunator<ArrayLike<number>>);
		constrainAll(edges: [number, number][]): void;
		constrainOne(edge: [number, number]): void;
	}
}
