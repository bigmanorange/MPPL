# backup-bot.py
# Backup Discord bot – ONLY controls the main/default PM2 (your bots)
# Does NOT touch the second PM2 for website/tunnel/updater

import discord
from discord import app_commands
from discord.ext import commands
import subprocess
import json
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("BACKUP_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))          # optional: for guild sync
OWNER_ID = int(os.getenv("DISCORD_OWNER_ID", "0"))          # restrict to this user

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


def is_owner(interaction: discord.Interaction) -> bool:
    """Return True when the interaction user is allowed to run backup-bot commands."""
    if OWNER_ID == 0:
        return True
    return interaction.user.id == OWNER_ID


@bot.event
async def on_ready():
    """Sync backup-bot slash commands and log connection details at startup."""
    print(f"Backup bot online: {bot.user} (ID: {bot.user.id})")

    try:
        if GUILD_ID:
            guild = discord.Object(id=GUILD_ID)
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
            print(f"Commands synced to guild {GUILD_ID}")
        else:
            await bot.tree.sync()
            print("Global sync done (may take up to 1h)")
    except Exception as e:
        print(f"Sync error: {e}")


@bot.tree.command(name="fix", description="Restart the main bot")
async def fix(interaction: discord.Interaction):
    """Restart the primary main-bot PM2 process after permission validation."""
    if not is_owner(interaction):
        await interaction.response.send_message("You don't have permission.", ephemeral=True)
        return

    await interaction.response.defer()

    process_name = "main-bot"  # Must match your PM2 name for the main bot

    try:
        result = subprocess.run(
            ["pm2", "restart", process_name],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0:
            await interaction.followup.send(f"✅ Restarted `{process_name}` successfully.")
        else:
            await interaction.followup.send(f"❌ Failed to restart: {result.stderr.strip() or 'Unknown error'}")
    except Exception as e:
        await interaction.followup.send(f"Error during restart: {str(e)}")


@bot.tree.command(name="status", description="Check if the main bot is online")
async def status(interaction: discord.Interaction):
    """Check PM2 for the main bot process and report its runtime status."""
    if not is_owner(interaction):
        await interaction.response.send_message("You don't have permission.", ephemeral=True)
        return

    await interaction.response.defer()

    try:
        result = subprocess.run(
            ["pm2", "jlist"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            await interaction.followup.send(f"❌ PM2 error: {result.stderr.strip()}")
            return

        processes = json.loads(result.stdout)
        main_bot = next((p for p in processes if p.get("name") == "main-bot"), None)

        if main_bot:
            status = main_bot["pm2_env"]["status"]
            emoji = "🟢" if status == "online" else "🔴"
            restarts = main_bot["pm2_env"].get("restart_time", 0)
            msg = f"{emoji} Main bot is **{status}** (restarts: {restarts})"
        else:
            msg = "Main bot process not found in PM2 list"

        await interaction.followup.send(msg)
    except json.JSONDecodeError:
        await interaction.followup.send("Error parsing PM2 output.")
    except Exception as e:
        await interaction.followup.send(f"Error checking status: {str(e)}")


if __name__ == "__main__":
    if not TOKEN:
        print("ERROR: No BACKUP_TOKEN in .env")
    else:
        bot.run(TOKEN)
