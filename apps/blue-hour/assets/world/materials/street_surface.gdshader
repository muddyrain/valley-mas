shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec4 base_color : source_color = vec4(0.25, 0.3, 0.33, 1.0);
uniform float variation = 0.025;
uniform float paving = 0.0;
varying vec3 world_position;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smooth_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void vertex() {
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world_position.xz;
	float broad = smooth_noise(p * 0.24) - 0.5;
	float grain = smooth_noise(p * 1.5) - 0.5;
	vec2 cell = abs(fract(p / 1.2) - 0.5);
	float joint = smoothstep(0.48, 0.5, max(cell.x, cell.y));
	ALBEDO = base_color.rgb + broad * variation + grain * variation * 0.08 - joint * paving * 0.025;
	ROUGHNESS = 0.94;
}
