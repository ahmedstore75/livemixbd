import json

# আপনার সংগৃহীত নেটওয়ার্ক লগ থেকে সংগৃহীত টফির সবগুলো লাইভ চ্যানেল
channels_data = [
    {
        "id": "fifa_world_cup_576",
        "name": "FIFA World Cup Live",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/fifa_world_cup_576/fifa_world_cup_576.m3u8"
    },
    {
        "id": "T9O9X5UBm1RY_In7UXFv",
        "name": "Toffee Live Channel 1",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/T9O9X5UBm1RY_In7UXFv"
    },
    {
        "id": "WtPBX5UBm1RY_In7mXEU",
        "name": "Toffee Live Channel 2",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/WtPBX5UBm1RY_In7mXEU"
    },
    {
        "id": "Ii5_-JQBv9knK3AHLDV3",
        "name": "Toffee Live Channel 3",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/Ii5_-JQBv9knK3AHLDV3"
    },
    {
        "id": "-C7MX5UBv9knK3AHdKOi",
        "name": "Toffee Live Channel 4",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/-C7MX5UBv9knK3AHdKOi"
    },
    {
        "id": "ny6W-JQBv9knK3AHujXC",
        "name": "Toffee Live Channel 5",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/ny6W-JQBv9knK3AHujXC"
    },
    {
        "id": "mC6W-JQBv9knK3AHfDWA",
        "name": "Toffee Live Channel 6",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/mC6W-JQBv9knK3AHfDWA"
    },
    {
        "id": "1y6e-JQBv9knK3AHNDWb",
        "name": "Toffee Live Channel 7",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/1y6e-JQBv9knK3AHNDWb"
    },
    {
        "id": "ay7uX5UBv9knK3AHs6TI",
        "name": "Toffee Live Channel 8",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/ay7uX5UBv9knK3AHs6TI"
    },
    {
        "id": "Ay6s-JQBv9knK3AHJTY1",
        "name": "Toffee Live Channel 9",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/Ay6s-JQBv9knK3AHJTY1"
    },
    {
        "id": "IC5_-JQBv9knK3AHFDXh",
        "name": "Toffee Live Channel 10",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/IC5_-JQBv9knK3AHFDXh"
    },
    {
        "id": "py5j-JQBv9knK3AHxDTY",
        "name": "Toffee Live Channel 11",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/py5j-JQBv9knK3AHxDTY"
    },
    {
        "id": "vi5n-JQBv9knK3AHqzTC",
        "name": "Toffee Live Channel 12",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/vi5n-JQBv9knK3AHqzTC"
    },
    {
        "id": "sy5m-JQBv9knK3AHYTTk",
        "name": "Toffee Live Channel 13",
        "group": "Toffee Live",
        "logo": "https://toffeelive.com/images/icons/signin-prompt.svg",
        "url": "https://toffeelive.com/en/watch/sy5m-JQBv9knK3AHYTTk"
    }
]

# --- ১. toffee.m3u ফাইল জেনারেট করা ---
m3u_lines = ['#EXTM3U name="Toffee"']
for ch in channels_data:
    m3u_lines.append(f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{ch["name"]}" tvg-logo="{ch["logo"]}" group-title="{ch["group"]}",{ch["name"]}')
    m3u_lines.append(ch["url"])

m3u_content = "\n".join(m3u_lines)

with open("toffee.m3u", "w", encoding="utf-8") as f:
    f.write(m3u_content)

print("toffee.m3u তৈরি সফল হয়েছে!")

# --- ২. toffee.json ফাইল জেনারেট করা (JSON Format) ---
toffee_json_output = {
    "playlist_name": "Toffee",
    "total_channels": len(channels_data),
    "channels": channels_data
}

with open("toffee.json", "w", encoding="utf-8") as f:
    json.dump(toffee_json_output, f, indent=4, ensure_ascii=False)

print("toffee.json তৈরি সফল হয়েছে!")
