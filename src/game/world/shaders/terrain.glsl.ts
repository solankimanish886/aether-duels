/**
 * GLSL injected into a MeshStandardMaterial (via onBeforeCompile) to displace
 * and colour the terrain on the GPU. The colour math is a 1:1 port of
 * `paintTerrain.ts`'s `terrainRamp` + vegetation/lava tint — keep the two in
 * sync. Data is read from two float textures packed by `useWorldTextures.ts`:
 *   uData: R = solid surface(height+lava), G = height, B = waterDepth, A = lava
 *   uAux : R = vegetation, G = temp, B = rock
 *
 * The plane geometry lies in local XY (height along local +Z); the mesh is
 * rotated -PI/2 about X so +Z becomes world up. Normals are recomputed from the
 * surface gradient so the orbiting sun lights and shadows real relief.
 */

/** Shared sRGB colour ramp — mirror of paintTerrain.ts terrainRamp(). */
export const GLSL_TERRAIN_RAMP = /* glsl */ `
vec3 terrainRamp(float h, float rock) {
  vec3 c;
  if (h < 0.34) {
    float t = h / 0.34;
    c = mix(vec3(214.0,196.0,150.0), vec3(198.0,178.0,120.0), t);
  } else if (h < 0.62) {
    float t = (h - 0.34) / 0.28;
    c = mix(vec3(150.0,132.0,96.0), vec3(110.0,104.0,86.0), t);
  } else if (h < 0.82) {
    float t = (h - 0.62) / 0.20;
    c = mix(vec3(120.0,114.0,104.0), vec3(150.0,150.0,152.0), t);
  } else {
    float t = (h - 0.82) / 0.18;
    c = mix(vec3(170.0,170.0,172.0), vec3(244.0,248.0,255.0), t);
  }
  c /= 255.0;
  if (rock > 0.5) c = mix(c, vec3(60.0,52.0,54.0) / 255.0, 0.55);
  return c;
}
`;

export const TERRAIN_PARS_VERTEX = /* glsl */ `
uniform sampler2D uData;
uniform vec2 uTexel;
uniform float uHeightScale;
uniform float uCell;
varying vec2 vWorldUv;
`;

/** Replaces #include <beginnormal_vertex>: gradient normal from the surface. */
export const TERRAIN_BEGINNORMAL = /* glsl */ `
vWorldUv = uv;
float sL = texture2D(uData, uv - vec2(uTexel.x, 0.0)).r;
float sR = texture2D(uData, uv + vec2(uTexel.x, 0.0)).r;
float sD = texture2D(uData, uv - vec2(0.0, uTexel.y)).r;
float sU = texture2D(uData, uv + vec2(0.0, uTexel.y)).r;
float slopeX = (sR - sL) * uHeightScale / (2.0 * uCell);
float slopeY = (sU - sD) * uHeightScale / (2.0 * uCell);
vec3 objectNormal = normalize(vec3(-slopeX, -slopeY, 1.0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

/** Replaces #include <begin_vertex>: displace local Z by the surface height. */
export const TERRAIN_BEGIN_VERTEX = /* glsl */ `
vec3 transformed = vec3( position );
float surf = texture2D(uData, uv).r;
transformed.z += surf * uHeightScale;
`;

export const TERRAIN_PARS_FRAGMENT = /* glsl */ `
uniform sampler2D uData;
uniform sampler2D uAux;
uniform float uLavaEmissive;
varying vec2 vWorldUv;
${GLSL_TERRAIN_RAMP}
`;

/**
 * Replaces #include <map_fragment>: build the albedo from the height ramp +
 * vegetation + lava. Colours are sRGB; convert to linear for the PBR pipeline.
 */
export const TERRAIN_MAP_FRAGMENT = /* glsl */ `
vec4 data = texture2D(uData, vWorldUv);
vec4 aux = texture2D(uAux, vWorldUv);
float height = data.g;
float lava = data.a;
float veg = aux.r;
float temp = aux.g;
float rock = aux.b;

vec3 col = terrainRamp(height, rock);
col = mix(col, vec3(34.0,120.0,46.0) / 255.0, veg * 0.85);

float lavaA = clamp(lava * 6.0, 0.0, 1.0);
vec3 lavaCol = vec3(1.0, mix(0.27, 0.78, temp), mix(0.08, 0.47, temp * temp));
col = mix(col, lavaCol, lavaA);

diffuseColor.rgb *= pow(col, vec3(2.2)); // sRGB → linear
`;

/** Appended after #include <emissivemap_fragment>: lava glows (brighter at night). */
export const TERRAIN_EMISSIVE_FRAGMENT = /* glsl */ `
vec4 dataE = texture2D(uData, vWorldUv);
vec4 auxE = texture2D(uAux, vWorldUv);
float lavaE = clamp(dataE.a * 6.0, 0.0, 1.0);
float tempE = auxE.g;
vec3 lavaColE = vec3(1.0, mix(0.27, 0.78, tempE), mix(0.08, 0.47, tempE * tempE));
totalEmissiveRadiance += pow(lavaColE, vec3(2.2)) * lavaE * uLavaEmissive;
`;
