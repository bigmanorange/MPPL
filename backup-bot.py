import discord
from discord.ext import commands
import subprocess
from dotenv import load_dotenv
import os

load_dotenv()  # loads .env

# backup-bot.py
TOKEN = os.getenv("BACKUP_TOKEN")

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    await bot.tree.sync()
    print("Backup bot online")

@bot.tree.command(name="fix", description="Restart main bot")
async def fix(interaction: discord.Interaction):

    subprocess.run(["pm2", "restart", "maavis-main"])

    await interaction.response.send_message(
        "🛟 Attempted to restart main bot."
    )

@bot.tree.command(name="status", description="Check main bot status")
async def status(interaction: discord.Interaction):

    result = subprocess.run(
        ["pm2", "list"],
        capture_output=True,
        text=True
    )

    if "maavis-main" in result.stdout and "online" in result.stdout:
        await interaction.response.send_message("✅ Main bot is online")
    else:
        await interaction.response.send_message("❌ Main bot is offline")

bot.run(TOKEN)
