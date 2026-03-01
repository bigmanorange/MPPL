# main-bot.py - Main Discord bot for MAAVIS TALENT HUB
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

load_dotenv()

# ────────────────────────────────────────────────
# Config from .env
# ────────────────────────────────────────────────
TOKEN = os.getenv("DISCORD_TOKEN_MAIN") or os.getenv("TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
OWNER_ID = int(os.getenv("DISCORD_OWNER_ID", "0"))

# PM2 second instance
SECOND_PM2_HOME = os.getenv("SECOND_PM2_HOME", str(Path.home() / ".pm2-maavis"))
PM2_SECOND_CMD = f'PM2_HOME={SECOND_PM2_HOME} pm2'

# Project paths (env override optional)
REPO_ROOT = os.getenv("PROJECT_DIR", Path(__file__).resolve().parents[2])  # two levels up
ECOSYSTEM_FILE = os.getenv(
    "ECOSYSTEM_FILE",
    Path(REPO_ROOT) / "server" / "app" / "ecosystem-maavis.config.cjs"
)
AUTO_UPDATE_SCRIPT = os.getenv(
    "AUTO_UPDATE_SCRIPT",
    Path(os.getenv("AUTO_UPDATE_SCRIPT", "./server/app/auto-update.sh"))
)
# Ensure we are in the project root
os.chdir(REPO_ROOT)

# ────────────────────────────────────────────────
# Helper: Run PM2 on second instance
# ────────────────────────────────────────────────
def run_second_pm2(args: str, timeout: int = 20) -> Dict[str, Any]:
    try:
        result = subprocess.run(
            f"{PM2_SECOND_CMD} {args}",
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "stdout": "", "stderr": "Timeout"}
    except Exception as e:
        err = str(e).lower()
        if "conn" in err or "refused" in err or "not running" in err:
            print("[Maavis] Second PM2 not running - lazy starting...")
            start_res = run_second_pm2(f"start {ECOSYSTEM_FILE}")
            if start_res["success"]:
                asyncio.sleep(2)
                return run_second_pm2(args)
        return {"success": False, "stdout": "", "stderr": str(e)}

def get_cf_tunnel_url() -> str:
    res = run_second_pm2("logs maavis-cf-tunnel --lines 80 --nostream")
    if not res["success"]:
        return "Tunnel not running"

    match = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", res["stdout"])
    return match.group(0) if match else "No tunnel URL in logs"

# ────────────────────────────────────────────────
# Bot setup
# ────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    print(f"Main bot online: {bot.user} (ID: {bot.user.id})")

    try:
        if GUILD_ID:
            guild = discord.Object(id=GUILD_ID)
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
            print(f"Commands synced to guild {GUILD_ID}")
        else:
            await bot.tree.sync()
            print("Global sync (may take 1h)")
    except Exception as e:
        print(f"Sync error: {e}")


def is_owner(interaction: discord.Interaction) -> bool:
    if OWNER_ID == 0:
        return True
    return interaction.user.id == OWNER_ID


# ────────────────────────────────────────────────
# Maavis commands
# ────────────────────────────────────────────────
@bot.tree.command(name="maavis_status", description="Status of website, tunnel & updater")
async def maavis_status(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()

    res = run_second_pm2("jlist")
    if not res["success"]:
        await interaction.followup.send("❌ Maavis PM2 not running.")
        return

    try:
        processes = json.loads(res["stdout"])
        embed = discord.Embed(title="Maavis Status", color=discord.Color.blue())

        for proc in processes:
            status = proc.get("pm2_env", {}).get("status", "unknown")
            restarts = proc.get("pm2_env", {}).get("restart_time", 0)
            emoji = "🟢" if status == "online" else "🟡" if status in ["stopped", "stopping"] else "🔴"
            embed.add_field(
                name=f"{emoji} {proc['name']}",
                value=f"**{status.capitalize()}** • Restarts: {restarts}",
                inline=False
            )

        url = get_cf_tunnel_url()
        embed.add_field(name="🌐 Cloudflare Tunnel", value=url, inline=False)
        embed.set_footer(text="Main bot PM2 unaffected.")

        await interaction.followup.send(embed=embed)
    except Exception as e:
        await interaction.followup.send(f"Error: {str(e)}\nRaw:\n```{res['stdout'][:1000]}```")


@bot.tree.command(name="maavis_start", description="Start Maavis processes")
async def maavis_start(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()
    if not AUTO_UPDATE_SCRIPT.exists():
        await interaction.followup.send(f"❌ Auto-update script not found: {AUTO_UPDATE_SCRIPT}")
        return

    res = run_second_pm2(f"start {ECOSYSTEM_FILE}")
    msg = "✅ Started" if res["success"] else f"❌ {res['stderr'] or 'Error'}"
    await interaction.followup.send(msg)


@bot.tree.command(name="maavis_stop", description="Stop Maavis processes")
async def maavis_stop(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()
    res = run_second_pm2("stop maavis-website maavis-cf-tunnel maavis-updater")
    msg = "🛑 Stopped" if res["success"] else f"❌ {res['stderr'] or 'Error'}"
    await interaction.followup.send(msg)


@bot.tree.command(name="maavis_restart", description="Restart Maavis processes")
async def maavis_restart(interaction: discord.Interaction):
    if not is_owner(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return

    await interaction.response.defer()
    res = run_second_pm2("restart maavis-website maavis-cf-tunnel maavis-updater")
    msg = "🔄 Restarted" if res["success"] else f"❌ {res['stderr'] or 'Error'}"
    await interaction.followup.send(msg)


if __name__ == "__main__":
    if not TOKEN:
        print("ERROR: No TOKEN in .env")
    else:
        bot.run(TOKEN)
