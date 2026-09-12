shader_type spatial;
render_mode cull_disabled, blend_mix, depth_draw_never;

// Integral of a periodic wire, for a box filter measured in screen-pixel derivatives.
// Subpixel diamonds converge to their mean coverage instead of blinking on/off.
float wire_integral(float x) {
	return floor(x) * 0.13 + clamp(fract(x) - 0.435, 0.0, 0.13);
}
float wire_coverage(float x) {
	float width = max(fwidth(x), 0.001);
	return clamp((wire_integral(x + width * 0.5) - wire_integral(x - width * 0.5)) / width, 0.0, 1.0);
}
void fragment() {
	vec2 grid = vec2(UV.x * 40.0, UV.y * 18.0);
	float first = wire_coverage(grid.x + grid.y);
	float second = wire_coverage(grid.x - grid.y);
	ALBEDO = vec3(0.38, 0.43, 0.44);
	ROUGHNESS = 0.8;
	ALPHA = 1.0 - (1.0 - first) * (1.0 - second);
}
