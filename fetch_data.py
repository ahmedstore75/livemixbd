import json
import uuid
import requests

# ১. তোফি টোকেন ও হেডার সেটিংস
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
BASE_CDN = "https://bldcmprod-cdn.toffeelive.com/cdn/live/slang"
DEFAULT_LOGO = "https://toffeelive.com/images/icons/signin-prompt.svg"

all_channels = []

# ২. সার্ভার থেকে ডাটা স্ক্র্যাপ ও লিঙ্ক ফরম্যাটিং
try:
    session = requests.Session()
    response = session.get(API_ENDPOINT, headers=HEADERS, timeout=12)
    
    if response.status_code == 200:
        res_data = response.json()
        raw_list = res_data.get("data", []) or res_data.get("channels", [])
        
        for ch in raw_list:
            slug = str(ch.get("slug") or ch.get("id") or "").strip().lower().replace(" ", "_")
            if not slug:
                continue

            ch_name = ch.get("name") or ch.get("title") or "Toffee Channel"
            ch_group = ch.get("category_name") or ch.get("category") or "Toffee Live"
            
            # লোগো ফিক্স
            logo = ch.get("logo") or ch.get("image_url") or ch.get("poster") or DEFAULT_LOGO
            if logo and logo.startswith("/"):
                logo = f"https://toffeelive.com{logo}"

            # আপনার দেওয়া নির্দিষ্ট CDN লিংক ফরম্যাট
            formatted_m3u8 = f"{BASE_CDN}/{slug}/{slug}.m3u8"

            all_channels.append({
                "id": slug,
                "name": ch_name,
                "group": ch_group,
                "logo": logo,
                "url": formatted_m3u8
            })
            
except Exception as e:
    print(f"Fetch Error: {e}")

# ব্যাকআপ ফালব্যাক লিস্ট (যদি গিটহাব থেকে ব্যাকএন্ড এপিআই ব্লক হয়)
if not all_channels:
    fallback_slugs = [
        ("fifa_world_cup_576", "FIFA World Cup Live", "Sports"),
        ("somoy_tv", "Somoy TV", "News"),
        ("jamuna_tv", "Jamuna TV", "News"),
        ("independent_tv", "Independent TV", "News"),
        ("channel24", "Channel 24", "News"),
        ("ekhon_tv", "Ekhon TV", "News"),
        ("dbc_news", "DBC News", "News"),
        ("ekattor_tv", "Ekattor TV", "News"),
        ("rtv", "RTV", "Entertainment"),
        ("ntv", "NTV", "Entertainment"),
        ("channel_i", "Channel i", "Entertainment"),
        ("atn_bangla", "ATN Bangla", "Entertainment"),
        ("boishakhi_tv", "Boishakhi TV", "Entertainment"),
        ("deepto_tv", "Deepto TV", "Entertainment"),
        ("nagorik_tv", "Nagorik TV", "Entertainment"),
        ("gazi_tv", "Gazi TV (GTV)", "Entertainment"),
        ("duronto_tv", "Duronto TV", "Kids")
    ]
    for slug, name, grp in fallback_slugs:
        all_channels.append({
            "id": slug,
            "name": name,
            "group": grp,
            "logo": DEFAULT_LOGO,
            "url": f"{BASE_CDN}/{slug}/{slug}.m3u8"
        })

# ৩. গ্রুপ অনুসারে ক্রমানুসারে সাজানো
all_channels = sorted(all_channels, key=lambda x: x["group"])

# --- ৪. toffee.m3u তৈরি ---
m3u_lines = ['#EXTM3U name="Toffee Playlist"']
for ch in all_channels:
    m3u_lines.append(f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{ch["name"]}" tvg-logo="{ch["logo"]}" group-title="{ch["group"]}",{ch["name"]}')
    m3u_lines.append(ch["url"])

with open("toffee.m3u", "w", encoding="utf-8") as f:
    f.write("\n".join(m3u_lines))

# --- ৫. toffee.json তৈরি (Grouped Structure) ---
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

print(f"Generated {len(all_channels)} channels with the specified CDN URL format.")
