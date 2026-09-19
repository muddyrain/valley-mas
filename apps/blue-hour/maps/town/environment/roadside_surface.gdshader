shader_type spatial;
render_mode diffuse_lambert, specular_disabled;
uniform vec4 base_color : source_color;
uniform bool paving = false;
varying vec2 world_xz;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float broad_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = smoothstep(vec2(0.0), vec2(1.0), fract(p));
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void vertex() {
	world_xz = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}
void fragment() {
	float tone = (broad_noise(world_xz * 0.045) - 0.5) * 0.025;
	if (paving) {
		vec2 cell = abs(fract(world_xz / 1.2) - 0.5);
		float footprint = max(fwidth(world_xz.x), fwidth(world_xz.y)) / 1.2;
		float joint = smoothstep(0.487 - footprint, 0.5 + footprint, max(cell.x, cell.y));
		tone += (hash(floor(world_xz / 1.2)) - 0.5) * 0.016 - joint * 0.035;
	}
	ALBEDO = max(base_color.rgb + vec3(tone), vec3(0.0));
	ROUGHNESS = 0.96;
}
