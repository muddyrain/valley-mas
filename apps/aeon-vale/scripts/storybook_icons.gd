extends RefCounted

# UI art has its own smooth vector vocabulary; the world keeps its pixel atlas.
const Catalog = preload("res://scripts/plant_catalog.gd")
static var cache: Dictionary = {}

static func _texture(key: String, body: String) -> ImageTexture:
	if cache.has(key): return cache[key]
	var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 64 64"><defs><linearGradient id="leaf" x2=".8" y2="1"><stop stop-color="#c8dfa3"/><stop offset="1" stop-color="#559878"/></linearGradient><linearGradient id="gold" x2=".7" y2="1"><stop stop-color="#fff0bd"/><stop offset="1" stop-color="#b89758"/></linearGradient><linearGradient id="water" x2=".8" y2="1"><stop stop-color="#bce9de"/><stop offset="1" stop-color="#539ca6"/></linearGradient><linearGradient id="paper" x2=".5" y2="1"><stop stop-color="#fffbee"/><stop offset="1" stop-color="#e2dcba"/></linearGradient></defs><g stroke="#577667" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">' + body + '</g></svg>'
	var image = Image.new()
	var error = image.load_svg_from_string(svg)
	if error != OK: push_error("Could not draw interface icon: " + key)
	var result = ImageTexture.create_from_image(image)
	cache[key] = result
	return result

static func _spark(x: int = 51, y: int = 12) -> String:
	return '<path d="M%d %d l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="url(#gold)" stroke="#b59a68"/>' % [x,y]

