// 듀얼 쿼터니언 스키닝: 관절이 크게 꺾여도 어깨·골반이 구겨지거나 가늘어지지 않게 한다.
// three 기본(선형 블렌드)은 두 뼈 사이 정점을 직선으로 섞어 부피가 줄어듦 → 회전을 섞어서 둥글게 돈다.
// 뼈 크기 변화(숨쉬기 가슴 부풀림)는 회전과 따로 선형으로 더한다.
const PARS = /* glsl */`
vec4 dqQuat(mat3 m) {
  float t = m[0][0] + m[1][1] + m[2][2]; vec4 q;
  if (t > 0.0) { float s = sqrt(t + 1.0) * 2.0; q = vec4((m[1][2] - m[2][1]) / s, (m[2][0] - m[0][2]) / s, (m[0][1] - m[1][0]) / s, 0.25 * s); }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { float s = sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2.0; q = vec4(0.25 * s, (m[1][0] + m[0][1]) / s, (m[2][0] + m[0][2]) / s, (m[1][2] - m[2][1]) / s); }
  else if (m[1][1] > m[2][2]) { float s = sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2.0; q = vec4((m[1][0] + m[0][1]) / s, 0.25 * s, (m[2][1] + m[1][2]) / s, (m[2][0] - m[0][2]) / s); }
  else { float s = sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2.0; q = vec4((m[2][0] + m[0][2]) / s, (m[2][1] + m[1][2]) / s, 0.25 * s, (m[0][1] - m[1][0]) / s); }
  return normalize(q);
}
vec4 dqMul(vec4 a, vec4 b) { return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz)); }
vec3 dqRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
// 뼈 행렬 하나 → 회전(qr)·이동(qd)·크기 보정용 강체 행렬
void dqBone(mat4 M, vec3 p, float w, vec4 ref, inout vec4 br, inout vec4 bd, inout vec3 extra) {
  mat3 R = mat3(normalize(M[0].xyz), normalize(M[1].xyz), normalize(M[2].xyz));
  vec4 qr = dqQuat(R); vec3 t = M[3].xyz;
  if (dot(qr, ref) < 0.0) w = -w;
  vec4 qd = 0.5 * dqMul(vec4(t, 0.0), qr);
  br += w * qr; bd += w * qd;
  extra += abs(w) * ((M * vec4(p, 1.0)).xyz - (R * p + t));
}
`;
const BASE = /* glsl */`
#include <skinbase_vertex>
#ifdef USE_SKINNING
mat4 dqMX = bindMatrixInverse * boneMatX * bindMatrix, dqMY = bindMatrixInverse * boneMatY * bindMatrix, dqMZ = bindMatrixInverse * boneMatZ * bindMatrix, dqMW = bindMatrixInverse * boneMatW * bindMatrix;
vec4 dqR = vec4(0.0), dqD = vec4(0.0); vec3 dqExtra = vec3(0.0);
{ vec3 p0 = position; vec4 ref = dqQuat(mat3(normalize(dqMX[0].xyz), normalize(dqMX[1].xyz), normalize(dqMX[2].xyz)));
  dqBone(dqMX, p0, skinWeight.x, ref, dqR, dqD, dqExtra); dqBone(dqMY, p0, skinWeight.y, ref, dqR, dqD, dqExtra);
  dqBone(dqMZ, p0, skinWeight.z, ref, dqR, dqD, dqExtra); dqBone(dqMW, p0, skinWeight.w, ref, dqR, dqD, dqExtra);
  float n = length(dqR); dqR /= n; dqD /= n; }
#endif
`;
const NORMAL = /* glsl */`
#ifdef USE_SKINNING
objectNormal = dqRot(dqR, objectNormal);
#endif
`;
const SKIN = /* glsl */`
#ifdef USE_SKINNING
transformed = dqRot(dqR, transformed) + 2.0 * (dqR.w * dqD.xyz - dqD.w * dqR.xyz + cross(dqR.xyz, dqD.xyz)) + dqExtra;
#endif
`;
// onBeforeCompile 안에서 부른다 (다른 치환과 같이 써도 됨)
export function patchDQS(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <skinning_pars_vertex>', '#include <skinning_pars_vertex>\n' + PARS)
    .replace('#include <skinbase_vertex>', BASE)
    .replace('#include <skinnormal_vertex>', NORMAL)
    .replace('#include <skinning_vertex>', SKIN);
}
