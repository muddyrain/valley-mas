shader_type canvas_item;
render_mode unshaded;
void fragment() {
	vec4 source = COLOR;
	float luminance = dot(source.rgb, vec3(0.299, 0.587, 0.114));
	vec3 toned = mix(source.rgb, vec3(luminance), 0.15);
	COLOR = vec4(toned * vec3(0.96, 0.88, 0.83), source.a);
}
