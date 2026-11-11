# Сцена 33 «День 66»: утренний двор, камера плывёт вдоль дорожки. Выполняется в Blender через MCP.
# Скорость камеры = скорость шага 2D-героя: px_per_m * v_cam = WALK_PX_PER_FRAME * hero_scale.
import bpy, bmesh, math, json, os, random
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = ARGS["dir"]
FRAMES = int(ARGS.get("frames", 110))
HERO_SCALE = float(ARGS.get("hero_scale", 1.5))      # масштаб 2D-рига в кадре
WALK_PX = 150 / 24                                    # px рига за кадр (gait.ts WALK)
HERO_M = 1.75                                         # рост героя в метрах
PATH_Y_SCREEN = 1000                                  # где на экране линия дорожки (над зоной субтитров)
random.seed(66)

sc = bpy.context.scene
for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def hexrgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
def mat(name, hexc, rough=0.92):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*hexrgb(hexc), 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    for key in ("Specular IOR Level", "Specular"):
        if key in b.inputs: b.inputs[key].default_value = 0.15
    return m
def mesh(name, build, loc, material, rot=(0, 0, 0), smooth=True):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); build(bm); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = loc; ob.rotation_euler = rot
    me.materials.append(material); sc.collection.objects.link(ob); return ob
def box(name, size, loc, material, bevel=0.04):
    def b(bm):
        bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect="EDGES")
    return mesh(name, b, loc, material)
def cone(name, r1, r2, h, loc, material, seg=8):
    return mesh(name, lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h), loc, material, smooth=False)
def blob(name, r, loc, material, sc_=(1, 1, 1)):
    ob = mesh(name, lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=18, radius=r), loc, material, smooth=True)
    ob.scale = sc_; return ob

PAPER, SKY, FOG, SAGE, OLIVE, DAWN = "#F6F2E7", "#F3E3C3", "#ADC0C2", "#8A9A6B", "#3B3D24", "#E8833A"
mGround, mPath, mGrass = mat("ground", "#7E8E5F"), mat("path", "#E6DCC4"), mat("grass", "#6F7F51")
mHedge, mTrunk, mLeaf, mLeaf2 = mat("hedge", "#505D36"), mat("trunk", "#6B4E36"), mat("leaf", "#6F7F51"), mat("leaf2", "#8A9A6B")
mBld = [mat("bld0", "#E9DDBF"), mat("bld1", "#D9CDB0"), mat("bld2", "#C9C7B4")]
mWin, mWinLit, mRoof, mBench, mLamp = mat("win", "#ADC0C2"), mat("winlit", "#F3C98A"), mat("roof", OLIVE), mat("bench", "#B98A5E"), mat("lamp", OLIVE)

# Камера: высота 1.3 м, смотрит вдоль +Y; дорожка вдоль X на глубине D
cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.lens = 35; cam_d.sensor_fit = "VERTICAL"; cam_d.sensor_height = 36
focal_px = cam_d.lens / cam_d.sensor_height * 1920
px_per_m = HERO_SCALE * 340 / HERO_M
D = focal_px / px_per_m
CAM_H = 1.3
tilt = math.atan(CAM_H / D) - math.atan((PATH_Y_SCREEN - 960) / focal_px)
v_cam = WALK_PX * HERO_SCALE / px_per_m            # м/кадр
X0 = -v_cam * FRAMES / 2
cam.rotation_euler = (math.pi / 2 - tilt, 0, 0)
for f in (1, FRAMES):
    cam.location = (X0 + v_cam * (f - 1), -D, CAM_H); cam.keyframe_insert("location", frame=f)
for fc in cam.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = "LINEAR"  # постоянная скорость = скорость шага
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = D / math.cos(tilt); cam_d.dof.aperture_fstop = 2.0

# Земля, дорожка, трава
span = (X0 - 30, -X0 + 30)
box("ground", (90, 60, 0.2), (0, 10, -0.1), mGround, bevel=0)
box("path", (90, 1.8, 0.03), (0, 0.4, 0.015), mPath, bevel=0)
box("curb_f", (90, 0.12, 0.08), (0, -0.55, 0.04), mat("curb", "#CFC4A8"), bevel=0.01)
box("curb_b", (90, 0.12, 0.08), (0, 1.35, 0.04), mat("curb2", "#CFC4A8"), bevel=0.01)
# Передний план: живая изгородь (размыта глубиной резкости)
for i in range(16):
    x = X0 - 8 + i * 1.6 + random.uniform(-0.3, 0.3)
    blob(f"hedgeF{i}", 0.45, (x, -D + 1.7 + random.uniform(-0.15, 0.15), 0.12), mHedge, (1.4, 0.9, 0.7))
