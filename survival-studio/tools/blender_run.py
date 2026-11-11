"""Выполняет Python-скрипт в живом Blender через MCP-сервер blender-mcp (инструмент execute_blender_code).
Использование: .venv/bin/python tools/blender_run.py scene.py [--var KEY=VALUE ...]
Переменные подставляются в скрипт как глобальные (ARGS = {...})."""
import asyncio, json, os, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

path = sys.argv[1]
args = dict(a.split("=", 1) for a in sys.argv[2:] if "=" in a)
code = f"ARGS = {json.dumps(args)}\n" + open(path, encoding="utf-8").read()

async def main():
    params = StdioServerParameters(command="uvx", args=["blender-mcp"], env=dict(os.environ))
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            res = await s.call_tool("execute_blender_code", {"code": code})
            text = res.content[0].text
            print(text[-3000:])
            if "Error" in text[:200]:
                sys.exit(1)

asyncio.run(main())
