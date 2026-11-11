# Сцена 25 «Кроссовки у двери»: вид сверху на квартиру. Выполняется в Blender через MCP
# (tools/blender_run.py). Строит сцену, сохраняет .blend, рендерит превью и выгружает
# экранные координаты объектов (для выносок в Remotion). Без текста в кадре.
import bpy, bmesh, math, json, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = ARGS["dir"]
FRAMES = int(ARGS.get("frames", 84))
sc = bpy.context.scene
for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials):
    bpy.data.materials.remove(m)

def hexrgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)  # sRGB → linear

def mat(name, hexc, rough=0.9, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*hexrgb(hexc), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    for key in ("Specular IOR Level", "Specular"):
        if key in b.inputs: b.inputs[key].default_value = 0.2
    if emit:
        b.inputs["Emission Color" if "Emission Color" in b.inputs else "Emission"].default_value = (*hexrgb(hexc), 1)
        b.inputs["Emission Strength"].default_value = emit
    return m

def box(name, size, loc, material, bevel=0.03):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect="EDGES")
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = loc
    me.materials.append(material); sc.collection.objects.link(ob)
    return ob

def cyl(name, r, h, loc, material, verts=24):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=h)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = loc
    me.materials.append(material); sc.collection.objects.link(ob)
    return ob

def sphere(name, r, loc, material, scale=(1, 1, 1)):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = loc; ob.scale = scale
    me.materials.append(material); sc.collection.objects.link(ob)
    return ob

# --- палитра «Режим» ---
PAPER, SKY, FOG, SAGE, OLIVE, DAWN = "#F6F2E7", "#F3E3C3", "#ADC0C2", "#8A9A6B", "#3B3D24", "#E8833A"
WOOD, HOODIE = "#B98A5E", "#C8662E"
mPaper, mSky, mFog, mSage, mOlive, mDawn = (mat(n, c) for n, c in
    [("paper", PAPER), ("sky", SKY), ("fog", FOG), ("sage", SAGE), ("olive", OLIVE), ("dawn", DAWN)])
mWood, mWall, mFloor = mat("wood", WOOD), mat("wall", "#E9DDBF"), mat("floor", "#D9CBA6")
mWhite, mScreen, mDark = mat("white", "#EDE6D6"), mat("screen", "#5AA9FF", emit=1.5), mat("dark", "#2A2C33")

# --- план: X — ширина (6 м), Y — длина (8 м) ---
W, L, T, H = 6.0, 8.0, 0.14, 1.0
box("floor", (W + 1, L + 1, 0.1), (0, 0, -0.05), mFloor, bevel=0)
box("hall_floor", (2.2, 3.2, 0.012), (1.9, 2.4, 0.006), mPaper, bevel=0)
walls = [
    ((W, T, H), (0, -L / 2, H / 2)), ((W, T, H), (0, L / 2, H / 2)),
    ((T, L, H), (-W / 2, 0, H / 2)), ((T, L, H), (W / 2, 0, H / 2)),
    # внутренняя стена: спальня (низ) | коридор (верх-право), проём к двери
    ((3.0, T, H), (-1.5, 0.8, H / 2)), ((0.9, T, H), (2.55, 0.8, H / 2)),
    ((T, 3.2, H), (0.8, 2.4, H / 2)),
]
for i, (s, l) in enumerate(walls):
    box(f"wall{i}", s, l, mWall, bevel=0.02)
    box(f"wallcap{i}", (s[0] + 0.002, s[1] + 0.002, 0.03), (l[0], l[1], H + 0.015), mOlive, bevel=0)
# входная дверь в верхней стене коридора, приоткрыта
box("door_gap", (1.0, T + 0.02, H + 0.01), (1.9, L / 2, H / 2), mFloor, bevel=0)
box("door", (0.98, 0.08, 0.95), (1.9, L / 2 - 0.02, 0.475), mat("door", "#6F7C55"), bevel=0.02)  # закрыта
# спальня
box("bed", (1.5, 2.1, 0.45), (-1.9, -2.3, 0.225), mPaper)
box("blanket", (1.52, 1.4, 0.06), (-1.9, -2.6, 0.47), mFog)
box("pillow", (1.0, 0.4, 0.14), (-1.9, -1.45, 0.5), mWhite)
box("rug", (2.0, 1.4, 0.02), (0.2, -2.2, 0.01), mSage, bevel=0.01)
box("desk", (1.4, 0.7, 0.75), (1.9, -3.3, 0.375), mWood)
box("chair", (0.5, 0.5, 0.45), (1.9, -2.6, 0.225), mOlive)
cyl("pot", 0.22, 0.4, (2.55, -0.2, 0.2), mDawn)
sphere("plant", 0.42, (2.55, -0.2, 0.7), mat("leaf", "#505D36"), (1, 1, 0.9))
# гостиная (левая верхняя комната): диван и столик
box("sofa", (2.0, 0.85, 0.42), (-1.4, 3.45, 0.21), mSage)
box("sofa_back", (2.0, 0.22, 0.75), (-1.4, 3.85, 0.375), mat("sofaBack", "#76865A"))
box("table", (0.9, 0.55, 0.38), (-1.4, 2.3, 0.19), mWood)
box("rug2", (2.4, 1.6, 0.02), (-1.3, 2.6, 0.01), mFog, bevel=0.01)
# лежанка Луны у двери
cyl("dogbed", 0.4, 0.14, (2.55, 2.75, 0.07), mSage)
cyl("dogbed_in", 0.29, 0.15, (2.55, 2.75, 0.09), mPaper)
# кроссовки у двери (пара)
box("doormat", (0.9, 0.6, 0.015), (1.75, 3.4, 0.008), mDawn, bevel=0.01)
for i, dx in enumerate((-0.17, 0.17)):  # стилизованно крупнее, чтобы читались сверху
    box(f"sneaker{i}", (0.18, 0.44, 0.15), (1.75 + dx, 3.4, 0.095), mWhite, bevel=0.06)
    box(f"sole{i}", (0.19, 0.45, 0.035), (1.75 + dx, 3.4, 0.03), mat(f"soleM{i}", OLIVE), bevel=0.012)