# Средний план: скамейки, фонари, деревья
for i, x in enumerate((-6, 0.5, 7)):
    box(f"bench{i}", (1.6, 0.45, 0.08), (x, 2.2, 0.45), mBench); box(f"benchB{i}", (1.6, 0.08, 0.4), (x, 2.42, 0.75), mBench)
    for dx in (-0.65, 0.65): box(f"benchL{i}{dx}", (0.08, 0.4, 0.45), (x + dx, 2.2, 0.22), mLamp, bevel=0.01)
for i, x in enumerate((-9, -3, 3.5, 10)):
    cone(f"lampP{i}", 0.06, 0.05, 3.2, (x, 1.9, 1.6), mLamp, seg=10); blob(f"lampH{i}", 0.2, (x, 1.9, 3.25), mat(f"lampG{i}", "#F3E3C3"))
for i in range(9):
    x = X0 - 10 + i * 4.2 + random.uniform(-0.8, 0.8); y = 3.6 + random.uniform(0, 1.5); h = random.uniform(2.6, 3.6)
    cone(f"trunk{i}", 0.13, 0.09, h * 0.5, (x, y, h * 0.25), mTrunk, seg=16)
    blob(f"crown{i}", random.uniform(1.0, 1.4), (x, y, h * 0.62), mLeaf if i % 2 else mLeaf2, (1, 1, 1.15))
# Дальний план: дома с окнами (без надписей)
for i in range(7):
    x = X0 - 14 + i * 7.5; w = random.uniform(5.5, 7.0); h = random.uniform(9, 15); y = 13 + random.uniform(0, 3)
    box(f"bld{i}", (w, 4, h), (x, y, h / 2), mBld[i % 3], bevel=0.05); box(f"roof{i}", (w + 0.2, 4.2, 0.3), (x, y, h + 0.15), mRoof, bevel=0.02)
    rows, cols = int(h // 2.2), int(w // 1.6)
    for r_ in range(1, rows):
        for c in range(cols):
            lit = random.random() < 0.18
            box(f"w{i}_{r_}_{c}", (0.7, 0.05, 1.0), (x - w / 2 + 0.9 + c * 1.6, y - 2.02, r_ * 2.2), mWinLit if lit else mWin, bevel=0.01)

# Свет: низкое тёплое солнце сзади-слева (контровой), тёплый мир; дымка по глубине
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.0; sun.color = (1.0, 0.84, 0.64); sun.angle = math.radians(10)
so = bpy.data.objects.new("sun", sun); so.rotation_euler = (math.radians(70), 0, math.radians(200)); sc.collection.objects.link(so)
world = sc.world or bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
nt = world.node_tree; bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (*hexrgb(SKY), 1); bg.inputs[1].default_value = 1.0
vol = nt.nodes.new("ShaderNodeVolumeScatter"); vol.inputs["Density"].default_value = 0.035
vol.inputs["Color"].default_value = (*hexrgb(PAPER), 1)
nt.links.new(vol.outputs[0], next(n for n in nt.nodes if n.type == "OUTPUT_WORLD").inputs["Volume"])

r = sc.render
try: r.engine = "BLENDER_EEVEE"
except TypeError: r.engine = "BLENDER_EEVEE_NEXT"
r.resolution_x, r.resolution_y, r.resolution_percentage, r.fps = 1080, 1920, 100, 30
r.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
sc.frame_start, sc.frame_end = 1, FRAMES
ee = sc.eevee
for k, v in (("taa_render_samples", 24), ("use_soft_shadows", True), ("use_gtao", True), ("volumetric_end", 60.0),
             ("use_volumetric_shadows", False), ("shadow_cascade_size", "2048")):
    if hasattr(ee, k): setattr(ee, k, v)

# Контроль: экранная высота линии ходьбы (центр дорожки) и масштаб на ней
sc.frame_set(1)
mid = world_to_camera_view(sc, cam, Vector((cam.location.x, 0.4, 0)))
one = world_to_camera_view(sc, cam, Vector((cam.location.x + 1, 0.4, 0)))
info = {"frames": FRAMES, "hero_scale": HERO_SCALE, "walk_y": round((1 - mid.y) * 1920, 1),
        "walk_x_center": round(mid.x * 1080, 1), "px_per_m": round((one.x - mid.x) * 1080, 2),
        "ground_px_per_frame": round((one.x - mid.x) * 1080 * v_cam, 3), "hero_px_per_frame": round(WALK_PX * HERO_SCALE, 3)}
os.makedirs(OUT, exist_ok=True)
json.dump(info, open(os.path.join(OUT, "courtyard_info.json"), "w"), indent=1)
sc.frame_set(FRAMES // 2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "courtyard.blend"), copy=True)
r.filepath = os.path.join(OUT, "courtyard_preview.png"); bpy.ops.render.render(write_still=True)
print("OK courtyard", json.dumps(info))
