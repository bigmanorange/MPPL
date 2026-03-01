# main-bot.py
import os
import asyncio
import subprocess
import json
import re
from pathlib import Path
from typing import Dict, Any

import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()  # loads .env file (TOKEN, etc.)

# ────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────
TOKEN = os.getenv("MAIN_BOT_TOKEN") or os.getenv("TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID", "0"))  # optional: your server ID for faster command sync

SECOND_PM2_HOME = str(Path.home() / ".pm2-maavis")
PM2_SECOND_CMD = f'PM2_HOME={SECOND_PM2_HOME} pm2'

ECOSYSTEM_FILE = "ecosystem-maavis.config.js"  # must be in your project cwd when starting

PROJECT_DIR = "/Users/macbookpro/MPPLtesting"  # ← CHANGE TO YOUR ACTUAL FULL PATH

# ────────────────────────────────────────────────
# Helper: run PM2 command on SECOND instance only
# ────────────────────────────────────────────────
def run_second_pm2(args: str, timeout: int = 20) -> Dict[str, Any]:
    cmd = f"{PM2_SECOND_CMD} {args}"
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=PROJECT_DIR,  # important for relative paths in ecosystem
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "stdout": "", "stderr": "Command timed out"}
    except Exception as e:
        err_msg = str(e)
        if "Connection refused" in err_msg or "ECONNREFUSED" in err_msg or "not running" in err_msg.lower():
            # Daemon not running → try to start it lazily
            print("[MaavisControl] Second PM2 not running → attempting lazy start")
            start_res = run_second_pm2(f"start {ECOSYSTEM_FILE}")
            if start_res["success"]:
                # Give it a moment then retry original command
                asyncio.sleep(2)
                return run_second_pm2(args)
        return {"success": False, "stdout": "", "stderr": err_msg}

# ────────────────────────────────────────────────
# Try to extract CF quick tunnel URL from logs
# ────────────────────────────────────────────────
def get_cf_tunnel_url() -> str:
    res = run_second_pm2("logs maavis-cf-tunnel --lines 80 --nostream")
    if not res["success"]:
        return "Not running / logs unavailable"

    match = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", res["stdout"])
    return match.group(0) if match else "No tunnel URL found in recent logs"

# ────────────────────────────────────────────────
# Bot setup
# ────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True  # if needed for other features

bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    print(f"Main bot logged in as {bot.user} (ID: {bot.user.id})")

    # Sync slash commands (to guild for faster testing, or globally)
    try:
        if GUILD_ID:
            guild = discord.Object(id=GUILD_ID)
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
            print(f"Slash commands synced to guild {GUILD_ID}")
        else:
            await bot.tree.sync()
            print("Slash commands synced globally (may take up to 1 hour)")
    except Exception as e:
        print(f"Error syncing commands: {e}")


# ────────────────────────────────────────────────
# Maavis control commands (only affect second PM2)
# ────────────────────────────────────────────────
@bot.tree.command(name="maavis_status", description="Show status of Maavis website + tunnel + updater")
async def maavis_status(interaction: discord.Interaction):
    await interaction.response.defer()

    res = run_second_pm2("jlist")  # JSON list
    if not res["success"]:
        await interaction.followup.send("❌ Maavis PM2 daemon is not running.")
        return

    try:
        processes = json.loads(res["stdout"])
        embed = discord.Embed(title="Maavis Processes Status", color=discord.Color.blue())

        for proc in processes:
            status = proc.get("pm2_env", {}).get("status", "unknown")
            restarts = proc.get("pm2_env", {}).get("restart_time", 0)
            emoji = "🟢" if status == "online" else "🟡" if status == "stopped" else "🔴"
            embed.add_field(
                name=f"{emoji} {proc['name']}",
                value=f"Status: **{status}** | Restarts: {restarts}",
                inline=False,
            )

        url = get_cf_tunnel_url()
        embed.add_field(name="🌐 Cloudflare Quick Tunnel", value=url, inline=False)
        embed.set_footer(text="Main PM2 (your bots) is NOT affected by these commands.")

        await interaction.followup.send(embed=embed)
    except Exception as e:
        await interaction.followup.send(f"Error parsing status: {str(e)}\nRaw output:\n```{res['stdout']}```")


@bot.tree.command(name="maavis_start", description="Start all Maavis processes")
async def maavis_start(interaction: discord.Interaction):
    await interaction.response.defer()
    res = run_second_pm2(f"start {ECOSYSTEM_FILE}")
    if res["success"]:
        await interaction.followup.send("✅ Maavis processes started (or already running)")
    else:
        await interaction.followup.send(f"❌ Failed to start: {res['stderr'] or 'Unknown error'}")


@bot.tree.command(name="maavis_stop", description="Stop all Maavis processes")
async def maavis_stop(interaction: discord.Interaction):
    await interaction.response.defer()
    res = run_second_pm2("stop maavis-website maavis-cf-tunnel maavis-updater")
    if res["success"]:
        await interaction.followup.send("🛑 Stopped all Maavis processes")
    else:
        await interaction.followup.send(f"❌ Failed: {res['stderr'] or 'Unknown error'}")


@bot.tree.command(name="maavis_restart", description="Restart all Maavis processes")
async def maavis_restart(interaction: discord.Interaction):
    await interaction.response.defer()
    res = run_second_pm2("restart maavis-website maavis-cf-tunnel maavis-updater")
    if res["success"]:
        await interaction.followup.send("🔄 Restarted all Maavis processes")
    else:
        await interaction.followup.send(f"❌ Failed: {res['stderr'] or 'Unknown error'}")


# Add your other existing commands / events here (don't remove them!)
# For example: @bot.tree.command(name="something_else") ...

if __name__ == "__main__":
    if not TOKEN:
        print("Error: No TOKEN found in .env")
    else:
        bot.run(TOKEN)
