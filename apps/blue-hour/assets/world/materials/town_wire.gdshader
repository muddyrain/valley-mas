shader_type spatial;
render_mode diffuse_lambert, specular_disabled, unshaded;

uniform vec4 wire_color : source_color = vec4(0.23, 0.28, 0.31, 1.0);

void fragment() {
	ALBEDO = wire_color.rgb;
	ROUGHNESS = 1.0;
}
