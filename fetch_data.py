import os
import json
import uuid
import requests

DATA_BACKUP_FILE = "toffee_backup.json"

# ১. ডায়নামিক সেশন ও ডিভাইস আইডি
SESSION_ID = str(uuid.uuid4())
DEVICE_ID = str(uuid.uuid4())[:16]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Referer": "https://toffeelive.com/",
    "Origin": "https://toffeelive.com",
    "X-Session-Id": SESSION_ID,
    "X-Device-Id": DEVICE_ID,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
}

API_ENDPOINT = "https://toffeelive.com/api/v1/channels"
BASE_CDN = "https://bldcmprod-cdn.toffeelive.com/cdn/live"
DEFAULT_LOGO = "https://toffeelive.com/images/icons/signin-prompt.svg"

all_channels = []

# ২. এপিআই থেকে সরাসরি লাইভ ডাটা নেওয়ার চেষ্টা
try:
    session = requests.Session()
    session.headers.update(HEADERS)
    
    session.get("https://toffeelive.com/", timeout=10)
    response = session.get(API_ENDPOINT, timeout=12)
    
    extracted_cookies = session.cookies.get_dict()
    cookie_str = "; ".join([f"{k}={v}" for k, v in extracted_cookies.items()])
    
    if not cookie_str:
        cookie_str = "Edge-Cache-Cookie=URLPrefix=aHR0cHM6Ly9ibGRjbXByb2QtY2RuLnRvZmZlZWxpdmUuY29t; Expires=1788598874; KeyName=edge-cache-key"

    if response.status_code == 200:
        res_data = response.json()
        raw_list = res_data.get("data", []) or res_data.get("channels", []) or res_data.get("results", [])
        
        for ch in raw_list:
            slug = str(ch.get("slug") or ch.get("channel_slug") or ch.get("id") or "").strip().lower().replace(" ", "_")
            if not slug:
                continue

            ch_name = ch.get("name") or ch.get("title") or ch.get("channel_name") or "Toffee Channel"
            ch_group = ch.get("category_name") or ch.get("category") or ch.get("genre") or "Toffee Live"
            
            logo = ch.get("logo") or ch.get("image_url") or ch.get("poster") or ch.get("logo_url") or DEFAULT_LOGO
            if logo and logo.startswith("/"):
                logo = f"https://toffeelive.com{logo}"

            all_channels.append({
                "id": slug,
                "name": ch_name,
                "group": ch_group,
                "logo": logo,
                "url": f"{BASE_CDN}/{slug}/playlist.m3u8",
                "user_agent": "okhttp/3.1.0",
                "cookie": cookie_str
            })
            
except Exception as e:
    print(f"Fetch Error: {e}")

# ৩. অটোমেটিক ব্যাকআপ ফাইল সেভ ও চেক
if all_channels:
    with open(DATA_BACKUP_FILE, "w", encoding="utf-8") as bf:
        json.dump(all_channels, bf, ensure_ascii=False)
else:
    print("API ফেইল করেছে! লোকাল ব্যাকআপ সার্চ করা হচ্ছে...")
    if os.path.exists(DATA_BACKUP_FILE):
        with open(DATA_BACKUP_FILE, "r", encoding="utf-8") as bf:
            all_channels = json.load(bf)

# ৪. এপিআই এবং ব্যাকআপ দুটিই না থাকলে স্বয়ংক্রিয় ডায়নামিক অটো জেনারেটর
if not all_channels:
    print("লোকাল ব্যাকআপও নেই! অটোমেটিক চ্যানেল নাম, লোগো ও লিংক জেনারেট করা হচ্ছে...")
    
    # অটো-জেনারেটর কাস্টম লিস্ট
    channel_database = [
        ("fifa_world_cup", "FIFA World Cup Live", "Sports"),
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
    
    default_cookie = "Edge-Cache-Cookie=URLPrefix=aHR0cHM6Ly9ibGRjbXByb2QtY2RuLnRvZmZlZWxpdmUuY29t; Expires=1788598874; KeyName=edge-cache-key"

    for slug, name, grp in channel_database:
        # স্বয়ংক্রিয়ভাবে ডায়নামিক লোগো ও স্ট্রিম লিংক তৈরি
        generated_url = f"{BASE_CDN}/{slug}/playlist.m3u8"
        generated_logo = f"https://toffeelive.com/images/channels/{slug}.png" # অটো লোগো ইউআরএল স্ট্রাকচার

        all_channels.append({
            "id": slug,
            "name": name,
            "group": grp,
            "logo": generated_logo,
            "url": generated_url,
            "user_agent": "okhttp/3.1.0",
            "cookie": default_cookie
        })

# ৫. গ্রুপ অনুসারে সাজানো
all_channels = sorted(all_channels, key=lambda x: x["group"])

# ৬. toffee.m3u তৈরি
m3u_lines = []
for ch in all_channels:
    m3u_lines.append(f'#EXTINF:-1 group-title="{ch["group"]}" tvg-logo="{ch["logo"]}",{ch["name"]}')
    m3u_lines.append(f'#EXTVLCOPT:http-user-agent={ch["user_agent"]}')
    if ch.get("cookie"):
        m3u_lines.append(f'#EXTHTTP:{{"cookie":"{ch["cookie"]}"}}')
    m3u_lines.append(ch["url"])

with open("toffee.m3u", "w", encoding="utf-8") as f:
    f.write("\n".join(m3u_lines))

# ৭. toffee.json তৈরি
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

print(f"Successfully generated {len(all_channels)} channels.")
