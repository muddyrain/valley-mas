shader_type spatial;
render_mode unshaded, fog_disabled, depth_draw_never, depth_test_disabled, cull_disabled, shadows_disabled;
uniform sampler2D depth_texture : hint_depth_texture, repeat_disable, filter_nearest;
uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear;
uniform sampler2D exploration_mask : repeat_disable, filter_linear;
uniform vec2 world_size;
uniform vec4 unexplored_color : source_color = vec4(0.15, 0.24, 0.29, 1.0);
uniform vec4 explored_color : source_color = vec4(0.32, 0.41, 0.47, 1.0);
void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}
void fragment() {
	float depth = texture(depth_texture, SCREEN_UV).r;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	vec3 ndc = vec3(SCREEN_UV, depth) * 2.0 - 1.0;
#else
	vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, depth);
#endif
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view /= view.w;
	vec3 world = (INV_VIEW_MATRIX * view).xyz;
	vec2 uv = world.xz / world_size + vec2(0.5);
	vec2 mask = texture(exploration_mask, uv).rg;
	if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) { mask = vec2(0.0); }
	vec3 scene = texture(screen_texture, SCREEN_UV).rgb;
	float grey = dot(scene, vec3(0.299, 0.587, 0.114));
	vec3 memory = mix(vec3(grey), explored_color.rgb, 0.38) * 0.78;
	vec3 unknown = unexplored_color.rgb + vec3(grey * 0.07);
	ALBEDO = mix(unknown, memory, mask.g);
	ALPHA = (1.0 - mask.r) * mix(0.97, 0.65, mask.g);
}
