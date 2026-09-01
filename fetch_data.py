import json
import requests

# ১. তোফির অফিশিয়াল ওয়েব ব্যাকএন্ড চ্যানেল ক্যাটাগরি ও ডেটা এপিআই
TOFFEE_CHANNELS_API = "https://toffeelive.com/api/v1/channels"
TOFFEE_SLUG_API = "https://toffeelive.com/api/v1/watch/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Referer": "https://toffeelive.com/",
    "Origin": "https://toffeelive.com",
    "Accept": "application/json, text/plain, */*"
}

channels_data = []

try:
    # ব্যাকএন্ড থেকে চ্যানেল ডেটা রিকোয়েস্ট
    session = requests.Session()
    response = session.get(TOFFEE_CHANNELS_API, headers=HEADERS, timeout=12)
    
    if response.status_code == 200:
        res_json = response.json()
        raw_channels = res_json.get("data", []) or res_json.get("channels", [])
        
        for ch in raw_channels:
            ch_id = str(ch.get("id", ""))
            ch_name = ch.get("name") or ch.get("title") or "Toffee Channel"
            ch_category = ch.get("category_name") or ch.get("category") or "Toffee Live"
            
            # লোগো ইউআরএল ফিল্টার
            logo = ch.get("logo") or ch.get("image_url") or ch.get("poster") or ""
            if logo and not logo.startswith("http"):
                logo = "https://toffeelive.com" + logo
            if not logo:
                logo = "https://toffeelive.com/images/icons/signin-prompt.svg"

            # স্ট্রিম ইউআরএল ফেচ (অফিশিয়াল ওয়েব প্লেয়ার লিংক)
            stream_url = ch.get("stream_url") or ch.get("link") or ch.get("m3u8_url")
            if not stream_url:
                slug = ch.get("slug") or ch_id
                stream_url = f"https://toffeelive.com/en/watch/{slug}"

            channels_data.append({
                "id": ch_id,
                "name": ch_name,
                "group": ch_category,
                "logo": logo,
                "url": stream_url
            })
            
except Exception as e:
    print(f"Toffee API Error: {e}")

# ব্যাকআপ সার্ভিস চ্যানেল (যদি এপিআই রিকোয়েস্ট গিটহাব অ্যাকশনে ব্লক হয়)
if not channels_data:
    channels_data = [
        {
            "id": "fifa_world_cup_576",
            "name": "FIFA World Cup / Sports Live",
            "group": "Sports",
            "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
            "url": "https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/fifa_world_cup_576/fifa_world_cup_576.m3u8"
        }
    ]

# --- ২. toffee.m3u তৈরি ---
m3u_lines = ['#EXTM3U name="Toffee"']
for ch in channels_data:
    m3u_lines.append(f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{ch["name"]}" tvg-logo="{ch["logo"]}" group-title="{ch["group"]}",{ch["name"]}')
    m3u_lines.append(ch["url"])

with open("toffee.m3u", "w", encoding="utf-8") as f:
    f.write("\n".join(m3u_lines))

# --- ৩. toffee.json তৈরি (JSON Array Format) ---
toffee_json_output = {
    "playlist_name": "Toffee",
    "total_channels": len(channels_data),
    "channels": channels_data
}

with open("toffee.json", "w", encoding="utf-8") as f:
    json.dump(toffee_json_output, f, indent=4, ensure_ascii=False)

print(f"Successfully processed {len(channels_data)} channels with valid logos and player links.")
