shader_type canvas_item;
render_mode unshaded;
uniform float strength = 1.0;
void fragment() {
	float right_shade = smoothstep(0.43, 0.96, UV.x) * 0.64;
	float edge_shade = pow(abs(UV.y - 0.48) * 1.7, 3.0) * 0.23;
	COLOR = vec4(vec3(0.018, 0.040, 0.070), clamp((right_shade + edge_shade) * strength, 0.0, 0.86));
}
