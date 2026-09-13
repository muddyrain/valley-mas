shader_type spatial;
render_mode cull_disabled, specular_disabled;

uniform sampler2D source_texture : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform vec4 source_tint : source_color = vec4(1.0);
uniform vec4 palette : source_color = vec4(0.72, 0.73, 0.68, 1.0);
uniform vec4 roof_color : source_color = vec4(0.25, 0.32, 0.39, 1.0);
uniform vec3 bounds_center;
uniform vec3 bounds_extent = vec3(1.0);
uniform float foliage = 0.0;
uniform float architecture = 0.0;
uniform float texture_softening = 0.0;
// Opt-in hero treatment; the existing city palette keeps its current defaults.
uniform float hero_surface = 0.0;
uniform float vehicle = 0.0;
uniform float rim_strength = 0.0;
uniform vec4 shade_color : source_color = vec4(0.67, 0.77, 0.90, 1.0);
varying vec3 roof_view_normal;
varying float height_ratio;
varying vec3 world_normal;
varying vec3 canopy_normal;
varying vec3 surface_world_position;

void vertex() {
	surface_world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	roof_view_normal = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	height_ratio = (VERTEX.y - bounds_center.y) / max(bounds_extent.y, 0.01) * 0.5 + 0.5;
	world_normal = normalize(MODEL_NORMAL_MATRIX * NORMAL);
	// A broad crown normal groups the existing opaque leaves without inflating their silhouette.
	vec3 crown = (VERTEX - bounds_center) / max(bounds_extent, vec3(0.01));
	crown.y = crown.y * 0.7 + 0.25;
	canopy_normal = normalize(MODELVIEW_NORMAL_MATRIX * normalize(crown));
}

void fragment() {
	vec3 detail = texture(source_texture, UV, texture_softening).rgb * source_tint.rgb;
	float luminance = dot(detail, vec3(0.2126, 0.7152, 0.0722));
	vec3 clean = mix(vec3(luminance), detail, 0.82);
	// Retain the atlas' doors and shop signs; compress dirt and photographed highlights.
	clean = mix(clean, palette.rgb * (0.52 + luminance * 0.65), 0.22);
	float plaster = architecture * smoothstep(0.52, 0.78, luminance);
	clean = mix(clean, palette.rgb * 0.94, plaster * 0.55);
	float roof = architecture * smoothstep(0.50, 0.68, height_ratio)
		* smoothstep(0.32, 0.68, world_normal.y) * (1.0 - smoothstep(0.43, 0.67, luminance));
	clean = mix(clean, roof_color.rgb * (0.82 + luminance * 0.48), roof * 0.82);
	float leaf = foliage * smoothstep(0.015, 0.07, detail.g - detail.r);
	vec3 leaf_color = mix(vec3(0.19, 0.32, 0.28), vec3(0.48, 0.62, 0.37), smoothstep(0.12, 0.78, luminance));
	clean = mix(clean, leaf_color, leaf * 0.88);
	if (hero_surface > 0.5) {
		// Compress photographed micro-contrast into broad material families. Keep the
		// original atlas at native mip selection so text and UV seams stay intact.
		float tone = 0.30 + 0.20 * smoothstep(0.10, 0.29, luminance)
			+ 0.24 * smoothstep(0.46, 0.77, luminance);
		vec3 hue = detail / max(luminance, 0.08);
		clean = mix(detail, mix(vec3(1.0), hue, 0.68) * tone, 0.86);
		// Geometric facing keeps roof compression off the vertical logo and fascia,
		// even where the imported smoothed normals bend into their neighbors.
		vec3 face_normal = normalize(cross(dFdx(surface_world_position), dFdy(surface_world_position)));
		float upper = smoothstep(0.54, 0.65, height_ratio) * smoothstep(0.40, 0.72, abs(face_normal.y));
		NORMAL = normalize(mix(NORMAL, roof_view_normal, upper * (1.0 - vehicle) * 0.88));
		float neutral = 1.0 - smoothstep(0.045, 0.16, max(detail.r, max(detail.g, detail.b)) - min(detail.r, min(detail.g, detail.b)));
		float plaster_mask = smoothstep(0.30, 0.66, luminance) * neutral;
		clean = mix(clean, palette.rgb * (0.91 + 0.06 * tone), plaster_mask * 0.91 * (1.0 - vehicle));
		clean = mix(clean, roof_color.rgb * (0.985 + 0.03 * tone), upper * (1.0 - vehicle) * 0.95);
		float stone = (1.0 - smoothstep(0.12, 0.24, height_ratio)) * neutral * smoothstep(0.14, 0.40, luminance);
		clean = mix(clean, palette.rgb * (0.65 + tone * 0.05), stone * (1.0 - vehicle) * 0.82);
		if (vehicle > 0.5) {
			float blue_paint = smoothstep(0.018, 0.075, detail.b - detail.r) * smoothstep(0.32, 0.58, luminance);
			clean = mix(clean, palette.rgb * (0.90 + 0.14 * tone), blue_paint * 0.90);
			// This source is one atlas/mesh: identify window-height cool panes, excluding
			// roof luggage and the low wheels, without splitting or replacing the model.
			float glass_height = smoothstep(0.37, 0.46, height_ratio) * (1.0 - smoothstep(0.72, 0.82, height_ratio));
			float glass = glass_height * (1.0 - smoothstep(0.48, 0.68, luminance)) * smoothstep(-0.025, 0.04, detail.b - detail.r);
			vec3 pane = mix(vec3(0.14, 0.27, 0.36), vec3(0.30, 0.47, 0.57), smoothstep(0.44, 0.76, height_ratio));
			float reflection = smoothstep(0.78, 0.91, dot(reflect(-VIEW, NORMAL), normalize(vec3(-0.2, 0.75, 0.6))));
			clean = mix(clean, pane + reflection * 0.065, glass * 0.84);
		}
	}
	NORMAL = normalize(mix(NORMAL, canopy_normal, leaf * 0.86));
	ALBEDO = clamp(clean, vec3(0.045), vec3(0.88));
	ROUGHNESS = 0.95;
	SPECULAR = 0.0;
}

void light() {
	float facing = dot(NORMAL, LIGHT);
	float band = 0.27 + 0.46 * smoothstep(-0.12, 0.12, facing)
		+ 0.27 * smoothstep(0.58, 0.80, facing);
	// Shadow attenuation stays continuous: no hard threshold crawling across fine roof geometry.
	if (hero_surface > 0.5) {
		band = 0.24 + 0.48 * smoothstep(-0.075, 0.075, facing)
			+ 0.28 * smoothstep(0.58, 0.72, facing);
		vec3 shade = mix(shade_color.rgb, vec3(1.0), smoothstep(0.0, 0.8, facing));
		float rim = pow(1.0 - max(dot(NORMAL, VIEW), 0.0), 4.0) * smoothstep(-0.1, 0.55, facing);
		DIFFUSE_LIGHT += LIGHT_COLOR * shade * (band + rim * rim_strength) * ATTENUATION / PI;
	} else {
		DIFFUSE_LIGHT += ALBEDO * LIGHT_COLOR * band * ATTENUATION / PI;
	}
}
