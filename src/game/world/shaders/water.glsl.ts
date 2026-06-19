/**
 * GLSL for the transparent water surface (MeshStandardMaterial + onBeforeCompile).
 * Shares the terrain's `uData` texture: R = solid surface(height+lava),
 * B = waterDepth. The water mesh sits at solid + waterDepth, is discarded where
 * there's no water, depth-tinted blue, and given animated ripple normals so the
 * sun throws a moving specular glint across it.
 */

export const WATER_PARS_VERTEX = /* glsl */ `
uniform sampler2D uData;
uniform vec2 uTexel;
uniform float uHeightScale;
uniform float uCell;
uniform float uTime;
varying vec2 vWaterUv;
varying float vDepth;

float waterSurf(vec2 uv) {
  vec4 d = texture2D(uData, uv);
  return d.r + d.b; // solid + waterDepth
}
`;

export const WATER_BEGINNORMAL = /* glsl */ `
vWaterUv = uv;
vDepth = texture2D(uData, uv).b;
// base gradient of the water surface
float sL = waterSurf(uv - vec2(uTexel.x, 0.0));
float sR = waterSurf(uv + vec2(uTexel.x, 0.0));
float sD = waterSurf(uv - vec2(0.0, uTexel.y));
float sU = waterSurf(uv + vec2(0.0, uTexel.y));
float slopeX = (sR - sL) * uHeightScale / (2.0 * uCell);
float slopeY = (sU - sD) * uHeightScale / (2.0 * uCell);
// animated ripples for a moving glint
float w1 = sin((uv.x * 60.0) + uTime * 1.7) * 0.06;
float w2 = cos((uv.y * 70.0) - uTime * 1.3) * 0.06;
vec3 objectNormal = normalize(vec3(-slopeX + w1, -slopeY + w2, 1.0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

export const WATER_BEGIN_VERTEX = /* glsl */ `
vec3 transformed = vec3( position );
transformed.z += waterSurf(uv) * uHeightScale;
`;

export const WATER_PARS_FRAGMENT = /* glsl */ `
varying vec2 vWaterUv;
varying float vDepth;
uniform float uWaterEps;
`;

export const WATER_MAP_FRAGMENT = /* glsl */ `
if (vDepth < uWaterEps) discard;
float t = clamp(vDepth * 4.0, 0.0, 0.85);
vec3 shallow = vec3(64.0, 150.0, 196.0) / 255.0;
vec3 deep = vec3(12.0, 52.0, 120.0) / 255.0;
vec3 wcol = mix(shallow, deep, t);
diffuseColor.rgb = pow(wcol, vec3(2.2));
diffuseColor.a = clamp(0.45 + vDepth * 3.0, 0.45, 0.92);
`;