static func texture(key: String) -> ImageTexture:
	if cache.has(key): return cache[key]
	var body = ''
	match key:
		"lightning": body = '<path d="M35 5L14 35h16l-6 24 29-36H36l8-18z" fill="url(#water)" stroke="#608e91" stroke-width="2"/>'+_spark(12,8)
		"fire": body = '<path d="M33 3q6 19 18 28 16 23-13 28Q2 60 12 33l9-14q-1 16 6 16 13-11 6-32z" fill="#d59065"/><path d="M32 31q15 14 7 23-20 6-18-8z" fill="#f6d69b" stroke="none"/>'
		"rain": body = '<path d="M10 32Q0 18 16 15 25-4 38 12 55 5 57 23q10 14-8 15H15z" fill="url(#paper)"/><path d="M17 44l-5 9 M33 45l-5 12 M50 44l-5 9" stroke="#65a9b1" stroke-width="4"/>'
		"acid_rain": body = '<path d="M10 31Q2 16 17 15 27 0 38 12 54 7 56 24q7 12-10 13H15z" fill="#a7bd6a" stroke="#617b52" stroke-width="2"/><path d="M18 40q-12 12-3 15 10 2 3-15M36 43q-12 12-3 15 10 2 3-15M52 40q-10 10-3 13 9 1 3-13" fill="#b9d769" stroke="#65884a" stroke-width="2"/>'
		"tornado": body = '<path d="M7 15q27-15 50 0Q50 27 11 24l6 9 32-3-9 12-15-1 7 15 4-11" fill="url(#water)"/><path d="M13 17q21 7 37-1 M21 29l23 1 M26 39h10" fill="none" stroke="#eef4df" stroke-width="2"/>'
		"earthquake": body = '<path d="M5 35L25 15l10 10 20-7 5 25-23 14-32-7z" fill="url(#gold)"/><path d="M35 13l-12 17 16 2-13 21 9 6" stroke="#725f51" stroke-width="4" fill="none"/>'
		"warm", "cold": body = '<path d="M20 42V13q0-9 9-9t9 9v29a13 13 0 1 1-18 0z" fill="url(#paper)"/><path d="M29 18v29" stroke="%s" stroke-width="5"/><circle cx="29" cy="49" r="7" fill="%s"/><path d="M48 20v23m-6-6 6 6 6-6" fill="none" stroke="#8e9c83" stroke-width="3"/>' % (['#ce9771','#ce9771'] if key == 'warm' else ['#7aa8bc','#7aa8bc'])
		"creatures": body = '<path d="M15 52q0-19 17-19t17 19z" fill="url(#leaf)"/><circle cx="32" cy="21" r="12" fill="url(#paper)"/><path d="M19 18q2-17 17-12 11 3 10 15l-12-8z" fill="url(#gold)"/>'+_spark(50,4)
		"paw": body = '<ellipse cx="32" cy="42" rx="17" ry="14" fill="url(#gold)"/><ellipse cx="13" cy="24" rx="6" ry="9" fill="url(#leaf)"/><ellipse cx="27" cy="15" rx="6" ry="9" fill="url(#leaf)"/><ellipse cx="42" cy="17" rx="6" ry="9" fill="url(#leaf)"/><ellipse cx="53" cy="29" rx="6" ry="9" fill="url(#leaf)"/>'
		"monster": body = '<path d="M12 25L7 7l19 12 18-5 13-8-3 24q11 32-24 27Q2 53 12 25z" fill="url(#leaf)"/><path d="M19 32l10 3 M42 31l-7 4" stroke="#fff0b1" stroke-width="3"/>'
		"pause": body = '<rect x="18" y="12" width="10" height="37" rx="4" fill="url(#water)"/><rect x="36" y="12" width="10" height="37" rx="4" fill="url(#water)"/><path d="M21 17v24 M39 17v24" stroke="#ecfff0" stroke-width="2"/>'
		"play": body = '<path d="M20 12 Q18 10 18 17 V48 Q18 53 23 50 L49 34 Q52 32 48 29z" fill="url(#leaf)"/><path d="M24 20v21" stroke="#edffd3" stroke-width="2"/>'
		"speed": body = '<path d="M18 12 C18 24 23 27 30 32 C22 36 18 43 18 53 H46 C46 42 41 36 34 32 C42 25 46 22 46 12z" fill="url(#water)"/><path d="M21 17h22 L33 29h-2z M21 49l11-12 11 12z" fill="url(#gold)" stroke="#c5a867"/><path d="M32 29v13" stroke="#ffe7a2" stroke-width="2"/><path d="M15 9h34v5H15z M15 51h34v5H15z" fill="url(#gold)"/><path d="M21 18v6" stroke="#fffbee" stroke-width="2"/>'
		"new", "world": body = '<circle cx="30" cy="33" r="22" fill="url(#water)"/><path d="M15 17l9-4 12 4 -4 6 8 5 -7 8 -10-4 -4 8 -8-7 2-9z M37 42l10-4 2 7 -11 7z" fill="url(#leaf)"/><path d="M17 18q-8 12-4 22" stroke="#eff9df" stroke-width="2" fill="none"/><path d="M6 46q23 19 49-10" stroke="#c2a16b" stroke-width="2" fill="none"/>' + (_spark(51,4) if key == "new" else '')
		"save", "load", "home", "book":
			body = '<path d="M10 16q12-6 22 1 12-7 22-1v37q-11-5-22 0-12-5-22 0z" fill="url(#paper)"/><path d="M7 15v40q12-3 25 1 13-4 25-1V15" fill="none" stroke="#b79e69" stroke-width="3"/><path d="M32 18v33 M16 24l9 1 M16 30l9 1 M39 24l9-1 M39 30l9-1" fill="none" stroke="#bdc4a1"/>'
			if key in ["save", "load"]:
				body += '<path d="M32 7v21 m-7-6 7 7 7-7" fill="none" stroke="#488b74" stroke-width="4" transform="%s"/>' % ('translate(0 37) scale(1 -1)' if key == "load" else '')
			else: body += '<path d="M30 23q-12-11-15-2 5 11 15 7 M32 26q4-13 12-9-1 11-12 14" fill="url(#leaf)"/>'
		"back": body = '<path d="M27 14L10 30l17 16V35h11q9 0 13 13 5-25-13-25H27z" fill="url(#gold)"/><path d="M15 30l10-9" stroke="#fffbea" stroke-width="2"/>'
		"settings": body = '<path d="M26 7h12l2 8 7 4 8-2 6 10-6 6 0 7 4 6-8 8-8-4-7 3-3 7-11-2-1-9-6-5-8 0-3-11 7-5 1-7-4-7 9-7 7 4z" transform="translate(2 1) scale(.9)" fill="url(#gold)"/><circle cx="31" cy="31" r="14" fill="url(#paper)"/><circle cx="31" cy="31" r="8" fill="url(#leaf)"/><path d="M28 29l5-3" stroke="#ecffd0" stroke-width="2"/>'
		"fit", "photo", "observe": body = '<path d="M4 32Q31 5 60 32 31 60 4 32z" fill="url(#paper)"/><circle cx="32" cy="32" r="13" fill="url(#water)"/><circle cx="32" cy="32" r="6" fill="#496d60"/><circle cx="28" cy="27" r="3" fill="#fbffec" stroke="none"/>' + _spark(48,6)
		"tree", "forest", "nature": body = _plant(1) + (_spark(51,6) if key == "nature" else '')
		"dead_tree": body = '<ellipse cx="32" cy="55" rx="19" ry="4" fill="#c7c6a9" opacity=".5" stroke="none"/><path d="M27 56l3-24-2-19 6 1 1 18 4 23z" fill="url(#gold)"/><path d="M31 37L17 28 13 16 M20 30l-9-2 M33 29l12-11 5-12 M42 22l12 2 M30 21l-7-9" stroke="#ac936b" stroke-width="3" fill="none"/>'
		"seed": body = '<path d="M12 49q20 11 40 0l-2 7H14z" fill="url(#gold)"/><path d="M31 49Q34 29 26 24" fill="none" stroke="#56836a" stroke-width="3"/><path d="M30 33Q5 34 13 13 33 15 30 33z M32 30Q35 9 52 15 52 32 32 35z" fill="url(#leaf)"/><path d="M17 19l11 11 M45 21l-11 9" stroke="#f1f3b7"/>' + _spark(52,35)
		"fertilizer", "tree_fertilizer": body = '<path d="M21 18h22l6 34q-16 9-34 0z" fill="url(#paper)"/><path d="M20 12q13-4 24 0l-2 7H22z" fill="url(#gold)"/><path d="M22 24l-3 23" stroke="#fffef2" stroke-width="3"/><circle cx="32" cy="37" r="10" fill="#d5e3ba" stroke="#b0c099"/>' + ('<path d="M32 26l-8 13h5l-5 5h16l-5-5h5z M32 43v6" fill="#54886b"/>' if key == "tree_fertilizer" else '<path d="M32 45V32 M32 36q-12-1-9-8 10 0 9 8 M32 40q10-1 10-8-9 0-10 8" fill="url(#leaf)"/>') + _spark(10,9)
		"erase": body = '<path d="M40 9l7 4-21 31-8-5z" fill="url(#gold)"/><path d="M18 34l14 10-6 14-19-13z" fill="url(#paper)"/><path d="M14 40l12 9 M11 44l12 9" stroke="#bdc7a3"/>' + _spark(51,28)
		"brush": body = '<path d="M40 6l8 5-22 34-8-5z" fill="url(#gold)"/><path d="M20 36q-13 0-10 12-1 8-6 8 19 8 25-10z" fill="url(#leaf)"/>'
		"terrain": body = '<path d="M5 48l19-35 14 21 9-14 14 30z" fill="#8bb79c"/><path d="M24 13l-9 17 10-4 10 7z" fill="url(#paper)"/><path d="M24 28l-8 20h23z" fill="#608975"/><path d="M8 51q27 7 48 0" fill="none" stroke="#bba16c" stroke-width="3"/>' + _spark(46,3)
		"close": body = '<path d="M16 16l32 32 M48 16L16 48" stroke="#a05748" stroke-width="5"/>'
		"checked", "unchecked": body = '<rect x="12" y="12" width="40" height="40" rx="12" fill="%s" stroke="#9eaf8b" stroke-width="3"/>' % ('url(#leaf)' if key == "checked" else 'url(#paper)') + ('<path d="M22 32l7 7 15-16" stroke="#fffcec" stroke-width="4" fill="none"/>' if key == "checked" else '')
		"knob": body = '<circle cx="32" cy="32" r="22" fill="url(#paper)" stroke="#b39d6e" stroke-width="4"/><path d="M32 18l5 10 10 4-10 4-5 10-5-10-10-4 10-4z" fill="url(#leaf)" stroke="none"/>'
		"arrow": body = '<path d="M19 25l13 14 13-14" fill="none" stroke="#64806b" stroke-width="5"/>'
		_: body = _spark(32,22)
	return _texture(key, body)