# полка в коридоре с телефоном на зарядке
box("shelf", (0.3, 0.8, 0.9), (2.8, 1.45, 0.45), mWood)
phone = box("phone", (0.08, 0.15, 0.012), (2.8, 1.45, 0.91), mDark, bevel=0.004)
box("phone_screen", (0.065, 0.13, 0.004), (2.8, 1.45, 0.918), mScreen, bevel=0)
# путь кровать → дверь (кружки рассветного цвета)
pts = [(-1.0, -1.6), (-0.2, -1.0), (0.6, -0.4), (1.3, 0.3), (1.5, 1.1), (1.6, 1.9), (1.7, 2.7)]
for i, (x, y) in enumerate(pts):
    cyl(f"path{i}", 0.07, 0.012, (x, y, 0.02), mDawn, verts=16)

# --- свет: тёплое солнце с мягкими тенями + тёплый мир ---
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.2; sun.color = (1.0, 0.86, 0.68); sun.angle = math.radians(12)
so = bpy.data.objects.new("sun", sun); so.rotation_euler = (math.radians(40), math.radians(12), math.radians(-35))
sc.collection.objects.link(so)
world = sc.world or bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
nt = world.node_tree
bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (*hexrgb(SKY), 1); bg.inputs[1].default_value = 0.9
# дымка по глубине: объёмное рассеяние в мире
vol = nt.nodes.new("ShaderNodeVolumeScatter"); vol.inputs["Density"].default_value = 0.012
vol.inputs["Color"].default_value = (*hexrgb(PAPER), 1)
out = next(n for n in nt.nodes if n.type == "OUTPUT_WORLD")
nt.links.new(vol.outputs[0], out.inputs["Volume"])

# --- камера: сверху, медленный спуск и поворот ---
cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
cam_d.lens = 32; cam_d.sensor_fit = "VERTICAL"; cam_d.sensor_height = 36
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.2
focus = bpy.data.objects.new("focus", None); sc.collection.objects.link(focus)
cam_d.dof.focus_object = focus
track = cam.constraints.new("TRACK_TO"); track.target = focus; track.track_axis = "TRACK_NEGATIVE_Z"; track.up_axis = "UP_Y"
sc.frame_start, sc.frame_end = 1, FRAMES
for f, loc, foc in ((1, (-1.2, -4.4, 11.5), (0.0, -0.6, 0.3)), (FRAMES, (0.8, -0.6, 6.8), (1.6, 2.5, 0.2))):
    cam.location = loc; cam.keyframe_insert("location", frame=f)
    focus.location = foc; focus.keyframe_insert("location", frame=f)
for ob in (cam, focus):
    for fc in ob.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"; kp.easing = "EASE_IN_OUT"

# --- рендер ---
r = sc.render
try: r.engine = "BLENDER_EEVEE"
except TypeError: r.engine = "BLENDER_EEVEE_NEXT"
r.resolution_x, r.resolution_y, r.resolution_percentage = 1080, 1920, 100
r.fps = 30
r.image_settings.file_format = "PNG"; r.film_transparent = False
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
ee = sc.eevee
for k, v in (("taa_render_samples", 24), ("use_soft_shadows", True), ("use_gtao", True), ("gtao_distance", 0.6),
             ("use_volumetric_shadows", False), ("volumetric_end", 30.0), ("shadow_cube_size", "1024"),
             ("shadow_cascade_size", "2048")):
    if hasattr(ee, k): setattr(ee, k, v)

# экранные координаты объектов по кадрам (y сверху вниз, в пикселях кадра)
def screen(ob_loc):
    co = world_to_camera_view(sc, cam, Vector(ob_loc))
    return [round(co.x * 1080, 1), round((1 - co.y) * 1920, 1)]
track_pts = {"sneakers": (1.75, 3.4, 0.15), "phone": (2.8, 1.45, 0.92), "bed": (-1.9, -2.3, 0.5),
             "door": (1.9, 3.95, 0.5), "dogbed": (2.55, 2.75, 0.1)}
proj = {k: [] for k in track_pts}
for f in range(1, FRAMES + 1):
    sc.frame_set(f)
    for k, p in track_pts.items():
        proj[k].append(screen(p))
os.makedirs(OUT, exist_ok=True)
json.dump({"frames": FRAMES, "points": proj}, open(os.path.join(OUT, "apartment_points.json"), "w"))
sc.frame_set(FRAMES)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "apartment.blend"), copy=True)
r.filepath = os.path.join(OUT, "apartment_preview.png")
bpy.ops.render.render(write_still=True)
print("OK apartment", r.engine, FRAMES)
