/**
 * Global app version constant.
 * The version is injected at build time by Vite (vite.config.ts).
 * Format: MAJOR.MINOR.PATCH+YYMMDD.HHmm
 * 
 * To bump version for important changes:
 * - Patch (1.0.x): bug fixes, small tweaks
 * - Minor (1.x.0): new features
 * - Major (x.0.0): breaking / structural changes
 * 
 * Edit APP_VERSION in vite.config.ts to bump.
 * The build suffix is added automatically.
 */
declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.2";
