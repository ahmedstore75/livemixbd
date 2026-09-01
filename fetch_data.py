import json
import uuid
import requests

# ১. তোফি সেশন ও টোকেন হেডারস সেটআপ
SESSION_ID = str(uuid.uuid4())
DEVICE_ID = str(uuid.uuid4())[:16]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    "Referer": "https://toffeelive.com/",
    "Origin": "https://toffeelive.com",
    "X-Session-Id": SESSION_ID,
    "X-Device-Id": DEVICE_ID,
    "Accept": "application/json, text/plain, */*"
}

API_ENDPOINT = "https://toffeelive.com/api/v1/channels"
DEFAULT_LOGO = "https://toffeelive.com/images/icons/signin-prompt.svg"

all_channels = []

try:
    session = requests.Session()
    response = session.get(API_ENDPOINT, headers=HEADERS, timeout=12)
    
    if response.status_code == 200:
        res_data = response.json()
        raw_list = res_data.get("data", []) or res_data.get("channels", [])
        
        for ch in raw_list:
            ch_id = str(ch.get("id", ""))
            ch_name = ch.get("name") or ch.get("title") or "Toffee Channel"
            
            # গ্রুপ / ক্যাটাগরি নির্ধারণ
            ch_group = ch.get("category_name") or ch.get("category") or "Toffee Live"
            
            # অরিজিনাল লোগো লিঙ্ক ফিক্স করা
            logo = ch.get("logo") or ch.get("image_url") or ch.get("poster") or DEFAULT_LOGO
            if logo and logo.startswith("/"):
                logo = f"https://toffeelive.com{logo}"

            # স্ট্রিম / প্লেয়ার লিঙ্ক
            stream_url = ch.get("stream_url") or ch.get("link")
            if not stream_url:
                slug = ch.get("slug") or ch_id
                stream_url = f"https://toffeelive.com/en/watch/{slug}"

            all_channels.append({
                "id": ch_id,
                "name": ch_name,
                "group": ch_group,
                "logo": logo,
                "url": stream_url
            })
            
except Exception as e:
    print(f"Fetch Error: {e}")

# ব্যাকআপ গ্রুপ ডাটা (যদি এপিআই কল গিটহাব সার্ভার থেকে ব্লক হয়)
if not all_channels:
    all_channels = [
        {"id": "fifa_world_cup_576", "name": "FIFA World Cup", "group": "Sports", "logo": DEFAULT_LOGO, "url": "https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/fifa_world_cup_576/fifa_world_cup_576.m3u8"},
        {"id": "somoy_tv", "name": "Somoy TV", "group": "News", "logo": DEFAULT_LOGO, "url": "https://toffeelive.com/en/watch/somoy_tv"},
        {"id": "jamuna_tv", "name": "Jamuna TV", "group": "News", "logo": DEFAULT_LOGO, "url": "https://toffeelive.com/en/watch/jamuna_tv"},
        {"id": "rtv", "name": "RTV", "group": "Entertainment", "logo": DEFAULT_LOGO, "url": "https://toffeelive.com/en/watch/rtv"}
    ]

# --- ২. গ্রুপ অনুযায়ী ক্রমানুসারে সাজানো (Sort by Group) ---
all_channels = sorted(all_channels, key=lambda x: x["group"])

# --- ৩. toffee.m3u ফাইল তৈরি (Group Title সহ) ---
m3u_lines = ['#EXTM3U name="Toffee Playlist"']
for ch in all_channels:
    m3u_lines.append(f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{ch["name"]}" tvg-logo="{ch["logo"]}" group-title="{ch["group"]}",{ch["name"]}')
    m3u_lines.append(ch["url"])

with open("toffee.m3u", "w", encoding="utf-8") as f:
    f.write("\n".join(m3u_lines))

# --- ৪. toffee.json তৈরি (Grouped JSON Structure) ---
# গ্রুপ অনুযায়ী আলাদা করে JSON তৈরি
grouped_data = {}
for ch in all_channels:
    grp = ch["group"]
    if grp not in grouped_data:
        grouped_data[grp] = []
    grouped_data[grp].append(ch)

json_output = {
    "playlist_name": "Toffee",
    "total_channels": len(all_channels),
    "total_groups": len(grouped_data),
    "groups": grouped_data,
    "all_channels": all_channels
}

with open("toffee.json", "w", encoding="utf-8") as f:
    json.dump(json_output, f, indent=4, ensure_ascii=False)

print(f"Data saved successfully! Total Channels: {len(all_channels)}, Groups: {len(grouped_data)}")