static func _plant(species: int) -> String:
	var green = '#' + Catalog.leaf_color(species).lightened(0.17).to_html(false)
	var body = '<ellipse cx="32" cy="55" rx="20" ry="4" fill="#728d62" opacity=".18" stroke="none"/>'
	if species in [58,59,60]:
		return body+'<path d="M12 45L5 23l10-9 11 19 6-29 12 11-2 22 13-15 7 10-17 24H23z" fill="%s"/><path d="M32 4l3 34 9-23 M15 14l2 22 9-3 M55 22L42 48" fill="none" stroke="#e5e1f5" stroke-width="2"/>' % green
	if species in [61,62]:
		return body+'<path d="M30 56V28 M30 42L14 23 M30 37l17-19" fill="none" stroke="#799b79" stroke-width="4"/><path d="M14 9l10 13-10 12L4 22z M32 4l10 13-10 12-10-12z M49 9l11 13-11 12-11-12z" fill="%s"/><path d="M14 9v25 M32 4v25 M49 9v25" stroke="#e0efb9" fill="none"/>' % green
	if species in [55,56,57,63]:
		return body+'<path d="M30 54V24 M30 41L15 24 M32 34l14-14" fill="none" stroke="#b09972" stroke-width="4"/><path d="M8 30Q1 13 20 15 20-1 36 8 48 1 50 19 65 20 52 36 38 43 28 34 17 43 8 30z" fill="%s"/><circle cx="17" cy="27" r="4" fill="#f7dc89"/><circle cx="36" cy="17" r="4" fill="#f7dc89"/><circle cx="47" cy="30" r="4" fill="#f7dc89"/>' % green
	if species == 51:
		return body+'<path d="M22 55V8 M33 55V17 M44 55V5" stroke="#89a477" stroke-width="5"/><path d="M19 16h6m-6 12h6m-6 12h6m16-27h6m-6 12h6m-6 12h6" stroke="#dae5b1" stroke-width="2"/><path d="M22 25Q5 5 7 22z M33 33Q13 20 15 34z M44 18Q63 3 56 21z M44 36Q64 22 57 39z" fill="url(#leaf)"/>'
	if species in [52,53]:
		return body+'<path d="M31 55V25" stroke="#a7a16f" stroke-width="5"/><path d="M32 28Q5 1 9 26 14 35 32 31Q4 29 10 48 24 46 32 32Q52 3 57 22 55 33 33 31Q66 28 54 49 45 44 33 33Q22-3 37 6L32 28" fill="url(#leaf)"/>'
	if species in [13,14]: return body + '<path d="M8 47l9-20 15-7 22 18-5 15-28 3z" fill="#b4c4b3"/><path d="M17 27l15-7-5 22-19 5 M27 42l22 11" fill="#d6deca"/>'
	if Catalog.is_tree(species) and species != 10:
		body += '<path d="M28 54l2-31h5l2 31z M32 39L21 30 M33 33l10-12" fill="%s" stroke="#9f8c69" stroke-width="2"/>' % ('#eee8cb' if species == 2 else '#bda172')
		if species in [3,4,11,24,28,29,30,33]:
			var width = 12 if species in [11,33] else 19
			for layer in range(3):
				var y = 6 + layer * 9
				var w = width - (2-layer) * 3
				body += '<path d="M32 %d Q%d %d %d %d Q32 %d %d %d Q%d %d 32 %d" fill="%s"/>' % [y,32-w/2,y+12,32-w,y+19,y+24,32+w,y+19,32+w/2,y+12,y,green]
			if species == 4: body += '<path d="M32 6l-7 14 7-3 7 3z M22 32l9-5 8 5" fill="#f9f5df" stroke="#ecf0d7"/>'
		elif species == 9:
			body += '<path d="M32 22Q10 2 7 27 20 17 32 24 Q13 24 11 43 22 28 32 25 Q43 3 56 22 43 16 33 25 Q61 23 55 41 45 28 32 26 Q27 2 37 5L33 24" fill="url(#leaf)"/>'
		elif species == 12:
			body += '<path d="M10 38Q4 9 31 9 60 8 55 44 L49 31 47 48 40 31 37 47 30 25 25 43 20 26 17 43z" fill="%s"/><path d="M20 18l-3 16 M32 15l5 20 M44 19l5 16" stroke="#dbe6ab" fill="none"/>' % green
		elif species == 26:
			body += '<path d="M31 39Q6 28 10 13 15 7 21 10 27 1 32 9 40 1 44 11 55 7 56 20 52 35 31 39z" fill="#d9c878"/><path d="M32 36L20 15 M32 36V13 M32 36l13-20" stroke="#f6e2ac" fill="none"/>'
		elif species in [5,27]:
			body += '<path d="M32 6l6 11 9-4-1 12 10 2-8 8 2 9-13-2-5 8-5-8-12 2 2-9-9-8 11-2-1-12 9 4z" fill="%s"/><path d="M32 16v28 M20 29l12 8 12-8" stroke="#f5d6a0" fill="none"/>' % green
		else:
			var spread = 22 if species in [1,6,22,25,32] else 17
			var height = 17 if species in [2,21,23,31] else 23
			body += '<path d="M%d 34Q5 21 18 19Q17 7 30 10Q42 4 47 18Q60 19 54 32Q55 43 40 42Q28 49 19 41Q%d 42 %d 34z" transform="translate(32 27) scale(%s %s) translate(-32 -27)" fill="%s"/>' % [12,7,12,spread/22.0,height/21.0,green]
			body += '<path d="M18 24Q23 15 30 18 M36 16q8-2 11 6 M16 32q4 7 10 6" fill="none" stroke="#f0f0c1" stroke-width="2" opacity=".6"/>'
			if species in [7,34]:
				for p in [Vector2(20,24),Vector2(35,18),Vector2(43,31),Vector2(29,34)]: body += _flower(p.x,p.y,'#fff1da' if species == 34 else '#f6d0cc',4)
		if species == 2: body += '<path d="M30 46h4 M31 51h4" stroke="#717f69"/>'
	elif species == 10:
		body += '<path d="M28 54V17q0-9 8-9 7 1 7 9v12h3V18q7-5 8 2v15q0 7-11 7v12z M29 37Q12 40 12 27v-9q7-5 8 2v9h8" fill="url(#leaf)"/><path d="M33 16v33 M16 22v8 M49 25v8" stroke="#e7e8ae"/>'
	elif species in [8,50,54]:
		body += '<path d="M29 52l1-23h6l3 23z" fill="url(#paper)"/><path d="M8 31Q12 4 33 7 51 9 57 33Q32 42 8 31z" fill="%s"/><path d="M14 31q19 8 37 1" fill="none" stroke="#ebddd6" stroke-width="2"/><ellipse cx="23" cy="19" rx="5" ry="3" fill="#fff0d2"/><circle cx="40" cy="24" r="3" fill="#fff0d2"/>' % ('#9cafcd' if species == 50 else '#cfa28c')
	elif species in [16,19,20,40,45,49]:
		body += '<path d="M8 49Q4 35 15 34 10 20 25 26 27 10 38 25 51 18 51 35 64 39 54 52z" fill="%s"/><path d="M22 50l9-18 7 19 M31 38l12-7" fill="none" stroke="#cbd4a4"/>' % green
		if species in [16,49]:
			for p in [Vector2(18,37),Vector2(36,30),Vector2(47,43)]: body += _flower(p.x,p.y,'#c28587',3)
	elif species in [43,44]:
		body += '<path d="M32 54Q7 46 6 24 22 28 29 43 Q18 23 26 9 36 23 33 42 Q41 13 53 15 50 36 38 47 Q49 36 59 37 50 54 32 54z" fill="%s"/><path d="M14 30l18 22 M27 19l5 31 M46 24L34 51" stroke="#e2edc4" fill="none"/>' % green
	elif species == 35:
		for tilt in [-30,0,30]:
			body += '<g transform="rotate(%d 32 53)"><path d="M32 53Q24 28 32 10" fill="none" stroke="#77a176" stroke-width="2"/>' % tilt
			for y in range(20,45,7): body += '<path d="M30 %dQ16 %d 20 %dL30 %d Q44 %d 41 %dZ" fill="url(#leaf)"/>' % [y+5,y-7,y-8,y+2,y-10,y-4]
			body += '</g>'
	else:
		for j in range(5):
			var x = 14+j*9
			var y = 24+((species+j*7)%16)
			body += '<path d="M32 54Q%d 43 %d %d M%d 42q-11-9-8-13 10 3 8 13" fill="%s" stroke="#789774" stroke-width="1.6"/>' % [x,x,y,x,green]
			if species in [15,36,37,38,39,41,47]: body += _flower(x,y,['#fff0c6','#d6bbdc','#f0ae9b','#e6eac6'][species%4],3 if species == 38 else 5)
			elif species in [18,46]: body += '<path d="M%d %dv-10" stroke="#b5986b" stroke-width="5"/>' % [x,y+3]
	return body

