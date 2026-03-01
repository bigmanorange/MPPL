# main-bot.py
# MAAVIS TALENT HUB - Main Control Bot (NGROK VERSION)

import os
import asyncio
import subprocess
import json
from pathlib import Path
from typing import Dict, Any

import discord
from discord.ext import commands
from discord import app_commands
from dotenv import load_dotenv
import requests

load_dotenv()

# ────────────────────────────────────────────────
# CONFIG
# ────────────────────────────────────────────────
TOKEN = os.getenv("DISCORD_TOKEN_MAIN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
OWNER_ID = int(os.getenv("DISCORD_OWNER_ID", "0"))

# Project paths (SAFE — no cwd crashes)
APP_DIR = Path(__file__).resolve().parent
ECOSYSTEM_FILE = APP_DIR / "ecosystem-maavis.config.cjs"
AUTO_UPDATE_SCRIPT = APP_DIR / "auto-update.sh"

SECOND_PM2_HOME = Path.home() / ".pm2-maavis"
PM2_CMD = f"PM2_HOME={SECOND_PM2_HOME} pm2"

# ────────────────────────────────────────────────
# SAFE PM2 RUNNER
# ────────────────────────────────────────────────
def run_pm2(args: str, timeout: int = 20) -> Dict[str, Any]:
    try:
        result = subprocess.run(
            f"{PM2_CMD} {args}",
            shell=True,
            capture_output=True,
            text=True,
            cwd=str(APP_DIR),   # ⭐ fixes cwd ENOENT forever
            timeout=timeout,
        )

        return {
            "success": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }

    except Exception as e:
        return {"success": False, "stdout": "", "stderr": str(e)}


# ────────────────────────────────────────────────
# NGROK URL FETCHER (NO LOG PARSING)
# ────────────────────────────────────────────────
def get_ngrok_url() -> str:
    try:
        r = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=3)
        data = r.json()

        for tunnel in data.get("tunnels", []):
            if tunnel.get("proto") == "https":
                return tunnel.get("public_url")

        return "Tunnel running but URL not found"

    except Exception:
        return "Tunnel not running"


# ────────────────────────────────────────────────
# DISCORD BOT SETUP
# ────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)


def is_owner(interaction: discord.Interaction):
    return OWNER_ID == 0 or interaction.user.id == OWNER_ID


@bot.event
async def on_ready():
    print(f"MAAVIS Main Bot Online → {bot.user}")

    try:
        if GUILD_ID:
            guild = discord.Object(id=GUILD_ID)
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
        else:
            await bot.tree.sync()

        print("Commands synced.")
    except Exception as e:
        print("Sync error:", e)


# ────────────────────────────────────────────────
# COMMANDS
# ────────────────────────────────────────────────

@bot.tree.command(name="maavis_start", description="Start website + ngrok")
async def maavis_start(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()

    if not ECOSYSTEM_FILE.exists():
        await interaction.followup.send("❌ ecosystem file missing.")
        return

    res = run_pm2(f"start {ECOSYSTEM_FILE}")

    if res["success"]:
        await interaction.followup.send("✅ MAAVIS started.")
    else:
        await interaction.followup.send(f"❌ {res['stderr']}")


@bot.tree.command(name="maavis_stop", description="Stop MAAVIS services")
async def maavis_stop(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()

    res = run_pm2("delete all")

    msg = "🛑 Stopped." if res["success"] else f"❌ {res['stderr']}"
    await interaction.followup.send(msg)


@bot.tree.command(name="maavis_restart", description="Restart MAAVIS")
async def maavis_restart(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()

    res = run_pm2("restart all")

    msg = "🔄 Restarted." if res["success"] else f"❌ {res['stderr']}"
    await interaction.followup.send(msg)


@bot.tree.command(name="maavis_status", description="Show MAAVIS status")
async def maavis_status(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()

    res = run_pm2("jlist")

    if not res["success"] or not res["stdout"]:
        await interaction.followup.send("❌ Maavis PM2 not running.")
        return

    try:
        processes = json.loads(res["stdout"])

        embed = discord.Embed(
            title="MAAVIS Status",
            color=discord.Color.blue()
        )

        for proc in processes:
            status = proc["pm2_env"]["status"]
            restarts = proc["pm2_env"]["restart_time"]

            emoji = "🟢" if status == "online" else "🔴"

            embed.add_field(
                name=f"{emoji} {proc['name']}",
                value=f"{status.capitalize()} • Restarts: {restarts}",
                inline=False,
            )

        embed.add_field(
            name="Public URL",
            value=get_ngrok_url(),
            inline=False,
        )

        await interaction.followup.send(embed=embed)

    except Exception as e:
        await interaction.followup.send(f"Parse error:\n```{e}```")


# ────────────────────────────────────────────────
# RUN
# ────────────────────────────────────────────────
if __name__ == "__main__":
    if not TOKEN:
        print("ERROR: DISCORD_TOKEN_MAIN missing")
    else:
        bot.run(TOKEN)
