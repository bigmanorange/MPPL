import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv
import os

load_dotenv()  # Load environment variables from .env

# Replace your previous TOKEN line with:
TOKEN = os.getenv("DISCORD_TOKEN")  # main-bot.py

CLOUDFLARE_LOG = "/Users/macbookpro/.pm2/logs/cf-tunnel-out.log"

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"Logged in as {bot.user}")
    print("Slash commands synced")

@bot.tree.command(name="tunnel", description="Show Cloudflare Tunnel URL")
async def tunnel(interaction: discord.Interaction):

    try:
        with open(CLOUDFLARE_LOG, "r") as f:
            lines = f.readlines()

        url = None
        for line in reversed(lines):
            if "trycloudflare.com" in line:
                for word in line.split():
                    if word.startswith("https://") and "trycloudflare.com" in word:
                        url = word
                        break
            if url:
                break

        if url:
            await interaction.response.send_message(
                f"🌐 **Tunnel URL:**\n{url}"
            )
        else:
            await interaction.response.send_message(
                "❌ No tunnel URL found in logs."
            )

    except Exception as e:
        await interaction.response.send_message(
            f"⚠️ Error reading tunnel log:\n`{e}`"
        )

bot.run(TOKEN)
