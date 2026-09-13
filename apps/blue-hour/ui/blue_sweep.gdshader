shader_type canvas_item;
void fragment() {
    float edge = smoothstep(0.0, 0.22, UV.x) * (1.0 - smoothstep(0.78, 1.0, UV.x));
    COLOR = vec4(COLOR.rgb, COLOR.a * edge);
}
