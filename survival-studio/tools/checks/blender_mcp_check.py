"""Проверка Blender MCP: через MCP-сервер blender-mcp строит куб на плоскости
и рендерит кадр 1280x720 (Eevee) в tools/checks/blender_cube.png."""
import asyncio, os, json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

OUT = os.path.abspath("tools/checks/blender_cube.png")
CODE = f'''
import bpy, bmesh, math
sc = bpy.context.scene
for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
try: sc.render.engine = "BLENDER_EEVEE"
except TypeError: sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1280, 720, 100
sc.render.filepath = r"{OUT}"
sc.render.image_settings.file_format = "PNG"
def mat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = 0.9; b.inputs["Metallic"].default_value = 0.0
    return m
def mesh_obj(name, build, material, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); build(bm); bm.to_mesh(me); bm.free()
    me.materials.append(material); ob = bpy.data.objects.new(name, me); ob.location = loc
    sc.collection.objects.link(ob); return ob
mesh_obj("Ground", lambda bm: bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14), mat("Field", (0.19, 0.25, 0.09)))
mesh_obj("Cube", lambda bm: bmesh.ops.create_cube(bm, size=2), mat("Barn", (0.40, 0.03, 0.02)), (0, 0, 1))
sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = 4; sun.color = (1.0, 0.86, 0.68)
so = bpy.data.objects.new("Sun", sun); so.rotation_euler = (math.radians(50), 0, math.radians(35)); sc.collection.objects.link(so)
cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
cam.location = (8, -8, 5.5)
tc = cam.constraints.new("TRACK_TO"); tc.target = bpy.data.objects["Cube"]; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
cam.data.lens = 40
sc.collection.objects.link(cam); sc.camera = cam
w = sc.world or bpy.data.worlds.new("Sky"); sc.world = w; w.use_nodes = True
next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (0.74, 0.73, 0.56, 1)
bpy.ops.render.render(write_still=True)
print("RENDERED", sc.render.filepath)
'''

async def main():
    params = StdioServerParameters(command="uvx", args=["blender-mcp"], env=dict(os.environ))
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = [t.name for t in (await s.list_tools()).tools]
            print("MCP tools:", len(tools), "| execute_blender_code" in " | ".join(tools) or tools[:8])
            info = await s.call_tool("get_scene_info", {})
            print("scene_info:", info.content[0].text[:120].replace("\n", " "))
            res = await s.call_tool("execute_blender_code", {"code": CODE})
            print("execute:", res.content[0].text[:300])

asyncio.run(main())
