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
BASE_CDN = "https://bldcmprod-cdn.toffeelive.com/cdn/live"
DEFAULT_LOGO = "https://toffeelive.com/images/icons/signin-prompt.svg"

all_channels = []

# ২. এপিআই থেকে সরাসরি ডাটা এবং কুকি স্ক্র্যাপ করা
try:
    session = requests.Session()
    response = session.get(API_ENDPOINT, headers=HEADERS, timeout=12)
    
    # এপিআই রেসপন্স থেকে এজ কুকি এক্সট্র্যাক্ট করা
    extracted_cookies = session.cookies.get_dict()
    cookie_str = "; ".join([f"{k}={v}" for k, v in extracted_cookies.items()])
    
    # যদি সার্ভার থেকে কুকি না আসে, তবে এজ-ক্যাশে ফরমেট কুকি জেনারেট করা
    if not cookie_str:
        cookie_str = "Edge-Cache-Cookie=URLPrefix=aHR0cHM6Ly9ibGRjbXByb2QtY2RuLnRvZmZlZWxpdmUuY29t; Expires=1788598874; KeyName=edge-cache-key"

    if response.status_code == 200:
        res_data = response.json()
        raw_list = res_data.get("data", []) or res_data.get("channels", [])
        
        for ch in raw_list:
            slug = str(ch.get("slug") or ch.get("id") or "").strip().lower().replace(" ", "_")
            if not slug:
                continue

            ch_name = ch.get("name") or ch.get("title") or "Toffee Channel"
            ch_group = ch.get("category_name") or ch.get("category") or "Toffee Live"
            
            logo = ch.get("logo") or ch.get("image_url") or ch.get("poster") or DEFAULT_LOGO
            if logo and logo.startswith("/"):
                logo = f"https://toffeelive.com{logo}"

            formatted_m3u8 = f"{BASE_CDN}/{slug}/playlist.m3u8"

            all_channels.append({
                "id": slug,
                "name": ch_name,
                "group": ch_group,
                "logo": logo,
                "url": formatted_m3u8,
                "user_agent": "okhttp/3.1.0",
                "cookie": cookie_str
            })
            
except Exception as e:
    print(f"Fetch Error: {e}")

# ব্যাকআপ ফালব্যাক লিস্ট (যদি API রেসপন্স না দেয়)
if not all_channels:
    fallback_slugs = [
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
    for slug, name, grp in fallback_slugs:
        all_channels.append({
            "id": slug,
            "name": name,
            "group": grp,
            "logo": DEFAULT_LOGO,
            "url": f"{BASE_CDN}/{slug}/playlist.m3u8",
            "user_agent": "okhttp/3.1.0",
            "cookie": default_cookie
        })

# ৩. গ্রুপ অনুসারে সাজানো
all_channels = sorted(all_channels, key=lambda x: x["group"])

# ৪. toffee.m3u ফাইল তৈরি
m3u_lines = []
for ch in all_channels:
    m3u_lines.append(f'#EXTINF:-1 group-title="{ch["group"]}" tvg-logo="{ch["logo"]}",{ch["name"]}')
    m3u_lines.append(f'#EXTVLCOPT:http-user-agent={ch["user_agent"]}')
    if ch.get("cookie"):
        m3u_lines.append(f'#EXTHTTP:{{"cookie":"{ch["cookie"]}"}}')
    m3u_lines.append(ch["url"])

with open("toffee.m3u", "w", encoding="utf-8") as f:
    f.write("\n".join(m3u_lines))

# ৫. toffee.json ফাইল তৈরি
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

print(f"Successfully generated {len(all_channels)} channels with Cookie headers.")