static func _flower(x: float, y: float, color: String, radius: int) -> String:
	var result = '<g transform="translate(%s %s)" fill="%s" stroke="#b2ae88" stroke-width=".7">' % [x,y,color]
	for angle in range(0,360,72): result += '<ellipse cx="0" cy="-%d" rx="%s" ry="%d" transform="rotate(%d)"/>' % [radius,radius*.65,radius,angle]
	return result + '<circle r="2" fill="#e6bb66"/></g>'

static func plant_texture(species: int) -> ImageTexture:
	return _texture("plant_%d" % species, _plant(species))

static func biome_texture(biome: int) -> ImageTexture:
	var species = [17,1,5,4,10,12,7,2,29,32,53,51,15,54,55,60,61,63][biome]
	return _texture("biome_%d" % biome, '<ellipse cx="32" cy="53" rx="27" ry="8" fill="url(#gold)"/>' + _plant(species))

static func terrain_texture(type: int) -> ImageTexture:
	var colors = preload("res://scripts/world_data.gd").COLORS
	var color = '#' + colors[type].lightened(.2).to_html(false)
	if type in [4,5]: color="#d2a263" if type==4 else "#b88950"
	var body = '<path d="M7 29l25-14 25 14v16L32 59 7 45z" fill="url(#gold)"/><path d="M7 29l25-14 25 14-25 15z" fill="%s"/><path d="M32 44v15" fill="none" stroke="#b2a582"/>' % color
	if type in [0,1,2,12]:
		body += '<path d="M16 29q5-5 10 0t10 0 M28 36q5-5 10 0t10 0" fill="none" stroke="#e4f6e0" stroke-width="2"/>'
	elif type in [10,13]:
		body += '<path d="M16 32L30 5l20 31z" fill="#829b8c"/><path d="M30 5l-8 16 8-3 10 6z" fill="url(#paper)"/><path d="M30 19l-3 16h19z" fill="#688875"/>' if type == 10 else '<path d="M14 32Q26 8 37 28Q48 13 53 34" fill="url(#leaf)"/>'
	elif type in [4,5]: body += '<path d="M19 29l7-2 M32 34l8-3 M34 24l6 1" fill="none" stroke="#ecd4a0" stroke-width="2"/>'
	else: body += '<path d="M19 30l8-2 M32 33l9-3" stroke="#fff3cc" stroke-width="2"/>'
	return _texture("terrain_%d" % type, body)

