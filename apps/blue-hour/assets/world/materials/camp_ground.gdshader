shader_type spatial;
render_mode specular_disabled;

uniform int surface_kind = 0; // 0 grounds, 1 entrance, 2 driveway, 3 road
uniform vec4 grass_color : source_color = vec4(0.355, 0.415, 0.35, 1.0);
uniform vec4 earth_color : source_color = vec4(0.51, 0.51, 0.465, 1.0);
uniform vec4 paving_color : source_color = vec4(0.61, 0.645, 0.63, 1.0);
uniform vec4 asphalt_color : source_color = vec4(0.285, 0.35, 0.40, 1.0);
uniform vec4 contacts[4];
uniform vec3 vehicle_contact;
uniform float vehicle_yaw = 0.0;
varying vec3 world_position;
varying vec3 local_position;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise_field(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float box_distance(vec2 p, vec2 half_size) {
	vec2 q = abs(p) - half_size;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float stripe(float position, float half_width, float aa) {
	return 1.0 - smoothstep(half_width - aa, half_width + aa, abs(position));
}

float fill(float distance, float aa) {
	return 1.0 - smoothstep(-aa, aa, distance);
}

vec3 paving(vec2 p, vec2 scale, float aa) {
	vec2 tile = vec2(p.x + mod(floor(p.y / scale.y), 2.0) * scale.x * 0.5, p.y) / scale;
	vec2 edge = min(fract(tile), 1.0 - fract(tile)) * scale;
	float joint = fill(min(edge.x, edge.y) - 0.012, aa * 0.45);
	return paving_color.rgb + (hash(floor(tile)) - 0.5) * 0.028 - joint * 0.075;
}

void vertex() {
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	local_position = VERTEX;
}

void fragment() {
	vec2 p = world_position.xz;
	float broad = noise_field(p * 0.28);
	float aa = max(length(fwidth(p)), 0.006);
	vec3 color;
	if (surface_kind == 0) {
		// A chamfered courtyard has an authored perimeter, not a noisy painted mask.
		vec2 yard_point = p - vec2(-0.10, 1.65);
		float yard = max(box_distance(yard_point, vec2(4.50, 3.95)), (abs(yard_point.x) + abs(yard_point.y) - 7.65) * 0.7071);
		float service_path = box_distance(p - vec2(-0.20, -1.65), vec2(9.50, 0.80));
		float ground_distance = min(yard, service_path);
		vec3 meadow = grass_color.rgb * (0.93 + smoothstep(0.22, 0.8, broad) * 0.13);
		vec3 courtyard = earth_color.rgb + (broad - 0.5) * 0.023 + (noise_field(p * 4.0) - 0.5) * 0.012;
		color = mix(meadow, courtyard, fill(ground_distance, aa));
		float border = stripe(ground_distance + 0.10, 0.085, aa);
		float entrance_gate = fill(box_distance(p - vec2(0, -2.3), vec2(2.9, 0.45)), aa);
		color = mix(color, paving_color.rgb * 0.91, border * (1.0 - entrance_gate));
		// Large communal pavers and a side boarding platform share a quiet material.
		float living_distance = box_distance(p - vec2(1.15, 1.65), vec2(2.8, 2.2));
		float assembly_distance = box_distance(p - vec2(-3.6, 3.65), vec2(1.35, 2.1));
		float paved_distance = min(living_distance, assembly_distance);
		color = mix(color, paving(p, vec2(1.2, 0.8), aa), fill(paved_distance, aa));
		color = mix(color, asphalt_color.rgb * 1.22, stripe(paved_distance + 0.075, 0.06, aa) * 0.50);
		vec2 patch = p * 2.5;
		vec2 cell = fract(patch) - 0.5;
		float tuft = stripe(cell.x + cell.y * 0.35, 0.035, aa * 2.0) * stripe(cell.y, 0.14, aa * 2.0);
		tuft *= step(0.96, hash(floor(patch))) * (1.0 - smoothstep(0.028, 0.09, aa));
		color += tuft * (1.0 - fill(ground_distance + 0.1, aa)) * vec3(0.025, 0.030, 0.014);
	} else if (surface_kind == 1) {
		color = paving(p, vec2(1.2, 0.8), aa);
		float border = smoothstep(2.78, 2.84, abs(local_position.x));
		color = mix(color, asphalt_color.rgb * 1.35, border * 0.65);
	} else {
		color = asphalt_color.rgb + (broad - 0.5) * 0.014;
		float marking = 0.0;
		if (surface_kind == 2) {
			vec2 q = local_position.xz;
			marking = stripe(abs(q.x) - 1.64, 0.035, aa) * fill(abs(q.y + 0.8) - 3.45, aa);
			marking = max(marking, stripe(q.y + 4.25, 0.035, aa) * fill(abs(q.x) - 1.64, aa));
			// A single forward arrow leaves a readable, uncluttered departure lane.
			vec2 arrow = q - vec2(0, 3.9);
			float stem = fill(box_distance(arrow + vec2(0, 0.25), vec2(0.085, 0.4)), aa);
			float tip = fill(max(abs(arrow.x) + arrow.y * 0.8 - 0.44, max(-arrow.y, arrow.y - 0.56)), aa);
			marking = max(marking, max(stem, tip));
			float edge = stripe(abs(q.x) - 2.12, 0.055, aa);
			color = mix(color, paving_color.rgb * 0.84, edge * 0.60);
		} else {
			float junction = fill(abs(p.x + 7.15) - 2.25, aa) * step(local_position.z, 0.0);
			marking = stripe(abs(local_position.z) - 2.30, 0.035, aa) * (1.0 - junction) * 0.6;
			marking = max(marking, stripe(local_position.z, 0.04, aa) * fill(mod(p.x, 3.4) - 1.6, aa));
		}
		color = mix(color, paving_color.rgb, marking * 0.86);
	}
	float contact = 0.0;
	for (int i = 0; i < 4; i++) {
		vec2 foot = (p - contacts[i].xz) / vec2(0.43, 0.32);
		contact = max(contact, (1.0 - smoothstep(0.0, 1.0, length(foot))) * contacts[i].w * 0.43);
	}
	vec2 car = p - vehicle_contact.xz;
	float cs = cos(vehicle_yaw);
	float sn = sin(vehicle_yaw);
	car = mat2(vec2(cs, sn), vec2(-sn, cs)) * car;
	contact = max(contact, (1.0 - smoothstep(-0.28, 0.4, box_distance(car, vec2(0.95, 2.28)))) * 0.30);
	ALBEDO = color * mix(vec3(1.0), vec3(0.48, 0.55, 0.72), contact);
	ROUGHNESS = 1.0;
}

void light() {
	float facing = dot(NORMAL, LIGHT);
	float band = 0.34 + 0.43 * smoothstep(-0.09, 0.09, facing) + 0.23 * smoothstep(0.55, 0.70, facing);
	DIFFUSE_LIGHT += LIGHT_COLOR * mix(vec3(0.74, 0.79, 0.94), vec3(1.0), smoothstep(0.0, 0.8, facing)) * band * ATTENUATION / PI;
}
