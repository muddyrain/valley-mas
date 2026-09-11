shader_type canvas_item;
render_mode unshaded;

uniform vec4 outline_color : source_color = vec4(0.56, 0.84, 0.98, 0.88);
uniform vec4 glow_color : source_color = vec4(0.35, 0.70, 0.92, 0.30);
uniform vec4 shadow_color : source_color = vec4(0.015, 0.055, 0.10, 0.34);
uniform sampler2D card_texture : source_color, filter_linear;
uniform float hover_amount : hint_range(0.0, 1.0) = 0.0;
uniform vec2 content_origin_uv = vec2(0.04, 0.04);
uniform vec2 content_size_uv = vec2(0.92, 0.92);

float alpha_at(vec2 source_uv) {
	if (source_uv.x < 0.0 || source_uv.y < 0.0 || source_uv.x > 1.0 || source_uv.y > 1.0) {
		return 0.0;
	}
	return texture(card_texture, source_uv).a;
}

float ring_alpha(vec2 source_uv, vec2 pixel_size, float radius) {
	float diagonal = radius * 0.70710678;
	float result = 0.0;
	result = max(result, alpha_at(source_uv + vec2(radius, 0.0) * pixel_size));
	result = max(result, alpha_at(source_uv + vec2(-radius, 0.0) * pixel_size));
	result = max(result, alpha_at(source_uv + vec2(0.0, radius) * pixel_size));
	result = max(result, alpha_at(source_uv + vec2(0.0, -radius) * pixel_size));
	result = max(result, alpha_at(source_uv + vec2(diagonal, diagonal) * pixel_size));
	result = max(result, alpha_at(source_uv + vec2(-diagonal, diagonal) * pixel_size));
	result = max(result, alpha_at(source_uv + vec2(diagonal, -diagonal) * pixel_size));
	result = max(result, alpha_at(source_uv + vec2(-diagonal, -diagonal) * pixel_size));
	return result;
}

void fragment() {
	vec2 source_uv = (UV - content_origin_uv) / content_size_uv;
	vec2 pixel_size = TEXTURE_PIXEL_SIZE;
	float center_alpha = alpha_at(source_uv);
	float near_alpha = max(
		ring_alpha(source_uv, pixel_size, 1.25),
		ring_alpha(source_uv, pixel_size, 2.75)
	);
	float medium_alpha = ring_alpha(source_uv, pixel_size, 4.75);
	float far_alpha = ring_alpha(source_uv, pixel_size, 7.5);
	float empty_alpha = 1.0 - center_alpha;
	float outline_mask = smoothstep(0.08, 0.72, near_alpha) * empty_alpha;
	float glow_mask = clamp(
		near_alpha * 0.24 + medium_alpha * 0.18 + far_alpha * 0.11,
		0.0,
		1.0
	) * empty_alpha * (1.0 - outline_mask * 0.72);
	vec2 shadow_uv = source_uv - vec2(2.0, 5.0) * pixel_size;
	float shadow_source = max(
		alpha_at(shadow_uv),
		ring_alpha(shadow_uv, pixel_size, 3.5)
	);
	float shadow_mask = smoothstep(0.02, 0.78, shadow_source) * empty_alpha * (1.0 - outline_mask);

	float outline_alpha = outline_mask * outline_color.a * hover_amount;
	float glow_alpha = glow_mask * glow_color.a * hover_amount;
	float shadow_alpha = shadow_mask * shadow_color.a * hover_amount;
	float color_weight = outline_alpha + glow_alpha + shadow_alpha;
	vec3 effect_color = (
		outline_color.rgb * outline_alpha
		+ glow_color.rgb * glow_alpha
		+ shadow_color.rgb * shadow_alpha
	) / max(color_weight, 0.0001);
	float effect_alpha = 1.0
		- (1.0 - outline_alpha)
		* (1.0 - glow_alpha)
		* (1.0 - shadow_alpha);
	COLOR = vec4(effect_color, effect_alpha);
}
