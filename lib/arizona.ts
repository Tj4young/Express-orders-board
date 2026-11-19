/**
 * Arizona outline from public-domain state boundary coordinates
 * (glynnbird/usstatesgeojson, simplified), projected with a cosine
 * correction so longitude isn't stretched. City pins use real coordinates.
 */
export const ARIZONA_VIEW = { width: 400, height: 500 };

export const ARIZONA_PATH =
  "M161.6 34L290.5 33.7L300.9 34.2L382 34.1L381.7 466.3L260.1 466.3L252.5 465.7L180 437.9L18 377.7L18.4 368L20 367.7L22.1 364.7L23.9 360.5L26.5 359.2L30.5 359.8L38 352.6L40 348.3L40.1 346.3L39.8 341.3L37.1 337.3L36.3 336.7L33.3 336.3L32.1 337.1L30 336.9L26.7 335.5L24.7 332.1L25.4 329.1L26.5 326.9L26.9 319.4L23.8 308.8L29.8 306L30 304.3L34.1 298.5L35.5 295.7L35.2 294L35.9 287.3L38 285.9L38.2 285.1L37.5 281.4L36.3 277.6L36.6 269.1L37.8 265.7L41.7 261.1L42 256.1L43.4 254.4L46.2 253.8L53.9 249.1L55.1 247.4L59 243.6L61 243L60.6 239.7L58.2 236.2L47.9 228.4L40.8 213L40 210L34.5 204.3L29.3 196.1L29.6 187.6L29.2 184.4L30.1 179.3L31.5 177.3L32.8 176.7L33.2 176L33.4 172.6L31.2 159.6L29.8 155.3L27.6 152.7L26.6 149.2L28.1 140L25.8 136.9L25.1 133.1L24.8 119.5L22.4 111.5L21.7 103.6L22.9 102.3L29.5 99.4L33.2 98.7L45.3 99.5L48.6 102.2L50.9 106.4L53.4 108.8L55.9 109.1L60 108.2L60.6 107.1L61.8 102.5L65.4 96L66.4 95.5L66.1 34L161.6 34Z";

export type MapCity = "tempe" | "mesa" | "chandler";

/** Pixel position inside ARIZONA_VIEW. */
export const ARIZONA_CITIES: Record<MapCity, { x: number; y: number; label: string }> = {
  tempe: { x: 199.3, y: 306.6, label: "Tempe" },
  mesa: { x: 206.2, y: 307.4, label: "Mesa" },
  chandler: { x: 205.6, y: 315.7, label: "Chandler" },
};

/** Phoenix-metro inset, same cities, local projection so the pins separate. */
export const METRO_CITIES: Record<MapCity, { x: number; y: number }> = {
  tempe: { x: 83.6, y: 75.9 },
  mesa: { x: 111, y: 79.8 },
  chandler: { x: 108.5, y: 120.7 },
};

export function pinRadius(openOrders: number, monthFills: number): number {
  return 7 + Math.min(16, openOrders * 2.4 + monthFills * 0.45);
}
