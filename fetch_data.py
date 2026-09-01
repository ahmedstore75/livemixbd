import json
import requests

# ১. স্ট্রিম ডাটাসমূহ (প্রয়োজন অনুযায়ী আরও চ্যানেল যুক্ত করতে পারেন)
channels = [
    {
        "id": "Toffee_FIFA_576",
        "name": "FIFA World Cup 576p",
        "group": "Sports",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/fifa_world_cup_576/fifa_world_cup_576.m3u8"
    }
]

# --- ২. M3U প্লেলিস্ট তৈরি ও সেভ করা ---
m3u_lines = ["#EXTM3U"]
for ch in channels:
    m3u_lines.append(f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{ch["name"]}" tvg-logo="{ch["logo"]}" group-title="{ch["group"]}",{ch["name"]}')
    m3u_lines.append(ch["url"])

m3u_content = "\n".join(m3u_lines)

with open("playlist.m3u", "w", encoding="utf-8") as f:
    f.write(m3u_content)

print("playlist.m3u তৈরি হয়েছে!")

# --- ৩. JSON Array প্লেলিস্ট তৈরি ও সেভ করা ---
with open("playlist.json", "w", encoding="utf-8") as f:
    json.dump(channels, f, indent=4, ensure_ascii=False)

print("playlist.json তৈরি হয়েছে!")