static func brush_texture(shape: int, radius: int, extent: int = 40) -> ImageTexture:
	var key = "brush_%d_%d_%d" % [shape,radius,extent]
	if cache.has(key): return cache[key]
	var body = ''
	var size = 2.0+radius*1.25
	if shape == 0: body += '<circle cx="32" cy="32" r="%s" fill="#36584b" stroke="none"/>' % size
	elif shape == 1: body += '<rect x="%s" y="%s" width="%s" height="%s" fill="#36584b" stroke="none"/>' % [32-size,32-size,size*2,size*2]
	elif shape == 2: body += '<path d="M32 %sL%s 32 32 %s %s 32z" fill="#36584b" stroke="none"/>' % [32-size,32+size,32+size,32-size]
	else:
		for y in range(-16,17):
			for x in range(-16,17):
				if preload("res://scripts/brush_mask.gd").contains(Vector2i(x,y),radius,shape,Vector2i(x+32,y+32)):
					body += '<rect x="%s" y="%s" width="1.4" height="1.4" fill="#36584b" stroke="none"/>' % [32+x*1.4,32+y*1.4]
	var source = _texture(key+"_source",body).get_image()
	source.resize(extent,extent,Image.INTERPOLATE_LANCZOS)
	var result = ImageTexture.create_from_image(source)
	cache[key] = result
	return result
