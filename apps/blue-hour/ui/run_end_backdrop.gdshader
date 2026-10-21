shader_type canvas_item;

uniform float saturation : hint_range(0.0, 1.0) = 1.0;
uniform float exposure : hint_range(0.0, 1.5) = 1.0;
uniform vec4 tint : source_color = vec4(1.0);

void fragment() {
	vec4 source = texture(TEXTURE, UV);
	float luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
	vec3 color = mix(vec3(luma), source.rgb, saturation) * tint.rgb * exposure;
	float vignette = 1.0 - 0.18 * smoothstep(0.30, 0.76, distance(UV, vec2(0.43, 0.47)));
	COLOR = vec4(color * vignette, source.a);
}
