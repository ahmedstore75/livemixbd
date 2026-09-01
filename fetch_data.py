import json
import requests

# ১. তোফি ক্যাটাগরি ও লাইভ চ্যানেল ডাটা এপিআই (Toffee API Response Dynamic Format)
TOFFEE_API_URL = "https://toffeelive.com/api/v1/channels" # অথবা আপনার সংগৃহীত সরাসরি চ্যানেল কন্টেন্ট API

# টেস্ট ফালব্যাক চ্যানেল লিস্ট (যদি এপিআই সরাসরি ব্লক করে তবে এগুলো প্রসেস হবে)
channels_data = [
    {
        "id": "fifa_world_cup_576",
        "name": "FIFA World Cup Live",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/fifa_world_cup_576/fifa_world_cup_576.m3u8"
    },
    {
        "id": "toffee_sports_1",
        "name": "Toffee Sports 1",
        "group": "Toffee Sports",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://bldcmprod-cdn.toffeelive.com/live/fifa_world_cup_576/fifa_world_cup_576.m3u8"
    }
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://toffeelive.com/",
    "Origin": "https://toffeelive.com"
}

# ২. API থেকে সরাসরি আপডেট চ্যানেল ডাটা নেওয়ার চেষ্টা
try:
    response = requests.get(TOFFEE_API_URL, headers=headers, timeout=10)
    if response.status_code == 200:
        api_json = response.json()
        # API থেকে রিটার্ন হওয়া চ্যানেল ফরম্যাট অনুযায়ী লিস্ট আপডেট করা
        if "data" in api_json:
            fetched_channels = []
            for item in api_json["data"]:
                fetched_channels.append({
                    "id": str(item.get("id", "")),
                    "name": item.get("title", "Toffee Channel"),
                    "group": "Toffee Live",
                    "logo": item.get("logo", "https://toffeelive.com/images/icons/signin-prompt.svg"),
                    "url": item.get("stream_url", "")
                })
            if fetched_channels:
                channels_data = fetched_channels
except Exception as e:
    print(f"API Fetch error, using cached links: {e}")

# --- ৩. toffee.m3u ফাইল জেনারেট করা ---
m3u_lines = ['#EXTM3U name="Toffee Live"']
for ch in channels_data:
    m3u_lines.append(f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{ch["name"]}" tvg-logo="{ch["logo"]}" group-title="{ch["group"]}",{ch["name"]}')
    m3u_lines.append(ch["url"])

m3u_content = "\n".join(m3u_lines)

with open("toffee.m3u", "w", encoding="utf-8") as f:
    f.write(m3u_content)

print("toffee.m3u তৈরি সফল হয়েছে!")

# --- ৪. toffee.json ফাইল জেনারেট করা (JSON Array Format) ---
toffee_json_output = {
    "playlist_name": "Toffee",
    "total_channels": len(channels_data),
    "channels": channels_data
}

with open("toffee.json", "w", encoding="utf-8") as f:
    json.dump(toffee_json_output, f, indent=4, ensure_ascii=False)

print("toffee.json তৈরি সফল হয়েছে!")
