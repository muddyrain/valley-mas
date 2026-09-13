shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D previous_mask : filter_linear, repeat_disable;
uniform vec2 world_size;
uniform vec2 sources[4];
uniform int source_count = 0;
uniform float radius = 20.0;
uniform float falloff = 5.0;
void fragment() {
	vec2 point = (UV - vec2(0.5)) * world_size;
	float visible = 0.0;
	for (int i = 0; i < source_count; i++) {
		float d = distance(point, sources[i]);
		visible = max(visible, 1.0 - smoothstep(radius - falloff, radius, d));
	}
	float explored = max(texture(previous_mask, UV).g, visible);
	COLOR = vec4(visible, explored, 0.0, 1.0);
}
