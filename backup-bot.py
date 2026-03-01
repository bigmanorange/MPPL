import discord
from discord.ext import commands
import subprocess
from dotenv import load_dotenv
import os
from discord import app_commands

load_dotenv()

TOKEN = os.getenv("BACKUP_TOKEN")

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

# Sync commands once on startup
@bot.event
async def on_ready():
    try:
        await bot.tree.sync()
        print("Backup bot online and commands synced!")
    except Exception as e:
        print(f"Error syncing commands: {e}")

# Restart main bot
@bot.tree.command(name="fix", description="Restart main bot")
async def fix(interaction: discord.Interaction):
    process_name = "main-bot"  # Make sure this matches PM2 exactly
    subprocess.run(["pm2", "restart", process_name])
    await interaction.response.send_message(f"🛟 Attempted to restart `{process_name}`.")

# Check main bot status
@bot.tree.command(name="status", description="Check main bot status")
async def status(interaction: discord.Interaction):
    result = subprocess.run(["pm2", "list"], capture_output=True, text=True)
    if "main-bot" in result.stdout and "online" in result.stdout:
        await interaction.response.send_message("✅ Main bot is online")
    else:
        await interaction.response.send_message("❌ Main bot is offline")

bot.run(TOKEN)
